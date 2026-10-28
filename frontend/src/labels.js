// turns column names into normal words so staff don't need to know the db

const FIELD = {
  ContactNo: 'Contact number',
  BirthDate: 'Birth date',
  DeathDate: 'Date of death',
  BurialDate: 'Burial date',
  ExhumationDate: 'Exhumation date',
  PermitNo: 'Permit number',
  CauseOfDeath: 'Cause of death',
  LotCode: 'Lot code',
  LotNo: 'Lot number',
  Email: 'Email',
  Address: 'Address',
};

// what a foreign key actually means in plain terms
const RELATION = {
  ClientId: 'Client',
  LocationId: 'Location',
  LotId: 'Lot',
  UsufructId: 'Usufruct',
  RentId: 'Rental',
  DeceasedId: 'Deceased person',
  ScheduleId: 'Schedule',
};

// camelCase to normal words
function humanize(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

export function fieldLabel(col) {
  return FIELD[col] || humanize(col);
}

export function relationLabel(column) {
  return RELATION[column] || humanize(column.replace(/Id$/, ''));
}
