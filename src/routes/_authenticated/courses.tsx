import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCourses, useInstitute, useRefresh, useTeachers } from "@/hooks/useApp";
import { usePrefs } from "@/lib/i18n";
import { money, hhmm, DAYS_AR, DAYS_EN } from "@/lib/format";
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
  BookOpen,
  Search,
  Users,
  Pencil,
  Trash2,
  ChevronDown,
  GraduationCap,
  SlidersHorizontal,
  Layers,
  Split,
  User,
  X,
  RotateCcw,
  CheckCircle2,
  Check,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { STAGES, GRADES, BRANCHES, classificationLabel, type StageId } from "@/lib/stages";

export const Route = createFileRoute("/_authenticated/courses")({
  validateSearch: (s: Record<string, unknown>): { add?: boolean } =>
    s["add"] === true || s["add"] === "true" ? { add: true } : {},
  head: () => ({
    meta: [
      { title: "المواد — معهدي" },
      { name: "description", content: "أضف وعدّل مواد معهدك وأسعارها والمدرس المسؤول عنها." },
      { property: "og:title", content: "المواد — معهدي" },
      { property: "og:description", content: "أضف وعدّل مواد معهدك وأسعارها والمدرس المسؤول." },
    ],
  }),
  component: CoursesPage,
});

type CourseRow = {
  id: string;
  name: string;
  price: number;
  stage: string | null;
  grade: string | null;
  branch: string | null;
  teacher_id: string | null;
  teachers: { id: string; name: string } | null;
  teacher_courses:
    | { id: string; teacher_id: string; price: number | null; teachers: { id: string; name: string } | null }[]
    | null;
  student_courses: { id: string }[] | null;
  sections: { id: string; name: string; day_of_week: number; start_time: string; end_time: string }[] | null;
};

function CoursesPage() {
  const { t, lang } = usePrefs();
  const { add } = Route.useSearch();
  const { data: institute } = useInstitute();
  const { data: courses = [], isLoading } = useCourses();
  const { data: teachers = [] } = useTeachers();
  const refresh = useRefresh();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CourseRow | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fStage, setFStage] = useState<string>("all");
  const [fGrade, setFGrade] = useState<string>("all");
  const [fBranch, setFBranch] = useState<string>("all");
  const [fTeacher, setFTeacher] = useState<string>("all");
  const emptyForm = { name: "", price: "", teacher_id: "", stage: "", grade: "", branch: "" };
  const [form, setForm] = useState(emptyForm);
  const [teacherFees, setTeacherFees] = useState<{ teacher_id: string; price: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleTeacher = (id: string) =>
    setTeacherFees((prev) =>
      prev.some((x) => x.teacher_id === id)
        ? prev.filter((x) => x.teacher_id !== id)
        : [...prev, { teacher_id: id, price: "" }],
    );
  const setTeacherPrice = (id: string, price: string) =>
    setTeacherFees((prev) => prev.map((x) => (x.teacher_id === id ? { ...x, price } : x)));

  useEffect(() => {
    if (add) openNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [add]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setTeacherFees([]);
    setOpen(true);
  };

  const openEdit = (c: CourseRow) => {
    setEditing(c);
    setForm({
      name: c.name,
      price: String(c.price),
      teacher_id: c.teacher_id ?? "",
      stage: c.stage ?? "",
      grade: c.grade ?? "",
      branch: c.branch ?? (c.stage === "secondary" ? "both" : ""),
    });
    setTeacherFees(
      (c.teacher_courses ?? []).map((tc) => ({
        teacher_id: tc.teacher_id,
        price: tc.price == null ? "" : String(tc.price),
      })),
    );
    setOpen(true);
  };

  const save = async () => {
    if (!institute) { toast.error(t("ما قدرنا نجيب بيانات معهدك، حدّث الصفحة وجرّب كمان مرة", "Could not load your institute, refresh and try again")); return; }
    if (!form.name.trim()) { toast.error(t("اسم المادة مطلوب", "Course name is required")); return; }
    if (form.stage === "secondary" && !form.branch) {
      toast.error(t("اختر الفرع (علمي أو أدبي أو الفرعين)", "Choose a branch (scientific, literary or both)"));
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      price: Number(form.price || 0),
      // legacy single-teacher column kept in sync with the first linked teacher
      teacher_id: teacherFees[0]?.teacher_id ?? null,
      stage: form.stage || null,
      grade: form.stage ? form.grade || null : null,
      branch:
        form.stage === "secondary" && form.branch !== "both" ? form.branch || null : null,
      institute_id: institute.id,
    };
    const { data: row, error } = editing
      ? await supabase.from("courses").update(payload).eq("id", editing.id).select("id").single()
      : await supabase.from("courses").insert(payload).select("id").single();
    if (error || !row) { setSaving(false); toast.error(error?.message ?? "Error"); return; }

    // sync the teacher ↔ course links with their per-teacher prices
    const { error: delErr } = await supabase.from("teacher_courses").delete().eq("course_id", row.id);
    if (delErr) { setSaving(false); toast.error(delErr.message); return; }
    if (teacherFees.length > 0) {
      const { error: linkErr } = await supabase.from("teacher_courses").insert(
        teacherFees.map((tf) => ({
          course_id: row.id,
          teacher_id: tf.teacher_id,
          price: tf.price.trim() === "" ? null : Number(tf.price),
        })),
      );
      if (linkErr) { setSaving(false); toast.error(linkErr.message); return; }
    }
    setSaving(false);
    toast.success(editing ? t("تم التعديل", "Updated") : t("تمت إضافة المادة", "Course added"));
    setOpen(false);
    refresh("courses", "students", "teachers");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("تم الحذف", "Deleted"));
    refresh("courses", "students", "sections");
  };

  const all = courses as unknown as CourseRow[];

  const clearFilters = () => {
    setFStage("all");
    setFGrade("all");
    setFBranch("all");
    setFTeacher("all");
  };

  const list = all.filter((c) => {
    if (!c.name.toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (fStage === "general" ? c.stage : fStage !== "all" && c.stage !== fStage) return false;
    if (fGrade !== "all" && c.grade !== fGrade) return false;
    if (fBranch === "both" ? c.branch : fBranch !== "all" && c.branch !== fBranch) return false;
    if (fTeacher === "none" ? c.teacher_id : fTeacher !== "all" && c.teacher_id !== fTeacher)
      return false;
    return true;
  });

  const stageCount = (id: string) =>
    id === "general" ? all.filter((c) => !c.stage).length : all.filter((c) => c.stage === id).length;
  const gradeCount = (id: string) => all.filter((c) => c.grade === id).length;
  const branchCount = (id: string) =>
    id === "both"
      ? all.filter((c) => c.stage === "secondary" && !c.branch).length
      : all.filter((c) => c.branch === id).length;
  const gradeOptions = fStage !== "all" && fStage !== "general" ? GRADES[fStage as StageId] : [];

  const stageRank = (s: string | null) => {
    const i = STAGES.findIndex((x) => x.id === s);
    return i < 0 ? 99 : i;
  };
  const gradeRank = (c: CourseRow) => {
    const list = c.stage ? (GRADES[c.stage as StageId] ?? []) : [];
    const i = list.findIndex((g) => g.id === c.grade);
    return i < 0 ? 99 : i;
  };

  const groups: { key: string; label: string; items: CourseRow[] }[] = [];
  [...list]
    .sort(
      (a, b) =>
        stageRank(a.stage) - stageRank(b.stage) ||
        (a.branch ?? "").localeCompare(b.branch ?? "") ||
        gradeRank(a) - gradeRank(b) ||
        a.name.localeCompare(b.name),
    )
    .forEach((c) => {
      const key = `${c.stage ?? ""}|${c.branch ?? ""}|${c.grade ?? ""}`;
      const label = classificationLabel(c, t) ?? t("مواد عامة", "General courses");
      const g = groups.find((x) => x.key === key);
      if (g) g.items.push(c);
      else groups.push({ key, label, items: [c] });
    });

  const activeChips: { key: string; label: string; icon: LucideIcon; clear: () => void }[] = [];
  if (fStage !== "all")
    activeChips.push({
      key: "stage",
      label:
        fStage === "general"
          ? t("مواد عامة", "General")
          : t(
              STAGES.find((s) => s.id === fStage)?.ar ?? "",
              STAGES.find((s) => s.id === fStage)?.en ?? "",
            ),
      icon: Layers,
      clear: () => {
        setFStage("all");
        setFGrade("all");
        setFBranch("all");
      },
    });
  if (fBranch !== "all")
    activeChips.push({
      key: "branch",
      label:
        fBranch === "both"
          ? t("الفرعين", "Both branches")
          : t(
              BRANCHES.find((b) => b.id === fBranch)?.ar ?? "",
              BRANCHES.find((b) => b.id === fBranch)?.en ?? "",
            ),
      icon: Split,
      clear: () => setFBranch("all"),
    });
  if (fGrade !== "all") {
    const g = Object.values(GRADES)
      .flat()
      .find((x) => x.id === fGrade);
    activeChips.push({
      key: "grade",
      label: g ? t(g.ar, g.en) : fGrade,
      icon: GraduationCap,
      clear: () => setFGrade("all"),
    });
  }
  if (fTeacher !== "all")
    activeChips.push({
      key: "teacher",
      label:
        fTeacher === "none"
          ? t("بدون مدرس", "No teacher")
          : (teachers.find((x) => x.id === fTeacher)?.name ?? ""),
      icon: User,
      clear: () => setFTeacher("all"),
    });
  const activeCount = activeChips.length;

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-xl font-extrabold text-foreground">{t("المواد", "Courses")}</h1>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("دوّر على مادة…", "Search courses…")}
            className="h-11 rounded-xl bg-card ltr:pl-9 rtl:pr-9"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-label={t("فلترة المواد", "Filter courses")}
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

      {courses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-xl bg-muted/60 px-3 py-2 text-xs font-bold text-muted-foreground">
            <BookOpen className="size-4 text-primary" />
            <span className="num">{list.length}</span>
            {t("مادة", "courses")}
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
      ) : courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-6" />}
          title={t("لسا ما أضفت مواد", "No courses yet")}
          description={t(
            "ابدأ بإضافة أول مادة مع سعرها، وبعدها فيك تسجّل عليها طلابك.",
            "Add your first course with its price, then enroll students in it.",
          )}
          actionLabel={t("أضف مادة", "Add course")}
          onAction={openNew}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Search className="size-6" />}
          title={t("ما في نتائج", "No results")}
          description={t(
            "ما في مواد مطابقة للبحث أو الفلاتر المختارة.",
            "No courses match your search or filters.",
          )}
          actionLabel={t("مسح الفلاتر", "Clear filters")}
          onAction={() => {
            clearFilters();
            setQ("");
          }}
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.key} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <GraduationCap className="size-4 shrink-0 text-primary" />
                <h2 className="truncate text-xs font-extrabold text-foreground">{group.label}</h2>
                <span className="num rounded-full bg-muted px-2 py-0.5 text-[10px] font-extrabold text-muted-foreground">
                  {group.items.length}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <ul className="space-y-3">
          {group.items.map((c) => (
            <li key={c.id} className="rounded-xl bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <button
                  className="min-w-0 flex-1 text-start"
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold text-foreground">{c.name}</p>
                    {classificationLabel(c, t) && (
                      <span className="flex items-center gap-1 rounded-lg bg-accent px-2 py-0.5 text-[11px] font-bold text-primary">
                        <GraduationCap className="size-3" />
                        {classificationLabel(c, t)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="num font-bold text-primary">{money(c.price)}</span>
                    {(c.teacher_courses ?? []).length > 0
                      ? (c.teacher_courses ?? []).map((tc) => (
                          <span key={tc.id} className="flex items-center gap-1">
                            · {tc.teachers?.name}
                            {tc.price != null && (
                              <span className="num font-bold text-primary">({money(Number(tc.price))})</span>
                            )}
                          </span>
                        ))
                      : c.teachers && <span>· {c.teachers.name}</span>}
                    <span className="flex items-center gap-1">
                      · <Users className="size-3" />
                      <span className="num">{c.student_courses?.length ?? 0}</span>
                    </span>
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => openEdit(c)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => remove(c.id)}
                    className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-4" />
                  </button>
                  <ChevronDown
                    className={`size-4 text-muted-foreground transition-transform ${
                      expanded === c.id ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </div>

              {expanded === c.id && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t("الشعب المرتبطة", "Linked sections")}
                  </p>
                  {(c.sections ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("ما في شعب لهالمادة بعد.", "No sections for this course yet.")}
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {c.sections!.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs"
                        >
                          <span className="truncate font-semibold text-foreground">{s.name}</span>
                          <span className="num shrink-0 text-muted-foreground">
                            {lang === "ar" ? DAYS_AR[s.day_of_week] : DAYS_EN[s.day_of_week]}{" "}
                            {hhmm(s.start_time)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {courses.length > 0 && <FabButton label={t("أضف مادة", "Add course")} onClick={openNew} />}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("تعديل المادة", "Edit course") : t("مادة جديدة", "New course")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("اسم المادة", "Course name")}</Label>
              <Input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("رياضيات", "Mathematics")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("السعر", "Price")}</Label>
              <Input
                type="number"
                inputMode="numeric"
                dir="ltr"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("المرحلة الدراسية (اختياري)", "Education stage (optional)")}</Label>
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
                  {[...BRANCHES, { id: "both", ar: "الفرعين", en: "Both branches" }].map((b) => {
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

            <div className="space-y-2">
              <Label>{t("أساتذة المادة وأسعارهم", "Course teachers & their prices")}</Label>
              {teachers.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("ما في مدرسين بعد — أضف مدرس من تبويب المدرسين", "No teachers yet — add one from the Teachers tab")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {teachers.map((tt) => {
                    const picked = teacherFees.find((x) => x.teacher_id === tt.id);
                    return (
                      <li
                        key={tt.id}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                          picked ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleTeacher(tt.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-start"
                        >
                          <span
                            className={`grid size-5 shrink-0 place-items-center rounded-md border ${
                              picked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                            }`}
                          >
                            {picked && <Check className="size-3.5" />}
                          </span>
                          <span className="truncate text-xs font-bold text-foreground">{tt.name}</span>
                        </button>
                        {picked && (
                          <Input
                            dir="ltr"
                            type="number"
                            inputMode="numeric"
                            className="num h-8 w-24 text-xs"
                            placeholder={form.price || "0"}
                            value={picked.price}
                            onChange={(e) => setTeacherPrice(tt.id, e.target.value)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-[11px] text-muted-foreground">
                {t(
                  "اترك السعر فارغاً ليُعتمد سعر المادة الأساسي. الطالب بيختار عند مين سجّل ويتحسب سعر أستاذه.",
                  "Leave a price empty to use the course base price. Students pick their teacher and are billed that teacher's price.",
                )}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving} className="w-full" size="lg">
              {saving ? t("لحظة…", "Saving…") : t("حفظ", "Save")}
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
              {t("فلترة المواد", "Filter courses")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("خيارات فلترة المواد", "Course filter options")}
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
            <FilterGroup icon={Layers} title={t("المرحلة الدراسية", "Education stage")}>
              <FilterChip
                active={fStage === "all"}
                onClick={() => { setFStage("all"); setFGrade("all"); setFBranch("all"); }}
                label={t("الكل", "All")}
                count={all.length}
              />
              {STAGES.map((st) => (
                <FilterChip
                  key={st.id}
                  active={fStage === st.id}
                  onClick={() => {
                    setFStage(st.id);
                    setFGrade("all");
                    if (st.id !== "secondary") setFBranch("all");
                  }}
                  label={t(st.ar, st.en)}
                  count={stageCount(st.id)}
                />
              ))}
              <FilterChip
                active={fStage === "general"}
                onClick={() => { setFStage("general"); setFGrade("all"); setFBranch("all"); }}
                label={t("مواد عامة", "General")}
                count={stageCount("general")}
              />
            </FilterGroup>

            {fStage === "secondary" && (
              <FilterGroup icon={Split} title={t("الفرع", "Branch")}>
                <FilterChip active={fBranch === "all"} onClick={() => setFBranch("all")} label={t("الكل", "All")} />
                {[...BRANCHES, { id: "both", ar: "الفرعين", en: "Both branches" }].map((b) => (
                  <FilterChip
                    key={b.id}
                    active={fBranch === b.id}
                    onClick={() => setFBranch(b.id)}
                    label={t(b.ar, b.en)}
                    count={branchCount(b.id)}
                  />
                ))}
              </FilterGroup>
            )}

            {gradeOptions.length > 0 && (
              <FilterGroup icon={GraduationCap} title={t("الصف", "Grade")}>
                <FilterChip active={fGrade === "all"} onClick={() => setFGrade("all")} label={t("الكل", "All")} />
                {gradeOptions.map((g) => (
                  <FilterChip
                    key={g.id}
                    active={fGrade === g.id}
                    onClick={() => setFGrade(g.id)}
                    label={t(g.ar, g.en)}
                    count={gradeCount(g.id)}
                  />
                ))}
              </FilterGroup>
            )}

            {teachers.length > 0 && (
              <FilterGroup icon={User} title={t("المدرس", "Teacher")}>
                <FilterChip active={fTeacher === "all"} onClick={() => setFTeacher("all")} label={t("الكل", "All")} count={all.length} />
                {teachers.map((tt) => (
                  <FilterChip
                    key={tt.id}
                    active={fTeacher === tt.id}
                    onClick={() => setFTeacher(tt.id)}
                    label={tt.name}
                    count={all.filter((c) => c.teacher_id === tt.id).length}
                  />
                ))}
                <FilterChip
                  active={fTeacher === "none"}
                  onClick={() => setFTeacher("none")}
                  label={t("بدون مدرس", "No teacher")}
                  count={all.filter((c) => !c.teacher_id).length}
                />
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
          className={`num rounded-full px-1.5 text-[10px] font-extrabold ${
            active ? "bg-white/20" : "bg-muted"
          }`}
        >
          {count}
        </span>
      )}
    </button>
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
