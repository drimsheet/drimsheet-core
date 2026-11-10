import assert from 'node:assert/strict';
import path from 'node:path';
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

const localRules = config.find((entry) => entry.plugins?.local).plugins.local
  .rules;
const helperFile = (
  filename = 'src/app/example/usecases/helpers/read.helper.ts'
) => path.resolve(filename);
const helperCase = (code, filename) => ({
  code,
  filename: helperFile(filename),
});
const invalidHelper = (code, messageId = 'exports', filename) => ({
  ...helperCase(code, filename),
  errors: [{ messageId }],
});

tester.run('helper-exports', localRules['helper-exports'], {
  valid: [
    ...[
      'export default function readHelper() { return 1; }',
      'export default async function readHelper() { return 1; }',
      'export default function* readHelper() { yield 1; }',
      'export default () => 1;',
      'export default function () { return 1; }',
      'function readHelper() { return 1; } export default readHelper;',
      'function readHelper() { return 1; } export { readHelper as default };',
      'const readHelper = () => 1; export default readHelper;',
      'const readHelper = function () { return 1; }; export default readHelper;',
      'interface Output { value: number } function privateHelper() { return 1; } export default function readHelper(): Output { return { value: privateHelper() }; }',
      'function readHelper(value: string): string; function readHelper(value: number): number; function readHelper(value: string | number) { return value; } export default readHelper;',
      'export default function readHelper(value: string): string; export default function readHelper(value: number): number; export default function readHelper(value: string | number) { return value; }',
      'const readHelper = (() => 1) satisfies (() => number); export default readHelper;',
      'const readHelper = (() => 1) as (() => number); export default readHelper!;',
      'export default (() => 1) satisfies (() => number);',
      'const readHelper = <(() => number)>(() => 1); export default readHelper;',
    ].map((code) => helperCase(code)),
    helperCase(
      'export default function readHelper() { return 1; }',
      'src/shared/helpers/read.ts'
    ),
    ...[
      'src/domain/example/entities/example.entity.ts',
      'src/shared/utils/date.ts',
      'src/infra/persistence/helpers/date.mapper.ts',
      'src/infra/persistence/helpers/money.mapper.ts',
      'src/app/example/usecases/helpers/__specs__/read.helper.spec.ts',
      'src/domain/example/entities/helpers/__tests__/read.helper.test.ts',
      'src/app/example/usecases/helpers/__mocks__/read.helper.ts',
      'src/app/example/usecases/helpers/read.spec.ts',
      'src/app/example/usecases/helpers/read.test.ts',
      'src/app/example/usecases/helpers/read.mock.ts',
      'test/setup/read.helper.ts',
    ].map((filename) => helperCase('export const value = {};', filename)),
  ],
  invalid: [
    ...[
      '',
      'function readHelper() { return 1; }',
      'export function readHelper() { return 1; }',
      'export const firstHelper = () => 1; export const secondHelper = () => 2;',
      'export default function firstHelper() { return 1; } export default function secondHelper() { return 2; }',
      'export default function readHelper() { return 1; } export const extra = 2;',
      'export default function readHelper() { return 1; } export interface Output { value: number }',
      'export default function readHelper() { return 1; } export type Output = number;',
      'export { default } from "./other.helper";',
      'export * from "./other.helper";',
      'export * as default from "./other.helper";',
      'export default function readHelper() { return 1; } export * from "./other.helper";',
      'function readHelper() { return 1; } export { readHelper, readHelper as default };',
      'function readHelper() { return 1; } export type { readHelper as default };',
      'function readHelper() { return 1; } export { type readHelper as default };',
      'export default function readHelper(value: string): string;',
      'function readHelper() { return 1; } export = readHelper;',
    ].map((code) => invalidHelper(code)),
    ...[
      'export default {};',
      'function readHelper() { return 1; } export default Object.freeze({ readHelper });',
      'const helpers = { readHelper() { return 1; } }; export default helpers;',
      'export default class ReadHelper {}',
      'export default 1;',
      'export default makeHelper();',
      'import readHelper from "./other.helper"; export default readHelper;',
      'import readHelper from "./other.helper"; export { readHelper as default };',
      'const value = {}; export { value as default };',
      'let readHelper = () => 1; readHelper = other; export default readHelper;',
      'declare function readHelper(): number; export default readHelper;',
      'export default missingHelper;',
      'const value = {} as (() => number); export default value;',
    ].map((code) => invalidHelper(code, 'function')),
    ...[
      'src/domain/example/entities/helpers/read.helper.ts',
      'src/app/example/usecases/helpers/read.helpers.ts',
      'src/interface/http/handlers/helpers/read.helper.ts',
      'src/infra/persistence/repos/helpers/read.helper.ts',
      'src/shared/helpers/read.ts',
      'src/shared/read.helper.ts',
    ].map((filename) =>
      invalidHelper('export default {};', 'function', filename)
    ),
  ],
});

tester.run('helper-naming', localRules['helper-naming'], {
  valid: [
    ...[
      'export default function readHelper() { return 1; }',
      'export default async function readHelper() { return 1; }',
      'function readHelper() { return 1; } export default readHelper;',
      'const readHelper = () => 1; export default readHelper;',
      'const readHelper = function internal() { return 1; }; export default readHelper;',
      'function readHelper() { return 1; } export { readHelper as default };',
      'const readHelper = () => 1; export { readHelper as "default" };',
      'function internal() { return 1; } export default function readHelper() { return internal(); }',
      'export default function readHelper(value: string): string; export default function readHelper(value: number): number; export default function readHelper(value: string | number) { return value; }',
      'function readHelper(value: string): string; function readHelper(value: number): number; function readHelper(value: string | number) { return value; } export default readHelper;',
      'const readHelper = () => 1; export default readHelper satisfies (() => number);',
      'const readHelper = () => 1; export default readHelper as (() => number);',
      'const readHelper = () => 1; export default readHelper!;',
      'const readHelper = () => 1; export default <(() => number)>readHelper;',
      'export type { Shape as default } from "./types";',
      'type Shape = number; export type { Shape as default };',
      'type Shape = number; export { type Shape as default };',
      'export { readHelper as default } from "./other.helper";',
      'export const privateValue = 1;',
    ].map((code) => helperCase(code)),
    ...[
      'src/domain/example/entities/example.entity.ts',
      'src/shared/utils/date.ts',
      'src/infra/persistence/helpers/date.mapper.ts',
      'src/infra/persistence/helpers/money.mapper.ts',
      'src/app/example/usecases/helpers/__specs__/read.spec.ts',
      'src/domain/example/entities/helpers/__tests__/read.test.ts',
      'src/app/example/usecases/helpers/__mocks__/read.helper.ts',
      'src/app/example/usecases/helpers/read.spec.ts',
      'src/app/example/usecases/helpers/read.test.ts',
      'src/app/example/usecases/helpers/read.mock.ts',
      'test/setup/read.helper.ts',
    ].map((filename) => helperCase('export default () => 1;', filename)),
    ...[
      'src/domain/example/entities/helpers/read.helper.ts',
      'src/app/naming-fixture/usecases/helpers/read.helper.ts',
      'src/infra/persistence/helpers/read.helper.ts',
      'src/interface/http/helpers/read.helper.ts',
      'src/shared/helpers/read.helper.ts',
    ].map((filename) =>
      helperCase('export default function readHelper() { return 1; }', filename)
    ),
  ],
  invalid: [
    ...[
      'export default function read() { return 1; }',
      'export default async function read() { return 1; }',
      'export default function Helper() { return 1; }',
      'export default function readhelper() { return 1; }',
      'function read() { return 1; } export default read;',
      'function read() { return 1; } export { read as default };',
      'const read = () => 1; export default read;',
      'export default function () { return 1; }',
      'export default () => 1;',
      'export default (() => 1) satisfies (() => number);',
      'export default (() => 1) as (() => number);',
      'export default <(() => number)>(() => 1);',
      'export default function read(value: string): string; export default function read(value: string) { return value; }',
    ].map((code) => invalidHelper(code, 'name')),
    ...[
      'src/domain/example/entities/helpers/read.ts',
      'src/app/example/usecases/helpers/read.helpers.ts',
      'src/infra/persistence/helpers/read.ts',
      'src/interface/http/helpers/read.ts',
      'src/shared/helpers/read.ts',
      'src/shared/helpers/.helper.ts',
      'src/shared/read.helpers.ts',
    ].map((filename) =>
      invalidHelper(
        'export default function readHelper() {}',
        'filename',
        filename
      )
    ),
    {
      ...helperCase(
        'export default function read() {}',
        'src/shared/helpers/read.ts'
      ),
      errors: [{ messageId: 'filename' }, { messageId: 'name' }],
    },
  ],
});

tester.run('helper-placement', localRules['helper-placement'], {
  valid: [
    'src/domain/example/entities/helpers/read.helper.ts',
    'src/app/example/usecases/helpers/reporting/read.helper.ts',
    'src/infra/persistence/repos/helpers/read.helper.ts',
    'src/infra/persistence/helpers/read.helper.ts',
    'src/infra/observability/helpers/read.helper.ts',
    'src/infra/observability/read.helper.ts',
    'src/interface/http/helpers/read.helper.ts',
    'src/interface/mcp/helpers/read.helper.ts',
    'src/interface/http/handlers/helpers/read.helper.ts',
    'src/interface/mcp/tools/helpers/read.helper.ts',
    'src/shared/helpers/read.helper.ts',
    'src/shared/example/helpers/read.helper.ts',
    'test/setup/helpers/read.ts',
  ].map((filename) => helperCase('export default () => 1;', filename)),
  invalid: [
    'src/domain/example/helpers/read.helper.ts',
    'src/app/journal-entry/helpers/read.helper.ts',
    'src/app/ledger/helpers/read.helper.ts',
    'src/domain/counterparty/helpers/read.helper.ts',
    'src/app/journal-entry/helpers/__specs__/read.helper.spec.ts',
  ].map((filename) =>
    invalidHelper('export default () => 1;', 'placement', filename)
  ),
});

it('enables all helper rules across all five layers', async () => {
  const eslint = new ESLint();
  for (const layer of ['domain', 'app', 'interface', 'infra', 'shared']) {
    const resolved = await eslint.calculateConfigForFile(
      `src/${layer}/example/owner/helpers/read.helper.ts`
    );
    assert.equal(resolved.rules['local/helper-exports'][0], 2);
    assert.equal(resolved.rules['local/helper-naming'][0], 2);
    assert.equal(resolved.rules['local/helper-placement'][0], 2);
  }
});
