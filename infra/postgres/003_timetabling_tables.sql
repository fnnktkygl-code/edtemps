create table if not exists timetabling_inputs (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);

create table if not exists timetabling_schedules (
  tenant_id uuid not null references tenants(id) on delete cascade,
  schedule_key text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, schedule_key)
);

alter table timetabling_inputs enable row level security;
alter table timetabling_schedules enable row level security;

create policy timetabling_inputs_by_tenant on timetabling_inputs
  using (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);

create policy timetabling_schedules_by_tenant on timetabling_schedules
  using (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);
