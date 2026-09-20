import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { studentBalance, useCourses, useInstitute, useRefresh, useStudents, useTeachers } from "@/hooks/useApp";
import { usePrefs } from "@/lib/i18n";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { FabButton } from "@/components/FabButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Search,
  ChevronLeft,
  BookOpen,
  User,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  Layers,
  GraduationCap,
  Split,
  Wallet,
  RotateCcw,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { STAGES, GRADES, BRANCHES, stageLabel, gradeLabel, branchLabel, courseMatchesStudent, classificationLabel, type StageId } from "@/lib/stages";
import { courseTeachers, enrollmentFee } from "@/lib/fees";

export const Route = createFileRoute("/_authenticated/students/")({
  validateSearch: (s: Record<string, unknown>): { add?: boolean } =>
    s["add"] === true || s["add"] === "true" ? { add: true } : {},
  head: () => ({
    meta: [
      { title: "الطلاب — معهدي" },
      { name: "description", content: "تابع طلابك، مستحقاتهم، ودفعاتهم بمكان واحد." },
      { property: "og:title", content: "الطلاب — معهدي" },
      { property: "og:description", content: "تابع طلابك، مستحقاتهم، ودفعاتهم بمكان واحد." },
    ],
  }),
  component: StudentsPage,
});

const blank = {
  name: "",
  surname: "",
  father_name: "",
  mother_name: "",
  phone: "",
  guardian_phone: "",
  enrollment_date: "",
  stage: "",
  grade: "",
  branch: "",
};

function StudentsPage() {
  const { t } = usePrefs();
  const { add } = Route.useSearch();
  const { data: institute } = useInstitute();
  const { data: students = [], isLoading } = useStudents();
  const { data: courses = [] } = useCourses();
  const { data: teachers = [] } = useTeachers();
  const refresh = useRefresh();

  const [q, setQ] = useState("");
  const [courseId, setCourseId] = useState<string>("all");
  const [payStatus, setPayStatus] = useState<"all" | "owes" | "settled">("all");
  const [stageId, setStageId] = useState<"all" | StageId>("all");
  const [gradeId, setGradeId] = useState<string>("all");
  const [branchId, setBranchId] = useState<string>("all");
  const [teacherId, setTeacherId] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [pickedCourses, setPickedCourses] = useState<
    { course_id: string; teacher_id: string | null }[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(0);

  // step gate: courses only appear once stage (+ branch for secondary) + grade are picked
  const classificationReady =
    !!form.stage && !!form.grade && (form.stage !== "secondary" || !!form.branch);
  // only offer courses that fit the student's stage/grade/branch
  const matchingCourses = classificationReady
    ? courses.filter((c) =>
        courseMatchesStudent(
          c as { stage?: string | null; grade?: string | null; branch?: string | null },
          form,
        ),
      )
    : [];
  useEffect(() => {
    setPickedCourses((prev) =>
      prev.filter((p) => matchingCourses.some((c) => c.id === p.course_id)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.stage, form.grade, form.branch]);

  const toggleCoursePick = (course: { id: string; teacher_courses?: { teacher_id: string }[] | null }) =>
    setPickedCourses((prev) => {
      if (prev.some((p) => p.course_id === course.id)) {
        return prev.filter((p) => p.course_id !== course.id);
      }
      const links = courseTeachers(course as never);
      // one teacher → pick them automatically, several → let the user choose
      return [
        ...prev,
        { course_id: course.id, teacher_id: links.length === 1 ? links[0]!.teacher_id : null },
      ];
    });

  const setPickedTeacher = (courseId: string, teacherId: string) =>
    setPickedCourses((prev) =>
      prev.map((p) =>
        p.course_id === courseId
          ? { ...p, teacher_id: p.teacher_id === teacherId ? null : teacherId }
          : p,
      ),
    );


  useEffect(() => {
    if (add) setOpen(true);
  }, [add]);

  const save = async (again: boolean) => {
    if (!institute) { toast.error(t("ما قدرنا نجيب بيانات معهدك، حدّث الصفحة وجرّب كمان مرة", "Could not load your institute, refresh and try again")); return; }
    if (!form.name.trim()) { toast.error(t("اسم الطالب مطلوب", "Student name is required")); return; }
    if (form.stage && !form.grade) { toast.error(t("اختر الصف", "Pick a grade")); return; }
    if (form.stage === "secondary" && !form.branch) { toast.error(t("اختر الفرع", "Pick a branch")); return; }
    const missingTeacher = pickedCourses.find((p) => {
      const course = matchingCourses.find((c) => c.id === p.course_id);
      return !p.teacher_id && courseTeachers(course as never).length > 1;
    });
    if (missingTeacher) {
      const course = matchingCourses.find((c) => c.id === missingTeacher.course_id);
      toast.error(
        t(`اختر الأستاذ لمادة ${course?.name ?? ""}`, `Pick a teacher for ${course?.name ?? ""}`),
      );
      return;
    }
    setSaving(true);
    const { data: inserted, error } = await supabase.from("students").insert({
      institute_id: institute.id,
      name: form.name.trim(),
      surname: form.surname.trim() || null,
      father_name: form.father_name || null,
      mother_name: form.mother_name || null,
      phone: form.phone || null,
      guardian_phone: form.guardian_phone || null,
      stage: form.stage || null,
      grade: form.grade || null,
      branch: form.stage === "secondary" ? form.branch || null : null,
      enrollment_date: form.enrollment_date || new Date().toISOString().slice(0, 10),
    }).select("id").single();
    if (error || !inserted) { setSaving(false); toast.error(error?.message ?? "Error"); return; }
    if (pickedCourses.length > 0) {
      const { error: enrollErr } = await supabase.from("student_courses").insert(
        pickedCourses.map((p) => ({
          student_id: inserted.id,
          course_id: p.course_id,
          teacher_id: p.teacher_id,
        })),
      );
      if (enrollErr) { setSaving(false); toast.error(enrollErr.message); return; }
    }
    setSaving(false);
    toast.success(t("تمت إضافة الطالب", "Student added"));
    refresh("students");
    setForm(blank);
    setPickedCourses([]);
    setJustSaved((n) => n + 1);
    if (!again) setOpen(false);
  };

  const term = q.trim().toLowerCase();
  const owesCount = students.filter((s) => studentBalance(s).owed > 0).length;
  const settledCount = students.length - owesCount;
  const stageCount = (id: StageId) => students.filter((s) => s.stage === id).length;
  const gradeOptions = stageId === "all" ? [] : GRADES[stageId];
  const gradeCount = (gid: string) => students.filter((s) => s.stage === stageId && s.grade === gid).length;
  const branchCount = (bid: string) => students.filter((s) => s.branch === bid).length;
  const clearFilters = () => {
    setCourseId("all");
    setPayStatus("all");
    setStageId("all");
    setGradeId("all");
    setBranchId("all");
    setTeacherId("all");
  };

  const list = students.filter((s) => {
    const matchText =
      s.name.toLowerCase().includes(term) ||
      (s.surname ?? "").toLowerCase().includes(term) ||
      (s.father_name ?? "").toLowerCase().includes(term) ||
      (s.mother_name ?? "").toLowerCase().includes(term) ||
      (s.phone ?? "").toLowerCase().includes(term) ||
      (s.guardian_phone ?? "").toLowerCase().includes(term);
    if (!matchText) return false;
    if (
      courseId !== "all" &&
      !(s.student_courses ?? []).some((sc: { courses: { id: string } | null }) => sc.courses?.id === courseId)
    )
      return false;
    const owed = studentBalance(s).owed;
    if (payStatus === "owes" && owed <= 0) return false;
    if (payStatus === "settled" && owed > 0) return false;
    if (stageId !== "all" && s.stage !== stageId) return false;
    if (gradeId !== "all" && s.grade !== gradeId) return false;
    if (branchId !== "all" && s.branch !== branchId) return false;
    if (
      teacherId !== "all" &&
      !(s.student_courses ?? []).some((sc: { teacher_id: string | null }) => sc.teacher_id === teacherId)
    )
      return false;
    return true;
  });

  const selectedCourse = courses.find((c) => c.id === courseId);

  const activeChips: { key: string; label: string; icon: LucideIcon; clear: () => void }[] = [];
  if (stageId !== "all")
    activeChips.push({
      key: "stage",
      label: stageLabel(stageId, t) ?? "",
      icon: Layers,
      clear: () => { setStageId("all"); setGradeId("all"); setBranchId("all"); },
    });
  if (gradeId !== "all")
    activeChips.push({
      key: "grade",
      label: gradeLabel(stageId, gradeId, t) ?? "",
      icon: GraduationCap,
      clear: () => setGradeId("all"),
    });
  if (branchId !== "all")
    activeChips.push({
      key: "branch",
      label: branchLabel(branchId, t) ?? "",
      icon: Split,
      clear: () => setBranchId("all"),
    });
  if (selectedCourse)
    activeChips.push({
      key: "course",
      label: selectedCourse.name,
      icon: BookOpen,
      clear: () => setCourseId("all"),
    });
  const selectedTeacher = teachers.find((t) => t.id === teacherId);
  if (selectedTeacher)
    activeChips.push({
      key: "teacher",
      label: selectedTeacher.name,
      icon: User,
      clear: () => setTeacherId("all"),
    });
  if (payStatus !== "all")
    activeChips.push({
      key: "pay",
      label: payStatus === "owes" ? t("عليه مستحقات", "Owes") : t("مسدّد", "Settled"),
      icon: payStatus === "owes" ? AlertCircle : CheckCircle2,
      clear: () => setPayStatus("all"),
    });
  const activeCount = activeChips.length;


  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-xl font-extrabold text-foreground">{t("الطلاب", "Students")}</h1>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("دوّر بالاسم أو رقم الهاتف…", "Search by name or phone…")}
            className="h-11 rounded-xl bg-card ltr:pl-9 rtl:pr-9"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-label={t("فلاتر البحث", "Search filters")}
          className={`relative flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
            activeCount > 0
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground active:bg-muted"
          }`}
        >
          <SlidersHorizontal className="size-5" />
          {activeCount > 0 && (
            <span className="num absolute -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-extrabold text-destructive-foreground ltr:-right-1.5 rtl:-left-1.5">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {students.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-xl bg-muted/60 px-3 py-2 text-xs font-bold text-muted-foreground">
            <Users className="size-4 text-primary" />
            <span className="num">{list.length}</span>
            {t("طالب", "students")}
          </span>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary"
            >
              <chip.icon className="size-3.5" />
              <span className="max-w-32 truncate">{chip.label}</span>
              <X className="size-3.5 opacity-70" />
            </button>
          ))}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold text-muted-foreground"
            >
              <RotateCcw className="size-3.5" />
              {t("مسح الكل", "Clear all")}
            </button>
          )}
        </div>
      )}



      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("جاري التحميل…", "Loading…")}</p>
      ) : students.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title={t("لسا ما أضفت طلاب", "No students yet")}
          description={t(
            "لسا ما أضفت طلاب. ابدأ بإضافة أول طالب لمتابعة دفعاته وموادّه بسهولة.",
            "Add your first student to track their courses and payments.",
          )}
          actionLabel={t("أضف طالب", "Add student")}
          onAction={() => setOpen(true)}
        />
      ) : list.length === 0 ? (
        <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
          {t("ما في نتائج مطابقة. جرّب تعديل البحث أو الفلاتر.", "No matching results. Try adjusting the search or filters.")}
        </p>
      ) : (
        <ul className="space-y-3.5">
          {list.map((s) => {
            const bal = studentBalance(s);
            const settled = bal.owed <= 0;
            const names = (s.student_courses ?? [])
              .map((sc: { courses: { name: string } | null }) => sc.courses?.name)
              .filter(Boolean) as string[];
            const shown = names.slice(0, 3);
            const extra = names.length - shown.length;
            return (
              <li key={s.id}>
                <Link
                  to="/students/$id"
                  params={{ id: s.id }}
                  className="block overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-shadow active:shadow-lift"
                >
                  <div className="flex items-start justify-between gap-3 bg-primary p-4 text-primary-foreground">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                        {t("بطاقة طالب", "Student card")}
                      </p>
                      <h2 className="truncate text-lg font-extrabold">
                        {[s.name, s.surname].filter(Boolean).join(" ")}
                      </h2>
                      <p className="flex items-center gap-1.5 truncate text-xs opacity-85">
                        <User className="size-3.5 shrink-0" />
                        {s.father_name
                          ? t(`الأب: ${s.father_name}`, `Father: ${s.father_name}`)
                          : t("بدون اسم الأب", "No father name")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="rounded-lg border border-primary-foreground/25 bg-primary-foreground/15 px-2.5 py-1 text-[10px] font-bold">
                        {settled ? t("مسدّد", "Settled") : t("عليه مستحقات", "Owes")}
                      </span>
                      {[stageLabel(s.stage, t), gradeLabel(s.stage, s.grade, t), branchLabel(s.branch, t)]
                        .filter(Boolean)
                        .map((label) => (
                          <span
                            key={label as string}
                            className="rounded-lg bg-primary-foreground/10 px-2.5 py-1 text-[10px] font-semibold opacity-90"
                          >
                            {label}
                          </span>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <div>
                      <p className="mb-2 text-[10px] font-bold text-muted-foreground">
                        {t("المواد المسجلة", "Enrolled courses")}
                      </p>
                      {shown.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {t("ما في مواد مسجلة بعد", "No courses yet")}
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {shown.map((n) => (
                            <span
                              key={n}
                              className="rounded-full border border-accent bg-accent px-3 py-1 text-[11px] font-semibold text-accent-foreground"
                            >
                              {n}
                            </span>
                          ))}
                          {extra > 0 && (
                            <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                              {t(`+${extra} إضافي`, `+${extra} more`)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border bg-muted/50 p-3">
                        <p className="mb-1 text-[10px] font-bold text-muted-foreground">
                          {t("المدفوع", "Paid")}
                        </p>
                        <p className="num text-lg font-extrabold text-success">{money(bal.paid)}</p>
                      </div>
                      <div
                        className={`rounded-xl border p-3 ${
                          settled
                            ? "border-border bg-muted/50"
                            : "border-destructive/20 bg-destructive/10"
                        }`}
                      >
                        <p className="mb-1 text-[10px] font-bold text-muted-foreground">
                          {t("المستحق", "Owed")}
                        </p>
                        <p
                          className={`num text-lg font-extrabold ${
                            settled ? "text-muted-foreground" : "text-destructive"
                          }`}
                        >
                          {money(Math.max(bal.owed, 0))}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
                        settled
                          ? "border-success/20 bg-success/10"
                          : "border-warning/25 bg-warning/10"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-xs font-bold">
                        {settled ? (
                          <CheckCircle2 className="size-4 text-success" />
                        ) : (
                          <AlertCircle className="size-4 text-warning" />
                        )}
                        <span className={settled ? "text-success" : "text-warning-foreground"}>
                          {settled
                            ? t("حالة الدفع: مسدّد بالكامل", "Payment: fully settled")
                            : t("حالة الدفع: بانتظار السداد", "Payment: pending")}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
                        {t("التفاصيل", "Details")}
                        <ChevronLeft className="size-3.5 icon-flip" />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {students.length > 0 && (
        <FabButton label={t("أضف طالب", "Add student")} onClick={() => setOpen(true)} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>{t("طالب جديد", "New student")}</DialogTitle>
          </DialogHeader>
          {justSaved > 0 && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-xs font-semibold text-success">
              {t(`انحفظ ${justSaved} طالب 👏`, `${justSaved} student(s) saved 👏`)}
            </p>
          )}
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t("اسم الطالب", "Student name")}
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                autoFocus
              />
              <Field
                label={t("الكنية", "Surname")}
                value={form.surname}
                onChange={(v) => setForm({ ...form, surname: v })}
              />
            </div>
            <Field
              label={t("اسم الأب", "Father's name")}
              value={form.father_name}
              onChange={(v) => setForm({ ...form, father_name: v })}
            />
            <Field
              label={t("اسم الأم", "Mother's name")}
              value={form.mother_name}
              onChange={(v) => setForm({ ...form, mother_name: v })}
            />
            <Field
              label={t("رقم هاتف الطالب", "Student phone")}
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              dir="ltr"
              type="tel"
            />
            <Field
              label={t("رقم هاتف ولي التلميذ", "Guardian phone")}
              value={form.guardian_phone}
              onChange={(v) => setForm({ ...form, guardian_phone: v })}
              dir="ltr"
              type="tel"
            />
            <div className="space-y-1.5">
              <Label>{t("المرحلة الدراسية", "Education stage")}</Label>
              <div className="flex flex-wrap gap-2">
                {STAGES.map((st) => {
                  const active = form.stage === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() =>
                        setForm({ ...form, stage: active ? "" : st.id, grade: "", branch: "" })
                      }
                      className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground active:bg-muted"
                      }`}
                    >
                      {t(st.ar, st.en)}
                    </button>
                  );
                })}
              </div>
            </div>
            {form.stage === "secondary" && (
              <div className="space-y-1.5">
                <Label>{t("الفرع", "Branch")}</Label>
                <div className="flex flex-wrap gap-2">
                  {BRANCHES.map((b) => {
                    const active = form.branch === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setForm({ ...form, branch: active ? "" : b.id })}
                        className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground active:bg-muted"
                        }`}
                      >
                        {t(b.ar, b.en)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {form.stage && (
              <div className="space-y-1.5">
                <Label>{t("الصف", "Grade")}</Label>
                <div className="flex flex-wrap gap-2">
                  {GRADES[form.stage as StageId].map((g) => {
                    const active = form.grade === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setForm({ ...form, grade: active ? "" : g.id })}
                        className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground active:bg-muted"
                        }`}
                      >
                        {t(g.ar, g.en)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {classificationReady && (
            <div className="space-y-1.5">
              <Label>{t("المواد المسجلة", "Enrolled courses")}</Label>
              {courses.length === 0 ? (

                <p className="text-xs text-muted-foreground">
                  {t("ما في مواد بعد — أضف مادة من تبويب المواد", "No courses yet — add one from the Courses tab")}
                </p>
              ) : matchingCourses.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t(
                    "ما في مواد مخصصة لهالصف — أضف مادة لهالصف من تبويب المواد",
                    "No courses for this grade yet — add one from the Courses tab",
                  )}
                </p>
              ) : (
                <div className="space-y-2">
                  {matchingCourses.map((c) => {
                    const pick = pickedCourses.find((p) => p.course_id === c.id);
                    const links = courseTeachers(c as never);
                    return (
                      <div key={c.id} className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => toggleCoursePick(c as never)}
                          className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                            pick
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground active:bg-muted"
                          }`}
                        >
                          <span className="truncate">{c.name}</span>
                          <span className="num shrink-0">
                            {money(
                              enrollmentFee({
                                custom_fee: null,
                                teacher_id: pick?.teacher_id ?? null,
                                courses: c as never,
                              }),
                            )}
                          </span>
                        </button>
                        {pick && links.length > 1 && (
                          <div className="flex flex-wrap items-center gap-1.5 ps-1">
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                              <User className="size-3" />
                              {t("الأستاذ:", "Teacher:")}
                            </span>
                            {links.map((l) => (
                              <button
                                key={l.teacher_id}
                                type="button"
                                onClick={() => setPickedTeacher(c.id, l.teacher_id)}
                                className={`num rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                                  pick.teacher_id === l.teacher_id
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border bg-card text-muted-foreground active:bg-muted"
                                }`}
                              >
                                {l.teachers?.name}
                                {l.price != null ? ` · ${money(Number(l.price))}` : ""}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}

            <div className="space-y-1.5">
              <Label>{t("تاريخ التسجيل", "Enrollment date")}</Label>
              <Input
                type="date"
                dir="ltr"
                value={form.enrollment_date}
                onChange={(e) => setForm({ ...form, enrollment_date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={() => save(false)} disabled={saving} size="lg" className="w-full">
              {saving ? t("لحظة…", "Saving…") : t("حفظ", "Save")}
            </Button>
            <Button
              variant="outline"
              onClick={() => save(true)}
              disabled={saving}
              size="lg"
              className="w-full"
            >
              {t("أضف طالب آخر", "Add another student")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl p-0">
          <DialogHeader className="flex flex-row items-center justify-between gap-2 border-b border-border bg-muted/40 px-5 py-4 text-start">
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <SlidersHorizontal className="size-5" />
              </span>
              {t("فلترة الطلاب", "Filter students")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("خيارات فلترة الطلاب", "Student filter options")}
            </DialogDescription>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              aria-label={t("إغلاق", "Close")}
              className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted active:scale-95"
            >
              <X className="size-5" />
            </button>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-5 py-5">
            <FilterGroup icon={Wallet} title={t("حالة الدفع", "Payment status")}>
              <FilterChip active={payStatus === "all"} onClick={() => setPayStatus("all")} label={t("الكل", "All")} count={students.length} />
              <FilterChip active={payStatus === "owes"} onClick={() => setPayStatus("owes")} label={t("عليه مستحقات", "Owes")} count={owesCount} />
              <FilterChip active={payStatus === "settled"} onClick={() => setPayStatus("settled")} label={t("مسدّد", "Settled")} count={settledCount} />
            </FilterGroup>

            <FilterGroup icon={Layers} title={t("المرحلة الدراسية", "Education stage")}>
              <FilterChip
                active={stageId === "all"}
                onClick={() => { setStageId("all"); setGradeId("all"); setBranchId("all"); }}
                label={t("الكل", "All")}
                count={students.length}
              />
              {STAGES.map((st) => (
                <FilterChip
                  key={st.id}
                  active={stageId === st.id}
                  onClick={() => {
                    setStageId(st.id);
                    setGradeId("all");
                    if (st.id !== "secondary") setBranchId("all");
                  }}
                  label={t(st.ar, st.en)}
                  count={stageCount(st.id)}
                />
              ))}
            </FilterGroup>

            {stageId === "secondary" && (
              <FilterGroup icon={Split} title={t("الفرع", "Branch")}>
                <FilterChip active={branchId === "all"} onClick={() => setBranchId("all")} label={t("الكل", "All")} />
                {BRANCHES.map((b) => (
                  <FilterChip
                    key={b.id}
                    active={branchId === b.id}
                    onClick={() => setBranchId(b.id)}
                    label={t(b.ar, b.en)}
                    count={branchCount(b.id)}
                  />
                ))}
              </FilterGroup>
            )}

            {gradeOptions.length > 0 && (
              <FilterGroup icon={GraduationCap} title={t("الصف", "Grade")}>
                <FilterChip active={gradeId === "all"} onClick={() => setGradeId("all")} label={t("الكل", "All")} />
                {gradeOptions.map((g) => (
                  <FilterChip
                    key={g.id}
                    active={gradeId === g.id}
                    onClick={() => setGradeId(g.id)}
                    label={t(g.ar, g.en)}
                    count={gradeCount(g.id)}
                  />
                ))}
              </FilterGroup>
            )}

            {courses.length > 0 && (
              <FilterGroup icon={BookOpen} title={t("المادة", "Course")}>
                <FilterChip active={courseId === "all"} onClick={() => setCourseId("all")} label={t("الكل", "All")} count={students.length} />
                {courses.map((c) => (
                  <FilterChip
                    key={c.id}
                    active={courseId === c.id}
                    onClick={() => setCourseId(c.id)}
                    label={c.name}
                    count={(c.student_courses ?? []).length}
                  />
                ))}
              </FilterGroup>
            )}

            {teachers.length > 0 && (
              <FilterGroup icon={User} title={t("المدرّس", "Teacher")}>
                <FilterChip active={teacherId === "all"} onClick={() => setTeacherId("all")} label={t("الكل", "All")} count={students.length} />
                {teachers.map((tc) => (
                  <FilterChip
                    key={tc.id}
                    active={teacherId === tc.id}
                    onClick={() => setTeacherId(tc.id)}
                    label={tc.name}
                    count={students.filter((s) =>
                      (s.student_courses ?? []).some((sc: { teacher_id: string | null }) => sc.teacher_id === tc.id),
                    ).length}
                  />
                ))}
              </FilterGroup>
            )}
          </div>

          <DialogFooter className="flex-row gap-2 border-t border-border bg-muted/40 px-5 py-4">
            <Button variant="outline" size="lg" className="flex-1" onClick={clearFilters} disabled={activeCount === 0}>
              <RotateCcw className="size-4" />
              {t("مسح", "Reset")}
            </Button>
            <Button size="lg" className="flex-1" onClick={() => setFiltersOpen(false)}>
              <CheckCircle2 className="size-4" />
              {t(`عرض ${list.length} نتيجة`, `Show ${list.length}`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow-soft"
          : "bg-card text-muted-foreground shadow-soft active:bg-muted"
      }`}
    >
      <span className="max-w-32 truncate">{label}</span>
      {count != null && (
        <span
          className={`rounded-full px-1.5 text-[10px] font-extrabold num ${
            active ? "bg-white/20" : "bg-muted"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

function FilterGroup({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-xs font-bold text-foreground">
        <Icon className="size-4 text-primary" />
        {title}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
