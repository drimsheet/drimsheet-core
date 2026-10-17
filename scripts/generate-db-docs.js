const fs = require('fs/promises');
const path = require('path');
const { Client } = require('pg');

require('dotenv').config();

const documentedSchemas = ['audit', 'core'];

function dbmlName(schema, name) {
  return `${schema}.${name}`;
}

function mermaidName(schema, name) {
  return `${schema}_${name}`;
}

function escapeDbml(value) {
  return value.replaceAll("'", "\\'");
}

function dbmlType(column) {
  if (column.data_type === 'USER-DEFINED') {
    return dbmlName(column.udt_schema, column.udt_name);
  }

  if (column.data_type === 'ARRAY') {
    return `"${column.udt_name.slice(1)}[]"`;
  }

  if (column.data_type === 'character varying') {
    return column.character_maximum_length
      ? `varchar(${column.character_maximum_length})`
      : 'varchar';
  }

  if (column.data_type === 'timestamp with time zone') {
    return 'timestamptz';
  }

  if (column.data_type === 'timestamp without time zone') {
    return 'timestamp';
  }

  return column.data_type.replaceAll(' ', '_');
}

function mermaidType(column) {
  return dbmlType(column).replaceAll(/[^a-zA-Z0-9_]/g, '_');
}

function defaultExpression(value) {
  if (!value) return null;
  return value.replace(/::[\w.\s\[\]"]+$/u, '');
}

function onDeleteAction(code) {
  return {
    a: null,
    c: 'cascade',
    d: 'set default',
    n: 'set null',
    r: 'restrict',
  }[code];
}

async function loadSchema(client) {
  const enums = await client.query(
    `
        SELECT
          namespace.nspname AS schema_name,
          type.typname AS enum_name,
          enum.enumlabel AS enum_value
        FROM pg_type AS type
        JOIN pg_enum AS enum
          ON enum.enumtypid = type.oid
        JOIN pg_namespace AS namespace
          ON namespace.oid = type.typnamespace
        WHERE namespace.nspname = ANY($1)
        ORDER BY namespace.nspname, type.typname, enum.enumsortorder
      `,
    [documentedSchemas]
  );
  const columns = await client.query(
    `
        SELECT
          table_schema,
          table_name,
          column_name,
          ordinal_position,
          column_default,
          is_nullable,
          data_type,
          udt_schema,
          udt_name,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = ANY($1)
        ORDER BY table_schema, table_name, ordinal_position
      `,
    [documentedSchemas]
  );
  const constraints = await client.query(
    `
        SELECT
          namespace.nspname AS schema_name,
          table_class.relname AS table_name,
          constraint_record.conname AS constraint_name,
          constraint_record.contype AS constraint_type,
          constraint_record.confdeltype AS delete_action,
          pg_get_constraintdef(constraint_record.oid, true) AS definition,
          ARRAY(
            SELECT attribute.attname
            FROM unnest(constraint_record.conkey) WITH ORDINALITY AS key(attnum, position)
            JOIN pg_attribute AS attribute
              ON attribute.attrelid = constraint_record.conrelid
             AND attribute.attnum = key.attnum
            ORDER BY key.position
          )::text[] AS columns,
          referenced_namespace.nspname AS referenced_schema,
          referenced_class.relname AS referenced_table,
          ARRAY(
            SELECT attribute.attname
            FROM unnest(constraint_record.confkey) WITH ORDINALITY AS key(attnum, position)
            JOIN pg_attribute AS attribute
              ON attribute.attrelid = constraint_record.confrelid
             AND attribute.attnum = key.attnum
            ORDER BY key.position
          )::text[] AS referenced_columns
        FROM pg_constraint AS constraint_record
        JOIN pg_class AS table_class
          ON table_class.oid = constraint_record.conrelid
        JOIN pg_namespace AS namespace
          ON namespace.oid = table_class.relnamespace
        LEFT JOIN pg_class AS referenced_class
          ON referenced_class.oid = constraint_record.confrelid
        LEFT JOIN pg_namespace AS referenced_namespace
          ON referenced_namespace.oid = referenced_class.relnamespace
        WHERE namespace.nspname = ANY($1)
        ORDER BY namespace.nspname, table_class.relname, constraint_record.conname
      `,
    [documentedSchemas]
  );
  const indexes = await client.query(
    `
        SELECT
          namespace.nspname AS schema_name,
          table_class.relname AS table_name,
          index_class.relname AS index_name,
          index_record.indisunique AS is_unique,
          ARRAY(
            SELECT attribute.attname
            FROM unnest(index_record.indkey) WITH ORDINALITY AS key(attnum, position)
            JOIN pg_attribute AS attribute
              ON attribute.attrelid = index_record.indrelid
             AND attribute.attnum = key.attnum
            ORDER BY key.position
          )::text[] AS columns
        FROM pg_index AS index_record
        JOIN pg_class AS table_class
          ON table_class.oid = index_record.indrelid
        JOIN pg_class AS index_class
          ON index_class.oid = index_record.indexrelid
        JOIN pg_namespace AS namespace
          ON namespace.oid = table_class.relnamespace
        LEFT JOIN pg_constraint AS constraint_record
          ON constraint_record.conindid = index_record.indexrelid
        WHERE namespace.nspname = ANY($1)
          AND constraint_record.oid IS NULL
        ORDER BY namespace.nspname, table_class.relname, index_class.relname
      `,
    [documentedSchemas]
  );

  return {
    enums: enums.rows,
    columns: columns.rows,
    constraints: constraints.rows,
    indexes: indexes.rows,
  };
}

function groupSchema(schema) {
  const enums = new Map();
  for (const row of schema.enums) {
    const key = dbmlName(row.schema_name, row.enum_name);
    if (!enums.has(key)) enums.set(key, []);
    enums.get(key).push(row.enum_value);
  }

  const tables = new Map();
  for (const column of schema.columns) {
    const key = dbmlName(column.table_schema, column.table_name);
    if (!tables.has(key)) {
      tables.set(key, {
        schema: column.table_schema,
        name: column.table_name,
        columns: [],
        constraints: [],
        indexes: [],
      });
    }
    tables.get(key).columns.push(column);
  }

  for (const constraint of schema.constraints) {
    tables
      .get(dbmlName(constraint.schema_name, constraint.table_name))
      ?.constraints.push(constraint);
  }

  for (const index of schema.indexes) {
    tables
      .get(dbmlName(index.schema_name, index.table_name))
      ?.indexes.push(index);
  }

  return { enums, tables };
}

function generateDbml(grouped) {
  const lines = [
    'Project drimsheet {',
    "  database_type: 'PostgreSQL'",
    "  Note: 'Generated from the migrated PostgreSQL schema'",
    '}',
    '',
  ];

  for (const [name, values] of grouped.enums) {
    lines.push(`Enum ${name} {`);
    for (const value of values) lines.push(`  ${value}`);
    lines.push('}', '');
  }

  const foreignKeys = [];

  for (const table of grouped.tables.values()) {
    const primaryKey = table.constraints.find(
      (constraint) => constraint.constraint_type === 'p'
    );
    const uniqueConstraints = table.constraints.filter(
      (constraint) => constraint.constraint_type === 'u'
    );
    const checks = table.constraints.filter(
      (constraint) => constraint.constraint_type === 'c'
    );

    lines.push(`Table ${dbmlName(table.schema, table.name)} {`);

    for (const column of table.columns) {
      const settings = [];
      if (
        primaryKey?.columns.length === 1 &&
        primaryKey.columns[0] === column.column_name
      ) {
        settings.push('pk');
      }
      if (
        uniqueConstraints.some(
          (constraint) =>
            constraint.columns.length === 1 &&
            constraint.columns[0] === column.column_name
        )
      ) {
        settings.push('unique');
      }
      if (column.is_nullable === 'NO') settings.push('not null');

      const defaultValue = defaultExpression(column.column_default);
      if (defaultValue) settings.push(`default: \`${defaultValue}\``);

      const suffix = settings.length ? ` [${settings.join(', ')}]` : '';
      lines.push(`  ${column.column_name} ${dbmlType(column)}${suffix}`);
    }

    const compositeConstraints = [
      ...(primaryKey?.columns.length > 1 ? [primaryKey] : []),
      ...uniqueConstraints.filter(
        (constraint) => constraint.columns.length > 1
      ),
    ];
    const documentedIndexes = [
      ...compositeConstraints.map((constraint) => ({
        columns: constraint.columns,
        index_name: constraint.constraint_name,
        is_unique: constraint.constraint_type === 'u',
        is_primary: constraint.constraint_type === 'p',
      })),
      ...table.indexes,
    ];

    if (documentedIndexes.length) {
      lines.push('', '  indexes {');
      for (const index of documentedIndexes) {
        const settings = [];
        if (index.is_primary) settings.push('pk');
        if (index.is_unique) settings.push('unique');
        settings.push(`name: '${escapeDbml(index.index_name)}'`);
        lines.push(
          `    (${index.columns.join(', ')}) [${settings.join(', ')}]`
        );
      }
      lines.push('  }');
    }

    if (checks.length) {
      lines.push('', '  checks {');
      for (const check of checks) {
        const expression = check.definition
          .replace(/^CHECK \(/u, '')
          .replace(/\)$/u, '');
        lines.push(
          `    \`${expression}\` [name: '${escapeDbml(check.constraint_name)}']`
        );
      }
      lines.push('  }');
    }

    lines.push('', `  Note: 'Schema: ${escapeDbml(table.schema)}'`, '}', '');

    foreignKeys.push(
      ...table.constraints.filter(
        (constraint) => constraint.constraint_type === 'f'
      )
    );
  }

  for (const foreignKey of foreignKeys) {
    const source = `${dbmlName(
      foreignKey.schema_name,
      foreignKey.table_name
    )}.(${foreignKey.columns.join(', ')})`;
    const target = `${dbmlName(
      foreignKey.referenced_schema,
      foreignKey.referenced_table
    )}.(${foreignKey.referenced_columns.join(', ')})`;
    const settings = [];
    const deleteAction = onDeleteAction(foreignKey.delete_action);
    if (deleteAction) settings.push(`delete: ${deleteAction}`);
    const suffix = settings.length ? ` [${settings.join(', ')}]` : '';
    lines.push(
      `Ref ${foreignKey.constraint_name}: ${source} > ${target}${suffix}`
    );
  }

  return `${lines.join('\n').trim()}\n`;
}

function generateMermaid(grouped) {
  const lines = ['erDiagram', ''];
  const foreignKeys = [];

  for (const table of grouped.tables.values()) {
    const primaryKey = table.constraints.find(
      (constraint) => constraint.constraint_type === 'p'
    );
    const foreignKeyColumns = new Set(
      table.constraints
        .filter((constraint) => constraint.constraint_type === 'f')
        .flatMap((constraint) => constraint.columns)
    );

    lines.push(`${mermaidName(table.schema, table.name)} {`);
    for (const column of table.columns) {
      const markers = [];
      if (primaryKey?.columns.includes(column.column_name)) markers.push('PK');
      if (foreignKeyColumns.has(column.column_name)) markers.push('FK');
      lines.push(
        `    ${mermaidType(column)} ${column.column_name}${
          markers.length ? ` ${markers.join(',')}` : ''
        }`
      );
    }
    lines.push('}', '');

    foreignKeys.push(
      ...table.constraints.filter(
        (constraint) => constraint.constraint_type === 'f'
      )
    );
  }

  for (const foreignKey of foreignKeys) {
    lines.push(
      `${mermaidName(
        foreignKey.referenced_schema,
        foreignKey.referenced_table
      )} ||--o{ ${mermaidName(
        foreignKey.schema_name,
        foreignKey.table_name
      )} : "${foreignKey.constraint_name}"`
    );
  }

  return `${lines.join('\n').trim()}\n`;
}

function generateDbdiagram(grouped) {
  const tables = [...grouped.tables.values()];
  const tablePositions = tables.map((table, index) => ({
    name: table.name,
    schemaName: table.schema,
    x: (index % 4) * 520 + 12,
    y: Math.floor(index / 4) * 360 + 12,
  }));
  const referencePaths = tables.flatMap((table) =>
    table.constraints
      .filter((constraint) => constraint.constraint_type === 'f')
      .map((foreignKey) => ({
        firstFieldNames: foreignKey.referenced_columns,
        firstTableName: foreignKey.referenced_table,
        firstSchemaName: foreignKey.referenced_schema,
        firstRelation: '1',
        secondFieldNames: foreignKey.columns,
        secondTableName: foreignKey.table_name,
        secondSchemaName: foreignKey.schema_name,
        secondRelation: '*',
        checkPoints: [],
      }))
  );

  return `${JSON.stringify(
    {
      version: '1.0.0',
      darkMode: true,
      gridEnabling: false,
      detailLevel: 'Keys',
      tablePositions,
      referencePaths,
      stickyNoteLayouts: [],
      tableGroupCollapseStates: [],
    },
    null,
    2
  )}\n`;
}

async function main() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();

  try {
    const grouped = groupSchema(await loadSchema(client));
    const docsDirectory = path.resolve(__dirname, '../db/docs');

    await Promise.all([
      fs.writeFile(path.join(docsDirectory, 'erd.dbml'), generateDbml(grouped)),
      fs.writeFile(
        path.join(docsDirectory, 'erd.mermaid'),
        generateMermaid(grouped)
      ),
      fs.writeFile(
        path.join(docsDirectory, 'erd.dbdiagram'),
        generateDbdiagram(grouped)
      ),
    ]);

    console.log(
      `Generated database documentation for ${grouped.tables.size} tables and ${grouped.enums.size} enums.`
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
