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
    example(`
      const tx = await repo.createTransaction();
      try {
        const accounts = await archive(tx.context);
        for (const account of accounts) {
          const history = makeHistory(account);
          await repo.update(account, { tx: tx.context, history });
        }
        await tx.commit();
      } catch (error) { return await tx.handleError(error); }
    `),
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
    example(`
      const tx = await repo.createTransaction();
      try {
        const prepared = await prepare(tx.context);
        await write(prepared, tx.context);
        await tx.commit({ dispose: true });
        await publish(prepared);
        if (done) return;
        return prepared;
      } catch (error) { return tx.handleError(error); }
    `),
    example(`
      const tx = await repo['createTransaction']();
      try { await tx['commit']({ 'dispose': true }); return; }
      catch (error) { return await tx['handleError'](error); }
    `),
    ...['await tx.commit();', 'await tx.commit({});'].map((commit) =>
      example(`
      const tx = await repo.createTransaction();
      try { ${commit} return result; }
      catch (error) { return tx.handleError(error); }
    `)
    ),
    example(`
      const tx = await repo.createTransaction();
      try { await tx.commit({ dispose: false }); }
      finally { await tx.dispose(); }
    `),
    'const tx = await repo.createTransaction(); try {} finally { await tx.dispose(); }',
  ],
  invalid: [
    ...[
      'return;',
      'if (done) return;',
      'return; await tx.commit({ dispose: true });',
      'if (done) return; await tx.commit({ dispose: true });',
      'try { return; } catch {} await tx.commit({ dispose: true });',
      'if (ready) await tx.commit({ dispose: true });',
      'await tx.commit({ dispose: false });',
      'await tx.commit(options);',
      'await tx.commit({ dispose: shouldDispose });',
      'if (done) return; await tx.commit();',
      'if (ready) await tx.commit();',
      'for (const account of accounts) { return account; } await tx.commit();',
      'for (const account of accounts) { if (done) return; } await tx.commit();',
      'for (const account of accounts) { break; } await tx.commit();',
      'tx.commit();',
      'await tx.commit({ dispose: true, ...options });',
      'await tx.commit({ dispose: true, dispose: false });',
      'await tx.commit({ get dispose() { return true; } });',
      'await tx.commit({ [key]: true });',
      'await tx.commit({ dispose: true }, other);',
      'await tx.commit?.({ dispose: true });',
      'await tx?.commit({ dispose: true });',
      'tx.commit({ dispose: true });',
      'await other.commit({ dispose: true });',
      'await commit({ dispose: true });',
      'await (ready && tx.commit({ dispose: true }));',
      'await tx.commit({ dispose: true }); const tx = other;',
    ].map((body) =>
      invalid(`
      const tx = await repo.createTransaction();
      try { ${body} }
      catch (error) { return tx.handleError(error); }
    `)
    ),
    ...[
      '',
      'return;',
      'tx.handleError(error);',
      'await tx.handleError(error);',
      'log(error); return tx.handleError(error);',
      'return other.handleError(error);',
      'return tx.handleError(other);',
      'return tx.handleError();',
      'return tx.handleError(getError());',
      'return tx.handleError(...errors);',
      'return tx.handleError(error, other);',
      'return tx.handleError?.(error);',
      'return tx?.handleError(error);',
      'return (ready && tx.handleError(error));',
    ].map((body) =>
      invalid(`
      const tx = await repo.createTransaction();
      try { await tx.commit({ dispose: true }); }
      catch (error) { ${body} }
    `)
    ),
    invalid(`
      const tx = await repo.createTransaction();
      try { await tx.commit({ dispose: true }); }
      catch (tx) { return tx.handleError(tx); }
    `),
    invalid(`
      const tx = await repo.createTransaction();
      try { await tx.commit({ dispose: true }); }
      catch { return tx.handleError(error); }
    `),
    invalid(`
      const tx = await repo.createTransaction();
      try { await tx.commit({ dispose: true }); }
      catch ({ error }) { return tx.handleError(error); }
    `),
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
