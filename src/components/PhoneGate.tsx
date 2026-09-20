import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstitute, useRefresh } from "@/hooks/useApp";
import { usePrefs } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";

/** Institutes must have a contact phone; Google sign-ups don't provide one. */
export function PhoneGate() {
  const { t } = usePrefs();
  const { data: institute } = useInstitute();
  const refresh = useRefresh();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!institute || institute.phone || dismissed) return null;

  const save = async () => {
    const clean = phone.replace(/[^\d+]/g, "");
    if (clean.replace(/\D/g, "").length < 9) {
      toast.error(t("رقم الهاتف مطلوب ولازم يكون صحيح", "A valid phone number is required"));
      return;
    }
    setSaving(true);
    const patch: { phone: string; name?: string } = { phone: clean };
    if (name.trim()) patch.name = name.trim();
    const { error } = await supabase.from("institutes").update(patch).eq("id", institute.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("تم الحفظ", "Saved"));
    refresh("institute");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-5 backdrop-blur-sm">
      <div className="w-full max-w-sm animate-rise rounded-2xl border border-border/70 bg-card p-6 shadow-lift">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Phone className="size-6" />
        </div>
        <h2 className="text-center text-lg font-bold text-foreground">
          {t("أكمل بيانات معهدك", "Complete your institute details")}
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
          {t(
            "يفضل إضافة رقم هاتف المعهد لنتواصل معك بخصوص الاشتراك والدعم.",
            "Adding a contact phone is preferred for subscription and support.",
          )}
        </p>
        <div className="mt-5 space-y-3">
          <Label htmlFor="gate-name">{t("اسم المعهد", "Institute name")}</Label>
          <Input
            id="gate-name"
            value={name || institute.name}
            onChange={(e) => setName(e.target.value)}
          />
          <Label htmlFor="gate-phone">{t("رقم الهاتف", "Phone number")}</Label>
          <Input
            id="gate-phone"
            className="num"
            dir="ltr"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09xxxxxxxx"
          />
          <Button className="w-full" size="lg" onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? t("لحظة…", "Saving…") : t("حفظ ومتابعة", "Save and continue")}
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="w-full text-center text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("تذكيري لاحقاً", "Remind me later")}
          </button>
        </div>
      </div>
    </div>
  );
}
