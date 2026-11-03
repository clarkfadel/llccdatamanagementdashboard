// turns column names into normal words so staff don't need to know the db

const FIELD = {
  LastName: 'Last name',
  FirstName: 'First name',
  MiddleName: 'Middle name',
  ContactNo: 'Contact number',
  BirthDate: 'Birth date',
  DeathDate: 'Date of death',
  BurialDate: 'Burial date',
  ExhumationDate: 'Exhumation date',
  PermitNo: 'Permit number',
  CauseOfDeath: 'Cause of death',
  LotCode: 'Lot code',
  LotNo: 'Lot number',
  LotSection: 'Section',
  LotArea: 'Lot area',
  LotMeasurement: 'Lot measurement',
  OldLotRefNo: 'Old lot reference no.',
  OldLOtRetNo: 'Old rental reference no.',
  CertNumber: 'Certificate no.',
  CertDate: 'Certificate date',
  DateOccupied: 'Date occupied',
  ExpiryDate: 'Expiry date',
  ScheduleNo: 'Schedule no.',
  ScheduleDate: 'Schedule date',
  ScheduleType: 'Schedule type',
  ScheduleReference: 'Schedule reference',
  ConstructionReference: 'Construction reference',
  RelationToOwner: 'Relation to owner',
  BurialType: 'Burial type',
  BurialRemarks: 'Burial remarks',
  withReserved: 'Reserved',
  WithContruction: 'With construction',
  ConstructionFeeAmount: 'Construction fee',
  MaintenanceFeeAmount: 'Maintenance fee',
  ContructionRemarks: 'Construction remarks',
  MaintenanceRemarks: 'Maintenance remarks',
  TransactionNo: 'Transaction no.',
  TransactionDate: 'Transaction date',
  TransactionType: 'Transaction type',
  PaymentType: 'Payment type',
  CheckDate: 'Check date',
  CheckNumber: 'Check no.',
  BankName: 'Bank',
  GLCode: 'GL code',
  SLCode: 'SL code',
  MFee: 'Maintenance fee',
  TimeStamp: 'Last updated',
  Timestamp: 'Last updated',
  Created_At: 'Created',
  Updated_At: 'Updated',
};

// what a foreign key actually means in plain terms
const RELATION = {
  ClientId: 'Client',
  ClientTypeId: 'Client type',
  LocationId: 'Section',
  LotId: 'Lot',
  UsufructId: 'Lot right',
  RentId: 'Rental',
  DeceasedId: 'Deceased person',
  ScheduleId: 'Schedule',
  TransactionId: 'Transaction',
  UserId: 'Encoded by',
};

const ACTION = { update: 'Edited', create: 'Added', link: 'Linked', bulk: 'Bulk edited', merge: 'Merged', delete: 'Deleted' };

// camelCase to normal words
function humanize(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

// pass the table's primary key so it shows as "ID"
export function fieldLabel(col, primaryKey) {
  if (col === primaryKey) return 'ID';
  if (FIELD[col]) return FIELD[col];
  if (/Id$/.test(col)) return relationLabel(col);
  return humanize(col);
}

export function relationLabel(column) {
  return RELATION[column] || humanize(column.replace(/Id$/, ''));
}

export function actionLabel(action) {
  return ACTION[action] || humanize(action);
}

export function tableLabel(table) {
  return humanize(table);
}
