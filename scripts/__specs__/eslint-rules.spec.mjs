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
const transaction = (
  body,
  handler = 'await tx.handleError(error);',
  finalizer = ''
) =>
  example(`
  const tx = await repo.createTransaction();
  try { ${body} }
  catch (error) { ${handler} }
  ${finalizer ? `finally { ${finalizer} }` : ''}
`);
const invalid = (code, messageId = 'cleanup') => ({
  code,
  errors: [{ messageId }],
});

tester.run(ruleName, rule, {
  valid: [
    example('await repo.findById(id);'),
    example('await getService()();'),
    ...[
      'await tx.commit();',
      'await tx.commit({});',
      'await tx.commit({ dispose: true });',
      "await tx['commit']({ 'dispose': true });",
      'await tx.dispose();',
      'await tx.dispose(operationError);',
      'return await tx.commit();',
      'return await tx.dispose();',
      'if (ready) { await tx.commit(); return result; } await tx.commit();',
      'if (ready) { await tx.commit(); } else { await tx.dispose(); }',
      'for (const account of accounts) { if (account.active) await save(account); } await tx.commit();',
      'for (const account of accounts) { await save(account); await tx.commit(); }',
      'switch (kind) { case "save": await tx.commit(); break; default: await tx.dispose(); }',
      'try { await work(); await tx.commit(); } finally { logCompletion(); }',
      'await tx.commit({ dispose: false }); await tx.dispose();',
      'await tx.commit(options); await tx.dispose();',
      'await tx.commit({ dispose: shouldDispose }); await tx.dispose();',
      // Presence checking deliberately does not prove coverage of successful paths.
      'if (ready) await tx.commit();',
      'if (done) return; await tx.commit();',
    ].map((body) => transaction(body)),
    ...[
      'return await tx.handleError(error);',
      "await tx['handleError'](error);",
      'log(error); await tx.handleError(error);',
      'const details = describe(error); log(details); return await tx.handleError(error);',
    ].map((handler) => transaction('await tx.commit();', handler)),
    transaction(
      'await tx.commit({ dispose: false });',
      undefined,
      'await tx.dispose();'
    ),
    transaction(
      'await tx.commit({ dispose: true, ...options });',
      undefined,
      'await tx.dispose();'
    ),
    transaction(
      'await work();',
      undefined,
      'logCompletion(); await tx.dispose();'
    ),
    transaction('await work();', undefined, 'await tx.commit();'),
    example(`
      const tx: IRepoTransaction = await repo['createTransaction']();
      try { await tx['commit'](); } catch (failure) { return await tx['handleError'](failure); }
    `),
    example(`
      const outer = await repo.createTransaction();
      try {
        const inner = await repo.createTransaction();
        try { await inner.commit(); } catch (error) { await inner.handleError(error); }
        await outer.commit();
      } catch (error) { await outer.handleError(error); }
    `),
    'const tx = await createTransaction(); try { await tx.commit(); } catch (error) { await tx.handleError(error); }',
  ],
  invalid: [
    ...[
      '',
      'return;',
      'if (done) return;',
      'tx.commit();',
      'tx.dispose();',
      'await other.commit();',
      'await other.dispose();',
      'await commit();',
      'await dispose();',
      'await tx.commit?.();',
      'await tx?.commit();',
      'await tx.dispose?.();',
      'await tx?.dispose();',
      'await (ready && tx.commit());',
      'await (ready && tx.dispose());',
      'await tx.dispose(getError());',
      'await tx.dispose(...errors);',
      'await tx.dispose(error, other);',
      'await tx.commit({ dispose: false });',
      'await tx.commit(options);',
      'await tx.commit({ dispose: shouldDispose });',
      'await tx.commit({ dispose: true, ...options });',
      'await tx.commit({ dispose: true, dispose: false });',
      'await tx.commit({ get dispose() { return true; } });',
      'await tx.commit({ [key]: true });',
      'await tx.commit({ dispose: true }, other);',
      'if (ready) await tx.commit(); else await tx.commit({ dispose: false });',
      'await tx.commit({ dispose: false }); tx.dispose();',
      'await tx.commit({ dispose: false }); await other.dispose();',
      'await tx.commit({ dispose: false }); const cleanup = async () => { await tx.dispose(); };',
      'const finish = async () => { await tx.commit(); };',
      'async function finish() { await tx.commit(); }',
      'const finish = async function () { await tx.dispose(); };',
      'class Cleanup { async finish() { await tx.dispose(); } }',
      'const Cleanup = class { async finish() { await tx.commit(); } };',
      'await tx.commit(); const tx = other;',
      '{ const tx = other; await tx.commit(); }',
      'try { await work(); } catch (error) { await tx.dispose(); }',
    ].map((body) => invalid(transaction(body))),
    ...[
      '',
      'return;',
      'tx.handleError(error);',
      'return tx.handleError(error);',
      'await other.handleError(error);',
      'await tx.handleError(other);',
      'await tx.handleError();',
      'await tx.handleError(getError());',
      'await tx.handleError(...errors);',
      'await tx.handleError(error, other);',
      'await tx.handleError?.(error);',
      'await tx?.handleError(error);',
      'await (ready && tx.handleError(error));',
      'if (ready) await tx.handleError(error);',
      'const fail = async () => { await tx.handleError(error); };',
      'async function fail() { await tx.handleError(error); }',
      'return; await tx.handleError(error);',
      'throw error; await tx.handleError(error);',
      'const tx = other; await tx.handleError(error);',
      '{ const error = other; await tx.handleError(error); }',
    ].map((handler) => invalid(transaction('await tx.commit();', handler))),
    // Cleanup in catch cannot satisfy cleanup on success, even with handleError.
    invalid(
      transaction('', 'await tx.dispose(); await tx.handleError(error);')
    ),
    invalid(
      transaction('', 'await tx.commit(); return await tx.handleError(error);')
    ),
    ...[
      'await other.dispose();',
      'tx.dispose();',
      'const finish = async () => { await tx.dispose(); };',
      'await tx.dispose(); const tx = other;',
    ].map((finalizer) =>
      invalid(
        transaction(
          'await tx.commit({ dispose: false });',
          undefined,
          finalizer
        )
      )
    ),
    ...[
      'catch (tx) { await tx.handleError(tx); }',
      'catch { await tx.handleError(error); }',
      'catch ({ error }) { await tx.handleError(error); }',
      'finally { await tx.dispose(); }',
      'catch (error) { throw error; } finally { await tx.dispose(); }',
    ].map((handler) =>
      invalid(
        example(
          `const tx = await repo.createTransaction(); try { await tx.commit(); } ${handler}`
        )
      )
    ),
    ...[
      'repo.createTransaction();',
      'await repo.createTransaction();',
      'return repo.createTransaction();',
      'const tx = repo.createTransaction();',
      'let tx = await repo.createTransaction();',
      'const { context } = await repo.createTransaction();',
      'tx = await repo.createTransaction();',
      'const tx = await repo.createTransaction(), other = work();',
    ].map((body) => invalid(example(body), 'declaration')),
    ...[
      'const tx = await repo.createTransaction();',
      'const tx = await repo.createTransaction(); await tx.dispose();',
      'const tx = await repo.createTransaction(); work(); try { await tx.commit(); } catch (error) { await tx.handleError(error); }',
      'for (const tx = await repo.createTransaction(); ready;) { try { await tx.commit(); } catch (error) { await tx.handleError(error); } }',
    ].map((body) => invalid(example(body))),
    invalid(
      example(`
      const outer = await repo.createTransaction();
      try {
        const inner = await repo.createTransaction();
        try { await inner.commit(); } catch (error) { await inner.handleError(error); }
      } catch (error) { await outer.handleError(error); }
    `)
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
