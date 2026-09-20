/**
 * Fee resolution for a student enrolled in a course.
 *
 * Priority: custom fee on the enrollment → the price of the teacher the student
 * enrolled with (teacher_courses.price) → the course base price.
 */

export type CourseTeacherLink = {
  teacher_id: string;
  price?: number | null;
  teachers?: { id: string; name: string } | null;
};

export type PricedCourse = {
  price: number;
  teacher_courses?: CourseTeacherLink[] | null;
};

export type EnrollmentRow = {
  custom_fee: number | null;
  teacher_id?: string | null;
  courses?: PricedCourse | null;
};

/** Price this teacher charges for the course, or null when they use the base price. */
export function teacherCoursePrice(
  course: PricedCourse | null | undefined,
  teacherId: string | null | undefined,
): number | null {
  if (!course || !teacherId) return null;
  const link = (course.teacher_courses ?? []).find((l) => l.teacher_id === teacherId);
  return link?.price != null ? Number(link.price) : null;
}

/** Effective fee for one enrollment row. */
export function enrollmentFee(row: EnrollmentRow): number {
  if (row.custom_fee != null) return Number(row.custom_fee);
  const byTeacher = teacherCoursePrice(row.courses, row.teacher_id);
  if (byTeacher != null) return byTeacher;
  return Number(row.courses?.price ?? 0);
}

/** Teachers available for a course (only those linked through teacher_courses). */
export function courseTeachers(course: PricedCourse | null | undefined): CourseTeacherLink[] {
  return (course?.teacher_courses ?? []).filter((l) => Boolean(l.teacher_id));
}

/** Cancelled payments stay in the history but never count towards the balance. */
export function isActivePayment(p: { status?: string | null }): boolean {
  return (p.status ?? "active") !== "cancelled";
}
