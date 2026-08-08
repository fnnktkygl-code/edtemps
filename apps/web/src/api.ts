import {
  createSyntheticDemoInput,
  createSyntheticTimetablingDemoInput,
  generateScenarios as generateDomainScenarios,
  generateSchedule as generateDomainSchedule,
  suggestTeacherSubstitutions as suggestDomainSubstitutions,
} from "@edtemps/domain";
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

const base = `${apiOrigin}/api/v1/establishments/demo-college`;
const headers = {
  "content-type": "application/json",
  "x-tenant-id": "demo-college",
  "x-actor-id": "demo-adjoint",
  "x-actor-role": "SCHOOL_ADMIN",
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const bodyIsFormData = init?.body instanceof FormData;
  const requestHeaders = { ...headers, ...init?.headers } as Record<string, string>;
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

// Fallback client-side instantané (< 10ms) pour garantir 0 freeze
const fallbackDataset = createSyntheticDemoInput();
const fallbackTimetablingDataset = createSyntheticTimetablingDemoInput();
let fallbackScenarios = generateDomainScenarios(fallbackDataset, 3);
let fallbackSchedule = generateDomainSchedule(fallbackTimetablingDataset);

export const api = {
  dataset: async () => {
    try {
      return await request<Dataset>("/dispatch/dataset");
    } catch {
      return fallbackDataset as unknown as Dataset;
    }
  },
  generate: async (weights?: { genderBalance: number; academicBalance: number; supportBalance: number; optionBalance: number }) => {
    try {
      return await request<{ scenarios: Scenario[] }>("/dispatch/generate", {
        method: "POST",
        body: JSON.stringify({ scenarioCount: 3, weights }),
      });
    } catch {
      fallbackScenarios = generateDomainScenarios(fallbackDataset, 3, weights) as unknown as Scenario[];
      return { scenarios: fallbackScenarios };
    }
  },
  move: (scenarioId: string, studentId: string, targetClassroomId: string) =>
    request<{ scenario: Scenario }>(`/dispatch/scenarios/${scenarioId}/move`, {
      method: "POST",
      body: JSON.stringify({ studentId, targetClassroomId }),
    }),
  validate: (scenarioId: string) =>
    request<{ scenario: Scenario }>(`/dispatch/scenarios/${scenarioId}/validate`, {
      method: "POST",
      body: JSON.stringify({ confirmation: true }),
    }),
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
