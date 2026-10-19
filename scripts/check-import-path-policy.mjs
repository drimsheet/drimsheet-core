import assert from 'node:assert/strict';

import { ESLint } from 'eslint';

const eslint = new ESLint();
const importPathRule = 'local/layer-import-paths';

const lint = async (code, filePath) => {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages;
};

const allowed = await lint(
  [
    "import './sibling';",
    "import '@domain/accounting/types/accounting-entity.types';",
    "import '@app/auth/errors/auth.error';",
    "import '@infra/runtime/servers/express';",
    "import '@interface/http';",
    "import '@shared/types/uuid';",
  ].join('\n'),
  'src/app/auth/import-path-policy.allowed.ts'
);

assert.equal(
  allowed.filter((message) => message.ruleId === importPathRule).length,
  0,
  'Direct siblings and the five layer aliases must be allowed.'
);

for (const forbiddenSpecifier of ['../auth/sibling', './nested/module']) {
  const messages = await lint(
    `import '${forbiddenSpecifier}';`,
    'src/app/auth/import-path-policy.forbidden.ts'
  );

  assert.equal(
    messages.filter((message) => message.ruleId === importPathRule).length,
    1,
    `${forbiddenSpecifier} must be rejected.`
  );
}

const boundaryMessages = await lint(
  "import '@app/auth/errors/auth.error';",
  'src/domain/import-path-policy.boundary.ts'
);

assert.equal(
  boundaryMessages.filter(
    (message) => message.ruleId === 'boundaries/dependencies'
  ).length,
  1,
  'Existing layer-boundary rules must still reject prohibited dependencies.'
);
