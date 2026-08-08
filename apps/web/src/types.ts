export type Student = {
  id: string;
  displayName: string;
  initials: string;
  gender: "F" | "M" | "X";
  levelAverage: number;
  options: string[];
  supportFlags: string[];
  conflictsWith: string[];
  coLocateGroupId?: string;
};

export type Classroom = { id: string; label: string; minSize: number; maxSize: number };

export type Metrics = {
  score: number;
  genderBalance: number;
  academicBalance: number;
  supportBalance: number;
  optionBalance: number;
  hardConstraintViolations: number;
};

export type Explanation = { hardConstraints: string[]; softConsiderations: string[] };

export type Scenario = {
  id: string;
  assignments: Record<string, string>;
  explanations: Record<string, Explanation>;
  metrics: Metrics;
  state: "DRAFT" | "APPROVED";
  generatedAt: string;
};

export type Dataset = {
  establishmentId: string;
  level: string;
  students: Student[];
  classrooms: Classroom[];
  dataClassification: "SYNTHETIC_DEMO_ONLY" | "PSEUDONYMIZED_IMPORT";
};

export type AuditEvent = {
  id: string;
  occurredAt: string;
  actorId: string;
  eventType: string;
  scenarioId?: string;
  details: Record<string, string | number | boolean>;
};

export type SIECLEImportPreview = {
  source: "SIECLE_ZIP";
  level: string;
  students: Student[];
  classrooms: Classroom[];
  warnings: string[];
  sourceFiles: string[];
};

// ==========================================
// MODULE 2 TYPES (TIMETABLING)
// ==========================================

export type TimeSlot = {
  id: string;
  day: "Lundi" | "Mardi" | "Mercredi" | "Jeudi" | "Vendredi";
  period: string;
  isMeridienne?: boolean;
};

export type Teacher = {
  id: string;
  displayName: string;
  subjects: string[];
  unavailableSlotIds: string[];
};

export type Room = {
  id: string;
  label: string;
  capacity: number;
  roomType: "STANDARD" | "LABO" | "EPS" | "INFORMATIQUE" | "ART";
};

export type Course = {
  id: string;
  subject: string;
  classroomId: string;
  teacherId: string;
  hoursPerWeek: number;
  requiredRoomType: "STANDARD" | "LABO" | "EPS" | "INFORMATIQUE" | "ART";
  coLocateBarretteId?: string;
};

export type TimetablingDataset = {
  establishmentId: string;
  timeSlots: TimeSlot[];
  teachers: Teacher[];
  rooms: Room[];
  courses: Course[];
  barrettes: { id: string; label: string; courseIds: string[] }[];
};

export type SchedulePlacement = {
  courseId: string;
  timeSlotId: string;
  roomId: string;
};

export type TimetableConflict = {
  code: string;
  message: string;
  courseIds: string[];
  timeSlotId: string;
  roomId?: string;
};

export type ScheduleMetrics = {
  score: number;
  placedCourses: number;
  totalCourses: number;
  conflictsCount: number;
  teacherGapScore: number;
  studentGapScore: number;
};

export type TimetablingSchedule = {
  id: string;
  placements: SchedulePlacement[];
  conflicts: TimetableConflict[];
  metrics: ScheduleMetrics;
  state: "DRAFT" | "APPROVED";
  generatedAt: string;
};

export type STSImportPreview = {
  source: "STS_WEB_XML";
  teachers: Teacher[];
  warnings: string[];
  rawTeacherCount: number;
};

export type TeacherAbsence = {
  id: string;
  teacherId: string;
  timeSlotId: string;
  reason: string;
};

export type SubstitutionSuggestion = {
  substituteTeacherId: string;
  substituteTeacherName: string;
  matchScore: number;
  available: boolean;
  reason: string;
};
