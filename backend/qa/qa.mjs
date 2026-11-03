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
    // 120 lots, the -1 placeholder row is not shown
    assert(r.json.total === 120, `total=${r.json.total}`);
    assert(r.json.totalPages === Math.ceil(120 / 5), 'totalPages wrong');
    assert(!r.json.rows.some((row) => row.LotId === '-1'), 'placeholder row is showing');
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
  await check('Write', 'link FK + undo restores old value', async () => {
    const before = (await api('GET', '/records/Lots/1')).json.record.ClientId;
    const value = before === '3' ? '4' : '3';
    const link = await api('POST', '/records/Lots/1/link', { body: { column: 'ClientId', value } });
    assert(link.json.record.ClientId === value, 'link did not apply');
    await api('POST', `/audit/${await latestAuditId()}/undo`);
    const after = (await api('GET', '/records/Lots/1')).json.record.ClientId;
    assert(after === before, `undo failed, ClientId=${after}`);
    return `linked to #${value}, undone back to ${before}`;
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

  // filters
  await check('Filters', 'date range only returns rows inside it', async () => {
    const r = await api('GET', '/records/Deceased?pageSize=100&f_DeathDate_from=2000-01-01&f_DeathDate_to=2009-12-31');
    assert(r.json.total > 0, 'no rows in range');
    assert(r.json.rows.every((x) => x.DeathDate >= '2000-01-01' && x.DeathDate <= '2009-12-31'), 'row outside range');
    return `${r.json.total} deceased died 2000-2009`;
  });
  await check('Filters', 'linked filter splits linked and not linked', async () => {
    const all = (await api('GET', '/records/Deceased?pageSize=1')).json.total;
    const yes = await api('GET', '/records/Deceased?pageSize=100&f_LotId=yes');
    const no = await api('GET', '/records/Deceased?pageSize=100&f_LotId=no');
    assert(yes.json.rows.every((x) => x.LotId !== '-1'), 'linked filter has -1');
    assert(no.json.rows.every((x) => x.LotId === '-1' || x.LotId === null), 'not linked filter has links');
    assert(yes.json.total + no.json.total === all, 'counts do not add up');
    return `${yes.json.total} linked + ${no.json.total} not linked = ${all}`;
  });
  await check('Filters', 'yes/no and dropdown filters', async () => {
    const r = await api('GET', '/records/Rent?pageSize=100&f_Active=True');
    assert(r.json.rows.every((x) => x.Active === 'True'), 'inactive row in result');
    const genders = (await api('GET', '/records/Clients?pageSize=1')).json.filters.find((f) => f.column === 'Gender').options;
    assert(genders.includes('Male') && genders.includes('Female'), `options ${genders}`);
    return `${r.json.total} active rentals, gender options ${genders.join('/')}`;
  });
  await check('Filters', 'csv export uses the same filters', async () => {
    const res = await api('GET', '/records/Rent/export?f_Active=True', { raw: true });
    const lines = (await res.text()).trim().split('\n').length - 1;
    const total = (await api('GET', '/records/Rent?pageSize=1&f_Active=True')).json.total;
    assert(lines === total, `csv ${lines} rows, list ${total}`);
    return `${lines} rows in both`;
  });

  // forms
  await check('Forms', 'fields tell the form what input to use', async () => {
    const f = (await api('GET', '/records/Deceased?pageSize=1')).json.fields;
    const kind = (n) => f.find((x) => x.name === n)?.kind;
    assert(f[0].name === 'Name' && f[0].required, 'Name should be first and required');
    assert(kind('DeathDate') === 'date' && kind('LotId') === 'link' && kind('TimeStamp') === 'auto', 'wrong kinds');
    return 'Name text*, DeathDate date, LotId link, TimeStamp auto';
  });
  await check('Forms', 'missing required fields 400', async () => {
    const r = await api('POST', '/records/Deceased', { body: { data: { CauseOfDeath: 'Old age' } } });
    assert(r.status === 400 && /Name/.test(r.json.error), `got ${r.status} ${r.json?.error}`);
    return r.json.error;
  });
  await check('Forms', 'new deceased name is saved in Remarks + undo', async () => {
    const r = await api('POST', '/records/Deceased', { body: { data: {
      Name: 'qa test person', DeathDate: '2026-01-02', PermitNo: 'MLA-0000', LotId: '-1' } } });
    assert(r.status === 201, `create ${r.status}`);
    const got = (await api('GET', `/records/Deceased/${r.json.id}`)).json;
    assert(got.record.Remarks === 'Name=QA TEST PERSON' && got.record.Name === 'QA TEST PERSON', got.record.Remarks);
    await api('POST', `/audit/${await latestAuditId()}/undo`);
    return `created #${r.json.id} as ${got.title}, undone`;
  });
  await check('Forms', 'editing Name keeps the rest of Remarks + undo', async () => {
    const before = (await api('GET', '/records/Deceased/1')).json.record.Remarks;
    await api('PATCH', '/records/Deceased/1', { body: { changes: { Name: 'renamed person' } } });
    const after = (await api('GET', '/records/Deceased/1')).json.record.Remarks;
    assert(after === before.replace(/Name=[^|]+/, 'Name=RENAMED PERSON '), `got ${after}`);
    await api('POST', `/audit/${await latestAuditId()}/undo`);
    const restored = (await api('GET', '/records/Deceased/1')).json.record.Remarks;
    assert(restored === before, 'undo did not restore Remarks');
    return 'name changed, other parts kept, undone';
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
