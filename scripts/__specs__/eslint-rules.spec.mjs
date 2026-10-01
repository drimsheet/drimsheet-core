import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import tsParser from '@typescript-eslint/parser';
import { ESLint, RuleTester } from 'eslint';

import config from '../../eslint.config.mjs';

const ruleName = 'require-transaction-disposal';
const rule = config.find((entry) => entry.plugins?.local).plugins.local.rules[
  ruleName
];
RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});
const example = (body) => `async function execute() { ${body} }`;
const invalid = (body, messageId = 'cleanup') => ({
  code: example(body),
  errors: [{ messageId }],
});

tester.run(ruleName, rule, {
  valid: [
    example('await repo.findById(id);'),
    example('await getService()();'),
    example(`
      const tx = await repo.createTransaction();
      try { await work(tx.context); await tx.commit(); }
      finally { await tx.dispose(); }
    `),
    example(`
      let failure;
      const tx = await repo.createTransaction();
      try { return await work(tx.context); }
      catch (error) { failure = error; throw error; }
      finally { await tx.dispose(failure); }
    `),
    example(`
      const tx = await createTransaction();
      try { return; } finally { await tx.dispose(); }
    `),
    example(`
      const tx = await repo['createTransaction']();
      try { throw failure; } finally { await tx['dispose'](); }
    `),
    example(`
      const tx: IRepoTransaction = await repo.createTransaction();
      try {} finally { await tx.dispose(); logCompletion(); }
    `),
    example(`
      const outer = await repo.createTransaction();
      try {
        const inner = await repo.createTransaction();
        try {} finally { await inner.dispose(); }
      } finally { await outer.dispose(); }
    `),
    'const tx = await repo.createTransaction(); try {} finally { await tx.dispose(); }',
  ],
  invalid: [
    invalid('repo.createTransaction();', 'declaration'),
    invalid('await repo.createTransaction();', 'declaration'),
    invalid('return repo.createTransaction();', 'declaration'),
    invalid('const tx = repo.createTransaction();', 'declaration'),
    invalid('let tx = await repo.createTransaction();', 'declaration'),
    invalid(
      'const { context } = await repo.createTransaction();',
      'declaration'
    ),
    invalid('tx = await repo.createTransaction();', 'declaration'),
    invalid(
      'const tx = await repo.createTransaction(), other = work();',
      'declaration'
    ),
    invalid('const tx = await repo.createTransaction();'),
    invalid('const tx = await repo.createTransaction(); await tx.dispose();'),
    invalid(
      'const tx = await repo.createTransaction(); work(); try {} finally { await tx.dispose(); }'
    ),
    invalid(
      'const tx = await repo.createTransaction(); try { await tx.dispose(); } catch (e) {}'
    ),
    invalid('const tx = await repo.createTransaction(); try {} finally {}'),
    invalid(
      'const tx = await repo.createTransaction(); try {} finally { tx.dispose(); }'
    ),
    invalid(
      'const tx = await repo.createTransaction(); try {} finally { await other.dispose(); }'
    ),
    invalid(
      'const tx = await repo.createTransaction(); try {} finally { if (ready) await tx.dispose(); }'
    ),
    invalid(
      'const tx = await repo.createTransaction(); try {} finally { return; await tx.dispose(); }'
    ),
    invalid(
      'const tx = await repo.createTransaction(); try {} finally { work(); await tx.dispose(); }'
    ),
    invalid(
      'const tx = await repo.createTransaction(); try {} finally { await (ready && tx.dispose()); }'
    ),
    invalid(
      'const tx = await repo.createTransaction(); try {} finally { await tx.dispose?.(); }'
    ),
    invalid(
      'const tx = await repo.createTransaction(); try {} finally { await dispose(); }'
    ),
    invalid(
      'const tx = await repo.createTransaction(); try {} finally { await tx.commit(); }'
    ),
    invalid(
      'const tx = await repo.createTransaction(); try {} finally { await tx.dispose(getError()); }'
    ),
    invalid(
      'const tx = await repo.createTransaction(); try {} finally { await tx.dispose(...errors); }'
    ),
    invalid(
      'const tx = await repo.createTransaction(); try {} finally { await tx.dispose(); const tx = other; }'
    ),
    invalid(
      'const tx = await repo.createTransaction(); try {} finally { async function cleanup() { await tx.dispose(); } }'
    ),
    invalid(
      'for (const tx = await repo.createTransaction(); ready;) { try {} finally { await tx.dispose(); } }'
    ),
  ],
});

it('enables the rule for application code and ordinary tests', async () => {
  const eslint = new ESLint();
  for (const file of ['src/app/example.ts', 'test/example.spec.ts']) {
    const resolved = await eslint.calculateConfigForFile(file);
    assert.equal(resolved.rules[`local/${ruleName}`][0], 2);
  }
});
