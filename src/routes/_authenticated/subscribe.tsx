import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstitute, useRefresh } from "@/hooks/useApp";
import { usePrefs } from "@/lib/i18n";
import { PLANS, type PlanId } from "@/lib/subscription";
import { usePricing, planPrice } from "@/lib/pricing";
import { money, shortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Upload, Check, QrCode, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/subscribe")({
  head: () => ({
    meta: [
      { title: "دفع الاشتراك — معهدي" },
      { name: "description", content: "اختر خطتك، ادفع عبر ShamCash، وارفع الإيصال ليراجعه الأدمن." },
      { property: "og:title", content: "دفع الاشتراك — معهدي" },
      { property: "og:description", content: "ادفع عبر ShamCash وارفع الإيصال ليراجعه الأدمن." },
    ],
  }),
  component: SubscribePage,
});

function SubscribePage() {
  const { t, lang } = usePrefs();
  const { data: institute } = useInstitute();
  const { data: pricing } = usePricing();
  const refresh = useRefresh();

  const [plan, setPlan] = useState<PlanId>("yearly");
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const myReceipts = useQuery({
    queryKey: ["my-receipts", institute?.id],
    enabled: !!institute?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const pending = (myReceipts.data ?? []).find((r) => r.status === "pending");

  const { data: qrUrl } = useQuery({
    queryKey: ["shamcash-qr"],
    queryFn: async () => {
      const { data: rows } = await supabase.rpc("get_payment_settings");
      const data = Array.isArray(rows) ? rows[0] : rows;

      const path = data?.shamcash_qr_url;
      if (!path) return null;
      const { data: signed } = await supabase.storage
        .from("app-assets")
        .createSignedUrl(path, 3600);
      return signed?.signedUrl ?? null;
    },
  });

  const upload = async (file: File) => {
    if (!institute) { toast.error(t("ما قدرنا نجيب بيانات معهدك، حدّث الصفحة وجرّب كمان مرة", "Could not load your institute, refresh and try again")); return; }
    setUploading(true);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user!.id;
    const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "")}`;
    const up = await supabase.storage.from("receipts").upload(path, file);
    if (up.error) {
      setUploading(false);
      { toast.error(up.error.message); return; }
    }

    const rec = await supabase.from("receipts").insert({
      institute_id: institute.id,
      user_email: userRes.user!.email ?? null,
      plan: plan,
      amount: planPrice(pricing, plan),
      months: PLANS[plan].months,
      image_url: path,
      status: "pending",
    });
    setUploading(false);
    if (rec.error) {
      const dup =
        rec.error.code === "23505" || /duplicate key|one_pending/i.test(rec.error.message);
      toast.error(
        dup
          ? t("عندك إيصال قيد المراجعة، انتظر رد الأدمن.", "You already have a receipt under review.")
          : rec.error.message,
      );
      myReceipts.refetch();
      return;
    }
    refresh("institute");
    myReceipts.refetch();
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <div className="animate-pop flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Clock className="size-8" />
        </div>
        <h1 className="mt-5 text-xl font-extrabold text-foreground">
          {t("وصلنا إيصالك — قيد مراجعة الأدمن", "Receipt received — pending admin review")}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {t(
            "رح ينفعّل اشتراكك مباشرة بعد ما يوافق الأدمن على الإيصال.",
            "Your subscription activates as soon as the admin approves the receipt.",
          )}
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/dashboard">{t("رجوع للداشبورد", "Back to dashboard")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10 lg:max-w-3xl">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"
      >
        <ChevronLeft className="size-4 icon-flip" /> {t("الداشبورد", "Dashboard")}
      </Link>
      <h1 className="text-xl font-extrabold text-foreground">{t("دفع الاشتراك", "Subscription")}</h1>

      {pending && (
        <div className="flex items-start gap-3 rounded-xl bg-primary/10 p-4 text-primary">
          <Clock className="mt-0.5 size-5 shrink-0" />
          <div className="text-xs leading-relaxed">
            <p className="font-bold">{t("إيصالك قيد المراجعة", "Your receipt is under review")}</p>
            <p className="opacity-80">
              {t(
                "ما فيك ترفع إيصال جديد قبل ما يبت الأدمن بالطلب الحالي.",
                "You can't submit another receipt until the admin reviews this one.",
              )}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {(Object.keys(PLANS) as PlanId[]).map((p) => {
          const info = PLANS[p];
          const selected = plan === p;
          const best = p === "yearly";
          return (
            <button
              key={p}
              onClick={() => setPlan(p)}
              className={`relative rounded-xl p-5 text-start shadow-soft transition-colors ${
                selected ? "bg-primary/5 ring-2 ring-primary" : "bg-card"
              }`}
            >
              {best && (
                <span className="absolute -top-2.5 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground ltr:right-4 rtl:left-4">
                  {t("الأوفر", "Best value")}
                </span>
              )}
              <p className="text-sm font-bold text-foreground">
                {lang === "ar" ? info.ar : info.en}
              </p>
              <p className="num mt-1 text-3xl font-extrabold text-primary">
                ${money(planPrice(pricing, p))}
              </p>
            </button>
          );
        })}
      </div>

      <section className="space-y-3 rounded-xl bg-card p-5 shadow-soft">
        <p className="text-sm font-bold text-foreground">{t("الدفع عبر ShamCash", "Pay via ShamCash")}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t(
            "صوّر الـ QR، افتح ShamCash، ادفع المبلغ.",
            "Scan the QR, open ShamCash, and pay the amount.",
          )}
        </p>
        <div className="flex items-center justify-center rounded-xl bg-muted p-4">
          {qrUrl ? (
            <img src={qrUrl} alt={t("رمز ShamCash للدفع", "ShamCash payment QR code")} className="max-h-64 rounded-lg" />
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <QrCode className="size-8" />
              <p className="text-xs">{t("رمز الدفع غير متوفر حالياً", "QR not available yet")}</p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-xl bg-card p-5 shadow-soft">
        <p className="text-sm font-bold text-foreground">{t("ارفع صورة الإيصال", "Upload your receipt")}</p>
        <label
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/50 px-4 py-8 text-center ${
            pending ? "pointer-events-none opacity-50" : "cursor-pointer"
          }`}
        >
          <Upload className="size-6 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            {uploading ? t("جاري الرفع…", "Uploading…") : t("اختر صورة الإيصال", "Choose receipt image")}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading || !!pending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
        </label>
        <p className="text-[11px] text-muted-foreground">
          {t(
            "بعد الرفع بيراجع الأدمن الإيصال ويوافق عليه، وبعدها بيتفعّل الاشتراك.",
            "After upload the admin reviews and approves it, then your subscription activates.",
          )}
        </p>
      </section>

      {(myReceipts.data?.length ?? 0) > 0 && (
        <section className="space-y-3 rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm font-bold text-foreground">{t("طلباتي السابقة", "My requests")}</p>
          <ul className="space-y-2">
            {myReceipts.data!.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="num text-xs text-muted-foreground">
                  ${money(r.amount)} · {shortDate(r.created_at)}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                    r.status === "confirmed"
                      ? "text-success"
                      : r.status === "cancelled"
                        ? "text-destructive"
                        : "text-primary"
                  }`}
                >
                  {r.status === "confirmed" ? (
                    <><Check className="size-3.5" /> {t("مقبول", "Approved")}</>
                  ) : r.status === "cancelled" ? (
                    <><XCircle className="size-3.5" /> {t("مرفوض", "Rejected")}</>
                  ) : (
                    <><Clock className="size-3.5" /> {t("قيد المراجعة", "Pending")}</>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
