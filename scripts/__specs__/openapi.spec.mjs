import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const spec = JSON.parse(
  readFileSync(path.join(root, 'generated/swagger.json'), 'utf8')
);

it('generates the checked-in UUID string schema directly through TSOA', (t) => {
  const outputDirectory = mkdtempSync(path.join(tmpdir(), 'tsoa-openapi-'));
  t.after(() => rmSync(outputDirectory, { recursive: true, force: true }));
  const config = JSON.parse(readFileSync(path.join(root, 'tsoa.json'), 'utf8'));
  config.spec.outputDirectory = outputDirectory;
  const configPath = path.join(outputDirectory, 'tsoa.json');
  writeFileSync(configPath, JSON.stringify(config));

  execFileSync(
    process.execPath,
    [
      path.join(root, 'node_modules/.bin/tsoa'),
      'spec',
      '--configuration',
      configPath,
    ],
    { cwd: root, stdio: 'pipe' }
  );

  const generated = JSON.parse(
    readFileSync(path.join(outputDirectory, 'swagger.json'), 'utf8')
  );
  assert.deepEqual(generated.components.schemas.TEntityId, {
    allOf: [{ type: 'string', format: 'uuid' }],
  });
  assert.deepEqual(spec, generated);
});

it('preserves existing schema references and security definitions', () => {
  for (const name of ['IAccountingEntity', 'IFiscalYear']) {
    assert.deepEqual(spec.components.schemas[name].properties.id, {
      $ref: '#/components/schemas/TEntityId',
    });
  }
  assert.deepEqual(spec.components.schemas.UAccountingPeriodStatus.enum, [
    'open',
    'closed',
  ]);
  assert.deepEqual(spec.components.securitySchemes.bearerAuth, {
    scheme: 'bearer',
    type: 'http',
    in: 'header',
    name: 'Authorization',
    bearerFormat: 'JWT',
  });
});
