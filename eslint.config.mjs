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

// Deliberately syntax-based: recognize createTransaction by name and require
// auditable ownership patterns rather than attempting general resource analysis.
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
        'Immediately follow transaction creation with finally disposal, or an unconditional awaited disposing commit() and catch returning handleError(error). Use finally for branching before commit or commit({ dispose: false }).',
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

    const hasDisposingCommitAndHandler = (statement, variable) => {
      if (statement?.type !== 'TryStatement') return false;

      const handler = statement.handler;
      const returned = handler?.body.body[0];
      const handled =
        returned?.argument?.type === 'AwaitExpression'
          ? returned.argument.argument
          : returned?.argument;
      const errorVariable =
        handler?.param?.type === 'Identifier'
          ? sourceCode.getDeclaredVariables(handler)[0]
          : undefined;
      const handlesCaughtError =
        handler?.body.body.length === 1 &&
        returned?.type === 'ReturnStatement' &&
        isOwnedCall(handled, 'handleError', variable) &&
        handled.arguments.length === 1 &&
        referencesVariable(errorVariable, handled.arguments[0]);
      if (!handlesCaughtError) return false;

      // A linear prefix cannot return/break/continue around the disposing commit.
      // Keep finally disposal for more complex control flow instead of guessing.
      for (const step of statement.block.body) {
        if (
          !['VariableDeclaration', 'ExpressionStatement'].includes(step.type)
        ) {
          return false;
        }
        const commit =
          step.expression?.type === 'AwaitExpression'
            ? step.expression.argument
            : undefined;
        if (!isOwnedCall(commit, 'commit', variable)) continue;

        if (commit.arguments.length === 0) return true;

        const options = commit.arguments[0];
        if (
          commit.arguments.length !== 1 ||
          options.type !== 'ObjectExpression'
        ) {
          return false;
        }
        if (options.properties.length === 0) return true;

        const flag = options?.properties?.[0];
        return (
          options.properties.length === 1 &&
          flag.type === 'Property' &&
          flag.kind === 'init' &&
          !flag.computed &&
          (flag.key.name ?? flag.key.value) === 'dispose' &&
          flag.value.type === 'Literal' &&
          flag.value.value === true
        );
      }
      return false;
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
        const cleanup =
          next?.type === 'TryStatement' ? next.finalizer?.body[0] : undefined;
        const disposal = cleanup?.expression?.argument;
        const isAwaitedDisposal =
          cleanup?.type === 'ExpressionStatement' &&
          cleanup.expression.type === 'AwaitExpression' &&
          disposal?.type === 'CallExpression' &&
          !disposal.optional &&
          disposal.callee.type === 'MemberExpression' &&
          !disposal.callee.optional &&
          disposal.callee.object.type === 'Identifier' &&
          callName(disposal.callee) === 'dispose';

        // A computed argument could throw before dispose is called. Allow only
        // no argument or the caller's already-captured operation error.
        const hasSafeArguments =
          isAwaitedDisposal &&
          (disposal.arguments.length === 0 ||
            (disposal.arguments.length === 1 &&
              disposal.arguments[0].type === 'Identifier'));
        const variable = sourceCode.getDeclaredVariables(declarator)[0];
        const disposesOwnedTransaction =
          hasSafeArguments &&
          variable.references.some(
            (reference) => reference.identifier === disposal.callee.object
          );

        if (
          !disposesOwnedTransaction &&
          !hasDisposingCommitAndHandler(next, variable)
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
