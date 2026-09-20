import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCourses, useRefresh } from "@/hooks/useApp";
import { usePrefs } from "@/lib/i18n";
import { money, shortDate } from "@/lib/format";
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
import { CourseMultiSelect, teacherCourseNames } from "@/components/CourseMultiSelect";
import { ChevronLeft, Wallet, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teachers/$id")({
  head: ({ params }) => {
    const ref = params.id.slice(0, 8);
    const title = `ملف المدرس ${ref} — معهدي`;
    const description = `صفحة المدرس ${ref}: المواد التي يدرّسها، سجل المدفوعات، وإجمالي المبالغ المدفوعة.`;
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
  component: TeacherDetail,
});

function TeacherDetail() {
  const { id } = Route.useParams();
  const { t } = usePrefs();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: courses = [] } = useCourses();

  const { data: teacher, refetch } = useQuery({
    queryKey: ["teacher", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select(
          "*, courses:course_id(id,name), teacher_courses(id, course_id, courses(id,name)), teacher_payments(id,amount,date,note)",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pay, setPay] = useState({ amount: "", date: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!teacher) {
    return <p className="text-sm text-muted-foreground">{t("جاري التحميل…", "Loading…")}</p>;
  }

  const payments = ((teacher.teacher_payments ?? []) as {
    id: string;
    amount: number;
    date: string;
    note: string | null;
  }[]).sort((a, b) => b.date.localeCompare(a.date));
  const total = payments.reduce((s, p) => s + Number(p.amount), 0);

  const savePayment = async () => {
    const amount = Number(pay.amount);
    if (!amount) { toast.error(t("أدخل المبلغ", "Enter an amount")); return; }
    setSaving(true);
    const { error } = await supabase.from("teacher_payments").insert({
      teacher_id: id,
      amount,
      date: pay.date || new Date().toISOString().slice(0, 10),
      note: pay.note || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setPayOpen(false);
    setPay({ amount: "", date: "", note: "" });
    await refetch();
    refresh("teachers", "recent-feed");
    toast.success(t("انحفظت الدفعة", "Payment saved"));
  };

  const deleteTeacher = async () => {
    setDeleting(true);
    const { error } = await supabase.from("teachers").delete().eq("id", id);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    setDeleteOpen(false);
    refresh("teachers", "courses", "recent-feed", "monthly-collections");
    toast.success(t("انحذف المدرس مع كل سجلاته", "Teacher deleted with all records"));
    navigate({ to: "/teachers" });
  };

  return (
    <div className="space-y-4 pb-24">
      <Link
        to="/teachers"
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"
      >
        <ChevronLeft className="size-4 icon-flip" /> {t("المدرسين", "Teachers")}
      </Link>

      <div className="rounded-xl bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold text-foreground">
              {teacher.name as string}
            </h1>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>
                {t("المواد", "Courses")}:{" "}
                {teacherCourseNames(teacher as never, t("بدون", "None"))}
              </p>
              {teacher.phone && (
                <p dir="ltr" className="num text-start">
                  {teacher.phone as string}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setEditOpen(true)}
              aria-label={t("تعديل المدرس", "Edit teacher")}
              className="rounded-lg bg-muted p-2 text-muted-foreground"
            >
              <Pencil className="size-4" />
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              aria-label={t("حذف المدرس", "Delete teacher")}
              className="rounded-lg bg-destructive/10 p-2 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-card p-5 shadow-soft">
        <p className="text-xs font-semibold text-muted-foreground">{t("إجمالي المدفوع", "Total paid")}</p>
        <p className="num mt-1 text-4xl font-extrabold text-primary">{money(total)}</p>
      </div>

      <section className="rounded-xl bg-card p-5 shadow-soft">
        <h2 className="text-sm font-bold text-foreground">{t("سجل المدفوعات", "Payment log")}</h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("ما في مدفوعات لهالمدرس بعد.", "No payments to this teacher yet.")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="num text-sm font-bold text-foreground">{money(p.amount)}</p>
                  {p.note && <p className="truncate text-[11px] text-muted-foreground">{p.note}</p>}
                </div>
                <span className="num shrink-0 text-xs text-muted-foreground">{shortDate(p.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FabButton
        label={t("تسجيل دفعة", "Record payment")}
        icon={<Wallet className="size-5" />}
        onClick={() => setPayOpen(true)}
      />

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>{t("تسجيل دفعة للمدرس", "Record teacher payment")}</DialogTitle>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>{t("تعديل معلومات المدرس", "Edit teacher")}</DialogTitle>
          </DialogHeader>
          <EditTeacherForm
            teacher={teacher as never}
            courses={courses as never}
            onDone={async () => {
              setEditOpen(false);
              await refetch();
              refresh("teachers");
            }}
          />
        </DialogContent>
      </Dialog>

      {/* delete warning */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="size-5" />
              {t("حذف المدرس نهائياً؟", "Delete teacher permanently?")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(
              `رح ينحذف «${teacher.name as string}» مع سجل دفعاته بالكامل، ورح تنفك المواد المرتبطة فيه من دون ما تنحذف. هالإجراء ما بينرجع عنه.`,
              `"${teacher.name as string}" and the full payment history will be deleted. Linked courses stay but will have no teacher. This cannot be undone.`,
            )}
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              {t("إلغاء", "Cancel")}
            </Button>
            <Button variant="destructive" onClick={deleteTeacher} disabled={deleting}>
              <Trash2 className="size-4" />
              {deleting ? t("جارٍ الحذف…", "Deleting…") : t("نعم، احذف المدرس", "Yes, delete teacher")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditTeacherForm({
  teacher,
  courses,
  onDone,
}: {
  teacher: {
    id: string;
    name: string;
    phone: string | null;
    course_id: string | null;
    teacher_courses?: { course_id: string }[] | null;
  };
  courses: { id: string; name: string }[];
  onDone: () => void;
}) {
  const { t } = usePrefs();
  const [form, setForm] = useState<{ name: string; phone: string; course_ids: string[] }>({
    name: teacher.name,
    phone: teacher.phone ?? "",
    course_ids:
      (teacher.teacher_courses ?? []).map((tc) => tc.course_id).length > 0
        ? (teacher.teacher_courses ?? []).map((tc) => tc.course_id)
        : teacher.course_id
          ? [teacher.course_id]
          : [],
  });

  const save = async () => {
    const { error } = await supabase
      .from("teachers")
      .update({ name: form.name, phone: form.phone || null })
      .eq("id", teacher.id);
    if (error) { toast.error(error.message); return; }

    // sync teacher_courses junction rows with the selection
    const { error: delError } = await supabase
      .from("teacher_courses")
      .delete()
      .eq("teacher_id", teacher.id);
    if (delError) { toast.error(delError.message); return; }
    if (form.course_ids.length > 0) {
      const { error: insError } = await supabase.from("teacher_courses").insert(
        form.course_ids.map((course_id) => ({ teacher_id: teacher.id, course_id })),
      );
      if (insError) { toast.error(insError.message); return; }
    }

    toast.success(t("تم التعديل", "Updated"));
    onDone();
  };

  return (
    <>
      <div className="space-y-3.5">
        <div className="space-y-1.5">
          <Label>{t("الاسم", "Name")}</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("رقم الهاتف", "Phone")}</Label>
          <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("المواد التي يدرّسها", "Courses they teach")}</Label>
          <CourseMultiSelect
            courses={courses}
            selected={form.course_ids}
            onChange={(ids) => setForm({ ...form, course_ids: ids })}
          />
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button onClick={save} size="lg" className="w-full">
          {t("حفظ", "Save")}
        </Button>
      </DialogFooter>
    </>
  );
}
