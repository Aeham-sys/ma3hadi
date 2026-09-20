import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitute, useIsAdmin, useRefresh } from "@/hooks/useApp";
import { usePrefs } from "@/lib/i18n";
import { resolveSubscription } from "@/lib/subscription";
import { shortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { buildReminderMessage, DEFAULT_REMINDER_TEMPLATE } from "@/lib/reminder";
import { ChevronLeft, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — معهدي" },
      { name: "description", content: "اسم المعهد، اللغة، الوضع الليلي، وحالة الاشتراك." },
      { property: "og:title", content: "الإعدادات — معهدي" },
      { property: "og:description", content: "اسم المعهد، اللغة، الوضع الليلي، وحالة الاشتراك." },
    ],
  }),
  component: SettingsPage,
});

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  trial: { ar: "تجربة مجانية", en: "Trial" },
  active: { ar: "اشتراك فعّال", en: "Active" },
  grace: { ar: "فترة سماح", en: "Grace period" },
  expired: { ar: "منتهي", en: "Expired" },
  cancelled: { ar: "ملغى", en: "Cancelled" },
};

function SettingsPage() {
  const { t, lang, setLang, theme, setTheme } = usePrefs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: institute } = useInstitute();
  const { data: isAdmin } = useIsAdmin();
  const refresh = useRefresh();
  const sub = resolveSubscription(institute);

  const [name, setName] = useState(institute?.name ?? "");
  const [phone, setPhone] = useState(institute?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState(institute?.reminder_template ?? DEFAULT_REMINDER_TEMPLATE);
  const [savingTpl, setSavingTpl] = useState(false);

  const saveTemplate = async () => {
    if (!institute) { toast.error(t("ما قدرنا نجيب بيانات معهدك، حدّث الصفحة وجرّب كمان مرة", "Could not load your institute, refresh and try again")); return; }
    setSavingTpl(true);
    const { error } = await supabase
      .from("institutes")
      .update({ reminder_template: template })
      .eq("id", institute.id);
    setSavingTpl(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("انحفظت رسالة التذكير", "Reminder message saved"));
    refresh("institute");
  };

  const saveName = async () => {
    if (!institute) { toast.error(t("ما قدرنا نجيب بيانات معهدك، حدّث الصفحة وجرّب كمان مرة", "Could not load your institute, refresh and try again")); return; }
    setSaving(true);
    const { error } = await supabase
      .from("institutes")
      .update({ name, phone: phone || null })
      .eq("id", institute.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("انحفظ اسم المعهد", "Institute name saved"));
    refresh("institute");
  };

  const persistPref = async (patch: { language?: string; theme?: string }) => {
    if (!institute) { toast.error(t("ما قدرنا نجيب بيانات معهدك، حدّث الصفحة وجرّب كمان مرة", "Could not load your institute, refresh and try again")); return; }
    await supabase.from("institutes").update(patch).eq("id", institute.id);
    refresh("institute");
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="space-y-4 pb-10">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"
      >
        <ChevronLeft className="size-4 icon-flip" /> {t("الداشبورد", "Dashboard")}
      </Link>
      <h1 className="text-xl font-extrabold text-foreground">{t("الإعدادات", "Settings")}</h1>

      <section className="space-y-3 rounded-xl bg-card p-5 shadow-soft">
        <Label>{t("اسم المعهد", "Institute name")}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <Label>{t("رقم الهاتف (للتواصل مع الإدارة)", "Phone number (for support)")}</Label>
        <Input className="num" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxx" />
        <Button onClick={saveName} disabled={saving} className="w-full">
          {saving ? t("لحظة…", "Saving…") : t("حفظ", "Save")}
        </Button>
      </section>

      <section className="space-y-3 rounded-xl bg-card p-5 shadow-soft">
        <Label>{t("رسالة تذكير الحساب (واتساب)", "Payment reminder message (WhatsApp)")}</Label>
        <Textarea
          rows={5}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder={DEFAULT_REMINDER_TEMPLATE}
        />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t(
            "المتغيرات: {student} اسم الطالب · {institute} اسم المعهد · {amount} المبلغ المستحق (يُحسب تلقائياً) · {due} إجمالي المواد · {paid} المدفوع",
            "Variables: {student} · {institute} · {amount} (auto-calculated) · {due} · {paid}",
          )}
        </p>
        <div className="rounded-xl bg-muted/60 p-3">
          <p className="text-[11px] font-bold text-muted-foreground">{t("معاينة", "Preview")}</p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">
            {buildReminderMessage(template, {
              student: t("أحمد", "Ahmad"),
              institute: institute?.name ?? "",
              amount: 75000,
              due: 150000,
              paid: 75000,
            })}
          </p>
        </div>
        <Button onClick={saveTemplate} disabled={savingTpl} className="w-full">
          {savingTpl ? t("لحظة…", "Saving…") : t("حفظ الرسالة", "Save message")}
        </Button>
      </section>

      <section className="space-y-4 rounded-xl bg-card p-5 shadow-soft">
        <div>
          <p className="text-sm font-bold text-foreground">{t("اللغة", "Language")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["ar", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => {
                  setLang(l);
                  persistPref({ language: l });
                }}
                className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  lang === l ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {l === "ar" ? "العربية" : "English"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            <p className="text-sm font-bold text-foreground">{t("الوضع الليلي", "Dark mode")}</p>
            <p className="text-xs text-muted-foreground">
              {t("مريح للعين بالليل", "Easier on the eyes at night")}
            </p>
          </div>
          <Switch
            checked={theme === "dark"}
            onCheckedChange={(v) => {
              const th = v ? "dark" : "light";
              setTheme(th);
              persistPref({ theme: th });
            }}
          />
        </div>
      </section>

      <section className="space-y-2 rounded-xl bg-card p-5 shadow-soft">
        <p className="text-sm font-bold text-foreground">{t("الاشتراك", "Subscription")}</p>
        <p className="text-xs text-muted-foreground">
          {t("الحالة", "Status")}:{" "}
          <span className="font-bold text-primary">
            {lang === "ar" ? STATUS_LABELS[sub.state]?.ar : STATUS_LABELS[sub.state]?.en}
          </span>
        </p>
        {institute?.subscription_end && (
          <p className="num text-xs text-muted-foreground">
            {t("ينتهي بتاريخ", "Ends on")}: {shortDate(institute.subscription_end)}
          </p>
        )}
        <Button asChild variant="outline" className="mt-2 w-full">
          <Link to="/subscribe">{t("إدارة الاشتراك", "Manage subscription")}</Link>
        </Button>
      </section>

      {isAdmin && (
        <Button asChild variant="outline" className="w-full">
          <Link to="/admin">
            <ShieldCheck className="size-4" />
            {t("لوحة المؤسس", "Founder panel")}
          </Link>
        </Button>
      )}

      <Button variant="ghost" onClick={signOut} className="w-full text-destructive">
        <LogOut className="size-4 icon-flip" />
        {t("تسجيل الخروج", "Sign out")}
      </Button>
    </div>
  );
}
