import {
  createSyntheticDemoInput,
  createSyntheticDemoInputCustom,
  createSyntheticTimetablingDemoInput,
  generateScenarios as generateDomainScenarios,
  generateSchedule as generateDomainSchedule,
  suggestTeacherSubstitutions as suggestDomainSubstitutions,
  validateDispatchFeasibility,
} from "@edtemps/domain";
export { createSyntheticDemoInputCustom, validateDispatchFeasibility };
import type {
  AuditEvent,
  Classroom,
  Dataset,
  Scenario,
  SIECLEImportPreview,
  TimetablingDataset,
  TimetablingSchedule,
} from "./types";

const apiOrigin =
  (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
    ? "https://edtemps-api.onrender.com"
    : "http://localhost:3001");

let activeActorRole = (typeof localStorage !== "undefined" && localStorage.getItem("actorRole")) || "SCHOOL_ADMIN";
let activeActorId = (typeof localStorage !== "undefined" && localStorage.getItem("actorId")) || "demo-adjoint";

export let isOfflineFallback = false;

export function setActorRole(role: string, id?: string): void {
  activeActorRole = role;
  if (id) activeActorId = id;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("actorRole", role);
    localStorage.setItem("actorId", activeActorId);
  }
}

export function getActiveActor(): { role: string; id: string } {
  return { role: activeActorRole, id: activeActorId };
}

const base = `${apiOrigin}/api/v1/establishments/demo-college`;

function getHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-tenant-id": "demo-college",
    "x-actor-id": activeActorId,
    "x-actor-role": activeActorRole,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const bodyIsFormData = init?.body instanceof FormData;
  const requestHeaders = { ...getHeaders(), ...init?.headers } as Record<string, string>;
  if (bodyIsFormData) delete requestHeaders["content-type"];

  // Timeout de 3.5 secondes pour éviter tout blocage UI sur Render cold-start
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: requestHeaders,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      throw new Error(body.message ?? body.error ?? "La requête a échoué.");
    }
    return response.json() as Promise<T>;
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

// Système de Caching Performant (In-Memory + LocalStorage avec TTL)
interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCached<T>(key: string): T | null {
  const memory = memoryCache.get(key);
  if (memory && Date.now() - memory.timestamp < CACHE_TTL_MS) {
    return memory.data as T;
  }
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(`cache_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEntry<T>;
        if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
          memoryCache.set(key, parsed as CacheEntry<unknown>);
          return parsed.data;
        }
      }
    } catch {}
  }
  return null;
}

function setCached<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { timestamp: Date.now(), data };
  memoryCache.set(key, entry as CacheEntry<unknown>);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
    } catch {}
  }
}

// Fallback client-side instantané (< 10ms) pour garantir 0 freeze
const fallbackDataset = createSyntheticDemoInput();
const fallbackTimetablingDataset = createSyntheticTimetablingDemoInput();
let fallbackScenarios = generateDomainScenarios(fallbackDataset, 3);
let fallbackSchedule = generateDomainSchedule(fallbackTimetablingDataset);

let activeDataset: Dataset = fallbackDataset;

export function setActiveDataset(ds: Dataset) {
  activeDataset = ds;
  setCached("dataset", ds);
}

export const api = {
  dataset: async () => {
    const cached = getCached<Dataset>("dataset");
    if (cached) {
      activeDataset = cached;
      return cached;
    }
    try {
      const data = await request<Dataset>("/dispatch/dataset");
      isOfflineFallback = false;
      activeDataset = data;
      setCached("dataset", data);
      return data;
    } catch {
      isOfflineFallback = true;
      const fallback = { ...activeDataset, dataClassification: "SYNTHETIC_DEMO_ONLY" as const };
      setCached("dataset", fallback);
      return fallback;
    }
  },
  generate: async (
    weights?: { genderBalance: number; academicBalance: number; supportBalance: number; optionBalance: number },
    overrideDataset?: Dataset
  ) => {
    const ds = overrideDataset || activeDataset || fallbackDataset;
    try {
      const res = await request<{ scenarios: Scenario[] }>("/dispatch/generate", {
        method: "POST",
        body: JSON.stringify({ scenarioCount: 3, weights }),
      });
      fallbackScenarios = res.scenarios;
      return res;
    } catch {
      fallbackScenarios = generateDomainScenarios(ds as unknown as Parameters<typeof generateDomainScenarios>[0], 3, weights) as unknown as Scenario[];
      return { scenarios: fallbackScenarios };
    }
  },
  move: async (scenarioId: string, studentId: string, targetClassroomId: string) => {
    try {
      const res = await request<{ scenario: Scenario }>(`/dispatch/scenarios/${scenarioId}/move`, {
        method: "POST",
        body: JSON.stringify({ studentId, targetClassroomId }),
      });
      const idx = fallbackScenarios.findIndex((s) => s.id === scenarioId);
      if (idx !== -1) fallbackScenarios[idx] = res.scenario;
      return res;
    } catch {
      let targetScenario = fallbackScenarios.find((s) => s.id === scenarioId);
      if (targetScenario) {
        targetScenario.assignments = {
          ...targetScenario.assignments,
          [studentId]: targetClassroomId,
        };
      } else if (fallbackScenarios.length > 0) {
        targetScenario = {
          ...fallbackScenarios[0],
          id: scenarioId,
          assignments: {
            ...fallbackScenarios[0].assignments,
            [studentId]: targetClassroomId,
          },
        };
        fallbackScenarios.push(targetScenario);
      }
      return { scenario: targetScenario || fallbackScenarios[0] };
    }
  },
  validate: async (scenarioId: string) => {
    try {
      return await request<{ scenario: Scenario }>(`/dispatch/scenarios/${scenarioId}/validate`, {
        method: "POST",
        body: JSON.stringify({ confirmation: true }),
      });
    } catch {
      const targetScenario = fallbackScenarios.find((s) => s.id === scenarioId);
      if (targetScenario) {
        targetScenario.state = "APPROVED";
      }
      return { scenario: targetScenario || fallbackScenarios[0] };
    }
  },
  exportCsvUrl: (scenarioId: string) => `${base}/dispatch/scenarios/${scenarioId}/export/csv`,
  exportPronoteUrl: (scenarioId: string) => `${base}/dispatch/scenarios/${scenarioId}/export/pronote`,
  cnilRegisterUrl: () => `${base}/compliance/cnil-register`,
  dpiaDocumentUrl: () => `${base}/compliance/dpia-document`,

  // Timetabling API
  timetablingDataset: async () => {
    try {
      return await request<TimetablingDataset>("/timetabling/dataset");
    } catch {
      return fallbackTimetablingDataset as unknown as TimetablingDataset;
    }
  },
  timetablingSchedules: async () => {
    try {
      return await request<{ schedules: TimetablingSchedule[] }>("/timetabling/schedules");
    } catch {
      const schedule = generateDomainSchedule(fallbackTimetablingDataset);
      return { schedules: [schedule as unknown as TimetablingSchedule] };
    }
  },
  generateSchedule: async () => {
    try {
      return await request<{ schedule: TimetablingSchedule }>("/timetabling/generate", { method: "POST", body: JSON.stringify({}) });
    } catch {
      const schedule = generateDomainSchedule(fallbackTimetablingDataset);
      return { schedule: schedule as unknown as TimetablingSchedule };
    }
  },
  moveCourseSlot: (scheduleId: string, courseId: string, targetTimeSlotId: string, targetRoomId: string) =>
    request<{ schedule: TimetablingSchedule }>(`/timetabling/schedules/${scheduleId}/move`, {
      method: "POST",
      body: JSON.stringify({ courseId, targetTimeSlotId, targetRoomId }),
    }),
  validateSchedule: (scheduleId: string) =>
    request<{ schedule: TimetablingSchedule }>(`/timetabling/schedules/${scheduleId}/validate`, {
      method: "POST",
    }),
  importSTSWeb: (file: File) => {
    const form = new FormData();
    form.append("archive", file);
    return request<{ preview: { source: string; rawTeacherCount: number } }>("/timetabling/imports/sts-web", { method: "POST", body: form });
  },
  suggestSubstitutions: async (scheduleId: string, teacherId: string, timeSlotId: string, reason?: string) => {
    try {
      return await request<{ absence: { id: string; teacherId: string; timeSlotId: string; reason: string }; suggestions: { substituteTeacherId: string; substituteTeacherName: string; matchScore: number; available: boolean; reason: string }[] }>(
        "/timetabling/substitutions/suggest",
        {
          method: "POST",
          body: JSON.stringify({ scheduleId, teacherId, timeSlotId, reason: reason ?? "Absence déclarée" }),
        }
      );
    } catch {
      const suggestions = suggestDomainSubstitutions(fallbackTimetablingDataset, fallbackSchedule, {
        id: "abs-demo",
        teacherId,
        timeSlotId,
        reason: reason ?? "Absence déclarée",
      });
      return {
        absence: { id: "abs-demo", teacherId, timeSlotId, reason: reason ?? "Absence" },
        suggestions,
      };
    }
  },
  scanDocumentOCR: (file: File) => {
    const form = new FormData();
    form.append("archive", file);
    return request<{ ocrResult: { rawText: string; summary: string; extractedPreferences: { teacherName?: string; subject?: string; unavailableDays?: string[] } } }>("/timetabling/ocr/scan", { method: "POST", body: form });
  },
  sendVoiceCommand: (file?: File) => {
    const form = new FormData();
    if (file) form.append("archive", file);
    return request<{ voiceResult: { transcription: string; explanation: string; structuredConstraint: { targetType: string; targetLabel: string; action: string; details: string } } }>("/timetabling/voice/command", { method: "POST", body: form });
  },

  audit: async () => {
    try {
      return await request<{ events: AuditEvent[] }>("/audit-events");
    } catch {
      return {
        events: [
          {
            id: "audit-demo-1",
            occurredAt: new Date().toISOString(),
            tenantId: "demo-college",
            actorId: "demo-adjoint",
            eventType: "SCENARIOS_GENERATED",
            details: { syntheticData: true },
          },
        ],
      };
    }
  },

  appendAudit: async (event: { eventType: string; scenarioId?: string; details: Record<string, string | number | boolean> }) => {
    try {
      return await request<{ status: string }>("/audit-events", {
        method: "POST",
        body: JSON.stringify(event),
      });
    } catch {
      return { status: "OK" };
    }
  },
  importSIECLE: (file: File) => {
    const form = new FormData();
    form.append("archive", file);
    return request<{ importId: string; expiresAt: string; preview: SIECLEImportPreview }>("/dispatch/imports/siecle", { method: "POST", body: form });
  },
  activateSIECLEImport: (importId: string, level: string, classrooms: Classroom[]) =>
    request<{ dataset: { studentCount: number } }>(`/dispatch/imports/${importId}/activate`, {
      method: "POST",
      body: JSON.stringify({ level, classrooms }),
    }),
};
