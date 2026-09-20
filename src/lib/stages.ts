export type StageId = "primary" | "basic" | "secondary";

export const STAGES: { id: StageId; ar: string; en: string }[] = [
  { id: "primary", ar: "المرحلة الابتدائية", en: "Primary" },
  { id: "basic", ar: "مرحلة التعليم الأساسي", en: "Basic education" },
  { id: "secondary", ar: "مرحلة التعليم الثانوي", en: "Secondary" },
];

export const BRANCHES = [
  { id: "scientific", ar: "علمي", en: "Scientific" },
  { id: "literary", ar: "أدبي", en: "Literary" },
];

export const GRADES: Record<StageId, { id: string; ar: string; en: string }[]> = {
  primary: [
    { id: "g1", ar: "الصف الأول", en: "Grade 1" },
    { id: "g2", ar: "الصف الثاني", en: "Grade 2" },
    { id: "g3", ar: "الصف الثالث", en: "Grade 3" },
    { id: "g4", ar: "الصف الرابع", en: "Grade 4" },
    { id: "g5", ar: "الصف الخامس", en: "Grade 5" },
    { id: "g6", ar: "الصف السادس", en: "Grade 6" },
  ],
  basic: [
    { id: "g7", ar: "الصف السابع", en: "Grade 7" },
    { id: "g8", ar: "الصف الثامن", en: "Grade 8" },
    { id: "g9", ar: "الصف التاسع", en: "Grade 9" },
  ],
  secondary: [
    { id: "s1", ar: "الأول الثانوي", en: "Secondary 1" },
    { id: "s2", ar: "الثاني الثانوي", en: "Secondary 2" },
    { id: "s3", ar: "الثالث الثانوي", en: "Secondary 3" },
  ],
};

export function stageLabel(id: string | null | undefined, t: (ar: string, en: string) => string) {
  const s = STAGES.find((x) => x.id === id);
  return s ? t(s.ar, s.en) : null;
}

export function gradeLabel(
  stage: string | null | undefined,
  grade: string | null | undefined,
  t: (ar: string, en: string) => string,
) {
  if (!stage || !grade) return null;
  const list = GRADES[stage as StageId];
  const g = list?.find((x) => x.id === grade);
  return g ? t(g.ar, g.en) : null;
}

type Classified = {
  stage?: string | null;
  grade?: string | null;
  branch?: string | null;
};

/**
 * Does a course fit a student's stage/grade/branch?
 * A student without a stage sees everything (nothing to filter on).
 * Otherwise the course must target the same stage; unclassified courses are hidden.
 */
export function courseMatchesStudent(course: Classified, student: Classified) {
  if (!student.stage) return true;
  if (!course.stage) return false;
  if (course.stage !== student.stage) return false;
  if (course.grade && student.grade && course.grade !== student.grade) return false;
  if (course.grade && !student.grade) return false;
  if (course.grade && student.grade && course.grade !== student.grade) return false;
  if (course.branch && student.branch && course.branch !== student.branch) return false;
  return true;
}

export function classificationLabel(
  c: Classified,
  t: (ar: string, en: string) => string,
): string | null {
  const parts = [
    gradeLabel(c.stage, c.grade, t) ?? stageLabel(c.stage, t),
    branchLabel(c.branch, t),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function branchLabel(id: string | null | undefined, t: (ar: string, en: string) => string) {
  const b = BRANCHES.find((x) => x.id === id);
  return b ? t(b.ar, b.en) : null;
}
