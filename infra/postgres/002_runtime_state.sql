-- Snapshots applicatifs utilisés par le premier incrément. Les tables métier
-- normalisées de 001 restent la cible pour les requêtes analytiques futures.
create table dispatch_inputs (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);

create table dispatch_scenario_snapshots (
  tenant_id uuid not null references tenants(id) on delete cascade,
  scenario_key text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, scenario_key)
);

create table application_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  occurred_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);

alter table dispatch_inputs enable row level security;
alter table dispatch_scenario_snapshots enable row level security;
alter table application_audit_events enable row level security;

create policy dispatch_inputs_by_tenant on dispatch_inputs
  using (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);
create policy dispatch_scenarios_by_tenant on dispatch_scenario_snapshots
  using (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);
create policy application_audit_by_tenant on application_audit_events
  using (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);

create index application_audit_events_by_tenant_time on application_audit_events (tenant_id, occurred_at desc);
