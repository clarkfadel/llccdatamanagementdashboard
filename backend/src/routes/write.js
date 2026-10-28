import { Router } from 'express';
import { query, withTx } from '../db.js';
import { ident, qualified } from '../schema.js';
import { getTable, colExists, pkOf, getSchema } from '../meta.js';
import { logChange, recentChanges, undo } from '../audit.js';

export const write = Router();

async function fetchRow(table, pk, id) {
  const { rows } = await query(
    `select * from ${qualified(table)} where ${ident(pk)} = $1 limit 1`, [id]);
  return rows[0] || null;
}

function actor(req) {
  return req.user?.name || 'staff';
}

// update fields on a record
write.patch('/records/:table/:id', async (req, res, next) => {
  try {
    const table = await getTable(req.params.table);
    if (!table) return res.status(404).json({ error: 'Unknown table' });
    const pk = pkOf(table);

    const changes = req.body?.changes || {};
    const cols = Object.keys(changes).filter((c) => colExists(table, c) && c !== pk);
    if (!cols.length) return res.status(400).json({ error: 'No editable fields provided' });

    const before = await fetchRow(table.name, pk, req.params.id);
    if (!before) return res.status(404).json({ error: 'Not found' });

    const sets = cols.map((c, i) => `${ident(c)} = $${i + 1}`);
    const params = cols.map((c) => (changes[c] === '' ? null : changes[c]));
    params.push(req.params.id);
    await query(
      `update ${qualified(table.name)} set ${sets.join(', ')} where ${ident(pk)} = $${params.length}`,
      params);

    const after = await fetchRow(table.name, pk, req.params.id);
    const beforeSlice = Object.fromEntries([pk, ...cols].map((c) => [c, before[c]]));
    await logChange({ table: table.name, rowPk: req.params.id, action: 'update',
      before: beforeSlice, after, by: actor(req) });
    res.json({ record: after });
  } catch (e) { next(e); }
});

// link a -1 to the right record
write.post('/records/:table/:id/link', async (req, res, next) => {
  try {
    const table = await getTable(req.params.table);
    if (!table) return res.status(404).json({ error: 'Unknown table' });
    const pk = pkOf(table);
    const { column, value } = req.body || {};
    if (!column || !colExists(table, column)) return res.status(400).json({ error: 'Bad column' });

    const before = await fetchRow(table.name, pk, req.params.id);
    if (!before) return res.status(404).json({ error: 'Not found' });

    await query(
      `update ${qualified(table.name)} set ${ident(column)} = $1 where ${ident(pk)} = $2`,
      [value, req.params.id]);
    const after = await fetchRow(table.name, pk, req.params.id);
    await logChange({ table: table.name, rowPk: req.params.id, action: 'link',
      before: { [pk]: before[pk], [column]: before[column] }, after, by: actor(req) });
    res.json({ record: after });
  } catch (e) { next(e); }
});

// add new record, id = max + 1
write.post('/records/:table', async (req, res, next) => {
  try {
    const table = await getTable(req.params.table);
    if (!table) return res.status(404).json({ error: 'Unknown table' });
    const pk = pkOf(table);
    const data = req.body?.data || {};
    const cols = Object.keys(data).filter((c) => colExists(table, c) && c !== pk);

    // no auto increment on these ids, so if two people add at the same time
    // they could get the same max + 1. lock the table first to avoid that
    const newId = await withTx(async (q) => {
      await q('select pg_advisory_xact_lock(hashtext($1))', [table.name]);
      const idRes = await q(
        `select coalesce(max(nullif(${ident(pk)}, '-1')::bigint), 0) + 1 as next
           from ${qualified(table.name)}`);
      const id = String(idRes.rows[0].next);

      const allCols = [pk, ...cols];
      const params = [id, ...cols.map((c) => (data[c] === '' ? null : data[c]))];
      const ph = allCols.map((_, i) => `$${i + 1}`);
      await q(
        `insert into ${qualified(table.name)} (${allCols.map(ident).join(', ')}) values (${ph.join(', ')})`,
        params);
      return id;
    });

    const after = await fetchRow(table.name, pk, newId);
    await logChange({ table: table.name, rowPk: newId, action: 'create', after, by: actor(req) });
    res.status(201).json({ record: after, id: newId });
  } catch (e) { next(e); }
});

// bulk update
write.post('/records/:table/bulk', async (req, res, next) => {
  try {
    const table = await getTable(req.params.table);
    if (!table) return res.status(404).json({ error: 'Unknown table' });
    const pk = pkOf(table);
    const { ids = [], changes = {} } = req.body || {};
    const cols = Object.keys(changes).filter((c) => colExists(table, c) && c !== pk);
    if (!ids.length || !cols.length) return res.status(400).json({ error: 'Nothing to update' });

    const { rows: beforeRows } = await query(
      `select * from ${qualified(table.name)} where ${ident(pk)} = any($1)`, [ids]);
    const sets = cols.map((c, i) => `${ident(c)} = $${i + 1}`);
    const params = cols.map((c) => (changes[c] === '' ? null : changes[c]));
    params.push(ids);
    await query(
      `update ${qualified(table.name)} set ${sets.join(', ')} where ${ident(pk)} = any($${params.length})`,
      params);

    const beforeSlim = beforeRows.map((r) => Object.fromEntries([pk, ...cols].map((c) => [c, r[c]])));
    await logChange({ table: table.name, rowPk: null, action: 'bulk',
      before: { rows: beforeSlim }, after: { changes, count: ids.length }, by: actor(req) });
    res.json({ updated: ids.length });
  } catch (e) { next(e); }
});

// merge duplicate: move references to target then delete source
write.post('/records/:table/merge', async (req, res, next) => {
  try {
    const table = await getTable(req.params.table);
    if (!table) return res.status(404).json({ error: 'Unknown table' });
    const pk = pkOf(table);
    const { sourceId, targetId } = req.body || {};
    if (!sourceId || !targetId || sourceId === targetId) {
      return res.status(400).json({ error: 'Need distinct source and target' });
    }

    const { tables } = await getSchema();
    const { source, repointed } = await withTx(async (q) => {
      // save source row for audit log
      const src = (await q(
        `select * from ${qualified(table.name)} where ${ident(pk)} = $1 limit 1`, [sourceId])).rows[0] || null;

      // only update the other tables. if we update this table too, the source
      // row turns into a copy of the target and the delete below won't find it
      let count = 0;
      for (const other of Object.values(tables)) {
        if (other.name === table.name || !colExists(other, pk)) continue;
        const r = await q(
          `update ${qualified(other.name)} set ${ident(pk)} = $1 where ${ident(pk)} = $2`,
          [targetId, sourceId]);
        count += r.rowCount;
      }
      await q(`delete from ${qualified(table.name)} where ${ident(pk)} = $1`, [sourceId]);
      return { source: src, repointed: count };
    });

    await logChange({ table: table.name, rowPk: sourceId, action: 'merge',
      before: source, after: { mergedInto: targetId, repointed }, by: actor(req) });
    res.json({ mergedInto: targetId, repointedReferences: repointed });
  } catch (e) { next(e); }
});

// audit log
write.get('/audit', async (req, res, next) => {
  try { res.json({ changes: await recentChanges(Number(req.query.limit) || 50) }); }
  catch (e) { next(e); }
});

write.post('/audit/:id/undo', async (req, res, next) => {
  try { res.json(await undo(Number(req.params.id))); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
