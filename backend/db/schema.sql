-- schema for local testing
-- all columns are text because the old data is messy (-1, "True"/"False", etc)

drop schema if exists public cascade;
create schema public;

create table "Clients" (
  "ClientId" text, "LastName" text, "FirstName" text, "MiddleName" text,
  "Suffix" text, "BirthDate" text, "Gender" text, "Religion" text,
  "Address" text, "ContactNo" text, "Email" text, "ClientTypeId" text,
  "Reference" text, "TimeStamp" text, "UserId" text
);

create table "Deceased" (
  "DeceasedId" text, "LotId" text, "UsufructId" text, "RentId" text,
  "DeathDate" text, "CauseOfDeath" text, "BurialDate" text,
  "ExhumationDate" text, "PermitNo" text, "Remarks" text,
  "TimeStamp" text, "UserId" text
);

create table "Location" (
  "LocationId" text, "Name" text
);

create table "Lots" (
  "LotId" text, "LotCode" text, "LotNo" text, "LotSection" text,
  "LotArea" text, "LotMeasurement" text, "Status" text, "ClientId" text,
  "LocationId" text, "TimeStamp" text, "UserId" text
);

create table "Rent" (
  "RentId" text, "LotId" text, "ClientId" text, "OldLOtRetNo" text,
  "DateOccupied" text, "ExpiryDate" text, "Active" text,
  "TimeStamp" text, "UserId" text
);

create table "Schedule" (
  "ScheduleId" text, "ScheduleNo" text, "DeceasedId" text, "ScheduleDate" text,
  "LotId" text, "UsufructId" text, "ClientId" text, "ConstructionReference" text,
  "ScheduleReference" text, "RelationToOwner" text, "ScheduleType" text,
  "Funeral" text, "BurialRemarks" text, "BurialType" text, "withReserved" text,
  "WithContruction" text, "ConstructionFeeAmount" text, "MaintenanceFeeAmount" text,
  "PermitNo" text, "ContructionRemarks" text, "MaintenanceRemarks" text,
  "TimeStamp" text, "UserId" text
);

create table "ScheduleBurial" (
  "ScheduleBurialId" text, "ScheduleId" text, "DeceasedId" text,
  "Remarks" text, "Amount" text
);

create table "ScheduleExhume" (
  "ScheduleExhumeId" text, "ScheduleId" text, "DeceasedId" text,
  "Remarks" text, "Amount" text
);

create table "TransactionDetails" (
  "DetailId" text, "TransactionId" text, "GLCode" text, "SLCode" text,
  "Description" text, "Amount" text, "LotId" text, "DeceasedId" text,
  "RentId" text, "UsufructId" text, "ScheduleId" text, "MFee" text,
  "Remarks" text
);

create table "Transactions" (
  "TransactionId" text, "TransactionNo" text, "TransactionDate" text,
  "ClientId" text, "LotId" text, "TransactionType" text, "PaymentType" text,
  "CheckDate" text, "CheckNumber" text, "BankName" text, "Remarks" text,
  "UserId" text
);

create table "User" (
  "UserId" text, "FirstName" text, "LastName" text, "Email" text,
  "Status" text, "Created_At" text, "Updated_At" text
);

create table "Usufruct" (
  "UsufructId" text, "LotId" text, "ClientId" text, "OldLotRefNo" text,
  "DateOccupied" text, "CertNumber" text, "CertDate" text, "Remarks" text,
  "Active" text, "Timestamp" text, "UserId" text
);

-- change history for edits made through the dashboard (enables undo).
create table audit_log (
  id           bigserial primary key,
  table_name   text not null,
  row_pk       text,
  action       text not null,         -- update | create | delete | link | merge | bulk
  before_data  jsonb,
  after_data   jsonb,
  performed_by text,
  performed_at timestamptz not null default now(),
  undone       boolean not null default false
);
create index on audit_log (performed_at desc);
