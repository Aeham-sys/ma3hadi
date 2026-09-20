import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useApp";
import { usePrefs } from "@/lib/i18n";
import { money, shortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, Upload, ShieldCheck, Users, Clock, Check, XCircle, Phone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "لوحة الأدمن — معهدي" },
      { name: "description", content: "مراجعة إيصالات الاشتراك، إدارة المستخدمين، رمز ShamCash والأسعار." },
      { property: "og:title", content: "لوحة الأدمن — معهدي" },
      { property: "og:description", content: "مراجعة الإيصالات وإدارة المستخدمين والأسعار." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Tab = "pending" | "all" | "confirmed" | "cancelled";

const STATUS_META: Record<string, { ar: string; en: string; cls: string }> = {
  pending: { ar: "قيد المراجعة", en: "Pending", cls: "text-primary" },
  confirmed: { ar: "مقبول", en: "Approved", cls: "text-success" },
  cancelled: { ar: "مرفوض/ملغى", en: "Rejected", cls: "text-destructive" },
};

function AdminPage() {
  const { t, lang } = usePrefs();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin();
  const [tab, setTab] = useState<Tab>("pending");
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [monthly, setMonthly] = useState("");
  const [yearly, setYearly] = useState("");
  const [savingPrices, setSavingPrices] = useState(false);
  const [search, setSearch] = useState("");

  const receipts = useQuery({
    queryKey: ["admin-receipts"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select("*, institutes:institute_id(id,name,phone,owner_email,subscription_status,subscription_end)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const users = useQuery({
    queryKey: ["admin-users"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institutes")
        .select("id,name,phone,owner_email,subscription_status,subscription_end,trial_end,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const settings = useQuery({
    queryKey: ["admin-settings"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      if (data) {
        setMonthly(String(data.price_monthly ?? ""));
        setYearly(String(data.price_yearly ?? ""));
      }
      return data;
    },
  });

  if (roleLoading) {
    return <p className="text-sm text-muted-foreground">{t("جاري التحقق…", "Checking access…")}</p>;
  }

  if (!isAdmin) {
    return (
      <div className="rounded-xl bg-card p-8 text-center shadow-soft">
        <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold text-foreground">
          {t("هالصفحة للأدمن فقط", "Admin access only")}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/dashboard">{t("رجوع", "Back")}</Link>
        </Button>
      </div>
    );
  }

  const uploadQr = async (file: File) => {
    setUploading(true);
    const path = `shamcash/qr-${Date.now()}-${file.name.replace(/[^\w.-]/g, "")}`;
    const up = await supabase.storage.from("app-assets").upload(path, file);
    if (up.error) {
      setUploading(false);
      { toast.error(up.error.message); return; }
    }
    const existing = settings.data;
    const { error } = existing
      ? await supabase.from("admin_settings").update({ shamcash_qr_url: path }).eq("id", existing.id)
      : await supabase.from("admin_settings").insert({ id: 1, shamcash_qr_url: path });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("انحفظ رمز الدفع", "QR saved"));
    settings.refetch();
  };

  const savePrices = async () => {
    setSavingPrices(true);
    const patch = { price_monthly: Number(monthly || 0), price_yearly: Number(yearly || 0) };
    const { error } = settings.data
      ? await supabase.from("admin_settings").update(patch).eq("id", settings.data.id)
      : await supabase.from("admin_settings").insert({ id: 1, ...patch });
    setSavingPrices(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("انحفظت الأسعار", "Prices saved"));
    settings.refetch();
  };

  const openImage = async (path: string) => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 600);
    if (data?.signedUrl) setPreview(data.signedUrl);
  };

  const approve = async (r: { id: string }) => {
    if (busy) return;
    setBusy(r.id);
    const { error } = await supabase.rpc("approve_receipt", { p_receipt_id: r.id });
    setBusy(null);
    if (error) { toast.error(error.message); receipts.refetch(); return; }
    toast.success(t("تمت الموافقة وتفعيل الاشتراك", "Approved and activated"));
    receipts.refetch();
    users.refetch();
  };

  const reject = async (receiptId: string) => {
    if (busy) return;
    setBusy(receiptId);
    const { error } = await supabase.rpc("reject_receipt", { p_receipt_id: receiptId });
    setBusy(null);
    if (error) { toast.error(error.message); receipts.refetch(); return; }
    toast.success(t("تم رفض الإيصال", "Receipt rejected"));
    receipts.refetch();
  };

  const grant = async (
    u: { id: string; subscription_end: string | null },
    opts: { days?: number; months?: number },
  ) => {
    if (busy) return;
    setBusy(u.id);
    const { error } = await supabase.rpc("admin_adjust_subscription", {
      p_institute_id: u.id,
      p_days: opts.days ?? 0,
      p_months: opts.months ?? 0,
      p_cancel: false,
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(t("تم تمديد الاشتراك", "Subscription extended"));
    users.refetch();
  };

  const cancelUser = async (id: string) => {
    if (busy) return;
    setBusy(id);
    const { error } = await supabase.rpc("admin_adjust_subscription", {
      p_institute_id: id,
      p_days: 0,
      p_months: 0,
      p_cancel: true,
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(t("تم إلغاء الاشتراك", "Subscription cancelled"));
    users.refetch();
  };

  const rows = (receipts.data ?? []).filter((r) => (tab === "all" ? true : r.status === tab));
  const pendingCount = (receipts.data ?? []).filter((r) => r.status === "pending").length;
  const q = search.trim().toLowerCase();
  const userRows = (users.data ?? []).filter(
    (u) =>
      !q ||
      (u.name ?? "").toLowerCase().includes(q) ||
      (u.phone ?? "").toLowerCase().includes(q) ||
      (u.owner_email ?? "").toLowerCase().includes(q),
  );

  return (
    <div className="space-y-4 pb-10">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"
      >
        <ChevronLeft className="size-4 icon-flip" /> {t("الداشبورد", "Dashboard")}
      </Link>
      <h1 className="text-xl font-extrabold text-foreground">{t("لوحة الأدمن", "Admin panel")}</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-xs text-muted-foreground">{t("إيصالات قيد المراجعة", "Pending receipts")}</p>
          <p className="num mt-1 text-2xl font-extrabold text-primary">{pendingCount}</p>
        </div>
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-xs text-muted-foreground">{t("عدد المستخدمين", "Users")}</p>
          <p className="num mt-1 text-2xl font-extrabold text-foreground">{users.data?.length ?? 0}</p>
        </div>
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-xs text-muted-foreground">{t("اشتراكات فعّالة", "Active subs")}</p>
          <p className="num mt-1 text-2xl font-extrabold text-success">
            {(users.data ?? []).filter((u) => u.subscription_status === "active").length}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm font-bold text-foreground">{t("رمز ShamCash للمستخدمين", "ShamCash QR for users")}</p>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/50 px-4 py-6 text-center">
            <Upload className="size-5 text-primary" />
            <span className="text-xs font-semibold">
              {uploading
                ? t("جاري الرفع…", "Uploading…")
                : settings.data?.shamcash_qr_url
                  ? t("استبدل الرمز الحالي", "Replace current QR")
                  : t("ارفع رمز الدفع", "Upload payment QR")}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadQr(f);
              }}
            />
          </label>
        </section>

        <section className="space-y-3 rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm font-bold text-foreground">{t("سعر الاشتراك", "Subscription pricing")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("شهري ($)", "Monthly ($)")}</Label>
              <Input className="num" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("سنوي ($)", "Yearly ($)")}</Label>
              <Input className="num" inputMode="decimal" value={yearly} onChange={(e) => setYearly(e.target.value)} />
            </div>
          </div>
          <Button onClick={savePrices} disabled={savingPrices} className="w-full">
            {savingPrices ? t("لحظة…", "Saving…") : t("حفظ الأسعار", "Save prices")}
          </Button>
        </section>
      </div>

      <section className="space-y-3 rounded-xl bg-card p-5 shadow-soft">
        <p className="text-sm font-bold text-foreground">{t("مراجعة الإيصالات", "Receipt review")}</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["pending", t("قيد المراجعة", "Pending")],
              ["confirmed", t("مقبول", "Approved")],
              ["cancelled", t("مرفوض", "Rejected")],
              ["all", t("الكل", "All")],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                tab === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("ما في إيصالات هون.", "No receipts here.")}
          </p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {rows.map((r) => {
              const inst = r.institutes as {
                name: string;
                phone: string | null;
                owner_email: string | null;
                subscription_end: string | null;
              } | null;
              const meta = STATUS_META[r.status] ?? STATUS_META['pending']!;
              return (
                <li key={r.id} className="rounded-xl bg-muted/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{inst?.name ?? "—"}</p>
                      <p className="num truncate text-xs text-muted-foreground">
                        {inst?.phone || inst?.owner_email || r.user_email || "—"}
                      </p>
                      <p className="num truncate text-xs text-muted-foreground">
                        {r.plan} · ${money(r.amount)} · {shortDate(r.created_at)}
                      </p>
                      <p className={`mt-1 text-[11px] font-bold ${meta.cls}`}>
                        {lang === "ar" ? meta.ar : meta.en}
                      </p>
                    </div>
                    <button
                      onClick={() => openImage(r.image_url)}
                      className="shrink-0 rounded-lg bg-card px-3 py-2 text-xs font-semibold"
                    >
                      {t("صورة الإيصال", "View receipt")}
                    </button>
                  </div>
                  {r.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={busy === r.id}
                        onClick={() => approve({ id: r.id })}
                      >
                        <Check className="size-4" /> {t("موافقة وتفعيل", "Approve")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        disabled={busy === r.id}
                        onClick={() => reject(r.id)}
                      >
                        <XCircle className="size-4" /> {t("رفض", "Reject")}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-xl bg-card p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-primary" />
          <p className="text-sm font-bold text-foreground">{t("المستخدمون", "Users")}</p>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("ابحث بالاسم أو الرقم", "Search by name or phone")}
        />
        {userRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("ما في مستخدمين.", "No users.")}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {userRows.map((u) => (
              <li key={u.id} className="rounded-xl bg-muted/50 p-4">
                <p className="truncate text-sm font-bold text-foreground">{u.name}</p>
                <p className="num flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Phone className="size-3" /> {u.phone || t("ما في رقم", "No phone")}
                </p>
                <p className="truncate text-xs text-muted-foreground">{u.owner_email ?? "—"}</p>
                <p className="num mt-1 text-[11px] font-semibold text-primary">
                  {u.subscription_status}
                  {u.subscription_end ? ` · ${shortDate(u.subscription_end)}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => grant(u, { days: 7 })}>
                    <Clock className="size-4" /> {t("+7 أيام", "+7 days")}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => grant(u, { months: 1 })}>
                    {t("+شهر", "+1 month")}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => grant(u, { months: 12 })}>
                    {t("+سنة", "+1 year")}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" disabled={busy === u.id} onClick={() => cancelUser(u.id)}>
                    {t("إلغاء", "Cancel")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="rounded-xl p-2">
          {preview && <img src={preview} alt={t("صورة الإيصال", "Receipt image")} className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
