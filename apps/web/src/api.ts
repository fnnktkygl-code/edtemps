import type {
  AuditEvent,
  Classroom,
  Dataset,
  Scenario,
  SIECLEImportPreview,
  TimetablingDataset,
  TimetablingSchedule,
} from "./types";

const base = "http://localhost:3001/api/v1/establishments/demo-college";
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
  const response = await fetch(`${base}${path}`, { ...init, headers: requestHeaders });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message ?? body.error ?? "La requête a échoué.");
  }
  return response.json() as Promise<T>;
}

export const api = {
  dataset: () => request<Dataset>("/dispatch/dataset"),
  generate: (weights?: { genderBalance: number; academicBalance: number; supportBalance: number; optionBalance: number }) =>
    request<{ scenarios: Scenario[] }>("/dispatch/generate", {
      method: "POST",
      body: JSON.stringify({ scenarioCount: 3, weights }),
    }),
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
  timetablingDataset: () => request<TimetablingDataset>("/timetabling/dataset"),
  timetablingSchedules: () => request<{ schedules: TimetablingSchedule[] }>("/timetabling/schedules"),
  generateSchedule: () => request<{ schedule: TimetablingSchedule }>("/timetabling/generate", { method: "POST" }),
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
  suggestSubstitutions: (scheduleId: string, teacherId: string, timeSlotId: string, reason?: string) =>
    request<{ absence: { id: string; teacherId: string; timeSlotId: string; reason: string }; suggestions: { substituteTeacherId: string; substituteTeacherName: string; matchScore: number; available: boolean; reason: string }[] }>(
      "/timetabling/substitutions/suggest",
      {
        method: "POST",
        body: JSON.stringify({ scheduleId, teacherId, timeSlotId, reason: reason ?? "Absence déclarée" }),
      }
    ),
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

  audit: () => request<{ events: AuditEvent[] }>("/audit-events"),
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
