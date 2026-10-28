import { query, withTx } from './db.js';
import { getTable, ident, qualified } from './schema.js';
import { pkOf } from './meta.js';

export async function logChange({ table, rowPk, action, before, after, by }) {
  const { rows } = await query(
    `insert into audit_log (table_name, row_pk, action, before_data, after_data, performed_by)
     values ($1, $2, $3, $4, $5, $6) returning id, performed_at`,
    [table, rowPk ?? null, action, before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null, by || 'staff']);
  return rows[0];
}

export async function recentChanges(limit = 50) {
  const { rows } = await query(
    `select id, table_name, row_pk, action, before_data, after_data,
            performed_by, performed_at, undone
       from audit_log order by performed_at desc limit $1`, [limit]);
  return rows;
}

// reverse a logged change. merges can't be undone.
export async function undo(id) {
  const { rows } = await query(`select * from audit_log where id = $1`, [id]);
  if (!rows.length) throw new Error('Audit entry not found');
  const entry = rows[0];
  if (entry.undone) throw new Error('Already undone');

  const t = await getTable(entry.table_name);
  if (!t) throw new Error('Unknown table');
  const pk = pkOf(t);

  // do it in a transaction so bulk undo doesn't half finish
  await withTx(async (q) => {
    if (entry.action === 'create') {
      await q(`delete from ${qualified(t.name)} where ${ident(pk)} = $1`, [entry.row_pk]);
    } else if (entry.action === 'delete') {
      const data = entry.before_data;
      const cols = Object.keys(data);
      const params = cols.map((c) => data[c]);
      const ph = cols.map((_, i) => `$${i + 1}`);
      await q(
        `insert into ${qualified(t.name)} (${cols.map(ident).join(', ')}) values (${ph.join(', ')})`,
        params);
    } else if (entry.action === 'update' || entry.action === 'link') {
      await restoreRow(q, t, pk, entry.before_data);
    } else if (entry.action === 'bulk') {
      for (const item of entry.before_data.rows) await restoreRow(q, t, pk, item);
    } else {
      throw new Error(`Cannot undo a "${entry.action}" change`);
    }
    await q(`update audit_log set undone = true where id = $1`, [id]);
  });

  return { id, action: entry.action };
}

async function restoreRow(q, t, pk, before) {
  const cols = Object.keys(before).filter((c) => c !== pk);
  if (!cols.length) return;
  const sets = cols.map((c, i) => `${ident(c)} = $${i + 1}`);
  const params = cols.map((c) => before[c]);
  params.push(before[pk]);
  await q(
    `update ${qualified(t.name)} set ${sets.join(', ')} where ${ident(pk)} = $${params.length}`,
    params);
}
