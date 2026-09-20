import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إعادة تعيين كلمة السر — معهدي" },
      { name: "description", content: "عيّن كلمة سر جديدة لحسابك في معهدي بأمان." },
      { property: "og:title", content: "إعادة تعيين كلمة السر — معهدي" },
      { property: "og:description", content: "عيّن كلمة سر جديدة لحسابك في معهدي بأمان." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let done = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        done = true;
        setValid(true);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (done) return;
      setValid(Boolean(data.session));
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("كلمة السر لازم تكون ٨ أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      toast.error("كلمتا السر غير متطابقتين");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // إنهاء كل الجلسات القديمة بعد تغيير كلمة السر
      await supabase.auth.signOut({ scope: "global" });
      toast.success("تم تغيير كلمة السر. سجّل دخولك بالكلمة الجديدة.");
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(
        /weak|pwned|compromis|short/i.test(msg)
          ? "كلمة السر ضعيفة أو مسرّبة سابقاً. اختر كلمة أقوى."
          : "ما قدرنا نغيّر كلمة السر. اطلب رابط جديد وجرب مرة تانية.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm animate-rise rounded-2xl border border-border/70 bg-card p-6 shadow-lift">
        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="text-xl font-bold text-foreground">كلمة سر جديدة</h1>

        {!ready ? (
          <p className="mt-4 text-sm text-muted-foreground">لحظة…</p>
        ) : !valid ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              الرابط غير صالح أو انتهت صلاحيته. اطلب رابط إعادة تعيين جديد.
            </p>
            <Button className="mt-5 w-full" onClick={() => navigate({ to: "/auth" })}>
              رجوع لتسجيل الدخول
            </Button>
          </>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw">كلمة السر الجديدة</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
                <Input
                  id="pw"
                  type="password"
                  dir="ltr"
                  required
                  minLength={8}
                  className="ps-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw2">تأكيد كلمة السر</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
                <Input
                  id="pw2"
                  type="password"
                  dir="ltr"
                  required
                  minLength={8}
                  className="ps-9"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "لحظة…" : "حفظ كلمة السر"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
