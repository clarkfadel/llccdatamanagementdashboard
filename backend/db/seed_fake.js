// makes fake data for testing and loads it to llcc_dev (no real data here)
// I copied the problems of the real db so all the features can be tested:
// - a -1 "unknown" row in every table
// - most foreign keys are -1, only some are linked
// - some nulls (no email, contact no, middle name)
// - a few duplicate clients
// - Status / Active saved as "True"/"False" text
import 'dotenv/config';
import pg from 'pg';
import { writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV_DIR = join(HERE, '..', '..', 'sample_csv');

const { Client } = pg;

// random helpers
let seed = 20260618;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
const pick = (a) => a[Math.floor(rnd() * a.length)];
const chance = (p) => rnd() < p;
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
function pad(n, w) { return String(n).padStart(w, '0'); }

const LAST = ['SANTOS', 'REYES', 'CRUZ', 'BAUTISTA', 'OCAMPO', 'GARCIA', 'MENDOZA',
  'TORRES', 'FLORES', 'RAMOS', 'AQUINO', 'DELA CRUZ', 'VILLANUEVA', 'NAVARRO',
  'SALAZAR', 'DOMINGO', 'CASTILLO', 'FERNANDEZ', 'RIVERA', 'MARQUEZ', 'GONZALES',
  'PASCUAL', 'AGUILAR', 'VALDEZ', 'SORIANO', 'GUTIERREZ', 'MERCADO', 'DIONISIO'];
const FIRST = ['JOSE', 'MARIA', 'ANTONIO', 'JUAN', 'ROSA', 'PEDRO', 'ANA', 'MANUEL',
  'CARMEN', 'RICARDO', 'LUZ', 'ROBERTO', 'ELENA', 'FRANCISCO', 'TERESA', 'EDUARDO',
  'CORAZON', 'ANGEL', 'NORMA', 'DANILO', 'LOURDES', 'ERNESTO', 'GLORIA', 'RAMON'];
const MID = LAST;
const SUFFIX = [null, null, null, null, 'JR', 'SR', 'III'];
const GENDER = ['Male', 'Female'];
const RELIGION = [null, null, 'Roman Catholic', 'Roman Catholic', 'Iglesia ni Cristo', 'Protestant'];
const BARANGAY = ['BAGONG SILANG', 'CAMARIN', 'DEPARO', 'BAGUMBONG', 'LLANO',
  'KAYBIGA', 'TALA', 'PANGARAP', 'NORTH CALOOCAN', 'SOUTH CALOOCAN'];
const STREETS = ['NARRA', 'ACACIA', 'MOLAVE', 'MABOLO', 'SAMPAGUITA', 'ILANG-ILANG',
  'KAMAGONG', 'YAKAL', 'DAO', 'TINDALO'];
const SECTIONS = ['ST. FRANCIS', 'ST. PETER', 'ST. JOSEPH', 'HOLY CROSS', 'STA. RITA',
  'SACRED HEART', 'STO. NINO', 'ST. PAUL'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const CAUSE = [null, null, 'Cardiac arrest', 'Pneumonia', 'Natural causes',
  'Hypertension', 'Old age', 'Respiratory failure'];
const BANKS = ['BDO', 'BPI', 'Metrobank', 'Landbank', 'PNB', 'Security Bank'];

function fullName() {
  return { last: pick(LAST), first: pick(FIRST),
    mid: chance(0.5) ? pick(MID) : null, suffix: pick(SUFFIX) };
}
function address() {
  return `B-${int(1, 40)} L-${int(1, 30)} ${pick(STREETS)} ST., ${pick(BARANGAY)}, CALOOCAN CITY`;
}
function contact() { return chance(0.4) ? `09${int(100000000, 999999999)}` : null; }
function email(first, last) {
  return chance(0.25) ? `${first}.${last}@example.com`.toLowerCase().replace(/[^a-z.@]/g, '') : null;
}
function ts() { return `2026-05-23 ${pad(int(8, 18), 2)}:${pad(int(0, 59), 2)}:${pad(int(0, 59), 2)}.000000+08`; }
function dateBetween(y0, y1) {
  return `${int(y0, y1)}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`;
}
function lotCode() { return `ESP. ${int(1965, 2010)}-${pick(ROMAN)}-${pick('ABCDEFGH')}`; }
function permit() { return chance(0.5) ? `MLA-${int(1000, 9999)}` : null; }

// foreign key value: mostly -1 (unresolved), occasionally a real id
function fk(ids, resolveProb) {
  if (!ids.length || !chance(resolveProb)) return '-1';
  return String(pick(ids));
}

const tables = {}; // name -> { columns:[], rows:[[...]] }
function table(name, columns) { tables[name] = { columns, rows: [] }; return tables[name]; }
function add(t, obj) { t.rows.push(t.columns.map((c) => obj[c] ?? null)); }

function build() {
  // Users (app accounts)
  const users = table('User', ['UserId', 'FirstName', 'LastName', 'Email', 'Status', 'Created_At', 'Updated_At']);
  add(users, { UserId: '-1', LastName: 'Migration User', Email: 'migration@llcc.local', Created_At: '2026-05-23', Updated_At: '2026-05-23' });
  const userIds = [];
  for (let i = 1; i <= 6; i++) {
    const n = fullName();
    add(users, { UserId: String(i), FirstName: n.first, LastName: n.last,
      Email: `${n.first}.${n.last}@llcc.local`.toLowerCase(), Status: pick(['True', 'False']),
      Created_At: '2026-05-23', Updated_At: '2026-05-23' });
    userIds.push(i);
  }

  // Location lookup
  const loc = table('Location', ['LocationId', 'Name']);
  add(loc, { LocationId: '-1', Name: 'UNKNOWN / UNMAPPED LOCATION' });
  const locIds = [];
  for (let i = 1; i <= 24; i++) { add(loc, { LocationId: String(i), Name: pick(SECTIONS) + ` SECTION ${pick(ROMAN)}` }); locIds.push(i); }

  // Clients
  const clients = table('Clients', ['ClientId', 'LastName', 'FirstName', 'MiddleName', 'Suffix',
    'BirthDate', 'Gender', 'Religion', 'Address', 'ContactNo', 'Email', 'ClientTypeId', 'Reference', 'TimeStamp', 'UserId']);
  add(clients, { ClientId: '-1', LastName: 'UNKNOWN / UNMAPPED CLIENT', UserId: '-1', TimeStamp: ts() });
  const clientIds = [];
  let cid = 1;
  for (let i = 0; i < 120; i++) {
    const n = fullName();
    add(clients, { ClientId: String(cid), LastName: n.last, FirstName: n.first, MiddleName: n.mid,
      Suffix: n.suffix, BirthDate: chance(0.7) ? dateBetween(1935, 1990) : null, Gender: pick(GENDER),
      Religion: pick(RELIGION), Address: chance(0.85) ? address() : null, ContactNo: contact(),
      Email: email(n.first, n.last), ClientTypeId: pick(['1', '2', null]),
      Reference: null, TimeStamp: ts(), UserId: '-1' });
    clientIds.push(cid); cid++;
    // intentional near-duplicate (~1 in 20) for the duplicate finder
    if (chance(0.05)) {
      add(clients, { ClientId: String(cid), LastName: n.last, FirstName: n.first,
        MiddleName: n.mid, Suffix: n.suffix, BirthDate: null, Gender: pick(GENDER),
        Religion: null, Address: chance(0.5) ? address() : null, ContactNo: null,
        Email: null, ClientTypeId: null, Reference: null, TimeStamp: ts(), UserId: '-1' });
      clientIds.push(cid); cid++;
    }
  }

  // Lots (hub)
  const lots = table('Lots', ['LotId', 'LotCode', 'LotNo', 'LotSection', 'LotArea', 'LotMeasurement',
    'Status', 'ClientId', 'LocationId', 'TimeStamp', 'UserId']);
  add(lots, { LotId: '-1', LotCode: 'UNKNOWN', LotNo: 'UNKNOWN', Status: 'UNKNOWN / UNMAPPED LOT', ClientId: '-1', LocationId: '-1', TimeStamp: ts(), UserId: '-1' });
  const lotIds = [];
  for (let i = 1; i <= 120; i++) {
    add(lots, { LotId: String(i), LotCode: lotCode(), LotNo: chance(0.4) ? String(int(1, 500)) : null,
      LotSection: chance(0.3) ? pick(SECTIONS) : null, LotArea: chance(0.3) ? String(int(2, 12)) : null,
      LotMeasurement: null, Status: pick(['True', 'True', 'False']), ClientId: fk(clientIds, 0.2),
      LocationId: fk(locIds, 0.5), TimeStamp: ts(), UserId: '-1' });
    lotIds.push(i);
  }

  // Usufruct (ClientId mostly resolved, per the real data)
  const usu = table('Usufruct', ['UsufructId', 'LotId', 'ClientId', 'OldLotRefNo', 'DateOccupied',
    'CertNumber', 'CertDate', 'Remarks', 'Active', 'Timestamp', 'UserId']);
  add(usu, { UsufructId: '-1', LotId: '-1', ClientId: '-1', OldLotRefNo: 'UNKNOWN', CertNumber: 'UNKNOWN', CertDate: '1900-01-01', Remarks: 'Controlled placeholder record.', Active: 'False', Timestamp: ts(), UserId: '-1' });
  const usuIds = [];
  for (let i = 1; i <= 70; i++) {
    add(usu, { UsufructId: String(i), LotId: fk(lotIds, 0.4), ClientId: fk(clientIds, 0.8),
      OldLotRefNo: `ESP. ${int(1965, 2000)}-${pick(ROMAN)}/${pad(int(1, 99), 3)}`,
      DateOccupied: chance(0.6) ? dateBetween(1965, 2005) : null, CertNumber: `CK-${int(1000, 9999)}`,
      CertDate: '1900-01-01', Remarks: null, Active: pick(['True', 'False']), Timestamp: ts(), UserId: '-1' });
    usuIds.push(i);
  }

  // Rent
  const rent = table('Rent', ['RentId', 'LotId', 'ClientId', 'OldLOtRetNo', 'DateOccupied', 'ExpiryDate', 'Active', 'TimeStamp', 'UserId']);
  add(rent, { RentId: '-1', LotId: '-1', ClientId: '-1', OldLOtRetNo: 'UNKNOWN', Active: 'False', TimeStamp: ts(), UserId: '-1' });
  const rentIds = [];
  for (let i = 1; i <= 80; i++) {
    add(rent, { RentId: String(i), LotId: fk(lotIds, 0.35), ClientId: fk(clientIds, 0.3),
      OldLOtRetNo: `${pick(SECTIONS)}-${pick(ROMAN)}/`, DateOccupied: chance(0.4) ? dateBetween(1970, 2010) : null,
      ExpiryDate: chance(0.3) ? dateBetween(2020, 2055) : null, Active: pick(['True', 'False']), TimeStamp: ts(), UserId: '-1' });
    rentIds.push(i);
  }

  // Deceased
  const dec = table('Deceased', ['DeceasedId', 'LotId', 'UsufructId', 'RentId', 'DeathDate', 'CauseOfDeath',
    'BurialDate', 'ExhumationDate', 'PermitNo', 'Remarks', 'TimeStamp', 'UserId']);
  add(dec, { DeceasedId: '-1', LotId: '-1', UsufructId: '-1', RentId: '-1', Remarks: 'Controlled placeholder record for unmapped deceased references.', TimeStamp: ts(), UserId: '-1' });
  const decIds = [];
  for (let i = 1; i <= 100; i++) {
    const death = dateBetween(1970, 2024);
    add(dec, { DeceasedId: String(i), LotId: fk(lotIds, 0.3), UsufructId: fk(usuIds, 0.2), RentId: fk(rentIds, 0.15),
      DeathDate: death, CauseOfDeath: pick(CAUSE), BurialDate: chance(0.8) ? death : null,
      ExhumationDate: chance(0.15) ? dateBetween(2000, 2024) : null, PermitNo: permit(),
      Remarks: chance(0.3) ? `Name=${pick(FIRST)} ${pick(LAST)} | DeathDate=${death} | OldLocationId=${int(1, 9)}` : null,
      TimeStamp: ts(), UserId: '-1' });
    decIds.push(i);
  }

  // Schedule (ScheduleId PK)
  const sch = table('Schedule', ['ScheduleId', 'ScheduleNo', 'DeceasedId', 'ScheduleDate', 'LotId', 'UsufructId',
    'ClientId', 'ConstructionReference', 'ScheduleReference', 'RelationToOwner', 'ScheduleType', 'Funeral',
    'BurialRemarks', 'BurialType', 'withReserved', 'WithContruction', 'ConstructionFeeAmount',
    'MaintenanceFeeAmount', 'PermitNo', 'ContructionRemarks', 'MaintenanceRemarks', 'TimeStamp', 'UserId']);
  add(sch, { ScheduleId: '-1', ScheduleNo: 'UNKNOWN', DeceasedId: '-1', LotId: '-1', UsufructId: '-1', ClientId: '-1', ScheduleType: 'UNKNOWN / UNMAPPED SCHEDULE', TimeStamp: ts(), UserId: '-1' });
  const schIds = [];
  for (let i = 1; i <= 90; i++) {
    add(sch, { ScheduleId: String(i), ScheduleNo: String(int(3000, 6000)), DeceasedId: fk(decIds, 0.5),
      ScheduleDate: dateBetween(1990, 2024), LotId: fk(lotIds, 0.25), UsufructId: fk(usuIds, 0.2),
      ClientId: fk(clientIds, 0.2), RelationToOwner: pick(['SON', 'DAUGHTER', 'SPOUSE', 'PARENT', null]),
      Funeral: chance(0.4) ? pick(['GRACE', 'ETERNAL', 'PAZ']) : null,
      BurialRemarks: null, ScheduleType: pick(['1', '2', '3', null]),
      withReserved: pick(['True', 'False']), WithContruction: pick(['True', 'False']),
      PermitNo: permit(), TimeStamp: ts(), UserId: '-1' });
    schIds.push(i);
  }

  // ScheduleBurial (ScheduleId mostly resolved)
  const sb = table('ScheduleBurial', ['ScheduleBurialId', 'ScheduleId', 'DeceasedId', 'Remarks', 'Amount']);
  add(sb, { ScheduleBurialId: '-1', ScheduleId: '-1', DeceasedId: '-1', Amount: '0' });
  for (let i = 1; i <= 90; i++) {
    add(sb, { ScheduleBurialId: String(i), ScheduleId: fk(schIds, 0.8), DeceasedId: fk(decIds, 0.3),
      Remarks: chance(0.5) ? `ScheduleId=${pick(schIds)} | Name=${pick(FIRST)} ${pick(LAST)} | PermitNo=MLA` : null,
      Amount: String(int(0, 5000)) });
  }

  // ScheduleExhume
  const se = table('ScheduleExhume', ['ScheduleExhumeId', 'ScheduleId', 'DeceasedId', 'Remarks', 'Amount']);
  add(se, { ScheduleExhumeId: '-1', ScheduleId: '-1', DeceasedId: '-1', Amount: '0' });
  for (let i = 1; i <= 40; i++) {
    add(se, { ScheduleExhumeId: String(i), ScheduleId: fk(schIds, 0.7), DeceasedId: fk(decIds, 0.3),
      Remarks: `ScheduleId=${pick(schIds)} | Name=${pick(FIRST)} ${pick(LAST)} | ExhumationDate=${dateBetween(2000, 2024)}`,
      Amount: String(int(0, 3000)) });
  }

  // Transactions
  const txn = table('Transactions', ['TransactionId', 'TransactionNo', 'TransactionDate', 'ClientId', 'LotId',
    'TransactionType', 'PaymentType', 'CheckDate', 'CheckNumber', 'BankName', 'Remarks', 'UserId']);
  add(txn, { TransactionId: '-1', TransactionNo: 'UNKNOWN', ClientId: '-1', LotId: '-1', Remarks: 'Controlled placeholder record for unmapped transaction references.', UserId: '-1' });
  const txnIds = [];
  for (let i = 1; i <= 100; i++) {
    const isCheck = chance(0.4);
    add(txn, { TransactionId: String(i), TransactionNo: `C${int(2018, 2024)}-${int(10000, 99999)}`,
      TransactionDate: dateBetween(2018, 2024), ClientId: fk(clientIds, 0.3), LotId: fk(lotIds, 0.3),
      TransactionType: pick(['1', '2', '3']), PaymentType: pick(['0', '1']),
      CheckDate: isCheck ? dateBetween(2018, 2024) : null, CheckNumber: isCheck ? String(int(1000, 9999)) : null,
      BankName: isCheck ? pick(BANKS) : null,
      Remarks: chance(0.3) ? `OldTransactionId=${i} | ReceivedFrom=${pick(FIRST)} ${pick(LAST)}` : null, UserId: '-1' });
    txnIds.push(i);
  }

  // TransactionDetails (line items)
  const td = table('TransactionDetails', ['DetailId', 'TransactionId', 'GLCode', 'SLCode', 'Description',
    'Amount', 'LotId', 'DeceasedId', 'RentId', 'UsufructId', 'ScheduleId', 'MFee', 'Remarks']);
  for (let i = 1; i <= 160; i++) {
    add(td, { DetailId: String(i), TransactionId: fk(txnIds, 0.85), GLCode: String(int(1, 9)), SLCode: String(int(10, 30)),
      Description: pick(['Lot purchase', 'Maintenance fee', 'Burial fee', 'Construction fee', 'Rental', 'Transfer fee']),
      Amount: String(int(500, 120000)), LotId: fk(lotIds, 0.25), DeceasedId: fk(decIds, 0.15),
      RentId: fk(rentIds, 0.1), UsufructId: fk(usuIds, 0.15), ScheduleId: fk(schIds, 0.15),
      MFee: String(int(0, 2000)), Remarks: chance(0.3) ? `DateFrom=${dateBetween(2018, 2020)} | DateTo=${dateBetween(2040, 2055)}` : null });
  }
}

// write csv files
function toCsvValue(v) {
  if (v === null || v === undefined) return 'NULL';
  return '"' + String(v).replace(/"/g, '""') + '"';
}
function writeCsvs() {
  for (const f of readdirSync(CSV_DIR)) if (f.endsWith('.csv')) unlinkSync(join(CSV_DIR, f));
  for (const [name, t] of Object.entries(tables)) {
    const lines = [t.columns.map((c) => `"${c}"`).join(',')];
    for (const row of t.rows) lines.push(row.map(toCsvValue).join(','));
    writeFileSync(join(CSV_DIR, `${name}.csv`), lines.join('\n') + '\n');
  }
}

// load to db
async function load() {
  const c = new Client({
    host: 'localhost', port: 5432, database: process.env.SEED_DB || 'llcc_dev',
    user: process.env.SEED_USER || 'postgres', password: process.env.SEED_PASSWORD,
  });
  await c.connect();
  const { readFileSync } = await import('node:fs');
  await c.query(readFileSync(join(HERE, 'schema.sql'), 'utf8'));

  // create roles
  const appUser = process.env.PGUSER || 'llcc_app';
  const appPass = process.env.PGPASSWORD || 'llcc_app_dev';
  await c.query(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = '${appUser}') then
      create role "${appUser}" login password '${appPass}';
    end if;
  end $$;`);
  await c.query(`grant usage, create on schema public to "${appUser}"`);
  await c.query(`grant select, insert, update, delete on all tables in schema public to "${appUser}"`);
  await c.query(`grant usage, select on all sequences in schema public to "${appUser}"`);
  for (const [name, t] of Object.entries(tables)) {
    if (!t.rows.length) continue;
    const cols = t.columns.map((x) => `"${x}"`).join(', ');
    // insert by batch
    const chunk = 50;
    for (let i = 0; i < t.rows.length; i += chunk) {
      const slice = t.rows.slice(i, i + chunk);
      const params = [];
      const values = slice.map((row) => {
        const ph = row.map((v) => { params.push(v); return `$${params.length}`; });
        return `(${ph.join(', ')})`;
      });
      await c.query(`insert into "${name}" (${cols}) values ${values.join(', ')}`, params);
    }
  }
  const counts = [];
  for (const name of Object.keys(tables)) {
    const r = await c.query(`select count(*)::int as n from "${name}"`);
    counts.push({ relname: name, n: r.rows[0].n });
  }
  await c.end();
  return counts;
}

build();
writeCsvs();
load().then((counts) => {
  console.log('seeded fake data:');
  for (const r of counts) console.log(`  ${r.relname.padEnd(20)} ${r.n}`);
  console.log('CSV samples rewritten in sample_csv/ (fake).');
}).catch((e) => { console.error(e); process.exit(1); });
