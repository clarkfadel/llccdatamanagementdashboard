import { Router } from 'express';
import { query } from '../db.js';
import { getSchema, getTable, ident, qualified, naturalOrder } from '../schema.js';
import { DASHBOARD_CARDS, NAV_GROUPS, entityConfig } from '../entities.js';
import { colExists, pkOf, tableByPkColumn } from '../meta.js';

export const api = Router();

const UNMAPPED = '-1';

api.get('/dashboard', async (_req, res, next) => {
  try {
    const cards = [];
    for (const card of DASHBOARD_CARDS) {
      const t = await getTable(card.table);
      if (!t) continue;
      const { rows } = await query(`select count(*)::bigint as n from ${qualified(card.table)}`);
      cards.push({ table: card.table, label: card.label, count: rows[0].n });
    }
    res.json({ cards });
  } catch (e) { next(e); }
});

// grouped list of browsable entities (for nav)
api.get('/entities', async (_req, res, next) => {
  try {
    const { tables } = await getSchema();
    const groups = NAV_GROUPS.map((g) => ({
      group: g.group,
      entities: g.tables
        .filter((name) => tables[name])
        .map((name) => ({ table: name, label: entityConfig(name)?.label || name })),
    })).filter((g) => g.entities.length);
    res.json({ groups });
  } catch (e) { next(e); }
});

// paginated, searchable list
api.get('/records/:table', async (req, res, next) => {
  try {
    const table = await getTable(req.params.table);
    if (!table) return res.status(404).json({ error: 'Unknown table' });
    const cfg = entityConfig(table.name) || {};

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
    const offset = (page - 1) * pageSize;

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

    const pk = pkOf(table);
    let sort = req.query.sort && colExists(table, req.query.sort) ? req.query.sort : pk;
    const dir = String(req.query.dir).toLowerCase() === 'desc' ? 'desc' : 'asc';

    const totalRes = await query(
      `select count(*)::bigint as n from ${qualified(table.name)} ${where}`, params);
    const total = totalRes.rows[0].n;

    const rowsRes = await query(
      `select * from ${qualified(table.name)} ${where}
        order by ${naturalOrder(sort, dir)}
        limit ${pageSize} offset ${offset}`, params);

    res.json({
      table: table.name,
      label: cfg.label || table.name,
      primaryKey: pk,
      columns: table.columns.map((c) => c.name),
      listColumns: (cfg.listColumns || table.columns.slice(0, 6).map((c) => c.name))
        .filter((c) => colExists(table, c)),
      page, pageSize, total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      rows: rowsRes.rows,
    });
  } catch (e) { next(e); }
});

// single record + related data
api.get('/records/:table/:id', async (req, res, next) => {
  try {
    const table = await getTable(req.params.table);
    if (!table) return res.status(404).json({ error: 'Unknown table' });
    const cfg = entityConfig(table.name) || {};
    const pk = pkOf(table);

    const recRes = await query(
      `select * from ${qualified(table.name)} where ${ident(pk)} = $1 limit 1`,
      [req.params.id]);
    if (!recRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const record = recRes.rows[0];

    // linked records (ex. ClientId)
    const outgoing = [];
    for (const col of table.columns) {
      const name = col.name;
      if (name === pk || !/Id$/.test(name)) continue;
      const targetName = await tableByPkColumn(name);
      if (!targetName || targetName === table.name) continue;
      const value = record[name];
      const ref = {
        column: name, table: targetName,
        label: entityConfig(targetName)?.label || targetName,
        value, unmapped: value === UNMAPPED, display: null,
      };
      if (value != null && value !== UNMAPPED) {
        const tgt = await getTable(targetName);
        const tgtPk = pkOf(tgt);
        const r = await query(
          `select * from ${qualified(targetName)} where ${ident(tgtPk)} = $1 limit 1`, [value]);
        if (r.rows.length) {
          const tcfg = entityConfig(targetName);
          ref.display = tcfg?.title ? tcfg.title(r.rows[0]) : value;
        }
      }
      outgoing.push(ref);
    }

    // other tables that point to this record
    const incoming = [];
    const { tables } = await getSchema();
    for (const other of Object.values(tables)) {
      if (other.name === table.name) continue;
      if (!colExists(other, pk)) continue;
      const ocfg = entityConfig(other.name) || {};
      const cntRes = await query(
        `select count(*)::bigint as n from ${qualified(other.name)} where ${ident(pk)} = $1`,
        [req.params.id]);
      const count = cntRes.rows[0].n;
      if (!count) continue;
      const sample = await query(
        `select * from ${qualified(other.name)} where ${ident(pk)} = $1 limit 5`,
        [req.params.id]);
      incoming.push({
        table: other.name,
        label: ocfg.label || other.name,
        primaryKey: pkOf(other),
        via: pk,
        count,
        listColumns: (ocfg.listColumns || other.columns.slice(0, 5).map((c) => c.name))
          .filter((c) => colExists(other, c)),
        rows: sample.rows,
      });
    }

    res.json({
      table: table.name,
      label: cfg.label || table.name,
      primaryKey: pk,
      columns: table.columns.map((c) => c.name),
      title: cfg.title ? cfg.title(record) : record[pk],
      record,
      outgoing,
      incoming,
    });
  } catch (e) { next(e); }
});
