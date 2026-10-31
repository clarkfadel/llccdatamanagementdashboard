// labels, search columns and list columns for each table

export const DASHBOARD_CARDS = [
  { table: 'Clients', label: 'Clients' },
  { table: 'Lots', label: 'Lots' },
  { table: 'Deceased', label: 'Deceased' },
  { table: 'Transactions', label: 'Transactions' },
];

// deceased has no name column, the name is inside Remarks ("Name=JUAN CRUZ | DeathDate=...")
const remarksName = (remarks) => remarks?.match(/Name=([^|]+)/)?.[1].trim() || null;

export const ENTITIES = {
  Clients: {
    label: 'Clients',
    primaryKey: 'ClientId',
    search: ['LastName', 'FirstName', 'Address', 'Email', 'ContactNo'],
    listColumns: ['ClientId', 'LastName', 'FirstName', 'Gender', 'Address', 'ContactNo'],
    title: (r) => [r.LastName, r.FirstName].filter(Boolean).join(', ') || r.ClientId,
  },
  Lots: {
    label: 'Lots',
    primaryKey: 'LotId',
    search: ['LotCode', 'LotNo', 'LotSection'],
    listColumns: ['LotId', 'LotCode', 'LotNo', 'LotSection', 'Status'],
    title: (r) => r.LotCode || r.LotId,
  },
  Deceased: {
    label: 'Deceased',
    primaryKey: 'DeceasedId',
    search: ['PermitNo', 'CauseOfDeath', 'Remarks'],
    listColumns: ['DeceasedId', 'Name', 'DeathDate', 'BurialDate', 'CauseOfDeath', 'PermitNo'],
    // extra columns made from other fields (read only). sql is used for sorting
    derived: {
      Name: { value: (r) => remarksName(r.Remarks), sql: `trim(substring("Remarks" from 'Name=([^|]+)'))` },
    },
    title: (r) => remarksName(r.Remarks) || `Deceased #${r.DeceasedId}`,
  },
  Transactions: {
    label: 'Transactions',
    primaryKey: 'TransactionId',
    search: ['TransactionNo', 'BankName', 'CheckNumber'],
    listColumns: ['TransactionId', 'TransactionNo', 'TransactionDate', 'TransactionType', 'PaymentType'],
    title: (r) => r.TransactionNo || r.TransactionId,
  },
  Location: {
    label: 'Locations',
    primaryKey: 'LocationId',
    search: ['Name'],
    listColumns: ['LocationId', 'Name'],
    title: (r) => r.Name || r.LocationId,
  },
  Rent: {
    label: 'Rent',
    primaryKey: 'RentId',
    search: ['OldLOtRetNo'],
    listColumns: ['RentId', 'LotId', 'ClientId', 'OldLOtRetNo', 'Active'],
    title: (r) => `Rent #${r.RentId}`,
  },
  Schedule: {
    label: 'Schedules',
    primaryKey: 'ScheduleId',
    search: ['ScheduleNo', 'RelationToOwner', 'BurialRemarks'],
    listColumns: ['ScheduleId', 'ScheduleNo', 'ScheduleDate', 'ScheduleType', 'RelationToOwner'],
    title: (r) => r.ScheduleNo || r.ScheduleId,
  },
  ScheduleBurial: {
    label: 'Burials',
    primaryKey: 'ScheduleBurialId',
    search: ['Remarks'],
    listColumns: ['ScheduleBurialId', 'ScheduleId', 'DeceasedId', 'Amount'],
    title: (r) => `Burial #${r.ScheduleBurialId}`,
  },
  ScheduleExhume: {
    label: 'Exhumations',
    primaryKey: 'ScheduleExhumeId',
    search: ['Remarks'],
    listColumns: ['ScheduleExhumeId', 'ScheduleId', 'DeceasedId', 'Amount'],
    title: (r) => `Exhumation #${r.ScheduleExhumeId}`,
  },
  TransactionDetails: {
    label: 'Transaction Details',
    primaryKey: 'DetailId',
    search: ['Description', 'GLCode', 'SLCode'],
    listColumns: ['DetailId', 'TransactionId', 'Description', 'Amount', 'MFee'],
    title: (r) => `Detail #${r.DetailId}`,
  },
  Usufruct: {
    label: 'Usufruct',
    primaryKey: 'UsufructId',
    search: ['OldLotRefNo', 'CertNumber'],
    listColumns: ['UsufructId', 'LotId', 'ClientId', 'OldLotRefNo', 'CertNumber', 'Active'],
    title: (r) => `Usufruct #${r.UsufructId}`,
  },
  User: {
    label: 'Users',
    primaryKey: 'UserId',
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
