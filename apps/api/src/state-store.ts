import { Pool, type PoolClient } from "pg";
import type { DispatchInput, DispatchScenario, TimetablingInput, TimetablingSchedule } from "../../../packages/domain/src/index.js";

export type AuditEvent = {
  id: string;
  occurredAt: string;
  tenantId: string;
  actorId: string;
  eventType:
    | "SIECLE_IMPORTED"
    | "IMPORT_ACTIVATED"
    | "SCENARIOS_GENERATED"
    | "ASSIGNMENT_MOVED"
    | "SCENARIO_VALIDATED"
    | "SCHEDULE_GENERATED"
    | "COURSE_MOVED"
    | "SCHEDULE_VALIDATED"
    | "STUDENT_UPDATED";
  scenarioId?: string;
  details: Record<string, string | number | boolean>;
};

export interface StateStore {
  readonly mode: "memory" | "postgres";
  loadInput(tenantKey: string): Promise<DispatchInput | undefined>;
  saveInput(tenantKey: string, input: DispatchInput): Promise<void>;
  listScenarios(tenantKey: string): Promise<DispatchScenario[]>;
  saveScenarios(tenantKey: string, scenarios: DispatchScenario[]): Promise<void>;
  loadTimetablingInput(tenantKey: string): Promise<TimetablingInput | undefined>;
  saveTimetablingInput(tenantKey: string, input: TimetablingInput): Promise<void>;
  listTimetablingSchedules(tenantKey: string): Promise<TimetablingSchedule[]>;
  saveTimetablingSchedules(tenantKey: string, schedules: TimetablingSchedule[]): Promise<void>;
  listAuditEvents(tenantKey: string): Promise<AuditEvent[]>;
  appendAuditEvent(event: AuditEvent): Promise<void>;
  close(): Promise<void>;
}

export class MemoryStateStore implements StateStore {
  readonly mode = "memory" as const;
  private readonly inputs = new Map<string, DispatchInput>();
  private readonly scenarios = new Map<string, DispatchScenario[]>();
  private readonly timetablingInputs = new Map<string, TimetablingInput>();
  private readonly timetablingSchedules = new Map<string, TimetablingSchedule[]>();
  private readonly auditEvents = new Map<string, AuditEvent[]>();

  async loadInput(tenantKey: string): Promise<DispatchInput | undefined> { return this.inputs.get(tenantKey); }
  async saveInput(tenantKey: string, input: DispatchInput): Promise<void> { this.inputs.set(tenantKey, structuredClone(input)); }
  async listScenarios(tenantKey: string): Promise<DispatchScenario[]> { return structuredClone(this.scenarios.get(tenantKey) ?? []); }
  async saveScenarios(tenantKey: string, scenarios: DispatchScenario[]): Promise<void> { this.scenarios.set(tenantKey, structuredClone(scenarios)); }

  async loadTimetablingInput(tenantKey: string): Promise<TimetablingInput | undefined> { return this.timetablingInputs.get(tenantKey); }
  async saveTimetablingInput(tenantKey: string, input: TimetablingInput): Promise<void> { this.timetablingInputs.set(tenantKey, structuredClone(input)); }
  async listTimetablingSchedules(tenantKey: string): Promise<TimetablingSchedule[]> { return structuredClone(this.timetablingSchedules.get(tenantKey) ?? []); }
  async saveTimetablingSchedules(tenantKey: string, schedules: TimetablingSchedule[]): Promise<void> { this.timetablingSchedules.set(tenantKey, structuredClone(schedules)); }

  async listAuditEvents(tenantKey: string): Promise<AuditEvent[]> { return structuredClone(this.auditEvents.get(tenantKey) ?? []); }
  async appendAuditEvent(event: AuditEvent): Promise<void> {
    this.auditEvents.set(event.tenantId, [structuredClone(event), ...(this.auditEvents.get(event.tenantId) ?? [])]);
  }
  async close(): Promise<void> { /* Le dépôt mémoire ne maintient aucune ressource. */ }
}

export class PostgresStateStore implements StateStore {
  readonly mode = "postgres" as const;
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 10, ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: true } : undefined });
  }

  async assertConnected(): Promise<void> { await this.pool.query("select 1"); }

  private async withTenant<T>(tenantKey: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const tenant = await client.query<{ id: string }>(
        `insert into tenants (external_key, name) values ($1, $2)
         on conflict (external_key) do update set name = excluded.name
         returning id`,
        [tenantKey, tenantKey],
      );
      await client.query("select set_config('app.tenant_id', $1, true)", [tenant.rows[0].id]);
      const result = await operation(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally { client.release(); }
  }

  async loadInput(tenantKey: string): Promise<DispatchInput | undefined> {
    return this.withTenant(tenantKey, async (client) => {
      const result = await client.query<{ payload: DispatchInput }>("select payload from dispatch_inputs limit 1");
      return result.rows[0]?.payload;
    });
  }

  async saveInput(tenantKey: string, input: DispatchInput): Promise<void> {
    await this.withTenant(tenantKey, async (client) => {
      await client.query(
        `insert into dispatch_inputs (tenant_id, payload) values (current_setting('app.tenant_id')::uuid, $1::jsonb)
         on conflict (tenant_id) do update set payload = excluded.payload, updated_at = now()`,
        [JSON.stringify(input)],
      );
    });
  }

  async listScenarios(tenantKey: string): Promise<DispatchScenario[]> {
    return this.withTenant(tenantKey, async (client) => {
      const result = await client.query<{ payload: DispatchScenario }>("select payload from dispatch_scenario_snapshots order by updated_at desc");
      return result.rows.map((row) => row.payload);
    });
  }

  async saveScenarios(tenantKey: string, scenarios: DispatchScenario[]): Promise<void> {
    await this.withTenant(tenantKey, async (client) => {
      await client.query("delete from dispatch_scenario_snapshots");
      for (const scenario of scenarios) {
        await client.query(
          `insert into dispatch_scenario_snapshots (tenant_id, scenario_key, payload)
           values (current_setting('app.tenant_id')::uuid, $1, $2::jsonb)`,
          [scenario.id, JSON.stringify(scenario)],
        );
      }
    });
  }

  async loadTimetablingInput(tenantKey: string): Promise<TimetablingInput | undefined> {
    return this.withTenant(tenantKey, async (client) => {
      const result = await client.query<{ payload: TimetablingInput }>("select payload from timetabling_inputs limit 1");
      return result.rows[0]?.payload;
    });
  }

  async saveTimetablingInput(tenantKey: string, input: TimetablingInput): Promise<void> {
    await this.withTenant(tenantKey, async (client) => {
      await client.query(
        `insert into timetabling_inputs (tenant_id, payload) values (current_setting('app.tenant_id')::uuid, $1::jsonb)
         on conflict (tenant_id) do update set payload = excluded.payload, updated_at = now()`,
        [JSON.stringify(input)],
      );
    });
  }

  async listTimetablingSchedules(tenantKey: string): Promise<TimetablingSchedule[]> {
    return this.withTenant(tenantKey, async (client) => {
      const result = await client.query<{ payload: TimetablingSchedule }>("select payload from timetabling_schedules order by updated_at desc");
      return result.rows.map((row) => row.payload);
    });
  }

  async saveTimetablingSchedules(tenantKey: string, schedules: TimetablingSchedule[]): Promise<void> {
    await this.withTenant(tenantKey, async (client) => {
      await client.query("delete from timetabling_schedules");
      for (const schedule of schedules) {
        await client.query(
          `insert into timetabling_schedules (tenant_id, schedule_key, payload)
           values (current_setting('app.tenant_id')::uuid, $1, $2::jsonb)`,
          [schedule.id, JSON.stringify(schedule)],
        );
      }
    });
  }

  async listAuditEvents(tenantKey: string): Promise<AuditEvent[]> {
    return this.withTenant(tenantKey, async (client) => {
      const result = await client.query<{ payload: AuditEvent }>("select payload from application_audit_events order by occurred_at desc limit 100");
      return result.rows.map((row) => row.payload);
    });
  }

  async appendAuditEvent(event: AuditEvent): Promise<void> {
    await this.withTenant(event.tenantId, async (client) => {
      await client.query(
        `insert into application_audit_events (tenant_id, occurred_at, payload)
         values (current_setting('app.tenant_id')::uuid, $1::timestamptz, $2::jsonb)`,
        [event.occurredAt, JSON.stringify(event)],
      );
    });
  }

  async close(): Promise<void> { await this.pool.end(); }
}

export async function createStateStore(): Promise<StateStore> {
  if (!process.env.DATABASE_URL) return new MemoryStateStore();
  const store = new PostgresStateStore(process.env.DATABASE_URL);
  await store.assertConnected();
  return store;
}
