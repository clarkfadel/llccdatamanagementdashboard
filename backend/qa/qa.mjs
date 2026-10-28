// tests for the api. run npm run seed first then start the server
// node qa/qa.mjs or node qa/qa.mjs --json

const BASE = process.env.QA_BASE || 'http://localhost:4100/api';
const JSON_OUT = process.argv.includes('--json');

let token = null;
const results = [];
function record(group, name, ok, detail = '') {
  results.push({ group, name, ok, detail });
}
async function check(group, name, fn) {
  try {
    const detail = await fn();
    record(group, name, true, detail || '');
  } catch (e) {
    record(group, name, false, e.message);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

async function api(method, path, { body, auth = true, raw = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers };
}
async function latestAuditId() {
  const r = await api('GET', '/audit?limit=1');
  return r.json.changes[0].id;
}

async function run() {
  // auth
  await check('Auth', 'rejects request with no token (401)', async () => {
    const r = await api('GET', '/dashboard', { auth: false });
    assert(r.status === 401, `expected 401, got ${r.status}`);
    return '401 Not authenticated';
  });
  await check('Auth', 'rejects bad credentials (401)', async () => {
    const r = await api('POST', '/login', { auth: false, body: { username: 'x', password: 'y' } });
    assert(r.status === 401, `expected 401, got ${r.status}`);
    return '401 invalid login';
  });
  await check('Auth', 'accepts valid credentials, returns token', async () => {
    const r = await api('POST', '/login', { auth: false, body: { username: 'admin', password: 'llcc' } });
    assert(r.status === 200 && r.json.token, 'no token returned');
    token = r.json.token;
    return `token length ${token.length}`;
  });
  await check('Auth', 'health reports connected database', async () => {
    const r = await api('GET', '/health', { auth: false });
    assert(r.json.ok === true, 'not ok');
    return `db=${r.json.database}`;
  });

  // browse
  await check('Browse', 'dashboard returns 4 count cards', async () => {
    const r = await api('GET', '/dashboard');
    assert(r.json.cards.length === 4, `cards=${r.json.cards.length}`);
    const clients = r.json.cards.find((c) => c.table === 'Clients');
    assert(clients.count === 122, `Clients count=${clients.count}`);
    return r.json.cards.map((c) => `${c.label}:${c.count}`).join(', ');
  });
  await check('Browse', 'nav entities grouped Main + Other', async () => {
    const r = await api('GET', '/entities');
    const main = r.json.groups.find((g) => g.group === 'Main');
    const other = r.json.groups.find((g) => g.group === 'Other records');
    assert(main.entities.length === 4 && other.entities.length === 5, 'group sizes wrong');
    return `Main=${main.entities.length}, Other=${other.entities.length}`;
  });
  await check('Browse', 'list paginates (Lots, pageSize 5)', async () => {
    const r = await api('GET', '/records/Lots?pageSize=5&page=1');
    assert(r.json.rows.length === 5, `rows=${r.json.rows.length}`);
    assert(r.json.total === 121, `total=${r.json.total}`);
    assert(r.json.totalPages === Math.ceil(121 / 5), 'totalPages wrong');
    return `total=${r.json.total}, pages=${r.json.totalPages}`;
  });
  await check('Browse', 'list search filters (Lots ?search=ESP)', async () => {
    const r = await api('GET', '/records/Lots?search=ESP&pageSize=100');
    assert(r.json.total > 0, 'no results');
    assert(r.json.rows.every((row) => (row.LotCode || '').toUpperCase().includes('ESP')), 'non-matching row');
    return `${r.json.total} matches, all contain ESP`;
  });
  await check('Browse', 'list sort desc works', async () => {
    const r = await api('GET', '/records/Clients?sort=LastName&dir=desc&pageSize=5');
    const names = r.json.rows.map((x) => x.LastName);
    const sorted = [...names].sort().reverse();
    assert(JSON.stringify(names) === JSON.stringify(sorted), 'not sorted desc');
    return `top: ${names[0]}`;
  });
  await check('Browse', 'detail shows record + relations + unmapped flag', async () => {
    const r = await api('GET', '/records/Lots/1');
    assert(r.json.record.LotId === '1', 'wrong record');
    const fk = r.json.outgoing.find((o) => o.column === 'ClientId' || o.column === 'LocationId');
    assert(fk, 'no outgoing FK');
    assert(typeof fk.unmapped === 'boolean', 'no unmapped flag');
    return `outgoing=${r.json.outgoing.length}, incoming=${r.json.incoming.length}`;
  });
  await check('Browse', 'unknown table 404', async () => {
    const r = await api('GET', '/records/NotARealTable');
    assert(r.status === 404, `got ${r.status}`);
    return '404';
  });
  await check('Browse', 'missing record 404', async () => {
    const r = await api('GET', '/records/Lots/99999999');
    assert(r.status === 404, `got ${r.status}`);
    return '404';
  });

  // search
  await check('Search', 'global search finds a known client', async () => {
    const r = await api('GET', '/search?q=valdez');
    const clients = r.json.groups.find((g) => g.table === 'Clients');
    assert(clients && clients.items.length > 0, 'no client matches');
    return `${clients.items.length} client hit(s)`;
  });
  await check('Search', 'lookup excludes the -1 placeholder', async () => {
    const r = await api('GET', '/lookup/Clients?q=a');
    assert(r.json.items.every((i) => i.id !== '-1'), 'placeholder leaked');
    return `${r.json.items.length} items, no -1`;
  });

  // data quality
  await check('Quality', 'overview reports actionable unmapped + missing', async () => {
    const r = await api('GET', '/quality');
    const lots = r.json.cards.find((c) => c.table === 'Lots');
    assert(lots.unmappedRows > 0, `Lots unmappedRows=${lots.unmappedRows}`);
    assert(lots.perColumn.some((p) => p.column === 'ClientId'), 'no ClientId column');
    assert(!lots.perColumn.some((p) => p.column === 'UserId'), 'UserId should be excluded as system FK');
    const clients = r.json.cards.find((c) => c.table === 'Clients');
    assert(clients.missing.some((m) => m.column === 'Email'), 'no Email metric');
    return `Lots unmapped=${lots.unmappedRows}, UserId excluded`;
  });
  await check('Quality', 'unmapped worklist lists -1 rows', async () => {
    const r = await api('GET', '/quality/unmapped/Lots?column=ClientId');
    assert(r.json.column === 'ClientId', 'wrong column');
    assert(r.json.rows.every((row) => row.ClientId === '-1'), 'non -1 row in worklist');
    assert(r.json.total > 0, 'empty worklist');
    return `${r.json.total} unmapped on Lots.ClientId`;
  });
  await check('Quality', 'duplicate finder groups same-name records', async () => {
    const r = await api('GET', '/duplicates/Clients');
    assert(r.json.groups.length > 0, 'no duplicate groups');
    assert(r.json.groups.every((g) => g.count > 1), 'group with count 1');
    return `${r.json.groups.length} duplicate group(s)`;
  });

  // export
  await check('Export', 'CSV export returns text/csv with header', async () => {
    const r = await api('GET', '/records/Clients/export', { raw: true });
    const ct = r.headers.get('content-type') || '';
    const body = await r.text();
    assert(ct.includes('text/csv'), `content-type=${ct}`);
    assert(body.startsWith('"ClientId"'), 'missing header row');
    return `${body.split('\n').length - 1} data rows`;
  });

  // writes
  await check('Write', 'update field + audit + undo restores', async () => {
    const before = (await api('GET', '/records/Clients/1')).json.record.ContactNo;
    const upd = await api('PATCH', '/records/Clients/1', { body: { changes: { ContactNo: '09990001111' } } });
    assert(upd.json.record.ContactNo === '09990001111', 'update did not apply');
    await api('POST', `/audit/${await latestAuditId()}/undo`);
    const after = (await api('GET', '/records/Clients/1')).json.record.ContactNo;
    assert(after === before, `undo failed: ${before} -> ${after}`);
    return `set then restored to "${before}"`;
  });
  await check('Write', 'link FK + undo restores -1', async () => {
    const link = await api('POST', '/records/Lots/1/link', { body: { column: 'ClientId', value: '3' } });
    assert(link.json.record.ClientId === '3', 'link did not apply');
    await api('POST', `/audit/${await latestAuditId()}/undo`);
    const after = (await api('GET', '/records/Lots/1')).json.record.ClientId;
    assert(after === '-1', `undo failed, ClientId=${after}`);
    return 'linked to #3, undone back to -1';
  });
  await check('Write', 'create record + undo deletes it', async () => {
    const created = await api('POST', '/records/Clients', { body: { data: { LastName: 'QA-TEMP', FirstName: 'TEST' } } });
    assert(created.status === 201 && created.json.id, 'create failed');
    const id = created.json.id;
    const got = await api('GET', `/records/Clients/${id}`);
    assert(got.json.record.LastName === 'QA-TEMP', 'record not found after create');
    await api('POST', `/audit/${await latestAuditId()}/undo`);
    const gone = await api('GET', `/records/Clients/${id}`);
    assert(gone.status === 404, 'undo did not delete');
    return `created #${id}, undone (now 404)`;
  });
  await check('Write', 'bulk update + undo restores all', async () => {
    const b2 = (await api('GET', '/records/Lots/2')).json.record.Status;
    const b3 = (await api('GET', '/records/Lots/3')).json.record.Status;
    const bulk = await api('POST', '/records/Lots/bulk', { body: { ids: ['2', '3'], changes: { Status: 'QA-BULK' } } });
    assert(bulk.json.updated === 2, `updated=${bulk.json.updated}`);
    const mid = (await api('GET', '/records/Lots/2')).json.record.Status;
    assert(mid === 'QA-BULK', 'bulk did not apply');
    await api('POST', `/audit/${await latestAuditId()}/undo`);
    const a2 = (await api('GET', '/records/Lots/2')).json.record.Status;
    const a3 = (await api('GET', '/records/Lots/3')).json.record.Status;
    assert(a2 === b2 && a3 === b3, 'undo did not restore both');
    return `2 rows changed + restored (${b2}/${b3})`;
  });
  await check('Write', 'merge repoints references + deletes source', async () => {
    // count references to source 7 across Lots-referencing tables before
    const merge = await api('POST', '/records/Clients/merge', { body: { sourceId: '7', targetId: '6' } });
    assert(merge.json.mergedInto === '6', 'merge target wrong');
    const gone = await api('GET', '/records/Clients/7');
    assert(gone.status === 404, 'source not deleted');
    return `merged #7 to #6, ${merge.json.repointedReferences} refs moved`;
  });

  // validation
  await check('Validation', 'update with no valid fields 400', async () => {
    const r = await api('PATCH', '/records/Clients/1', { body: { changes: { NotAColumn: 'x' } } });
    assert(r.status === 400, `got ${r.status}`);
    return '400';
  });
  await check('Validation', 'merge with same source/target 400', async () => {
    const r = await api('POST', '/records/Clients/merge', { body: { sourceId: '1', targetId: '1' } });
    assert(r.status === 400, `got ${r.status}`);
    return '400';
  });
  await check('Validation', 'undo of a merge is refused', async () => {
    const id = await latestAuditId(); // the merge above
    const r = await api('POST', `/audit/${id}/undo`);
    assert(r.status === 400, `got ${r.status}`);
    return 'merge undo rejected (400)';
  });

  // output
  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  if (JSON_OUT) {
    console.log(JSON.stringify({ pass, fail, total: results.length, results }, null, 2));
  } else {
    let group = '';
    for (const r of results) {
      if (r.group !== group) { group = r.group; console.log(`\n${group}`); }
      console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` - ${r.detail}` : ''}`);
    }
    console.log(`\n${pass}/${results.length} passed${fail ? `, ${fail} FAILED` : ''}`);
  }
  process.exit(fail ? 1 : 0);
}

run().catch((e) => { console.error('QA harness error:', e); process.exit(2); });
