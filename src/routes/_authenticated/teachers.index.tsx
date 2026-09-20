import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCourses, useInstitute, useRefresh, useTeachers } from "@/hooks/useApp";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GraduationCap, Search, ChevronLeft } from "lucide-react";
import { CourseMultiSelect, teacherCourseNames } from "@/components/CourseMultiSelect";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teachers/")({
  head: () => ({
    meta: [
      { title: "المدرسين — معهدي" },
      { name: "description", content: "سجّل مدرسينك وتابع كل دفعة دفعتها لكل مدرس." },
      { property: "og:title", content: "المدرسين — معهدي" },
      { property: "og:description", content: "سجّل مدرسينك وتابع كل دفعة دفعتها لكل مدرس." },
    ],
  }),
  component: TeachersPage,
});

function TeachersPage() {
  const { t } = usePrefs();
  const { data: institute } = useInstitute();
  const { data: teachers = [], isLoading } = useTeachers();
  const { data: courses = [] } = useCourses();
  const refresh = useRefresh();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; phone: string; course_ids: string[] }>({
    name: "",
    phone: "",
    course_ids: [],
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!institute) { toast.error(t("ما قدرنا نجيب بيانات معهدك، حدّث الصفحة وجرّب كمان مرة", "Could not load your institute, refresh and try again")); return; }
    if (!form.name.trim()) { toast.error(t("اسم المدرس مطلوب", "Teacher name is required")); return; }
    setSaving(true);
    const { data: inserted, error } = await supabase
      .from("teachers")
      .insert({
        institute_id: institute.id,
        name: form.name.trim(),
        phone: form.phone || null,
        course_id: null,
      })
      .select("id")
      .single();
    if (!error && inserted && form.course_ids.length > 0) {
      const { error: linkError } = await supabase.from("teacher_courses").insert(
        form.course_ids.map((course_id) => ({ teacher_id: inserted.id as string, course_id })),
      );
      if (linkError) {
        setSaving(false);
        toast.error(linkError.message);
        return;
      }
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("تمت إضافة المدرس", "Teacher added"));
    setForm({ name: "", phone: "", course_ids: [] });
    setOpen(false);
    refresh("teachers");
  };

  const list = teachers.filter((x) =>
    (x.name as string).toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-xl font-extrabold text-foreground">{t("المدرسين", "Teachers")}</h1>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("دوّر على مدرس…", "Search teachers…")}
          className="h-11 rounded-xl bg-card ltr:pl-9 rtl:pr-9"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("جاري التحميل…", "Loading…")}</p>
      ) : teachers.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-6" />}
          title={t("لسا ما أضفت مدرسين", "No teachers yet")}
          description={t(
            "أضف مدرسينك لتتابع كل دفعة دفعتها إلهم، بدون دفتر ولا ورق.",
            "Add your teachers to log every payment you make to them.",
          )}
          actionLabel={t("أضف مدرس", "Add teacher")}
          onAction={() => setOpen(true)}
        />
      ) : (
        <ul className="space-y-3">
          {list.map((x) => {
            const paid = ((x.teacher_payments ?? []) as { amount: number }[]).reduce(
              (s, p) => s + Number(p.amount),
              0,
            );
            return (
              <li key={x.id as string}>
                <Link
                  to="/teachers/$id"
                  params={{ id: x.id as string }}
                  className="flex items-center justify-between gap-3 rounded-xl bg-card p-4 shadow-soft active:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{x.name as string}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {teacherCourseNames(x as never, t("بدون مادة", "No course"))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-end">
                      <p className="text-[10px] text-muted-foreground">{t("إجمالي المدفوع", "Paid")}</p>
                      <p className="num text-sm font-extrabold text-primary">{money(paid)}</p>
                    </div>
                    <ChevronLeft className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {teachers.length > 0 && (
        <FabButton label={t("أضف مدرس", "Add teacher")} onClick={() => setOpen(true)} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>{t("مدرس جديد", "New teacher")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label>{t("الاسم", "Name")}</Label>
              <Input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("رقم الهاتف", "Phone")}</Label>
              <Input
                dir="ltr"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("المواد التي يدرّسها (اختياري)", "Courses they teach (optional)")}</Label>
              <CourseMultiSelect
                courses={courses as never}
                selected={form.course_ids}
                onChange={(ids) => setForm({ ...form, course_ids: ids })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving} size="lg" className="w-full">
              {saving ? t("لحظة…", "Saving…") : t("حفظ", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
