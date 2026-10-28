import { getSchema, getTable } from './schema.js';
import { entityConfig } from './entities.js';

export function colExists(table, name) {
  return table.columns.some((c) => c.name === name);
}

// get primary key of a table
export function pkOf(table) {
  const cfg = entityConfig(table.name);
  return table.primaryKey || (cfg && cfg.primaryKey) || table.columns[0]?.name;
}

// no FK constraints in the db so we match by column name (ex. ClientId -> Clients)
export async function tableByPkColumn(colName) {
  const { tables } = await getSchema();
  for (const t of Object.values(tables)) {
    if (pkOf(t) === colName) return t.name;
  }
  return null;
}

// columns that are real foreign keys (resolvable to another table)
export async function fkColumns(table) {
  const pk = pkOf(table);
  const out = [];
  for (const c of table.columns) {
    if (c.name === pk || !/Id$/.test(c.name)) continue;
    const target = await tableByPkColumn(c.name);
    if (target && target !== table.name) out.push({ column: c.name, target });
  }
  return out;
}

export { getTable, getSchema };
