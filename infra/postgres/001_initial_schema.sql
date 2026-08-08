-- Référence de persistance pour une base PostgreSQL dédiée à l'API.
-- Les identifiants de calcul sont pseudonymes ; le mapping INE/identité est chiffré et séparé.
create extension if not exists pgcrypto;

create table tenants (
  id uuid primary key default gen_random_uuid(),
  external_key text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table actors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  subject text not null,
  role text not null check (role in ('SCHOOL_ADMIN', 'DISPATCH_EDITOR', 'CPE', 'DPO', 'VIEWER')),
  unique (tenant_id, subject)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  pseudonym text not null,
  identity_ciphertext bytea,
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  unique (tenant_id, pseudonym)
);

create table dispatch_scenarios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  state text not null check (state in ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED')),
  input_fingerprint text not null,
  created_by uuid not null references actors(id),
  validated_by uuid references actors(id),
  validated_at timestamptz,
  created_at timestamptz not null default now()
);

create table dispatch_assignments (
  scenario_id uuid not null references dispatch_scenarios(id) on delete cascade,
  student_id uuid not null references students(id),
  classroom_key text not null,
  explanation jsonb not null,
  primary key (scenario_id, student_id)
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor_id uuid references actors(id),
  event_type text not null,
  payload jsonb not null,
  occurred_at timestamptz not null default now()
);

alter table students enable row level security;
alter table dispatch_scenarios enable row level security;
alter table dispatch_assignments enable row level security;
alter table audit_events enable row level security;

-- L'API fixe app.tenant_id après authentification. Ne jamais ouvrir de connexion de rôle applicatif avec BYPASSRLS.
create policy students_by_tenant on students
  using (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);
create policy scenarios_by_tenant on dispatch_scenarios
  using (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);
create policy assignments_by_tenant on dispatch_assignments
  using (scenario_id in (select id from dispatch_scenarios));
create policy audit_by_tenant on audit_events
  using (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);
