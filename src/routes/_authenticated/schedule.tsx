import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCourses, useRefresh, useSections } from "@/hooks/useApp";
import { usePrefs } from "@/lib/i18n";
import { DAYS_AR, DAYS_EN, hhmm } from "@/lib/format";
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
import { CalendarDays, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "برنامج الدوام — معهدي" },
      { name: "description", content: "نظّم شعب معهدك وأيام وأوقات الدوام، وشوفها على الداشبورد." },
      { property: "og:title", content: "برنامج الدوام — معهدي" },
      { property: "og:description", content: "نظّم شعب معهدك وأيام وأوقات الدوام." },
    ],
  }),
  component: SchedulePage,
});

type Section = {
  id: string;
  name: string;
  course_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  courses: { id: string; name: string } | null;
};

const blank = { name: "", course_id: "", day_of_week: "0", start_time: "16:00", end_time: "17:30" };

function SchedulePage() {
  const { t, lang } = usePrefs();
  const { data: sections = [], isLoading } = useSections();
  const { data: courses = [] } = useCourses();
  const refresh = useRefresh();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const days = lang === "ar" ? DAYS_AR : DAYS_EN;

  const openNew = () => {
    setEditing(null);
    setForm({ ...blank, course_id: (courses[0]?.id as string) ?? "" });
    setOpen(true);
  };

  const openEdit = (s: Section) => {
    setEditing(s);
    setForm({
      name: s.name,
      course_id: s.course_id,
      day_of_week: String(s.day_of_week),
      start_time: hhmm(s.start_time),
      end_time: hhmm(s.end_time),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.course_id) { toast.error(t("اختر المادة", "Pick a course")); return; }
    if (!form.name.trim()) { toast.error(t("اسم الشعبة مطلوب", "Section name is required")); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      course_id: form.course_id,
      day_of_week: Number(form.day_of_week),
      start_time: form.start_time,
      end_time: form.end_time,
    };
    const { error } = editing
      ? await supabase.from("sections").update(payload).eq("id", editing.id)
      : await supabase.from("sections").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? t("تم التعديل", "Updated") : t("تمت إضافة الشعبة", "Section added"));
    setOpen(false);
    refresh("sections", "courses");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("sections").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh("sections", "courses");
  };

  const list = sections as unknown as Section[];
  const grouped = days.map((_, i) => ({ day: i, items: list.filter((s) => s.day_of_week === i) }));

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-xl font-extrabold text-foreground">{t("برنامج الدوام", "Schedule")}</h1>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("جاري التحميل…", "Loading…")}</p>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-6" />}
          title={t("لسا ما في برنامج دوام", "No schedule yet")}
          description={t(
            "أضف أول شعبة (مادة + يوم + وقت) وبتطلعلك مباشرة على داشبورد اليوم.",
            "Add your first section and it shows up on today's dashboard.",
          )}
          actionLabel={t("أضف شعبة", "Add section")}
          onAction={openNew}
        />
      ) : (
        <div className="space-y-4">
          {grouped
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <section key={g.day}>
                <h2 className="mb-2 text-xs font-bold text-muted-foreground">{days[g.day]}</h2>
                <ul className="space-y-2">
                  {g.items.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-card p-4 shadow-soft"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{s.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.courses?.name}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="num text-xs font-semibold text-primary" dir="ltr">
                          {hhmm(s.start_time)}–{hhmm(s.end_time)}
                        </span>
                        <button onClick={() => openEdit(s)} className="rounded-lg p-2 text-muted-foreground">
                          <Pencil className="size-4" />
                        </button>
                        <button onClick={() => remove(s.id)} className="rounded-lg p-2 text-destructive">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}

      {list.length > 0 && <FabButton label={t("أضف شعبة", "Add section")} onClick={openNew} />}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("تعديل الشعبة", "Edit section") : t("شعبة جديدة", "New section")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label>{t("اسم الشعبة", "Section name")}</Label>
              <Input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("رياضيات - شعبة أ", "Math - Section A")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("المادة", "Course")}</Label>
              <select
                value={form.course_id}
                onChange={(e) => setForm({ ...form, course_id: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("اختر مادة", "Select course")}</option>
                {courses.map((c) => (
                  <option key={c.id as string} value={c.id as string}>
                    {c.name as string}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("اليوم", "Day")}</Label>
              <select
                value={form.day_of_week}
                onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {days.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("من", "From")}</Label>
                <Input
                  dir="ltr"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("إلى", "To")}</Label>
                <Input
                  dir="ltr"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                />
              </div>
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
