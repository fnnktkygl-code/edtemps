import "dotenv/config";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import {
  createSyntheticDemoInput,
  createSyntheticTimetablingDemoInput,
  exportDispatchCSV,
  exportDispatchPRONOTE,
  generateCNILRegisterJSON,
  generateDPIAMarkdown,
  generateScenarios,
  generateSchedule,
  moveCourseSlot,
  moveStudent,
  parsePronoteExchangeJSON,
  suggestTeacherSubstitutions,
  type DispatchScenario,
  type DispatchWeights,
  type TeacherAbsence,
  type TimetablingSchedule,
} from "../../../packages/domain/src/index.js";
import { inputFromSIECLEPreview, parseSIECLEArchive, type SIECLEImportPreview } from "./siecle-import.js";
import { parseSTSWebXML } from "./sts-import.js";
import { explainConflictWithMistral, processDocumentOCRWithMistral, transcribeAndParseAudioCommand } from "./mistral.js";
import { createStateStore, type AuditEvent } from "./state-store.js";

const establishmentId = "demo-college";
const stateStore = await createStateStore();
let input = await stateStore.loadInput(establishmentId) ?? createSyntheticDemoInput();
const scenarios = new Map<string, DispatchScenario>((await stateStore.listScenarios(establishmentId)).map((scenario) => [scenario.id, scenario]));

const timetablingInput = await stateStore.loadTimetablingInput(establishmentId) ?? createSyntheticTimetablingDemoInput();
const timetablingSchedules = new Map<string, TimetablingSchedule>((await stateStore.listTimetablingSchedules(establishmentId)).map((s) => [s.id, s]));

const pendingImports = new Map<string, { preview: SIECLEImportPreview; expiresAt: number }>();
let dataClassification = process.env.DEMO_MODE === "false" ? "PSEUDONYMIZED_IMPORT" : "SYNTHETIC_DEMO_ONLY";

async function audit(event: Omit<AuditEvent, "id" | "occurredAt">): Promise<void> {
  await stateStore.appendAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    occurredAt: new Date().toISOString(),
    ...event,
  });
}

function getActor(request: FastifyRequest): { id: string; role: string } {
  // Démonstration locale uniquement. En production, valeurs issues de claims OIDC validés.
  const id = request.headers["x-actor-id"];
  const role = request.headers["x-actor-role"];
  return {
    id: typeof id === "string" ? id : "demo-adjoint",
    role: typeof role === "string" ? role : "DISPATCH_EDITOR",
  };
}

function assertTenant(request: FastifyRequest, reply: FastifyReply, requestedTenant: string): boolean {
  const headerTenant = request.headers["x-tenant-id"];
  if (headerTenant !== requestedTenant || requestedTenant !== establishmentId) {
    reply.code(403).send({ error: "TENANT_ACCESS_DENIED", message: "Contexte établissement absent ou non autorisé." });
    return false;
  }
  return true;
}

function requireRole(request: FastifyRequest, reply: FastifyReply, allowed: string[]): boolean {
  const actor = getActor(request);
  if (!allowed.includes(actor.role)) {
    reply.code(403).send({ error: "ROLE_ACCESS_DENIED", message: "Cette action requiert une habilitation spécifique." });
    return false;
  }
  return true;
}

const generationSchema = z.object({
  scenarioCount: z.number().int().min(1).max(5).default(3),
  weights: z.object({
    genderBalance: z.number().min(0).max(10),
    academicBalance: z.number().min(0).max(10),
    supportBalance: z.number().min(0).max(10),
    optionBalance: z.number().min(0).max(10),
  }).optional(),
});

const moveSchema = z.object({ studentId: z.string().min(1), targetClassroomId: z.string().min(1) });
const validateSchema = z.object({ confirmation: z.literal(true) });
const activateImportSchema = z.object({
  level: z.string().trim().min(1).max(30),
  classrooms: z.array(z.object({
    id: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
    label: z.string().trim().min(1).max(100),
    minSize: z.number().int().min(1).max(100),
    maxSize: z.number().int().min(1).max(100),
  }).refine((classroom) => classroom.minSize <= classroom.maxSize, { message: "L'effectif minimal doit être inférieur ou égal au maximum." })).min(1).max(100),
});

const app = Fastify({ logger: true });

const allowedCorsOrigin = process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGIN || "*";
await app.register(cors, {
  origin: allowedCorsOrigin === "*" ? true : [allowedCorsOrigin, "http://localhost:5173", "http://127.0.0.1:5173", "https://edtemps.vercel.app"],
  methods: ["GET", "POST"],
  allowedHeaders: ["content-type", "x-tenant-id", "x-actor-id", "x-actor-role"],
});
await app.register(multipart, { limits: { files: 1, fileSize: 10 * 1024 * 1024 } });

app.get("/api/health", async () => ({
  status: "ok",
  mode: process.env.DEMO_MODE === "false" ? "configured" : "demo",
  persistence: stateStore.mode,
}));

app.get("/api/v1/establishments/:tenantId/dispatch/dataset", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId)) return;
  return {
    establishmentId: input.establishmentId,
    level: input.level,
    students: input.students,
    classrooms: input.classrooms,
    dataClassification,
  };
});

app.post("/api/v1/establishments/:tenantId/dispatch/imports/siecle", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId) || !requireRole(request, reply, ["SCHOOL_ADMIN", "DISPATCH_EDITOR"])) return;
  const upload = await request.file();
  if (!upload) return reply.code(400).send({ error: "FILE_REQUIRED", message: "Une archive SIECLE ZIP est requise." });
  if (!upload.filename.toLowerCase().endsWith(".zip")) return reply.code(400).send({ error: "INVALID_FILE_TYPE", message: "Seules les archives ZIP sont acceptées." });
  try {
    const archive = await upload.toBuffer();
    const secret = process.env.TENANT_PSEUDONYMIZATION_SECRET ?? (process.env.DEMO_MODE === "false" ? "" : "local-demo-secret-not-for-production");
    const preview = parseSIECLEArchive(archive, secret, tenantId);
    const importId = `siecle-${crypto.randomUUID()}`;
    const expiresAt = Date.now() + 30 * 60 * 1000;
    pendingImports.set(importId, { preview, expiresAt });
    await audit({
      tenantId,
      actorId: getActor(request).id,
      eventType: "SIECLE_IMPORTED",
      details: { importId, studentCount: preview.students.length, warningCount: preview.warnings.length, rawIdentifiersPersisted: false },
    });
    return { importId, expiresAt: new Date(expiresAt).toISOString(), preview };
  } catch (error) {
    return reply.code(422).send({ error: "SIECLE_IMPORT_REJECTED", message: error instanceof Error ? error.message : "Archive non exploitable." });
  }
});

app.post("/api/v1/establishments/:tenantId/dispatch/imports/:importId/activate", async (request, reply) => {
  const { tenantId, importId } = request.params as { tenantId: string; importId: string };
  if (!assertTenant(request, reply, tenantId) || !requireRole(request, reply, ["SCHOOL_ADMIN", "DISPATCH_EDITOR"])) return;
  const pendingImport = pendingImports.get(importId);
  if (!pendingImport) return reply.code(404).send({ error: "IMPORT_NOT_FOUND", message: "L'aperçu a expiré ou est introuvable." });
  if (pendingImport.expiresAt <= Date.now()) {
    pendingImports.delete(importId);
    return reply.code(410).send({ error: "IMPORT_EXPIRED", message: "L'aperçu a expiré ; importez à nouveau l'archive." });
  }
  const parsed = activateImportSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "INVALID_TARGET_CLASSES", details: parsed.error.flatten() });
  try {
    input = inputFromSIECLEPreview(pendingImport.preview, parsed.data.classrooms, parsed.data.level);
    input.establishmentId = tenantId;
    scenarios.clear();
    await stateStore.saveInput(tenantId, input);
    await stateStore.saveScenarios(tenantId, []);
    pendingImports.delete(importId);
    dataClassification = "PSEUDONYMIZED_IMPORT";
    await audit({
      tenantId,
      actorId: getActor(request).id,
      eventType: "IMPORT_ACTIVATED",
      details: { importId, studentCount: input.students.length, targetClassCount: input.classrooms.length },
    });
    return { dataset: { establishmentId: input.establishmentId, level: input.level, studentCount: input.students.length, classrooms: input.classrooms } };
  } catch (error) {
    return reply.code(422).send({ error: "IMPORT_ACTIVATION_REJECTED", message: error instanceof Error ? error.message : "Activation impossible." });
  }
});

app.get("/api/v1/establishments/:tenantId/dispatch/scenarios", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId)) return;
  return { scenarios: [...scenarios.values()].sort((left, right) => right.metrics.score - left.metrics.score) };
});

app.post("/api/v1/establishments/:tenantId/dispatch/generate", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId) || !requireRole(request, reply, ["SCHOOL_ADMIN", "DISPATCH_EDITOR"])) return;
  const parsed = generationSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
  const generated = generateScenarios(input, parsed.data.scenarioCount, parsed.data.weights as DispatchWeights | undefined);
  scenarios.clear();
  generated.forEach((scenario) => scenarios.set(scenario.id, scenario));
  await stateStore.saveScenarios(tenantId, generated);
  await audit({
    tenantId,
    actorId: getActor(request).id,
    eventType: "SCENARIOS_GENERATED",
    details: { count: generated.length, syntheticData: dataClassification === "SYNTHETIC_DEMO_ONLY" },
  });
  return { scenarios: generated };
});

app.post("/api/v1/establishments/:tenantId/dispatch/scenarios/:scenarioId/move", async (request, reply) => {
  const { tenantId, scenarioId } = request.params as { tenantId: string; scenarioId: string };
  if (!assertTenant(request, reply, tenantId) || !requireRole(request, reply, ["SCHOOL_ADMIN", "DISPATCH_EDITOR", "CPE"])) return;
  const parsed = moveSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
  const scenario = scenarios.get(scenarioId);
  if (!scenario) return reply.code(404).send({ error: "SCENARIO_NOT_FOUND" });
  try {
    const updated = moveStudent(input, scenario, parsed.data.studentId, parsed.data.targetClassroomId);
    scenarios.set(scenarioId, updated);
    await stateStore.saveScenarios(tenantId, [...scenarios.values()]);
    await audit({
      tenantId,
      actorId: getActor(request).id,
      eventType: "ASSIGNMENT_MOVED",
      scenarioId,
      details: { studentId: parsed.data.studentId, targetClassroomId: parsed.data.targetClassroomId },
    });
    return { scenario: updated };
  } catch (error) {
    return reply.code(409).send({ error: "HARD_CONSTRAINT_VIOLATION", message: error instanceof Error ? error.message : "Déplacement impossible." });
  }
});

app.post("/api/v1/establishments/:tenantId/dispatch/scenarios/:scenarioId/validate", async (request, reply) => {
  const { tenantId, scenarioId } = request.params as { tenantId: string; scenarioId: string };
  if (!assertTenant(request, reply, tenantId) || !requireRole(request, reply, ["SCHOOL_ADMIN"])) return;
  const parsed = validateSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "EXPLICIT_CONFIRMATION_REQUIRED" });
  const scenario = scenarios.get(scenarioId);
  if (!scenario) return reply.code(404).send({ error: "SCENARIO_NOT_FOUND" });
  if (scenario.metrics.hardConstraintViolations > 0) return reply.code(409).send({ error: "UNRESOLVED_HARD_CONSTRAINTS" });
  const validated = { ...scenario, state: "APPROVED" as const };
  scenarios.set(scenarioId, validated);
  await stateStore.saveScenarios(tenantId, [...scenarios.values()]);
  await audit({
    tenantId,
    actorId: getActor(request).id,
    eventType: "SCENARIO_VALIDATED",
    scenarioId,
    details: { explicitHumanValidation: true, hardConstraintViolations: 0 },
  });
  return { scenario: validated };
});

app.get("/api/v1/establishments/:tenantId/dispatch/scenarios/:scenarioId/export/csv", async (request, reply) => {
  const { tenantId, scenarioId } = request.params as { tenantId: string; scenarioId: string };
  if (!assertTenant(request, reply, tenantId)) return;
  const scenario = scenarios.get(scenarioId);
  if (!scenario) return reply.code(404).send({ error: "SCENARIO_NOT_FOUND" });
  const csv = exportDispatchCSV(input, scenario);
  reply.header("content-type", "text/csv; charset=utf-8");
  reply.header("content-disposition", `attachment; filename="repartition-${scenarioId}.csv"`);
  return csv;
});

app.get("/api/v1/establishments/:tenantId/dispatch/scenarios/:scenarioId/export/pronote", async (request, reply) => {
  const { tenantId, scenarioId } = request.params as { tenantId: string; scenarioId: string };
  if (!assertTenant(request, reply, tenantId)) return;
  const scenario = scenarios.get(scenarioId);
  if (!scenario) return reply.code(404).send({ error: "SCENARIO_NOT_FOUND" });
  const json = exportDispatchPRONOTE(input, scenario);
  reply.header("content-type", "application/json; charset=utf-8");
  reply.header("content-disposition", `attachment; filename="repartition-${scenarioId}-pronote.json"`);
  return json;
});

// ==========================================
// MODULE 2 ENDPOINTS — EMPLOIS DU TEMPS (EDT)
// ==========================================

const moveCourseSchema = z.object({
  courseId: z.string().min(1),
  targetTimeSlotId: z.string().min(1),
  targetRoomId: z.string().min(1),
});

app.get("/api/v1/establishments/:tenantId/timetabling/dataset", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId)) return;
  return {
    establishmentId: timetablingInput.establishmentId,
    timeSlots: timetablingInput.timeSlots,
    teachers: timetablingInput.teachers,
    rooms: timetablingInput.rooms,
    courses: timetablingInput.courses,
    barrettes: timetablingInput.barrettes,
  };
});

app.get("/api/v1/establishments/:tenantId/timetabling/schedules", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId)) return;
  return { schedules: [...timetablingSchedules.values()] };
});

app.post("/api/v1/establishments/:tenantId/timetabling/generate", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId) || !requireRole(request, reply, ["SCHOOL_ADMIN", "DISPATCH_EDITOR"])) return;
  const schedule = generateSchedule(timetablingInput, Math.floor(Math.random() * 10000));
  timetablingSchedules.set(schedule.id, schedule);
  await stateStore.saveTimetablingSchedules(tenantId, [...timetablingSchedules.values()]);
  await audit({
    tenantId,
    actorId: getActor(request).id,
    eventType: "SCHEDULE_GENERATED",
    scenarioId: schedule.id,
    details: { placedCourses: schedule.metrics.placedCourses, conflictsCount: schedule.conflicts.length },
  });
  return { schedule };
});

app.post("/api/v1/establishments/:tenantId/timetabling/schedules/:scheduleId/move", async (request, reply) => {
  const { tenantId, scheduleId } = request.params as { tenantId: string; scheduleId: string };
  if (!assertTenant(request, reply, tenantId) || !requireRole(request, reply, ["SCHOOL_ADMIN", "DISPATCH_EDITOR"])) return;
  const parsed = moveCourseSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
  const schedule = timetablingSchedules.get(scheduleId);
  if (!schedule) return reply.code(404).send({ error: "SCHEDULE_NOT_FOUND" });
  try {
    const updated = moveCourseSlot(timetablingInput, schedule, parsed.data.courseId, parsed.data.targetTimeSlotId, parsed.data.targetRoomId);
    timetablingSchedules.set(scheduleId, updated);
    await stateStore.saveTimetablingSchedules(tenantId, [...timetablingSchedules.values()]);
    await audit({
      tenantId,
      actorId: getActor(request).id,
      eventType: "COURSE_MOVED",
      scenarioId: scheduleId,
      details: { courseId: parsed.data.courseId, targetTimeSlotId: parsed.data.targetTimeSlotId, targetRoomId: parsed.data.targetRoomId },
    });
    return { schedule: updated };
  } catch (error) {
    return reply.code(409).send({ error: "TIMETABLE_CONSTRAINT_VIOLATION", message: error instanceof Error ? error.message : "Déplacement impossible." });
  }
});

app.post("/api/v1/establishments/:tenantId/timetabling/schedules/:scheduleId/validate", async (request, reply) => {
  const { tenantId, scheduleId } = request.params as { tenantId: string; scheduleId: string };
  if (!assertTenant(request, reply, tenantId) || !requireRole(request, reply, ["SCHOOL_ADMIN"])) return;
  const schedule = timetablingSchedules.get(scheduleId);
  if (!schedule) return reply.code(404).send({ error: "SCHEDULE_NOT_FOUND" });
  const validated = { ...schedule, state: "APPROVED" as const };
  timetablingSchedules.set(scheduleId, validated);
  await stateStore.saveTimetablingSchedules(tenantId, [...timetablingSchedules.values()]);
  await audit({
    tenantId,
    actorId: getActor(request).id,
    eventType: "SCHEDULE_VALIDATED",
    scenarioId: scheduleId,
    details: { explicitHumanValidation: true, conflictsCount: schedule.conflicts.length },
  });
  return { schedule: validated };
});

app.post("/api/v1/establishments/:tenantId/timetabling/imports/sts-web", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId) || !requireRole(request, reply, ["SCHOOL_ADMIN", "DISPATCH_EDITOR"])) return;
  const upload = await request.file();
  if (!upload) return reply.code(400).send({ error: "FILE_REQUIRED", message: "Le fichier STS-Web XML (sts_emp.xml) est requis." });
  try {
    const xmlContent = (await upload.toBuffer()).toString("utf8");
    const preview = parseSTSWebXML(xmlContent);
    timetablingInput.teachers = preview.teachers;
    await stateStore.saveTimetablingInput(tenantId, timetablingInput);
    await audit({
      tenantId,
      actorId: getActor(request).id,
      eventType: "SIECLE_IMPORTED",
      details: { importedTeachersCount: preview.teachers.length },
    });
    return { preview };
  } catch (error) {
    return reply.code(422).send({ error: "STS_IMPORT_REJECTED", message: error instanceof Error ? error.message : "Fichier STS-Web non exploitable." });
  }
});

const substitutionSchema = z.object({
  scheduleId: z.string().min(1),
  teacherId: z.string().min(1),
  timeSlotId: z.string().min(1),
  reason: z.string().default("Absence déclarée"),
});

app.post("/api/v1/establishments/:tenantId/timetabling/substitutions/suggest", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId)) return;
  const parsed = substitutionSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
  const schedule = timetablingSchedules.get(parsed.data.scheduleId);
  if (!schedule) return reply.code(404).send({ error: "SCHEDULE_NOT_FOUND" });

  const absence: TeacherAbsence = {
    id: `abs-${crypto.randomUUID()}`,
    teacherId: parsed.data.teacherId,
    timeSlotId: parsed.data.timeSlotId,
    reason: parsed.data.reason,
  };

  const suggestions = suggestTeacherSubstitutions(timetablingInput, schedule, absence);
  return { absence, suggestions };
});

app.post("/api/v1/establishments/:tenantId/timetabling/conflicts/explain", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId)) return;
  const { conflictMessage } = (request.body as { conflictMessage?: string }) ?? {};
  if (!conflictMessage) return reply.code(400).send({ error: "INVALID_REQUEST", message: "conflictMessage requis." });
  const explanation = await explainConflictWithMistral(conflictMessage);
  return { explanation };
});

app.post("/api/v1/establishments/:tenantId/timetabling/ocr/scan", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId) || !requireRole(request, reply, ["SCHOOL_ADMIN", "DISPATCH_EDITOR"])) return;
  const upload = await request.file();
  if (!upload) return reply.code(400).send({ error: "FILE_REQUIRED", message: "Document scanné (Image/PDF) requis." });
  const buffer = await upload.toBuffer();
  const result = await processDocumentOCRWithMistral(buffer, upload.mimetype);
  await audit({
    tenantId,
    actorId: getActor(request).id,
    eventType: "SIECLE_IMPORTED",
    details: { ocrSuccess: true, teacherExtracted: result.extractedPreferences.teacherName ?? "Détecté" },
  });
  return { ocrResult: result };
});

app.post("/api/v1/establishments/:tenantId/timetabling/voice/command", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId)) return;
  const upload = await request.file();
  const buffer = upload ? await upload.toBuffer() : Buffer.from("dummy-audio");
  const mimeType = upload ? upload.mimetype : "audio/webm";
  const result = await transcribeAndParseAudioCommand(buffer, mimeType);
  await audit({
    tenantId,
    actorId: getActor(request).id,
    eventType: "COURSE_MOVED",
    details: { voiceCommandTranscribed: result.transcription },
  });
  return { voiceResult: result };
});

app.post("/api/v1/establishments/:tenantId/dispatch/imports/pronote", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId) || !requireRole(request, reply, ["SCHOOL_ADMIN", "DISPATCH_EDITOR"])) return;
  const upload = await request.file();
  if (!upload) return reply.code(400).send({ error: "FILE_REQUIRED", message: "Le fichier d'échange PRONOTE JSON est requis." });
  try {
    const jsonContent = (await upload.toBuffer()).toString("utf8");
    const preview = parsePronoteExchangeJSON(jsonContent);
    await audit({
      tenantId,
      actorId: getActor(request).id,
      eventType: "SIECLE_IMPORTED",
      details: { importedPRONOTEAssignments: preview.assignmentsCount },
    });
    return { preview };
  } catch (error) {
    return reply.code(422).send({ error: "PRONOTE_IMPORT_REJECTED", message: error instanceof Error ? error.message : "Fichier PRONOTE non exploitable." });
  }
});

app.get("/api/v1/establishments/:tenantId/compliance/cnil-register", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId)) return;
  const json = generateCNILRegisterJSON(tenantId);
  reply.header("content-type", "application/json; charset=utf-8");
  reply.header("content-disposition", `attachment; filename="registre-cnil-${tenantId}.json"`);
  return json;
});

app.get("/api/v1/establishments/:tenantId/compliance/dpia-document", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId)) return;
  const md = generateDPIAMarkdown(tenantId);
  reply.header("content-type", "text/markdown; charset=utf-8");
  reply.header("content-disposition", `attachment; filename="aipd-dpia-${tenantId}.md"`);
  return md;
});

app.get("/api/v1/establishments/:tenantId/audit-events", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId) || !requireRole(request, reply, ["SCHOOL_ADMIN", "DPO", "DISPATCH_EDITOR", "CPE"])) return;
  return { events: await stateStore.listAuditEvents(tenantId) };
});

app.post("/api/v1/establishments/:tenantId/audit-events", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  if (!assertTenant(request, reply, tenantId) || !requireRole(request, reply, ["SCHOOL_ADMIN", "DPO", "DISPATCH_EDITOR"])) return;
  const payload = request.body as { eventType: string; scenarioId?: string; details: Record<string, string | number | boolean> };
  await audit({
    tenantId,
    actorId: getActor(request).id,
    eventType: (payload.eventType as any) || "STUDENT_UPDATED",
    scenarioId: payload.scenarioId,
    details: payload.details || {},
  });
  return { status: "OK" };
});

app.addHook("onClose", async () => { await stateStore.close(); });

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  const err = error as Error;
  // RGPD & Sécurité : Ne jamais divulguer la stack trace ou les détails internes au client
  reply.code(422).send({
    error: "PROCESSING_FAILED",
    message: err.message || "Une erreur de traitement s'est produite lors de l'exécution de la requête.",
  });
});

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST || "0.0.0.0";
await app.listen({ port, host });
