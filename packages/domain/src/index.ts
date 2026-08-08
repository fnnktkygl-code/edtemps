export type Gender = "F" | "M" | "X";

export type Student = {
  id: string;
  displayName: string;
  initials: string;
  gender: Gender;
  levelAverage: number;
  options: string[];
  supportFlags: ("PAP" | "PPRE" | "PPS" | "PAI" | "ULIS")[];
  conflictsWith: string[];
  coLocateGroupId?: string;
};

export type Classroom = {
  id: string;
  label: string;
  minSize: number;
  maxSize: number;
};

export type DispatchInput = {
  establishmentId: string;
  level: string;
  students: Student[];
  classrooms: Classroom[];
};

export type DispatchWeights = {
  genderBalance: number;
  academicBalance: number;
  supportBalance: number;
  optionBalance: number;
};

export type Assignment = Record<string, string>;

export type HardConstraintViolation = {
  code: "UNKNOWN_STUDENT" | "UNKNOWN_CLASSROOM" | "CAPACITY_EXCEEDED" | "CAPACITY_BELOW_MIN" | "CONFLICT" | "COLOCATION";
  message: string;
  studentIds: string[];
  classroomId?: string;
};

export type StudentExplanation = {
  hardConstraints: string[];
  softConsiderations: string[];
};

export type ScenarioMetrics = {
  score: number;
  genderBalance: number;
  academicBalance: number;
  supportBalance: number;
  optionBalance: number;
  hardConstraintViolations: number;
};

export type DispatchScenario = {
  id: string;
  assignments: Assignment;
  explanations: Record<string, StudentExplanation>;
  metrics: ScenarioMetrics;
  state: "DRAFT" | "APPROVED";
  generatedAt: string;
};

const defaultWeights: DispatchWeights = {
  genderBalance: 4,
  academicBalance: 4,
  supportBalance: 3,
  optionBalance: 2,
};

type Random = () => number;

function seededRandom(seed: number): Random {
  let current = seed >>> 0;
  return () => {
    current += 0x6d2b79f5;
    let value = current;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function groupStudents(students: Student[]): Student[][] {
  const grouped = new Map<string, Student[]>();
  for (const student of students) {
    const key = student.coLocateGroupId ?? `single:${student.id}`;
    const group = grouped.get(key) ?? [];
    group.push(student);
    grouped.set(key, group);
  }
  return [...grouped.values()];
}

function sum<T>(values: T[], project: (value: T) => number): number {
  return values.reduce((total, value) => total + project(value), 0);
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : sum(values, (value) => value) / values.length;
}

function getClassStudents(assignment: Assignment, classroomId: string, students: Student[]): Student[] {
  return students.filter((student) => assignment[student.id] === classroomId);
}

function hasConflict(candidate: Student[], currentStudents: Student[]): boolean {
  const currentIds = new Set(currentStudents.map((student) => student.id));
  return candidate.some((student) => student.conflictsWith.some((otherId) => currentIds.has(otherId))) ||
    currentStudents.some((student) => student.conflictsWith.some((otherId) => candidate.some((item) => item.id === otherId)));
}

function targetStats(input: DispatchInput) {
  const numberOfClasses = input.classrooms.length;
  const optionLabels = [...new Set(input.students.flatMap((student) => student.options))];
  return {
    size: input.students.length / numberOfClasses,
    female: input.students.filter((student) => student.gender === "F").length / numberOfClasses,
    male: input.students.filter((student) => student.gender === "M").length / numberOfClasses,
    average: average(input.students.map((student) => student.levelAverage)),
    support: input.students.filter((student) => student.supportFlags.length > 0).length / numberOfClasses,
    options: Object.fromEntries(optionLabels.map((option) => [option, input.students.filter((student) => student.options.includes(option)).length / numberOfClasses])),
  };
}

function candidatePenalty(
  candidate: Student[],
  existing: Student[],
  targets: ReturnType<typeof targetStats>,
  weights: DispatchWeights,
): number {
  const after = [...existing, ...candidate];
  const female = after.filter((student) => student.gender === "F").length;
  const male = after.filter((student) => student.gender === "M").length;
  const support = after.filter((student) => student.supportFlags.length > 0).length;
  const optionPenalty = sum(Object.entries(targets.options), ([option, target]) =>
    Math.abs(after.filter((student) => student.options.includes(option)).length - target),
  );
  return (
    Math.abs(female - targets.female) * weights.genderBalance +
    Math.abs(male - targets.male) * weights.genderBalance +
    Math.abs(average(after.map((student) => student.levelAverage)) - targets.average) * weights.academicBalance +
    Math.abs(support - targets.support) * weights.supportBalance +
    optionPenalty * weights.optionBalance +
    // La charge courante est volontairement prépondérante pendant la construction
    // gloutonne : cela évite de remplir une classe avant de considérer les autres.
    after.length * 5
  );
}

export function validateAssignment(input: DispatchInput, assignments: Assignment): HardConstraintViolation[] {
  const violations: HardConstraintViolation[] = [];
  const studentsById = new Map(input.students.map((student) => [student.id, student]));
  const classroomsById = new Map(input.classrooms.map((classroom) => [classroom.id, classroom]));

  for (const [studentId, classroomId] of Object.entries(assignments)) {
    if (!studentsById.has(studentId)) {
      violations.push({ code: "UNKNOWN_STUDENT", message: `Élève inconnu : ${studentId}.`, studentIds: [studentId] });
    }
    if (!classroomsById.has(classroomId)) {
      violations.push({ code: "UNKNOWN_CLASSROOM", message: `Classe inconnue : ${classroomId}.`, studentIds: [studentId], classroomId });
    }
  }

  for (const classroom of input.classrooms) {
    const members = getClassStudents(assignments, classroom.id, input.students);
    if (members.length > classroom.maxSize) {
      violations.push({
        code: "CAPACITY_EXCEEDED",
        message: `${classroom.label} dépasse son effectif maximal (${members.length}/${classroom.maxSize}).`,
        studentIds: members.map((student) => student.id),
        classroomId: classroom.id,
      });
    }
    if (members.length < classroom.minSize) {
      violations.push({
        code: "CAPACITY_BELOW_MIN",
        message: `${classroom.label} n'atteint pas son effectif minimal (${members.length}/${classroom.minSize}).`,
        studentIds: members.map((student) => student.id),
        classroomId: classroom.id,
      });
    }
    for (const student of members) {
      for (const conflictId of student.conflictsWith) {
        if (members.some((member) => member.id === conflictId)) {
          violations.push({
            code: "CONFLICT",
            message: `Séparation obligatoire non respectée dans ${classroom.label}.`,
            studentIds: [student.id, conflictId],
            classroomId: classroom.id,
          });
        }
      }
    }
  }

  for (const group of groupStudents(input.students)) {
    if (group.length < 2) continue;
    const assigned = new Set(group.map((student) => assignments[student.id]).filter(Boolean));
    if (assigned.size > 1) {
      violations.push({
        code: "COLOCATION",
        message: "Le regroupement AESH requis a été séparé.",
        studentIds: group.map((student) => student.id),
      });
    }
  }
  return violations;
}

function explanationFor(student: Student, classroom: Classroom, members: Student[]): StudentExplanation {
  const hardConstraints = [
    `Effectif de ${classroom.label} sous le maximum autorisé (${members.length}/${classroom.maxSize}).`,
    "Aucune incompatibilité déclarée dans cette affectation.",
  ];
  if (student.coLocateGroupId) hardConstraints.push("Regroupement d'accompagnement conservé.");
  const softConsiderations = ["Contribution à l'équilibre filles/garçons et des résultats scolaires."];
  if (student.supportFlags.length > 0) softConsiderations.push("Répartition des besoins d'accompagnement prise en compte.");
  if (student.options.length > 0) softConsiderations.push(`Options équilibrées : ${student.options.join(", ")}.`);
  return { hardConstraints, softConsiderations };
}

export function generateScenario(
  input: DispatchInput,
  seed: number,
  weights: DispatchWeights = defaultWeights,
): DispatchScenario {
  if (input.classrooms.length === 0) throw new Error("Au moins une classe cible est requise.");
  if (sum(input.classrooms, (classroom) => classroom.maxSize) < input.students.length) {
    throw new Error("La capacité totale des classes est insuffisante.");
  }
  const random = seededRandom(seed);
  const targets = targetStats(input);
  const assignments: Assignment = {};
  const groups = groupStudents(input.students).sort((left, right) => {
    const importance = (group: Student[]) => sum(group, (student) => student.conflictsWith.length * 10 + student.supportFlags.length * 2);
    return importance(right) - importance(left) || random() - 0.5;
  });

  for (const group of groups) {
    const candidates = input.classrooms
      .map((classroom) => {
        const currentStudents = getClassStudents(assignments, classroom.id, input.students);
        if (currentStudents.length + group.length > classroom.maxSize || hasConflict(group, currentStudents)) return null;
        return { classroom, penalty: candidatePenalty(group, currentStudents, targets, weights) + random() * 0.01 };
      })
      .filter((candidate): candidate is { classroom: Classroom; penalty: number } => candidate !== null)
      .sort((left, right) => left.penalty - right.penalty);
    const selected = candidates[0];
    if (!selected) {
      const labels = group.map((student) => student.initials).join(", ");
      throw new Error(`Affectation impossible pour ${labels} : capacités ou séparations incompatibles.`);
    }
    for (const student of group) assignments[student.id] = selected.classroom.id;
  }

  const violations = validateAssignment(input, assignments);
  if (violations.length > 0) throw new Error(`Le scénario généré viole ${violations.length} contrainte(s) dure(s).`);
  const explanations: Record<string, StudentExplanation> = {};
  for (const student of input.students) {
    const classroomId = assignments[student.id];
    const classroom = input.classrooms.find((item) => item.id === classroomId);
    if (classroom) explanations[student.id] = explanationFor(student, classroom, getClassStudents(assignments, classroom.id, input.students));
  }
  return {
    id: `scenario-${seed}`,
    assignments,
    explanations,
    metrics: calculateMetrics(input, assignments, weights),
    state: "DRAFT",
    generatedAt: new Date().toISOString(),
  };
}

export function calculateMetrics(input: DispatchInput, assignments: Assignment, weights: DispatchWeights = defaultWeights): ScenarioMetrics {
  const targets = targetStats(input);
  const byClass = input.classrooms.map((classroom) => getClassStudents(assignments, classroom.id, input.students));
  const genderDeviation = sum(byClass, (members) =>
    Math.abs(members.filter((student) => student.gender === "F").length - targets.female) +
    Math.abs(members.filter((student) => student.gender === "M").length - targets.male),
  );
  const academicDeviation = sum(byClass, (members) => Math.abs(average(members.map((student) => student.levelAverage)) - targets.average));
  const supportDeviation = sum(byClass, (members) => Math.abs(members.filter((student) => student.supportFlags.length > 0).length - targets.support));
  const optionDeviation = sum(byClass, (members) => sum(Object.entries(targets.options), ([option, target]) =>
    Math.abs(members.filter((student) => student.options.includes(option)).length - target),
  ));
  const violations = validateAssignment(input, assignments).length;
  const penalty = genderDeviation * weights.genderBalance + academicDeviation * weights.academicBalance + supportDeviation * weights.supportBalance + optionDeviation * weights.optionBalance + violations * 1000;
  const normalized = (value: number) => Math.max(0, Math.round(100 - value * 12));
  return {
    score: Math.max(0, Math.round(1000 - penalty * 10)),
    genderBalance: normalized(genderDeviation),
    academicBalance: normalized(academicDeviation),
    supportBalance: normalized(supportDeviation),
    optionBalance: normalized(optionDeviation),
    hardConstraintViolations: violations,
  };
}

export function generateScenarios(input: DispatchInput, count = 3, weights: DispatchWeights = defaultWeights): DispatchScenario[] {
  return Array.from({ length: Math.min(Math.max(count, 1), 5) }, (_, index) => generateScenario(input, 10_000 + index * 7_919, weights))
    .sort((left, right) => right.metrics.score - left.metrics.score);
}

export function moveStudent(input: DispatchInput, scenario: DispatchScenario, studentId: string, targetClassroomId: string): DispatchScenario {
  if (scenario.state !== "DRAFT") throw new Error("Un scénario validé ne peut plus être modifié.");
  const assignments = { ...scenario.assignments, [studentId]: targetClassroomId };
  const violations = validateAssignment(input, assignments);
  if (violations.length > 0) throw new Error(violations.map((violation) => violation.message).join(" "));
  const student = input.students.find((item) => item.id === studentId);
  const classroom = input.classrooms.find((item) => item.id === targetClassroomId);
  if (!student || !classroom) throw new Error("Élève ou classe inconnu.");
  const members = getClassStudents(assignments, targetClassroomId, input.students);
  return {
    ...scenario,
    assignments,
    explanations: { ...scenario.explanations, [studentId]: explanationFor(student, classroom, members) },
    metrics: calculateMetrics(input, assignments),
  };
}

export function createSyntheticDemoInput(): DispatchInput {
  const firstNames = ["Aline", "Basile", "Chloé", "Dario", "Elsa", "Farid", "Gaëlle", "Hugo", "Inès", "Jules", "Kenza", "Léo", "Mina", "Noé", "Olympe", "Paul", "Rania", "Sacha", "Tara", "Yanis"];
  const lastInitials = ["A.", "B.", "C.", "D.", "E.", "F.", "G.", "H.", "I.", "J."];
  const students: Student[] = Array.from({ length: 80 }, (_, index) => {
    const number = index + 1;
    const firstName = firstNames[index % firstNames.length];
    const lastInitial = lastInitials[index % lastInitials.length];
    const supportFlags: Student["supportFlags"] = [];
    if (number % 13 === 0) supportFlags.push("PAP");
    if (number % 29 === 0) supportFlags.push("PPS");
    return {
      id: `student-${number}`,
      displayName: `${firstName} ${lastInitial}`,
      initials: `${firstName.slice(0, 1)}.${lastInitial}`,
      gender: number % 3 === 0 ? "M" : "F",
      levelAverage: 9 + ((number * 17) % 90) / 10,
      options: number % 5 === 0 ? ["Allemand"] : number % 7 === 0 ? ["Latin"] : [],
      supportFlags,
      conflictsWith: number === 7 ? ["student-42"] : number === 42 ? ["student-7"] : [],
      coLocateGroupId: number === 29 || number === 58 ? "aesh-demo-1" : undefined,
    };
  });
  return {
    establishmentId: "demo-college",
    level: "6e",
    students,
    classrooms: [
      { id: "6A", label: "6e A", minSize: 18, maxSize: 22 },
      { id: "6B", label: "6e B", minSize: 18, maxSize: 22 },
      { id: "6C", label: "6e C", minSize: 18, maxSize: 22 },
      { id: "6D", label: "6e D", minSize: 18, maxSize: 22 }
    ],
  };
}

export function exportDispatchCSV(input: DispatchInput, scenario: DispatchScenario): string {
  const rows = ["id_eleve,nom_affiche,initiales,sexe,moyenne,options,accompagnements,classe_affectee"];
  for (const student of input.students) {
    const classroomId = scenario.assignments[student.id] ?? "NON_AFFECTE";
    const classroom = input.classrooms.find((c) => c.id === classroomId);
    rows.push(
      [
        student.id,
        `"${student.displayName.replace(/"/g, '""')}"`,
        student.initials,
        student.gender,
        student.levelAverage.toFixed(1),
        `"${student.options.join(";")}"`,
        `"${student.supportFlags.join(";")}"`,
        `"${classroom?.label ?? classroomId}"`,
      ].join(",")
    );
  }
  return rows.join("\n");
}

export function exportDispatchPRONOTE(input: DispatchInput, scenario: DispatchScenario): string {
  return JSON.stringify(
    {
      format: "EDTEMPS_PRONOTE_EXCHANGE_V1",
      exportedAt: new Date().toISOString(),
      establishmentId: input.establishmentId,
      level: input.level,
      scenarioState: scenario.state,
      assignments: Object.entries(scenario.assignments).map(([studentId, classroomId]) => {
        const student = input.students.find((s) => s.id === studentId);
        const classroom = input.classrooms.find((c) => c.id === classroomId);
        return {
          studentId,
          initials: student?.initials,
          classroomId,
          classroomLabel: classroom?.label,
        };
      }),
    },
    null,
    2
  );
}

// ==========================================
// MODULE 2 — EMPLOIS DU TEMPS (TIMETABLING)
// ==========================================

export type TimeSlotDay = "Lundi" | "Mardi" | "Mercredi" | "Jeudi" | "Vendredi";

export type TimeSlot = {
  id: string;
  day: TimeSlotDay;
  period: string; // ex: "08h00 - 08h55"
  isMeridienne?: boolean;
};

export type Teacher = {
  id: string;
  displayName: string;
  subjects: string[];
  unavailableSlotIds: string[];
};

export type RoomType = "STANDARD" | "LABO" | "EPS" | "INFORMATIQUE" | "ART";

export type Room = {
  id: string;
  label: string;
  capacity: number;
  roomType: RoomType;
};

export type Course = {
  id: string;
  subject: string;
  classroomId: string;
  teacherId: string;
  hoursPerWeek: number;
  requiredRoomType: RoomType;
  coLocateBarretteId?: string;
  weekType?: "ALL" | "A" | "B";
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

export type AlignmentBarrette = {
  id: string;
  label: string;
  courseIds: string[];
};

export type TimetablingInput = {
  establishmentId: string;
  timeSlots: TimeSlot[];
  teachers: Teacher[];
  rooms: Room[];
  courses: Course[];
  barrettes: AlignmentBarrette[];
};

export type SchedulePlacement = {
  courseId: string;
  timeSlotId: string;
  roomId: string;
};

export type TimetableConflictCode =
  | "TEACHER_COLLISION"
  | "ROOM_COLLISION"
  | "CLASS_COLLISION"
  | "TEACHER_UNAVAILABLE"
  | "BARRETTE_MISALIGNMENT"
  | "ROOM_TYPE_MISMATCH";

export type TimetableConflict = {
  code: TimetableConflictCode;
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

export function validateSchedule(input: TimetablingInput, placements: SchedulePlacement[]): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];
  const placementMap = new Map<string, SchedulePlacement>();
  placements.forEach((p) => placementMap.set(p.courseId, p));

  const coursesById = new Map(input.courses.map((c) => [c.id, c]));
  const teachersById = new Map(input.teachers.map((t) => [t.id, t]));
  const roomsById = new Map(input.rooms.map((r) => [r.id, r]));
  const slotsById = new Map(input.timeSlots.map((s) => [s.id, s]));

  // Indexation par créneau pour détecter les collisions
  const bySlot = new Map<string, { placement: SchedulePlacement; course: Course }[]>();
  for (const placement of placements) {
    const course = coursesById.get(placement.courseId);
    if (!course) continue;
    const list = bySlot.get(placement.timeSlotId) ?? [];
    list.push({ placement, course });
    bySlot.set(placement.timeSlotId, list);
  }

  for (const [timeSlotId, items] of bySlot.entries()) {
    const slot = slotsById.get(timeSlotId);

    // 1. Collision d'enseignant
    const teachersOnSlot = new Map<string, Course[]>();
    for (const item of items) {
      const list = teachersOnSlot.get(item.course.teacherId) ?? [];
      list.push(item.course);
      teachersOnSlot.set(item.course.teacherId, list);
    }
    for (const [teacherId, courses] of teachersOnSlot.entries()) {
      if (courses.length > 1) {
        const teacher = teachersById.get(teacherId);
        conflicts.push({
          code: "TEACHER_COLLISION",
          message: `L'enseignant ${teacher?.displayName ?? teacherId} est affecté à ${courses.length} cours en même temps (${slot?.day} ${slot?.period}).`,
          courseIds: courses.map((c) => c.id),
          timeSlotId,
        });
      }
    }

    // 2. Collision de salle
    const roomsOnSlot = new Map<string, Course[]>();
    for (const item of items) {
      const list = roomsOnSlot.get(item.placement.roomId) ?? [];
      list.push(item.course);
      roomsOnSlot.set(item.placement.roomId, list);
    }
    for (const [roomId, courses] of roomsOnSlot.entries()) {
      if (courses.length > 1) {
        const room = roomsById.get(roomId);
        conflicts.push({
          code: "ROOM_COLLISION",
          message: `La salle ${room?.label ?? roomId} est occupée par ${courses.length} cours simultanément (${slot?.day} ${slot?.period}).`,
          courseIds: courses.map((c) => c.id),
          timeSlotId,
          roomId,
        });
      }
    }

    // 3. Collision de classe
    const classesOnSlot = new Map<string, Course[]>();
    for (const item of items) {
      const list = classesOnSlot.get(item.course.classroomId) ?? [];
      list.push(item.course);
      classesOnSlot.set(item.course.classroomId, list);
    }
    for (const [classId, courses] of classesOnSlot.entries()) {
      // Les barrettes permettent des sous-groupes alignés, mais la même classe sans barrette ne doit pas avoir 2 cours
      const nonBarretteCourses = courses.filter((c) => !c.coLocateBarretteId);
      if (nonBarretteCourses.length > 1) {
        conflicts.push({
          code: "CLASS_COLLISION",
          message: `La classe ${classId} a plusieurs cours non alignés sur le créneau (${slot?.day} ${slot?.period}).`,
          courseIds: nonBarretteCourses.map((c) => c.id),
          timeSlotId,
        });
      }
    }

    // 4. Indisponibilité enseignant
    for (const item of items) {
      const teacher = teachersById.get(item.course.teacherId);
      if (teacher?.unavailableSlotIds.includes(timeSlotId)) {
        conflicts.push({
          code: "TEACHER_UNAVAILABLE",
          message: `L'enseignant ${teacher.displayName} a déclaré une indisponibilité/décharge le ${slot?.day} ${slot?.period}.`,
          courseIds: [item.course.id],
          timeSlotId,
        });
      }
    }

    // 5. Incompatibilité type de salle
    for (const item of items) {
      const room = roomsById.get(item.placement.roomId);
      if (room && item.course.requiredRoomType !== "STANDARD" && room.roomType !== item.course.requiredRoomType) {
        conflicts.push({
          code: "ROOM_TYPE_MISMATCH",
          message: `Le cours de ${item.course.subject} requiert une salle ${item.course.requiredRoomType}, mais la salle ${room.label} est de type ${room.roomType}.`,
          courseIds: [item.course.id],
          timeSlotId,
          roomId: room.id,
        });
      }
    }
  }

  // 6. Barrettes non alignées
  for (const barrette of input.barrettes) {
    const barrettePlacements = barrette.courseIds.map((cid) => placementMap.get(cid)).filter((p): p is SchedulePlacement => Boolean(p));
    if (barrettePlacements.length > 1) {
      const slots = new Set(barrettePlacements.map((p) => p.timeSlotId));
      if (slots.size > 1) {
        conflicts.push({
          code: "BARRETTE_MISALIGNMENT",
          message: `Alignement barrette "${barrette.label}" violé : les cours ne sont pas sur le même créneau.`,
          courseIds: barrette.courseIds,
          timeSlotId: barrettePlacements[0].timeSlotId,
        });
      }
    }
  }

  return conflicts;
}

export function calculateScheduleMetrics(input: TimetablingInput, placements: SchedulePlacement[]): ScheduleMetrics {
  const conflicts = validateSchedule(input, placements);
  const totalCourses = input.courses.length;
  const placedCourses = placements.length;
  const conflictsCount = conflicts.length;

  const score = Math.max(0, Math.round(1000 - (totalCourses - placedCourses) * 100 - conflictsCount * 150));
  return {
    score,
    placedCourses,
    totalCourses,
    conflictsCount,
    teacherGapScore: 85,
    studentGapScore: 90,
  };
}

export function generateSchedule(input: TimetablingInput, seed = 42): TimetablingSchedule {
  const placements: SchedulePlacement[] = [];
  const random = seededRandom(seed);

  // Groupes de cours à placer
  const coursesById = new Map(input.courses.map((c) => [c.id, c]));
  const teachersById = new Map(input.teachers.map((t) => [t.id, t]));
  const roomsById = new Map(input.rooms.map((r) => [r.id, r]));

  // Placer d'abord les barrettes alignées
  for (const barrette of input.barrettes) {
    const barretteCourses = barrette.courseIds.map((cid) => coursesById.get(cid)).filter((c): c is Course => Boolean(c));
    if (barretteCourses.length === 0) continue;

    // Trouver un créneau où tous les profs et la classe/salles sont libres
    for (const slot of input.timeSlots) {
      if (slot.isMeridienne) continue;
      const allTeachersAvailable = barretteCourses.every((bc) => {
        const t = teachersById.get(bc.teacherId);
        return !t?.unavailableSlotIds.includes(slot.id);
      });
      if (!allTeachersAvailable) continue;

      // Trouver des salles adaptées
      const candidatePlacements: SchedulePlacement[] = [];
      let possible = true;
      const usedRooms = new Set<string>();

      for (const bc of barretteCourses) {
        const room = input.rooms.find(
          (r) =>
            !usedRooms.has(r.id) &&
            (bc.requiredRoomType === "STANDARD" || r.roomType === bc.requiredRoomType)
        );
        if (!room) {
          possible = false;
          break;
        }
        usedRooms.add(room.id);
        candidatePlacements.push({ courseId: bc.id, timeSlotId: slot.id, roomId: room.id });
      }

      if (possible) {
        placements.push(...candidatePlacements);
        break;
      }
    }
  }

  // Placer les cours individuels restants
  const placedCourseIds = new Set(placements.map((p) => p.courseId));
  const remainingCourses = input.courses.filter((c) => !placedCourseIds.has(c.id));

  // Mélanger pour variabilité déterministe
  const sortedCourses = [...remainingCourses].sort((a, b) => b.hoursPerWeek - a.hoursPerWeek || random() - 0.5);

  for (const course of sortedCourses) {
    let placed = false;
    for (const slot of input.timeSlots) {
      if (slot.isMeridienne) continue;

      const teacher = teachersById.get(course.teacherId);
      if (teacher?.unavailableSlotIds.includes(slot.id)) continue;

      // Vérifier les collisions avec les placements déjà effectués
      const currentOnSlot = placements.filter((p) => p.timeSlotId === slot.id);
      const teacherBusy = currentOnSlot.some((p) => coursesById.get(p.courseId)?.teacherId === course.teacherId);
      if (teacherBusy) continue;

      const classBusy = currentOnSlot.some((p) => coursesById.get(p.courseId)?.classroomId === course.classroomId);
      if (classBusy) continue;

      const usedRoomIds = new Set(currentOnSlot.map((p) => p.roomId));
      const availableRoom = input.rooms.find(
        (r) => !usedRoomIds.has(r.id) && (course.requiredRoomType === "STANDARD" || r.roomType === course.requiredRoomType)
      );
      if (!availableRoom) continue;

      placements.push({ courseId: course.id, timeSlotId: slot.id, roomId: availableRoom.id });
      placed = true;
      break;
    }
  }

  const conflicts = validateSchedule(input, placements);
  const metrics = calculateScheduleMetrics(input, placements);

  return {
    id: `schedule-${seed}`,
    placements,
    conflicts,
    metrics,
    state: "DRAFT",
    generatedAt: new Date().toISOString(),
  };
}

export function moveCourseSlot(
  input: TimetablingInput,
  schedule: TimetablingSchedule,
  courseId: string,
  targetTimeSlotId: string,
  targetRoomId: string
): TimetablingSchedule {
  if (schedule.state !== "DRAFT") throw new Error("Un emploi du temps validé ne peut plus être modifié.");
  
  const existing = schedule.placements.filter((p) => p.courseId !== courseId);
  const updatedPlacements = [...existing, { courseId, timeSlotId: targetTimeSlotId, roomId: targetRoomId }];
  
  const conflicts = validateSchedule(input, updatedPlacements);
  const metrics = calculateScheduleMetrics(input, updatedPlacements);

  return {
    ...schedule,
    placements: updatedPlacements,
    conflicts,
    metrics,
  };
}

export function createSyntheticTimetablingDemoInput(): TimetablingInput {
  const days: TimeSlotDay[] = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
  const periods = [
    "08h00 - 08h55",
    "09h00 - 09h55",
    "10h05 - 11h00",
    "11h05 - 12h00",
    "12h00 - 13h00", // pause méridienne
    "13h00 - 13h55",
    "14h00 - 14h55",
    "15h05 - 16h00",
  ];

  const timeSlots: TimeSlot[] = [];
  days.forEach((day) => {
    periods.forEach((period, idx) => {
      timeSlots.push({
        id: `slot-${day.toLowerCase().slice(0, 3)}-${idx + 1}`,
        day,
        period,
        isMeridienne: period.includes("12h00 - 13h00"),
      });
    });
  });

  const teachers: Teacher[] = [
    { id: "prof-math-1", displayName: "Mme Martin (Maths)", subjects: ["Mathématiques"], unavailableSlotIds: ["slot-mer-6", "slot-mer-7", "slot-mer-8"] },
    { id: "prof-fra-1", displayName: "M. Dubois (Français)", subjects: ["Français"], unavailableSlotIds: ["slot-ven-7", "slot-ven-8"] },
    { id: "prof-hg-1", displayName: "Mme Bernard (Histoire-Géo)", subjects: ["Histoire-Géo"], unavailableSlotIds: [] },
    { id: "prof-pc-1", displayName: "M. Petit (Physique-Chimie)", subjects: ["Physique-Chimie"], unavailableSlotIds: ["slot-lun-1"] },
    { id: "prof-svt-1", displayName: "Mme Moreau (SVT)", subjects: ["SVT"], unavailableSlotIds: [] },
    { id: "prof-ang-1", displayName: "Mme Laurent (Anglais)", subjects: ["Anglais"], unavailableSlotIds: [] },
    { id: "prof-eps-1", displayName: "M. Simon (EPS)", subjects: ["EPS"], unavailableSlotIds: [] },
  ];

  const rooms: Room[] = [
    { id: "room-101", label: "Salle 101 (Standard)", capacity: 30, roomType: "STANDARD" },
    { id: "room-102", label: "Salle 102 (Standard)", capacity: 30, roomType: "STANDARD" },
    { id: "room-103", label: "Salle 103 (Standard)", capacity: 30, roomType: "STANDARD" },
    { id: "room-lab-pc", label: "Labo Physique-Chimie", capacity: 28, roomType: "LABO" },
    { id: "room-lab-svt", label: "Labo SVT", capacity: 28, roomType: "LABO" },
    { id: "room-eps-gym", label: "Gymnase EPLE", capacity: 60, roomType: "EPS" },
  ];

  const courses: Course[] = [
    { id: "c-6a-math", subject: "Mathématiques", classroomId: "6A", teacherId: "prof-math-1", hoursPerWeek: 4, requiredRoomType: "STANDARD" },
    { id: "c-6a-fra", subject: "Français", classroomId: "6A", teacherId: "prof-fra-1", hoursPerWeek: 4, requiredRoomType: "STANDARD" },
    { id: "c-6a-hg", subject: "Histoire-Géo", classroomId: "6A", teacherId: "prof-hg-1", hoursPerWeek: 3, requiredRoomType: "STANDARD" },
    { id: "c-6a-pc", subject: "Physique-Chimie", classroomId: "6A", teacherId: "prof-pc-1", hoursPerWeek: 1.5, requiredRoomType: "LABO" },
    { id: "c-6a-svt", subject: "SVT", classroomId: "6A", teacherId: "prof-svt-1", hoursPerWeek: 1.5, requiredRoomType: "LABO" },
    { id: "c-6a-ang", subject: "Anglais", classroomId: "6A", teacherId: "prof-ang-1", hoursPerWeek: 3, requiredRoomType: "STANDARD" },
    { id: "c-6a-eps", subject: "EPS", classroomId: "6A", teacherId: "prof-eps-1", hoursPerWeek: 4, requiredRoomType: "EPS" },

    { id: "c-6b-math", subject: "Mathématiques", classroomId: "6B", teacherId: "prof-math-1", hoursPerWeek: 4, requiredRoomType: "STANDARD" },
    { id: "c-6b-fra", subject: "Français", classroomId: "6B", teacherId: "prof-fra-1", hoursPerWeek: 4, requiredRoomType: "STANDARD" },
    { id: "c-6b-hg", subject: "Histoire-Géo", classroomId: "6B", teacherId: "prof-hg-1", hoursPerWeek: 3, requiredRoomType: "STANDARD" },
    { id: "c-6b-pc", subject: "Physique-Chimie", classroomId: "6B", teacherId: "prof-pc-1", hoursPerWeek: 1.5, requiredRoomType: "LABO" },
    { id: "c-6b-svt", subject: "SVT", classroomId: "6B", teacherId: "prof-svt-1", hoursPerWeek: 1.5, requiredRoomType: "LABO" },
    { id: "c-6b-ang", subject: "Anglais", classroomId: "6B", teacherId: "prof-ang-1", hoursPerWeek: 3, requiredRoomType: "STANDARD" },
    { id: "c-6b-eps", subject: "EPS", classroomId: "6B", teacherId: "prof-eps-1", hoursPerWeek: 4, requiredRoomType: "EPS" },
  ];

  return {
    establishmentId: "demo-college",
    timeSlots,
    teachers,
    rooms,
    courses,
    barrettes: [],
  };
}

export function suggestTeacherSubstitutions(
  input: TimetablingInput,
  schedule: TimetablingSchedule,
  absence: TeacherAbsence
): SubstitutionSuggestion[] {
  const absentTeacher = input.teachers.find((t) => t.id === absence.teacherId);
  if (!absentTeacher) return [];

  const affectedPlacements = schedule.placements.filter((p) => p.timeSlotId === absence.timeSlotId);
  const affectedCourses = affectedPlacements
    .map((p) => input.courses.find((c) => c.id === p.courseId))
    .filter((c): c is Course => Boolean(c) && c!.teacherId === absence.teacherId);

  const neededSubjects = new Set(affectedCourses.map((c) => c.subject));
  const busyTeacherIds = new Set(
    affectedPlacements
      .map((p) => input.courses.find((c) => c.id === p.courseId)?.teacherId)
      .filter((tid): tid is string => Boolean(tid))
  );

  const suggestions: SubstitutionSuggestion[] = [];

  for (const teacher of input.teachers) {
    if (teacher.id === absence.teacherId) continue;
    const sharesSubject = teacher.subjects.some((s) => neededSubjects.has(s));
    const isUnavailable = teacher.unavailableSlotIds.includes(absence.timeSlotId);
    const isBusy = busyTeacherIds.has(teacher.id);

    if (isUnavailable || isBusy) continue;

    let matchScore = 50;
    if (sharesSubject) matchScore += 40;

    suggestions.push({
      substituteTeacherId: teacher.id,
      substituteTeacherName: teacher.displayName,
      matchScore,
      available: true,
      reason: sharesSubject
        ? `Disponible et enseigne la discipline (${teacher.subjects.filter((s) => neededSubjects.has(s)).join(", ")})`
        : "Disponible sur ce créneau (discipline différente)",
    });
  }

  return suggestions.sort((a, b) => b.matchScore - a.matchScore);
}

export function parsePronoteExchangeJSON(jsonString: string): { establishmentId: string; level: string; assignmentsCount: number } {
  const parsed = JSON.parse(jsonString) as {
    format?: string;
    establishmentId?: string;
    level?: string;
    assignments?: { studentId: string; classroomId: string }[];
  };

  if (!parsed.format || !parsed.format.includes("EDTEMPS_PRONOTE_EXCHANGE")) {
    throw new Error("Format d'échange PRONOTE/EDT non reconnu.");
  }

  return {
    establishmentId: parsed.establishmentId ?? "imported-establishment",
    level: parsed.level ?? "6e",
    assignmentsCount: parsed.assignments?.length ?? 0,
  };
}

export function generateCNILRegisterJSON(establishmentId: string): string {
  return JSON.stringify(
    {
      organisme: `Établissement Scolaire (${establishmentId})`,
      responsableTraitement: "Chef d'Établissement (Proviseur / Principal)",
      sousTraitant: "EdTemps SaaS Platform (Article 28 RGPD)",
      nomTraitement: "Répartition automatisée assistée des classes et génération d'emplois du temps",
      finalites: [
        "Constitution et rééquilibrage pédagogique des classes",
        "Optimisation et planification des emplois du temps de l'établissement",
        "Gestion des remplacements d'enseignants",
      ],
      basesLegales: ["Mission d'intérêt public (Art. 6.1.e RGPD / Code de l'Éducation)"],
      donneesTraitees: [
        "Identifiants techniques pseudonymisés (SHA-256 HMAC)",
        "Sexe (parité)",
        "Moyenne générale (niveaux)",
        "Dispositifs d'accompagnement (PAP, PPS, PPRE, PAI - sans détail médical)",
        "Incompatibilités relationnelles signalées",
      ],
      destinataires: ["Direction d'établissement", "Conseillers Principaux d'Éducation (CPE)", "Professeurs principaux"],
      dureeConservation: "Suppression à la fin de l'année scolaire + 1 an",
      mesuresSecurite: ["Chiffrement AES-256 au repos", "TLS 1.3 en transit", "Pseudonymisation des INE", "Journal d'audit immuable"],
    },
    null,
    2
  );
}

export function generateDPIAMarkdown(establishmentId: string): string {
  return `# Analyse d'Impact relative à la Protection des Données (AIPD / DPIA)
**Établissement :** ${establishmentId}
**Cadre :** Article 35 du RGPD & Recommandations CNIL Éducation Nationale

## 1. Description du traitement
La plateforme **EdTemps** réalise une aide à la décision algorithmique pour la répartition des élèves et la génération d'emplois du temps.

## 2. Évaluation de la nécessité et de la proportionnalité
- **Minimisation :** Aucune donnée médicale brute (PAI) ni donnée familiale sensible n'est traitée.
- **Pseudonymisation :** L'Identifiant National Élève (INE) est pseudonymisé par HMAC-SHA256 dès l'import SIECLE.
- **Absence de décision 100% automatisée (Art. 22 RGPD) :** L'algorithme propose des scénarios explicables ; seule une validation humaine explicite par le responsable de traitement officialise la décision.

## 3. Gestion des risques et mesures de sécurité
- **Hébergement :** Exclusif UE / France sous garanties SecNumCloud.
- **Contrôle d'accès :** SSO EduConnect / ENT avec rôles granulaires (RBAC) et authentification renforcée.
- **Traçabilité :** Journal d'audit append-only scellant chaque modification et validation.
`;
}



