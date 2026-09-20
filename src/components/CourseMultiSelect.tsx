import { Check } from "lucide-react";
import { usePrefs } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Course = { id: string; name: string };

/**
 * Multi-select chip list linking a teacher to one or more courses.
 * Emits the full selected id array through onChange.
 */
export function CourseMultiSelect({
  courses,
  selected,
  onChange,
}: {
  courses: Course[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = usePrefs();

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  if (courses.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("ما في مواد بعد — أضف مواد من صفحة المواد أولاً", "No courses yet — add courses first")}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {courses.map((c) => {
        const active = selected.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {active && <Check className="size-3.5" />}
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

/** Joined course names for a teacher row that carries teacher_courses (+ legacy course_id link). */
export function teacherCourseNames(
  teacher: {
    teacher_courses?: { courses: { name: string } | null }[] | null;
    courses?: { name: string } | null;
  },
  fallback: string,
): string {
  const names = (teacher.teacher_courses ?? [])
    .map((tc) => tc.courses?.name)
    .filter((n): n is string => Boolean(n));
  if (names.length === 0 && teacher.courses?.name) names.push(teacher.courses.name);
  return names.length ? names.join("، ") : fallback;
}
