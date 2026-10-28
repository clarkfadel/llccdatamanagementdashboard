import { query, SCHEMA } from './db.js';

// load tables/columns from information_schema once and cache it
let cache = null;

const TEXTY = new Set([
  'text', 'character varying', 'character', 'citext', 'name', 'uuid',
]);

async function load() {
  const tablesRes = await query(
    `select table_name
       from information_schema.tables
      where table_schema = $1 and table_type = 'BASE TABLE'
      order by table_name`,
    [SCHEMA]
  );

  const colsRes = await query(
    `select table_name, column_name, data_type, ordinal_position
       from information_schema.columns
      where table_schema = $1
      order by table_name, ordinal_position`,
    [SCHEMA]
  );

  const pkRes = await query(
    `select tc.table_name, kcu.column_name
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu
         on kcu.constraint_name = tc.constraint_name
        and kcu.table_schema = tc.table_schema
      where tc.table_schema = $1 and tc.constraint_type = 'PRIMARY KEY'`,
    [SCHEMA]
  );

  // outgoing FKs: this table's column -> referenced table/column
  const fkRes = await query(
    `select tc.table_name,
            kcu.column_name,
            ccu.table_name  as foreign_table,
            ccu.column_name as foreign_column
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu
         on kcu.constraint_name = tc.constraint_name
        and kcu.table_schema = tc.table_schema
       join information_schema.constraint_column_usage ccu
         on ccu.constraint_name = tc.constraint_name
        and ccu.table_schema = tc.table_schema
      where tc.table_schema = $1 and tc.constraint_type = 'FOREIGN KEY'`,
    [SCHEMA]
  );

  const tables = {};
  for (const { table_name } of tablesRes.rows) {
    tables[table_name] = {
      name: table_name,
      columns: [],
      textColumns: [],
      primaryKey: null,
      foreignKeys: [],   // outgoing
      referencedBy: [],  // incoming
    };
  }

  for (const c of colsRes.rows) {
    const t = tables[c.table_name];
    if (!t) continue;
    t.columns.push({ name: c.column_name, type: c.data_type });
    if (TEXTY.has(c.data_type)) t.textColumns.push(c.column_name);
  }

  for (const pk of pkRes.rows) {
    const t = tables[pk.table_name];
    if (t && !t.primaryKey) t.primaryKey = pk.column_name;
  }

  for (const fk of fkRes.rows) {
    const t = tables[fk.table_name];
    if (!t) continue;
    t.foreignKeys.push({
      column: fk.column_name,
      table: fk.foreign_table,
      foreignColumn: fk.foreign_column,
    });
    const target = tables[fk.foreign_table];
    if (target) {
      target.referencedBy.push({
        table: fk.table_name,
        column: fk.column_name,
        foreignColumn: fk.foreign_column,
      });
    }
  }

  return { tables, order: tablesRes.rows.map((r) => r.table_name) };
}

export async function getSchema() {
  if (!cache) cache = await load();
  return cache;
}

export async function getTable(name) {
  const { tables } = await getSchema();
  return tables[name] || null;
}

// quote an identifier we've already validated against the schema
export function ident(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

export function qualified(table) {
  return `${ident(SCHEMA)}.${ident(table)}`;
}

// ids are saved as text so normal sorting gives 1, 10, 11, 2...
// this sorts them as numbers instead
export function naturalOrder(col, dir = 'asc') {
  const c = ident(col);
  const d = String(dir).toLowerCase() === 'desc' ? 'desc' : 'asc';
  // use [0-9] not \d, postgres removes the backslash
  return (
    `case when ${c} ~ '^-?[0-9]+$' then 0 else 1 end, ` +
    `case when ${c} ~ '^-?[0-9]+$' then ${c}::numeric end ${d} nulls last, ` +
    `${c} ${d}`
  );
}
