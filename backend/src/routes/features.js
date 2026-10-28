import { Router } from 'express';
import { query } from '../db.js';
import { ident, qualified, naturalOrder } from '../schema.js';
import { getTable, colExists, pkOf, fkColumns, getSchema } from '../meta.js';
import { entityConfig, DASHBOARD_CARDS } from '../entities.js';

export const features = Router();

const SEARCH_ENTITIES = ['Clients', 'Lots', 'Deceased', 'Transactions'];

const SYSTEM_FK = new Set(['UserId']);
const actionableFks = (fks) => fks.filter((f) => !SYSTEM_FK.has(f.column));

// global search
features.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ query: q, groups: [] });
    const groups = [];
    for (const name of SEARCH_ENTITIES) {
      const table = await getTable(name);
      const cfg = entityConfig(name);
      if (!table || !cfg) continue;
      const cols = (cfg.search || []).filter((c) => colExists(table, c));
      if (!cols.length) continue;
      const where = cols.map((c) => `${ident(c)} ilike $1`).join(' or ');
      const { rows } = await query(
        `select * from ${qualified(name)} where ${where} limit 6`, [`%${q}%`]);
      if (rows.length) {
        groups.push({
          table: name, label: cfg.label,
          items: rows.map((r) => ({ id: r[pkOf(table)], title: cfg.title(r) })),
        });
      }
    }
    res.json({ query: q, groups });
  } catch (e) { next(e); }
});

// search for the link picker
features.get('/lookup/:table', async (req, res, next) => {
  try {
    const table = await getTable(req.params.table);
    const cfg = entityConfig(table?.name);
    if (!table || !cfg) return res.status(404).json({ error: 'Unknown table' });
    const pk = pkOf(table);
    const q = (req.query.q || '').trim();
    const cols = (cfg.search || []).filter((c) => colExists(table, c));
    let rows;
    if (q && cols.length) {
      const where = cols.map((c) => `${ident(c)} ilike $1`).join(' or ');
      ({ rows } = await query(
        `select * from ${qualified(table.name)} where ${ident(pk)} <> '-1' and (${where}) limit 12`,
        [`%${q}%`]));
    } else {
      ({ rows } = await query(
        `select * from ${qualified(table.name)} where ${ident(pk)} <> '-1' limit 12`));
    }
    res.json({ items: rows.map((r) => ({ id: r[pk], label: cfg.title(r) })) });
  } catch (e) { next(e); }
});

// data quality
features.get('/quality', async (_req, res, next) => {
  try {
    const cards = [];
    for (const card of DASHBOARD_CARDS) {
      const table = await getTable(card.table);
      if (!table) continue;
      const pk = pkOf(table);
      const fks = actionableFks(await fkColumns(table));

      const total = (await query(`select count(*)::int n from ${qualified(table.name)}`)).rows[0].n;

      // rows with -1
      let unmappedRows = 0;
      const perColumn = [];
      if (fks.length) {
        const anyUnmapped = fks.map((f) => `${ident(f.column)} = '-1'`).join(' or ');
        unmappedRows = (await query(
          `select count(*)::int n from ${qualified(table.name)} where ${ident(pk)} <> '-1' and (${anyUnmapped})`
        )).rows[0].n;
        for (const f of fks) {
          const n = (await query(
            `select count(*)::int n from ${qualified(table.name)} where ${ident(f.column)} = '-1'`
          )).rows[0].n;
          perColumn.push({ column: f.column, target: f.target, unmapped: n });
        }
      }

      // missing fields
      const missing = [];
      for (const c of ['Email', 'ContactNo', 'Address', 'BirthDate']) {
        if (colExists(table, c)) {
          const n = (await query(
            `select count(*)::int n from ${qualified(table.name)} where ${ident(c)} is null`
          )).rows[0].n;
          missing.push({ column: c, missing: n });
        }
      }

      cards.push({ table: table.name, label: card.label, total, unmappedRows, perColumn, missing });
    }
    res.json({ cards });
  } catch (e) { next(e); }
});

// worklist of -1 rows
features.get('/quality/unmapped/:table', async (req, res, next) => {
  try {
    const table = await getTable(req.params.table);
    const cfg = entityConfig(table?.name) || {};
    if (!table) return res.status(404).json({ error: 'Unknown table' });
    const pk = pkOf(table);
    const fks = actionableFks(await fkColumns(table));
    const column = req.query.column && colExists(table, req.query.column)
      ? req.query.column : fks[0]?.column;
    if (!column) return res.json({ table: table.name, column: null, rows: [], columns: [] });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    const total = (await query(
      `select count(*)::int n from ${qualified(table.name)} where ${ident(column)} = '-1' and ${ident(pk)} <> '-1'`
    )).rows[0].n;
    const { rows } = await query(
      `select * from ${qualified(table.name)} where ${ident(column)} = '-1' and ${ident(pk)} <> '-1'
        order by ${naturalOrder(pk)} limit ${pageSize} offset ${offset}`);

    res.json({
      table: table.name, label: cfg.label || table.name, primaryKey: pk,
      column, fkColumns: fks,
      listColumns: (cfg.listColumns || table.columns.slice(0, 6).map((c) => c.name))
        .filter((c) => colExists(table, c)),
      page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
      rows,
    });
  } catch (e) { next(e); }
});

// duplicates (same name)
features.get('/duplicates/:table', async (req, res, next) => {
  try {
    const table = await getTable(req.params.table);
    const cfg = entityConfig(table?.name) || {};
    if (!table) return res.status(404).json({ error: 'Unknown table' });
    const pk = pkOf(table);
    const keys = (cfg.search || []).filter((c) => colExists(table, c)).slice(0, 2);
    if (keys.length < 1) return res.json({ groups: [] });

    const keyExpr = keys.map((k) => `coalesce(${ident(k)}, '')`).join(` || '|' || `);
    const { rows } = await query(
      `select ${keyExpr} as k, array_agg(${ident(pk)}) as ids, count(*)::int n
         from ${qualified(table.name)}
        where ${ident(pk)} <> '-1'
        group by k having count(*) > 1
        order by n desc limit 50`);
    const groups = [];
    for (const g of rows) {
      const recs = await query(
        `select * from ${qualified(table.name)} where ${ident(pk)} = any($1)`, [g.ids]);
      groups.push({ key: g.k, count: g.n, records: recs.rows, primaryKey: pk,
        listColumns: keys });
    }
    res.json({ table: table.name, label: cfg.label || table.name, groups });
  } catch (e) { next(e); }
});

// export csv
features.get('/records/:table/export', async (req, res, next) => {
  try {
    const table = await getTable(req.params.table);
    const cfg = entityConfig(table?.name) || {};
    if (!table) return res.status(404).json({ error: 'Unknown table' });
    const search = (req.query.search || '').trim();
    const params = [];
    let where = '';
    if (search) {
      const cols = (cfg.search || table.textColumns).filter((c) => colExists(table, c));
      if (cols.length) {
        params.push(`%${search}%`);
        where = 'where ' + cols.map((c) => `${ident(c)} ilike $1`).join(' or ');
      }
    }
    const { rows } = await query(`select * from ${qualified(table.name)} ${where}`, params);
    const cols = table.columns.map((c) => c.name);
    const esc = (v) => (v == null ? '' : `"${String(v).replace(/"/g, '""')}"`);
    const csv = [cols.map((c) => `"${c}"`).join(','),
      ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${table.name}.csv"`);
    res.send(csv);
  } catch (e) { next(e); }
});
