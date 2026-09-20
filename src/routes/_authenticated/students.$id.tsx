import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCourses, useRefresh, useInstitute } from "@/hooks/useApp";
import { usePrefs } from "@/lib/i18n";
import { money, shortDate, METHOD_LABELS } from "@/lib/format";
import { buildReminderMessage, waLink } from "@/lib/reminder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FabButton } from "@/components/FabButton";
import { ChevronLeft, Wallet, Check, Pencil, MessageCircle, AlertCircle, CheckCircle2, Trash2, TriangleAlert, User, Ban, RotateCcw } from "lucide-react";
import { courseTeachers, enrollmentFee, isActivePayment } from "@/lib/fees";
import { toast } from "sonner";
import { STAGES, GRADES, BRANCHES, stageLabel, gradeLabel, branchLabel, courseMatchesStudent, classificationLabel, type StageId } from "@/lib/stages";



export const Route = createFileRoute("/_authenticated/students/$id")({
  head: ({ params }) => {
    const ref = params.id.slice(0, 8);
    const title = `ملف الطالب ${ref} — معهدي`;
    const description = `صفحة الطالب ${ref}: المواد المسجلة، المستحقات المالية، وسجل الدفعات داخل معهدك.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: StudentDetail,
});

type EnrolledRow = {
  id: string;
  custom_fee: number | null;
  course_id: string;
  teacher_id: string | null;
  courses:
    | {
        id: string;
        name: string;
        price: number;
        teacher_courses:
          | { teacher_id: string; price: number | null; teachers: { id: string; name: string } | null }[]
          | null;
      }
    | null;
};

type PaymentRow = {
  id: string;
  amount: number;
  date: string;
  method: string;
  note: string | null;
  status: string | null;
  cancelled_at: string | null;
};


function StudentDetail() {
  const { id } = Route.useParams();
  const { t, lang } = usePrefs();
  const refresh = useRefresh();
  const { data: courses = [] } = useCourses();
  const { data: institute } = useInstitute();

  const { data: student, refetch } = useQuery({
    queryKey: ["student", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select(
          "*, student_courses(id, custom_fee, course_id, teacher_id, courses(id,name,price, teacher_courses(teacher_id, price, teachers(id,name)))), payments(id,amount,date,method,note,status,cancelled_at)",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [pay, setPay] = useState({ amount: "", date: "", method: "cash", note: "" });
  const [editingPayment, setEditingPayment] = useState<PaymentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  if (!student) {
    return <p className="text-sm text-muted-foreground">{t("جاري التحميل…", "Loading…")}</p>;
  }

  const enrolled = (student.student_courses ?? []) as EnrolledRow[];
  const payments = ((student.payments ?? []) as PaymentRow[]).sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  const fitCourses = courses.filter(
    (c) =>
      courseMatchesStudent(
        c as { stage?: string | null; grade?: string | null; branch?: string | null },
        student as { stage?: string | null; grade?: string | null; branch?: string | null },
      ) || enrolled.some((e) => e.course_id === c.id),
  );

  const due = enrolled.reduce((s, e) => s + enrollmentFee(e), 0);
  const paid = payments.filter(isActivePayment).reduce((s, p) => s + Number(p.amount), 0);
  const owed = due - paid;

  const reminderHref = waLink(
    student.guardian_phone ?? student.phone,
    buildReminderMessage(institute?.reminder_template, {
      student: student.name,
      institute: institute?.name ?? "",
      amount: owed,
      due,
      paid,
    }),
  );

  const savePayment = async () => {
    const amount = Number(pay.amount);
    if (!amount) { toast.error(t("أدخل المبلغ", "Enter an amount")); return; }
    setSaving(true);
    const { error } = await supabase.from("payments").insert({
      student_id: id,
      amount,
      date: pay.date || new Date().toISOString().slice(0, 10),
      method: pay.method as "cash" | "shamcash" | "transfer",
      note: pay.note || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setPayOpen(false);
    setPay({ amount: "", date: "", method: "cash", note: "" });
    await refetch();
    refresh("students", "recent-feed", "monthly-collections");
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 2600);
    await supabase.from("institutes").update({ onboarding_completed: true }).eq("owner_id", (await supabase.auth.getUser()).data.user!.id);
    refresh("institute");
    toast.success(t("انحفظت الدفعة! المستحقات تحدّثت", "Payment saved! Balance updated"));
  };

  const toggleCourse = async (courseId: string, on: boolean) => {
    if (on) {
      const course = courses.find((c) => c.id === courseId);
      const links = courseTeachers(course as never);
      await supabase.from("student_courses").insert({
        student_id: id,
        course_id: courseId,
        // single teacher → assigned automatically, several → student picks below
        teacher_id: links.length === 1 ? links[0]!.teacher_id : null,
      });
    } else {
      await supabase.from("student_courses").delete().eq("student_id", id).eq("course_id", courseId);
    }
    await refetch();
    refresh("students", "courses");
  };

  const setEnrollmentTeacher = async (rowId: string, teacherId: string | null) => {
    const { error } = await supabase
      .from("student_courses")
      .update({ teacher_id: teacherId })
      .eq("id", rowId);
    if (error) { toast.error(error.message); return; }
    await refetch();
    refresh("students");
  };

  const savePaymentEdit = async (
    row: PaymentRow,
    patch: { amount: number; date: string; method: string; note: string | null; status: string },
  ) => {
    const { error } = await supabase
      .from("payments")
      .update({
        amount: patch.amount,
        date: patch.date,
        method: patch.method as "cash" | "shamcash" | "transfer",
        note: patch.note,
        status: patch.status,
      })
      .eq("id", row.id);
    if (error) { toast.error(error.message); return false; }
    await refetch();
    refresh("students", "recent-feed", "monthly-collections");
    toast.success(
      patch.status === "cancelled"
        ? t("تم إلغاء الدفعة", "Payment cancelled")
        : t("تم تحديث الدفعة", "Payment updated"),
    );
    return true;
  };

  const setFee = async (rowId: string, fee: string) => {
    await supabase
      .from("student_courses")
      .update({ custom_fee: fee === "" ? null : Number(fee) })
      .eq("id", rowId);
    await refetch();
    refresh("students");
  };

  const deleteStudent = async () => {
    setDeleting(true);
    // payments & student_courses are FK-linked with ON DELETE CASCADE
    const { error } = await supabase.from("students").delete().eq("id", id);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    refresh("students", "recent-feed", "monthly-collections", "courses");
    toast.success(t("انحذف الطالب مع كل سجلاته", "Student deleted with all records"));
    navigate({ to: "/students" });
  };

  return (
    <div className="space-y-4 pb-24">
      <Link
        to="/students"
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"
      >
        <ChevronLeft className="size-4 icon-flip" /> {t("الطلاب", "Students")}
      </Link>

      {/* بطاقة الطالب */}
      <div className="overflow-hidden rounded-xl shadow-soft">
        <div className="bg-primary p-5 text-primary-foreground">
          <div className="flex items-start gap-3.5">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-primary-foreground/25 bg-primary-foreground/15">
              <span className="text-2xl font-extrabold">{student.name.trim().charAt(0)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-extrabold">
                {[student.name, student.surname].filter(Boolean).join(" ")}
              </h1>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                {[stageLabel(student.stage, t), gradeLabel(student.stage, student.grade, t), branchLabel(student.branch, t)]
                  .filter(Boolean)
                  .map((label) => (
                    <span
                      key={label as string}
                      className="rounded-lg border border-primary-foreground/25 bg-primary-foreground/15 px-2 py-0.5"
                    >
                      {label}
                    </span>
                  ))}
                {student.father_name && (
                  <span className="rounded-lg border border-primary-foreground/25 bg-primary-foreground/15 px-2 py-0.5">
                    {t("الأب", "Father")}: {student.father_name}
                  </span>
                )}
              </div>
              {student.phone && (
                <p dir="ltr" className="num mt-1.5 text-start text-xs text-primary-foreground/85">
                  {student.phone}
                </p>
              )}
              {student.guardian_phone && (
                <p dir="ltr" className="num mt-0.5 text-start text-xs text-primary-foreground/85">
                  {student.guardian_phone}
                  <span dir={lang === "ar" ? "rtl" : "ltr"} className="ms-1.5 opacity-75">
                    ({t("ولي الأمر", "Guardian")})
                  </span>
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                onClick={() => setEditOpen(true)}
                aria-label={t("تعديل", "Edit")}
                className="grid size-9 place-items-center rounded-xl border border-primary-foreground/25 bg-primary-foreground/15 transition-colors hover:bg-primary-foreground/25"
              >
                <Pencil className="size-4" />
              </button>
              <button
                onClick={() => setDeleteOpen(true)}
                aria-label={t("حذف الطالب", "Delete student")}
                className="grid size-9 place-items-center rounded-xl border border-primary-foreground/25 bg-primary-foreground/15 transition-colors hover:bg-destructive hover:border-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border bg-card rtl:divide-x-reverse">
          {[
            {
              label: t("اسم الأم", "Mother"),
              value: student.mother_name || t("—", "—"),
            },
            {
              label: t("تاريخ التسجيل", "Enrolled"),
              value: shortDate(student.enrollment_date),
            },
            {
              label: t("المواد", "Courses"),
              value: String(enrolled.length),
            },
          ].map((cell) => (
            <div key={cell.label} className="min-w-0 px-3 py-3 text-center">
              <p className="text-[10px] font-semibold text-muted-foreground">{cell.label}</p>
              <p className="num mt-0.5 truncate text-xs font-bold text-foreground">{cell.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* المستحقات */}
      <div className={`rounded-xl bg-card p-5 shadow-soft transition-shadow ${celebrate ? "ring-2 ring-success" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">{t("المستحقات", "Amount owed")}</p>
            <p
              key={owed}
              className={`num mt-1 text-4xl font-extrabold ${owed > 0 ? "text-primary" : "text-success"} ${
                celebrate ? "animate-pop" : ""
              }`}
            >
              {money(owed)}
            </p>
          </div>
          <span
            className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
              owed > 0 ? "bg-primary/10 text-primary" : "bg-success/10 text-success"
            }`}
          >
            {owed > 0 ? <AlertCircle className="size-5" /> : <CheckCircle2 className="size-5" />}
          </span>
        </div>
        <div className="num mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-muted/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold text-muted-foreground">{t("إجمالي المواد", "Total fees")}</p>
            <p className="mt-0.5 text-sm font-extrabold text-foreground">{money(due)}</p>
          </div>
          <div className="rounded-xl bg-muted/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold text-muted-foreground">{t("المدفوع", "Paid")}</p>
            <p className="mt-0.5 text-sm font-extrabold text-success">{money(paid)}</p>
          </div>
        </div>
        {celebrate && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-success animate-pop">
            <Check className="size-4" />
            {t("حساب دقيق، بدون ورق ولا إكسل", "Accurate math — no paper, no Excel")}
          </p>
        )}
        <Button
          variant="outline"
          className="mt-4 w-full border-success/40 text-success hover:bg-success/10"
          disabled={!reminderHref}
          onClick={() => reminderHref && window.open(reminderHref, "_blank", "noopener")}
        >
          <MessageCircle className="size-4" />
          {t("تذكير بالحساب عبر واتساب", "Remind via WhatsApp")}
        </Button>
        {!reminderHref && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t("أضف رقم هاتف للطالب لتفعيل التذكير.", "Add a phone number to enable reminders.")}
          </p>
        )}
      </div>


      {/* المواد */}
      <section className="rounded-xl bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">{t("المواد المسجّلة", "Enrolled courses")}</h2>
          <Button variant="outline" size="sm" onClick={() => setCoursesOpen(true)}>
            {t("تعديل", "Edit")}
          </Button>
        </div>
        {enrolled.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("ما في مواد مسجلة بعد.", "No courses enrolled yet.")}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {enrolled.map((e) => {
              const links = courseTeachers(e.courses);
              return (
                <li key={e.id} className="rounded-xl bg-muted/60 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {e.courses?.name}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <Input
                        dir="ltr"
                        type="number"
                        className="num h-8 w-24 bg-card text-xs"
                        defaultValue={e.custom_fee ?? ""}
                        placeholder={String(
                          enrollmentFee({ custom_fee: null, teacher_id: e.teacher_id, courses: e.courses }),
                        )}
                        onBlur={(ev) => setFee(e.id, ev.target.value)}
                      />
                    </div>
                  </div>
                  {links.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                        <User className="size-3" />
                        {t("الأستاذ:", "Teacher:")}
                      </span>
                      {links.map((l) => (
                        <button
                          key={l.teacher_id}
                          type="button"
                          onClick={() =>
                            setEnrollmentTeacher(
                              e.id,
                              e.teacher_id === l.teacher_id ? null : l.teacher_id,
                            )
                          }
                          className={`num rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                            e.teacher_id === l.teacher_id
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
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t("فيك تحط سعر خاص لكل مادة بدل السعر الافتراضي.", "Override the default fee per course if needed.")}
        </p>
      </section>

      {/* سجل الدفعات */}
      <section className="rounded-xl bg-card p-5 shadow-soft">
        <h2 className="text-sm font-bold text-foreground">{t("سجل الدفعات", "Payment history")}</h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("لسا ما في دفعات. سجّل أول دفعة وشوف المستحقات بتتحدث فوراً.", "No payments yet.")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {payments.map((p) => {
              const cancelled = !isActivePayment(p);
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p
                      className={`num text-sm font-bold ${
                        cancelled ? "text-muted-foreground line-through" : "text-success"
                      }`}
                    >
                      {cancelled ? "" : "+"}
                      {money(p.amount)}
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="break-words [overflow-wrap:anywhere]">
                        {lang === "ar" ? METHOD_LABELS[p.method]?.ar : METHOD_LABELS[p.method]?.en}
                        {p.note ? ` · ${p.note}` : ""}
                      </span>
                      {cancelled && (
                        <span className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                          <Ban className="size-3" />
                          {t("ملغاة", "Cancelled")}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="num text-xs text-muted-foreground">{shortDate(p.date)}</span>
                    <button
                      onClick={() => setEditingPayment(p)}
                      aria-label={t("تعديل الدفعة", "Edit payment")}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <Pencil className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <FabButton
        label={t("تسجيل دفعة", "Record payment")}
        icon={<Wallet className="size-5" />}
        onClick={() => setPayOpen(true)}
      />

      {/* payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>{t("تسجيل دفعة", "Record payment")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label>{t("المبلغ", "Amount")}</Label>
              <Input
                autoFocus
                dir="ltr"
                type="number"
                inputMode="numeric"
                value={pay.amount}
                onChange={(e) => setPay({ ...pay, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("التاريخ", "Date")}</Label>
              <Input
                dir="ltr"
                type="date"
                value={pay.date}
                onChange={(e) => setPay({ ...pay, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("طريقة الدفع", "Method")}</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["cash", "shamcash", "transfer"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPay({ ...pay, method: m })}
                    className={`rounded-xl px-2 py-2.5 text-xs font-semibold transition-colors ${
                      pay.method === m
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {lang === "ar" ? METHOD_LABELS[m]!.ar : METHOD_LABELS[m]!.en}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("ملاحظة", "Note")}</Label>
              <Textarea
                rows={2}
                value={pay.note}
                onChange={(e) => setPay({ ...pay, note: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={savePayment} disabled={saving} size="lg" className="w-full">
              {saving ? t("لحظة…", "Saving…") : t("حفظ الدفعة", "Save payment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* edit / cancel a payment */}
      <PaymentEditDialog
        payment={editingPayment}
        onClose={() => setEditingPayment(null)}
        onSave={savePaymentEdit}
      />

      {/* edit student */}
      <EditStudentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        student={student}
        onSaved={async () => {
          await refetch();
          refresh("students");
        }}
      />

      {/* delete warning */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="size-5" />
              {t("حذف الطالب نهائياً؟", "Delete student permanently?")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(
              `رح ينحذف «${student.name}» مع كل سجلاته: المواد المسجلة وسجل الدفعات بالكامل. هالإجراء ما بينرجع عنه.`,
              `"${student.name}" and all records — enrolled courses and payment history — will be permanently deleted. This cannot be undone.`,
            )}
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              {t("إلغاء", "Cancel")}
            </Button>
            <Button variant="destructive" onClick={deleteStudent} disabled={deleting}>
              <Trash2 className="size-4" />
              {deleting ? t("جارٍ الحذف…", "Deleting…") : t("نعم، احذف الطالب", "Yes, delete student")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* courses multi-select */}
      <Dialog open={coursesOpen} onOpenChange={setCoursesOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>{t("المواد المسجّلة", "Enrolled courses")}</DialogTitle>
          </DialogHeader>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("أضف مواد أول شي من صفحة المواد.", "Add courses first.")}
            </p>
          ) : fitCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(
                "ما في مواد مخصصة لصف هذا الطالب — أضف مادة لهالصف من صفحة المواد.",
                "No courses for this student's grade yet — add one from the Courses page.",
              )}
            </p>
          ) : (
            <ul className="space-y-2">
              {fitCourses.map((c) => {
                const on = enrolled.some((e) => e.course_id === c.id);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => toggleCourse(c.id, !on)}
                      className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm transition-colors ${
                        on ? "bg-primary/10 text-primary" : "bg-muted text-foreground"
                      }`}
                    >
                      <span className="flex flex-col items-start gap-0.5">
                        <span className="font-semibold">{c.name}</span>
                        {classificationLabel(c, t) && (
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {classificationLabel(c, t)}
                          </span>
                        )}
                      </span>
                      <span className="num flex items-center gap-2 text-xs">
                        {money(c.price)}
                        {on && <Check className="size-4" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditStudentDialog({
  open,
  onOpenChange,
  student,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student: {
    id: string;
    name: string;
    surname: string | null;
    father_name: string | null;
    mother_name: string | null;
    phone: string | null;
    guardian_phone: string | null;
    stage: string | null;
    grade: string | null;
    branch: string | null;
  };
  onSaved: () => void;
}) {
  const { t } = usePrefs();
  const [form, setForm] = useState({
    name: student.name,
    surname: student.surname ?? "",
    father_name: student.father_name ?? "",
    mother_name: student.mother_name ?? "",
    phone: student.phone ?? "",
    guardian_phone: student.guardian_phone ?? "",
    stage: student.stage ?? "",
    grade: student.grade ?? "",
    branch: student.branch ?? "",
  });

  const save = async () => {
    const { error } = await supabase
      .from("students")
      .update({
        name: form.name,
        surname: form.surname || null,
        father_name: form.father_name || null,
        mother_name: form.mother_name || null,
        phone: form.phone || null,
        guardian_phone: form.guardian_phone || null,
        stage: form.stage || null,
        grade: form.grade || null,
        branch: form.stage === "secondary" ? form.branch || null : null,
      })
      .eq("id", student.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("تم التعديل", "Updated"));
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl">
        <DialogHeader>
          <DialogTitle>{t("تعديل معلومات الطالب", "Edit student")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("اسم الطالب", "Name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("الكنية", "Surname")}</Label>
              <Input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("اسم الأب", "Father")}</Label>
            <Input
              value={form.father_name}
              onChange={(e) => setForm({ ...form, father_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("اسم الأم", "Mother")}</Label>
            <Input
              value={form.mother_name}
              onChange={(e) => setForm({ ...form, mother_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("رقم هاتف الطالب", "Student phone")}</Label>
            <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("رقم هاتف ولي التلميذ", "Guardian phone")}</Label>
            <Input dir="ltr" value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("المرحلة الدراسية", "Education stage")}</Label>
            <div className="flex flex-wrap gap-2">
              {STAGES.map((st) => {
                const active = form.stage === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setForm({ ...form, stage: active ? "" : st.id, grade: "", branch: "" })}
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
        </div>
        <DialogFooter>
          <Button onClick={save} size="lg" className="w-full">
            {t("حفظ", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentEditDialog({
  payment,
  onClose,
  onSave,
}: {
  payment: PaymentRow | null;
  onClose: () => void;
  onSave: (
    row: PaymentRow,
    patch: { amount: number; date: string; method: string; note: string | null; status: string },
  ) => Promise<boolean>;
}) {
  const { t, lang } = usePrefs();
  const [form, setForm] = useState({ amount: "", date: "", method: "cash", note: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!payment) return;
    setForm({
      amount: String(payment.amount),
      date: payment.date,
      method: payment.method,
      note: payment.note ?? "",
    });
  }, [payment]);

  if (!payment) return null;
  const cancelled = !isActivePayment(payment);

  const submit = async (status: string) => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error(t("أدخل مبلغ صحيح", "Enter a valid amount"));
      return;
    }
    setSaving(true);
    const ok = await onSave(payment, {
      amount,
      date: form.date,
      method: form.method,
      note: form.note || null,
      status,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("تعديل الدفعة", "Edit payment")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5">
          {cancelled && (
            <p className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              <Ban className="size-4" />
              {t("هالدفعة ملغاة وما بتنحسب بالمحصل.", "This payment is cancelled and excluded from totals.")}
            </p>
          )}
          <div className="space-y-1.5">
            <Label>{t("المبلغ", "Amount")}</Label>
            <Input
              dir="ltr"
              type="number"
              inputMode="numeric"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("التاريخ", "Date")}</Label>
            <Input
              dir="ltr"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("طريقة الدفع", "Method")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "shamcash", "transfer"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm({ ...form, method: m })}
                  className={`rounded-xl px-2 py-2.5 text-xs font-semibold transition-colors ${
                    form.method === m
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {lang === "ar" ? METHOD_LABELS[m]!.ar : METHOD_LABELS[m]!.en}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("ملاحظة", "Note")}</Label>
            <Textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={() => submit(cancelled ? "cancelled" : "active")}
            disabled={saving}
            size="lg"
            className="w-full"
          >
            {saving ? t("لحظة…", "Saving…") : t("حفظ التعديلات", "Save changes")}
          </Button>
          {cancelled ? (
            <Button
              variant="outline"
              onClick={() => submit("active")}
              disabled={saving}
              className="w-full"
            >
              <RotateCcw className="size-4" />
              {t("استعادة الدفعة", "Restore payment")}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => submit("cancelled")}
              disabled={saving}
              className="w-full"
            >
              <Ban className="size-4" />
              {t("إلغاء الدفعة (بدون حذف)", "Cancel payment (keep record)")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
