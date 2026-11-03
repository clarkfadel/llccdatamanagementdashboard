import { query } from './db.js';
import { ident, qualified } from './schema.js';
import { colExists, pkOf, fkColumns } from './meta.js';

// saved as "True"/"False" text in the db
const YESNO = new Set(['Status', 'Active', 'withReserved', 'WithContruction']);
// filled in by the system, not by staff
const AUTO = new Set(['TimeStamp', 'Timestamp', 'Created_At', 'Updated_At', 'UserId']);
const NUMBER_TYPES = new Set(['integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision']);

// what kind of input each column needs in the forms
export async function fieldList(table, cfg) {
  const pk = pkOf(table);
  const links = Object.fromEntries((await fkColumns(table)).map((f) => [f.column, f.target]));
  const required = new Set(cfg.required || []);
  const out = [];
  // editable derived columns (like the deceased's Name) go first
  for (const [name, d] of Object.entries(cfg.derived || {})) {
    if (d.write) out.push({ name, kind: 'text', target: null, required: required.has(name) });
  }
  for (const c of table.columns) {
    if (c.name === pk) continue;
    let kind = 'text';
    if (AUTO.has(c.name)) kind = 'auto';
    else if (links[c.name]) kind = 'link';
    else if (c.type === 'date' || /Date/.test(c.name)) kind = 'date';
    else if (YESNO.has(c.name)) kind = 'yesno';
    else if (NUMBER_TYPES.has(c.type) || /Amount$|^MFee$|^LotArea$/.test(c.name)) kind = 'number';
    out.push({ name: c.name, kind, target: links[c.name] || null, required: required.has(c.name) });
  }
  return out;
}

// where clause for lists and csv export: hides the -1 row, then search + filters.
// filters come in as f_<Column> (or f_<Column>_from / _to for dates) and only
// the columns listed in entities.js `filters` are used
export function buildWhere(table, cfg, q) {
  const pk = pkOf(table);
  const params = [];
  const conds = [`${ident(pk)} is distinct from '-1'`];

  const search = String(q.search || '').trim();
  if (search) {
    const cols = (cfg.search || table.textColumns).filter((c) => colExists(table, c));
    if (cols.length) {
      params.push(`%${search}%`);
      conds.push('(' + cols.map((c) => `${ident(c)} ilike $${params.length}`).join(' or ') + ')');
    }
  }

  for (const f of cfg.filters || []) {
    if (!colExists(table, f.column)) continue;
    const c = ident(f.column);
    if (f.type === 'range') {
      const from = q[`f_${f.column}_from`];
      const to = q[`f_${f.column}_to`];
      if (from) { params.push(String(from)); conds.push(`${c} >= $${params.length}`); }
      if (to) { params.push(String(to)); conds.push(`${c} <= $${params.length}`); }
      continue;
    }
    const v = q[`f_${f.column}`];
    if (!v) continue;
    if (f.type === 'linked') {
      conds.push(v === 'yes' ? `(${c} is distinct from '-1' and ${c} is not null)` : `(${c} = '-1' or ${c} is null)`);
    } else if (f.type === 'present') {
      conds.push(v === 'yes' ? `nullif(${c}, '') is not null` : `nullif(${c}, '') is null`);
    } else {
      params.push(String(v));
      conds.push(`${c} = $${params.length}`);
    }
  }

  return { where: `where ${conds.join(' and ')}`, params };
}

// the filters of a table, with the choices for dropdown filters
export async function filterOptions(table, cfg) {
  const pk = pkOf(table);
  const out = [];
  for (const f of cfg.filters || []) {
    if (!colExists(table, f.column)) continue;
    const item = { ...f };
    if (f.type === 'select') {
      const { rows } = await query(
        `select distinct ${ident(f.column)}::text as v from ${qualified(table.name)}
          where ${ident(f.column)} is not null and ${ident(pk)} is distinct from '-1'
          order by 1 limit 50`);
      item.options = rows.map((r) => r.v);
    }
    out.push(item);
  }
  return out;
}
