create extension if not exists "uuid-ossp";

create table renach_process (
  id uuid primary key default uuid_generate_v4(),
  renach_number text unique not null,
  cpf text not null,
  process_type text not null,
  status text not null,
  current_category text,
  requested_category text,
  opened_at timestamptz not null,
  expires_at timestamptz
);

create table renach_exam (
  id uuid primary key default uuid_generate_v4(),
  renach_process_id uuid not null references renach_process(id),
  exam_type text not null,
  result text not null,
  clinic_id text not null,
  examiner_cpf text not null,
  performed_at timestamptz,
  payload jsonb not null,
  created_at timestamptz default now()
);

create table renainf_ait (
  id uuid primary key default uuid_generate_v4(),
  ait_number text unique not null,
  renainf_number text,
  agency_code text not null,
  status text not null,
  plate text,
  infraction_code text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz default now()
);

create table renainf_case (
  id uuid primary key default uuid_generate_v4(),
  ait_id uuid not null references renainf_ait(id),
  status text not null,
  payload jsonb not null,
  created_at timestamptz default now()
);

create table audit_event (
  id uuid primary key default uuid_generate_v4(),
  domain text not null,
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  payload_hash text,
  payload jsonb not null,
  created_at timestamptz default now()
);

create index idx_renach_process_cpf on renach_process(cpf);
create index idx_renach_exam_process on renach_exam(renach_process_id);
create index idx_renainf_ait_plate on renainf_ait(plate);
create index idx_renainf_case_ait on renainf_case(ait_id);
