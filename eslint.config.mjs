import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tsEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import boundaries from 'eslint-plugin-boundaries';

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));
const typescriptResolver = createRequire(import.meta.url).resolve(
  'eslint-import-resolver-typescript'
);

const layer = (type, pattern) => ({
  type,
  pattern,
  partialMatch: false,
});

const layerRoots = ['domain', 'app', 'infra', 'interface', 'shared'].map(
  (layerName) => path.join(repositoryRoot, 'src', layerName)
);

const targetsLayerRoot = (filename, specifier) => {
  const target = path.resolve(path.dirname(filename), specifier);

  return layerRoots.some((root) => {
    const relativeTarget = path.relative(root, target);
    return !relativeTarget.startsWith('..') && !path.isAbsolute(relativeTarget);
  });
};

const layerImportPaths = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require layer aliases except for direct sibling imports.',
    },
    messages: {
      useAlias:
        'Use the owning layer alias; relative imports are limited to direct siblings.',
    },
    schema: [],
  },
  create(context) {
    const checkSource = (node) => {
      const specifier = node.source?.value;

      if (typeof specifier !== 'string' || !specifier.startsWith('.')) return;

      const isParent = specifier.startsWith('../');
      const isNestedSibling =
        specifier.startsWith('./') && specifier.slice(2).includes('/');

      if (
        (isParent || isNestedSibling) &&
        targetsLayerRoot(context.filename, specifier)
      ) {
        context.report({ node: node.source, messageId: 'useAlias' });
      }
    };

    return {
      ExportAllDeclaration: checkSource,
      ExportNamedDeclaration: checkSource,
      ImportDeclaration: checkSource,
    };
  },
};

// Structural checks only: recognize awaited lifecycle calls on the owned
// transaction. Their presence does not prove cleanup on every execution path.
const requireTransactionDisposal = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require manual transactions to have explicit success and failure cleanup.',
    },
    messages: {
      declaration:
        'Assign awaited createTransaction() to a single const identifier.',
      cleanup:
        'Follow transaction creation with try/catch containing an unconditional awaited handleError(error) on that transaction, plus an awaited commit() or dispose() in try/finally. A commit with disposal disabled or unverified also requires an awaited dispose().',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const callName = (callee) => {
      if (callee.type === 'Identifier') return callee.name;
      if (callee.type !== 'MemberExpression') return undefined;
      return callee.computed ? callee.property.value : callee.property.name;
    };
    const referencesVariable = (variable, identifier) =>
      variable?.references.some(
        (reference) => reference.identifier === identifier
      );
    const isOwnedCall = (call, method, variable) =>
      call?.type === 'CallExpression' &&
      !call.optional &&
      call.callee.type === 'MemberExpression' &&
      !call.callee.optional &&
      call.callee.object.type === 'Identifier' &&
      callName(call.callee) === method &&
      referencesVariable(variable, call.callee.object);

    const hasAwaitedErrorHandler = (statement, variable) => {
      if (statement?.type !== 'TryStatement') return false;

      const handler = statement.handler;
      const errorVariable =
        handler?.param?.type === 'Identifier'
          ? sourceCode.getDeclaredVariables(handler)[0]
          : undefined;
      for (const step of handler?.body.body ?? []) {
        const expression =
          step.type === 'ReturnStatement' ? step.argument : step.expression;
        const handled =
          expression?.type === 'AwaitExpression'
            ? expression.argument
            : undefined;
        const handlesCaughtError =
          isOwnedCall(handled, 'handleError', variable) &&
          handled.arguments.length === 1 &&
          referencesVariable(errorVariable, handled.arguments[0]);
        if (handlesCaughtError) return true;
        if (['ReturnStatement', 'ThrowStatement'].includes(step.type))
          return false;
      }
      return false;
    };

    // Only statically known disposing options can replace explicit disposal.
    const isDisposingCommit = (commit) => {
      if (commit.arguments.length === 0) return true;
      const options = commit.arguments[0];
      if (
        commit.arguments.length !== 1 ||
        options.type !== 'ObjectExpression'
      ) {
        return false;
      }
      if (options.properties.length === 0) return true;
      const flag = options.properties[0];
      return (
        options.properties.length === 1 &&
        flag.type === 'Property' &&
        flag.kind === 'init' &&
        !flag.computed &&
        (flag.key.name ?? flag.key.value) === 'dispose' &&
        flag.value.type === 'Literal' &&
        flag.value.value === true
      );
    };

    const hasAwaitedCleanup = (statement, variable) => {
      let hasCommit = false;
      let hasDisposal = false;
      let requiresDisposal = false;

      // Branches and loops are allowed. A nested function/class does not run
      // merely because it is declared, and catch-only cleanup is not success cleanup.
      const visit = (node) => {
        if (!node) return;
        const isSeparateScope = [
          'FunctionDeclaration',
          'FunctionExpression',
          'ArrowFunctionExpression',
          'ClassDeclaration',
          'ClassExpression',
          'CatchClause',
        ].includes(node.type);
        if (isSeparateScope) return;

        if (node.type === 'AwaitExpression') {
          const call = node.argument;
          if (isOwnedCall(call, 'commit', variable)) {
            hasCommit = true;
            requiresDisposal ||= !isDisposingCommit(call);
          }
          if (isOwnedCall(call, 'dispose', variable)) {
            const hasSafeArguments =
              call.arguments.length === 0 ||
              (call.arguments.length === 1 &&
                call.arguments[0].type === 'Identifier');
            hasDisposal ||= hasSafeArguments;
          }
        }
        for (const key of sourceCode.visitorKeys[node.type] ?? []) {
          const child = node[key];
          if (Array.isArray(child)) child.forEach(visit);
          else visit(child);
        }
      };
      visit(statement.block);
      visit(statement.finalizer);
      return hasDisposal || (hasCommit && !requiresDisposal);
    };

    return {
      CallExpression(node) {
        if (callName(node.callee) !== 'createTransaction') return;

        const awaited = node.parent;
        const declarator = awaited.parent;
        const declaration = declarator?.parent;
        const isOwnedTransaction =
          awaited.type === 'AwaitExpression' &&
          declarator.type === 'VariableDeclarator' &&
          declarator.init === awaited &&
          declarator.id.type === 'Identifier' &&
          declaration.type === 'VariableDeclaration' &&
          declaration.kind === 'const' &&
          declaration.declarations.length === 1;

        if (!isOwnedTransaction) {
          context.report({ node, messageId: 'declaration' });
          return;
        }

        const statements = declaration.parent.body;
        const next = Array.isArray(statements)
          ? statements[statements.indexOf(declaration) + 1]
          : undefined;
        const variable = sourceCode.getDeclaredVariables(declarator)[0];

        if (
          !hasAwaitedErrorHandler(next, variable) ||
          !hasAwaitedCleanup(next, variable)
        ) {
          context.report({ node, messageId: 'cleanup' });
        }
      },
    };
  },
};

export default [
  {
    ignores: ['coverage/**', 'dist/**', 'generated/**', 'node_modules/**'],
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
      },
    },
    plugins: {
      local: {
        rules: {
          'layer-import-paths': layerImportPaths,
          'require-transaction-disposal': requireTransactionDisposal,
        },
      },
    },
    rules: {
      'local/layer-import-paths': 'error',
      'local/require-transaction-disposal': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: [
      'src/infra/ioc/handlers/http.ts',
      'src/infra/ioc/handlers/mcp.ts',
      'src/infra/ioc/middlewares/http.ts',
      'src/infra/server/index.ts',
      'src/infra/runtime/_bootstrap/**/*.ts',
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsEslint,
      boundaries,
    },
    settings: {
      'import/resolver': {
        [typescriptResolver]: {
          project: path.join(repositoryRoot, 'tsconfig.json'),
        },
      },
      'boundaries/elements': [
        layer('domain', 'src/domain'),
        layer('app', 'src/app'),
        layer('infra', 'src/infra'),
        layer('interface', 'src/interface'),
        layer('shared', 'src/shared'),
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          checkInternals: false,
          policies: [
            {
              from: { element: { types: 'domain' } },
              disallow: {
                element: {
                  types: { anyOf: ['app', 'infra', 'interface'] },
                },
              },
              message:
                'Domain code may only import from src/domain or src/shared.',
            },
            {
              from: { element: { types: 'app' } },
              disallow: {
                element: {
                  types: { anyOf: ['infra', 'interface'] },
                },
              },
              message:
                'App code may only import from src/shared, src/domain, or src/app.',
            },
            {
              from: { element: { types: 'infra' } },
              disallow: {
                element: {
                  types: { anyOf: ['interface'] },
                },
              },
              message:
                'Infra code may only import from src/shared, src/app, src/domain, or src/infra.',
            },
            {
              from: { element: { types: 'shared' } },
              disallow: {
                element: {
                  types: { anyOf: ['domain', 'app', 'infra', 'interface'] },
                },
              },
              message: 'Shared code may only import from src/shared.',
            },
          ],
        },
      ],
    },
  },
];
