// labels, search columns and list columns for each table

export const DASHBOARD_CARDS = [
  { table: 'Clients', label: 'Clients' },
  { table: 'Lots', label: 'Lots' },
  { table: 'Deceased', label: 'Deceased' },
  { table: 'Transactions', label: 'Transactions' },
];

// deceased has no name column, the name is inside Remarks ("Name=JUAN CRUZ | DeathDate=...")
const remarksName = (remarks) => remarks?.match(/Name=([^|]+)/)?.[1].trim() || null;

// puts the name back into Remarks and keeps the other parts
function setRemarksName(remarks, name) {
  const parts = String(remarks || '').split('|').map((p) => p.trim()).filter((p) => p && !p.startsWith('Name='));
  if (name && String(name).trim()) parts.unshift(`Name=${String(name).trim().toUpperCase()}`);
  return parts.join(' | ') || null;
}

export const ENTITIES = {
  Clients: {
    label: 'Clients',
    description: 'People who own, rent or pay for a lot.',
    primaryKey: 'ClientId',
    required: ['LastName', 'FirstName'],
    filters: [
      { column: 'Gender', type: 'select' },
      { column: 'ContactNo', type: 'present', label: 'Has contact number' },
    ],
    search: ['LastName', 'FirstName', 'Address', 'Email', 'ContactNo'],
    listColumns: ['ClientId', 'LastName', 'FirstName', 'Gender', 'Address', 'ContactNo'],
    title: (r) => [r.LastName, r.FirstName].filter(Boolean).join(', ') || r.ClientId,
  },
  Lots: {
    label: 'Lots',
    description: 'Cemetery lots. Open a lot to see its owner, who is buried there, and its payments.',
    primaryKey: 'LotId',
    required: ['LotCode'],
    filters: [
      { column: 'LotSection', type: 'select' },
      { column: 'Status', type: 'yesno' },
      { column: 'ClientId', type: 'linked', label: 'Has owner' },
    ],
    search: ['LotCode', 'LotNo', 'LotSection'],
    listColumns: ['LotId', 'LotCode', 'LotNo', 'LotSection', 'Status'],
    title: (r) => r.LotCode || r.LotId,
  },
  Deceased: {
    label: 'Deceased',
    description: 'People buried in the cemetery, with their date of death, burial date and permit.',
    primaryKey: 'DeceasedId',
    required: ['Name', 'DeathDate', 'PermitNo'],
    filters: [
      { column: 'DeathDate', type: 'range' },
      { column: 'CauseOfDeath', type: 'select' },
      { column: 'LotId', type: 'linked', label: 'Linked to a lot' },
    ],
    search: ['PermitNo', 'CauseOfDeath', 'Remarks'],
    listColumns: ['DeceasedId', 'Name', 'DeathDate', 'BurialDate', 'CauseOfDeath', 'PermitNo'],
    // extra columns made from other fields. sql is used for sorting, write saves it back
    derived: {
      Name: {
        value: (r) => remarksName(r.Remarks),
        sql: `trim(substring("Remarks" from 'Name=([^|]+)'))`,
        write: (name, row) => ({ Remarks: setRemarksName(row.Remarks, name) }),
      },
    },
    title: (r) => remarksName(r.Remarks) || `Deceased #${r.DeceasedId}`,
  },
  Transactions: {
    label: 'Transactions',
    description: 'Payments received by the office. Open one to see what it was paid for.',
    primaryKey: 'TransactionId',
    required: ['TransactionNo', 'TransactionDate'],
    filters: [
      { column: 'TransactionDate', type: 'range' },
      { column: 'BankName', type: 'select' },
      { column: 'ClientId', type: 'linked', label: 'Linked to a client' },
    ],
    search: ['TransactionNo', 'BankName', 'CheckNumber'],
    listColumns: ['TransactionId', 'TransactionNo', 'TransactionDate', 'TransactionType', 'PaymentType'],
    title: (r) => r.TransactionNo || r.TransactionId,
  },
  Location: {
    label: 'Cemetery sections',
    description: 'Sections or areas of the cemetery where the lots are.',
    primaryKey: 'LocationId',
    required: ['Name'],
    search: ['Name'],
    listColumns: ['LocationId', 'Name'],
    title: (r) => r.Name || r.LocationId,
  },
  Rent: {
    label: 'Lot rentals',
    description: 'Lots that are rented for a period instead of owned. Shows who rents it and until when.',
    primaryKey: 'RentId',
    required: ['DateOccupied', 'ExpiryDate'],
    filters: [
      { column: 'ExpiryDate', type: 'range' },
      { column: 'Active', type: 'yesno' },
      { column: 'LotId', type: 'linked', label: 'Linked to a lot' },
    ],
    search: ['OldLOtRetNo'],
    listColumns: ['RentId', 'LotId', 'ClientId', 'OldLOtRetNo', 'ExpiryDate', 'Active'],
    title: (r) => `Rental #${r.RentId}`,
  },
  Schedule: {
    label: 'Burial schedules',
    description: 'Booked burials and exhumations, with the date, the lot, and the construction and maintenance fees.',
    primaryKey: 'ScheduleId',
    required: ['ScheduleDate'],
    filters: [
      { column: 'ScheduleDate', type: 'range' },
      { column: 'RelationToOwner', type: 'select' },
      { column: 'DeceasedId', type: 'linked', label: 'Linked to a deceased' },
    ],
    search: ['ScheduleNo', 'RelationToOwner', 'BurialRemarks'],
    listColumns: ['ScheduleId', 'ScheduleNo', 'ScheduleDate', 'ScheduleType', 'RelationToOwner'],
    title: (r) => r.ScheduleNo || r.ScheduleId,
  },
  ScheduleBurial: {
    label: 'Burials',
    description: 'Burial details of a schedule: who was buried and the amount paid.',
    primaryKey: 'ScheduleBurialId',
    search: ['Remarks'],
    listColumns: ['ScheduleBurialId', 'ScheduleId', 'DeceasedId', 'Amount'],
    title: (r) => `Burial #${r.ScheduleBurialId}`,
  },
  ScheduleExhume: {
    label: 'Exhumations',
    description: 'Exhumation details of a schedule: whose remains were exhumed and the amount paid.',
    primaryKey: 'ScheduleExhumeId',
    search: ['Remarks'],
    listColumns: ['ScheduleExhumeId', 'ScheduleId', 'DeceasedId', 'Amount'],
    title: (r) => `Exhumation #${r.ScheduleExhumeId}`,
  },
  TransactionDetails: {
    label: 'Transaction details',
    description: 'The items of each payment (lot, burial fee, maintenance fee, etc).',
    primaryKey: 'DetailId',
    filters: [{ column: 'Description', type: 'select' }],
    search: ['Description', 'GLCode', 'SLCode'],
    listColumns: ['DetailId', 'TransactionId', 'Description', 'Amount', 'MFee'],
    title: (r) => `Detail #${r.DetailId}`,
  },
  Usufruct: {
    label: 'Lot rights (Usufruct)',
    description: 'The right to use a lot. Lots are not sold, the owner gets a contract and a certificate of usufruct that can be passed on to their heirs.',
    primaryKey: 'UsufructId',
    required: ['CertNumber'],
    filters: [
      { column: 'CertDate', type: 'range' },
      { column: 'Active', type: 'yesno' },
      { column: 'LotId', type: 'linked', label: 'Linked to a lot' },
    ],
    search: ['OldLotRefNo', 'CertNumber'],
    listColumns: ['UsufructId', 'LotId', 'ClientId', 'CertNumber', 'CertDate', 'Active'],
    title: (r) => (r.CertNumber ? `Certificate ${r.CertNumber}` : `Lot right #${r.UsufructId}`),
  },
  User: {
    label: 'Staff users',
    description: 'Office staff accounts from the old system. Used to show who encoded a record.',
    primaryKey: 'UserId',
    required: ['FirstName', 'LastName'],
    filters: [{ column: 'Status', type: 'yesno' }],
    search: ['FirstName', 'LastName', 'Email'],
    listColumns: ['UserId', 'FirstName', 'LastName', 'Email', 'Status'],
    title: (r) => [r.FirstName, r.LastName].filter(Boolean).join(' ') || r.UserId,
  },
};

// sidebar groups. TransactionDetails, ScheduleBurial and ScheduleExhume are not
// here because you open them from the parent record
export const NAV_GROUPS = [
  { group: 'Main', tables: ['Clients', 'Lots', 'Deceased', 'Transactions'] },
  { group: 'Other records', tables: ['Location', 'Rent', 'Schedule', 'Usufruct', 'User'] },
];

export function entityConfig(table) {
  return ENTITIES[table] || null;
}

export const isDerived = (cfg, col) => Boolean(cfg?.derived?.[col]);

// add the derived (read-only) columns to a row
export function withDerived(cfg, row) {
  if (!cfg?.derived) return row;
  const extra = {};
  for (const [col, d] of Object.entries(cfg.derived)) extra[col] = d.value(row);
  return { ...row, ...extra };
}

// turns edits to derived columns (like Name) into edits to the real columns
export function applyDerivedWrites(cfg, changes, row = {}) {
  const out = { ...changes };
  for (const [col, d] of Object.entries(cfg?.derived || {})) {
    if (!(col in out)) continue;
    const value = out[col];
    delete out[col];
    if (d.write) Object.assign(out, d.write(value, { ...row, ...out }));
  }
  return out;
}
