import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  GraduationCap,
  Mail,
  Lock,
  Phone,
  Building2,
  Wallet,
  CalendarDays,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — معهدي" },
      { name: "description", content: "سجل دخولك لإدارة طلاب ومدرسي ومواد معهدك." },
      { property: "og:title", content: "تسجيل الدخول — معهدي" },
      { property: "og:description", content: "سجل دخولك لإدارة طلاب ومدرسي ومواد معهدك." },
    ],
  }),
  component: AuthPage,
});

const PERKS = [
  { icon: Wallet, ar: "متابعة الدفعات والرصيد المستحق لحظياً" },
  { icon: CalendarDays, ar: "برنامج دوام مرتب لكل مادة وشعبة" },
];

// موحّد دائماً: ما منكشف إذا البريد موجود أو لأ (منع Account Enumeration)
const GENERIC_CREDENTIALS_ERROR = "البريد الإلكتروني أو كلمة السر غير صحيحة";
const GENERIC_RESET_MESSAGE =
  "إذا كان هذا البريد مسجّلاً عندنا، رح يوصلك رابط إعادة تعيين كلمة السر خلال دقائق.";
const GENERIC_SIGNUP_MESSAGE =
  "تمام! إذا كان البريد متاحاً رح يوصلك رابط تأكيد. أكّد بريدك وبعدها سجّل دخولك.";

// تهدئة محلية لمحاولات الدخول المتكررة (طبقة إضافية فوق حدود الخادم)
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 60_000;

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [instituteName, setInstituteName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  async function signInWithGoogle() {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) {
        toast.error("تعذّر تسجيل الدخول عبر غوغل، جرّب مرة تانية");
        setGoogleLoading(false);
      }
    } catch {
      toast.error("تعذّر تسجيل الدخول عبر غوغل، جرّب مرة تانية");
      setGoogleLoading(false);
    }
  }
  const attempts = useRef(0);
  const blockedUntil = useRef(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((blockedUntil.current - Date.now()) / 1000));
      setCooldownLeft(left);
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownLeft]);

  const startCooldown = () => {
    blockedUntil.current = Date.now() + COOLDOWN_MS;
    attempts.current = 0;
    setCooldownLeft(Math.ceil(COOLDOWN_MS / 1000));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Date.now() < blockedUntil.current) {
      toast.error(`محاولات كتيرة. جرب بعد ${cooldownLeft} ثانية.`);
      return;
    }
    setLoading(true);
    try {
      if (mode === "forgot") {
        await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        // نفس الرسالة دائماً حتى لو البريد غير موجود
        toast.success(GENERIC_RESET_MESSAGE);
        setMode("login");
        return;
      }

      if (mode === "signup") {
        const cleanPhone = phone.replace(/[^\d+]/g, "");
        if (cleanPhone && cleanPhone.replace(/\D/g, "").length < 9) {
          toast.error("رقم هاتف المعهد غير صحيح");
          return;
        }
        if (password.length < 8) {
          toast.error("كلمة السر لازم تكون ٨ أحرف على الأقل");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { institute_name: instituteName || "معهدي", phone: cleanPhone || null },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success(GENERIC_SIGNUP_MESSAGE);
          setMode("login");
          setPassword("");
          return;
        }
        navigate({ to: "/dashboard", replace: true });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        attempts.current += 1;
        if (attempts.current >= MAX_ATTEMPTS) startCooldown();
        const rateLimited = /rate|too many|429/i.test(error.message);
        toast.error(
          rateLimited
            ? "محاولات كتيرة خلال وقت قصير. استنى شوي وجرب مرة تانية."
            : GENERIC_CREDENTIALS_ERROR,
        );
        return;
      }
      attempts.current = 0;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(
        /rate|too many|429/i.test(msg)
          ? "محاولات كتيرة خلال وقت قصير. استنى شوي وجرب مرة تانية."
          : mode === "signup"
            ? "ما قدرنا نكمل الطلب. تأكد من البيانات وجرب مرة تانية."
            : GENERIC_CREDENTIALS_ERROR,
      );
    } finally {
      setLoading(false);
    }
  };

  const submitLabel =
    mode === "login" ? "دخول" : mode === "signup" ? "ابدأ التجربة المجانية" : "إرسال رابط الاستعادة";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute -top-32 -start-24 size-80 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -end-24 size-96 rounded-full bg-accent/60 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-10 px-5 py-10 lg:flex-row lg:items-center lg:gap-16">
        {/* Brand / value side */}
        <div className="mx-auto w-full max-w-sm text-center animate-rise lg:mx-0 lg:max-w-md lg:text-start">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lift lg:mx-0">
            <GraduationCap className="size-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground lg:text-4xl">
            معهدي — نظام إدارة المعاهد التعليمية
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground lg:text-base">
            طلابك، مدرسينك، ودفعاتك — كلها بمكان واحد، بدون دفاتر ولا إكسل.
          </p>
          <ul className="mt-6 hidden space-y-3 lg:block">
            {PERKS.map((p) => (
              <li key={p.ar} className="flex items-center gap-3 text-sm text-foreground">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <p.icon className="size-4.5" />
                </span>
                {p.ar}
              </li>
            ))}
          </ul>
        </div>

        {/* Form card */}
        <div className="mx-auto w-full max-w-sm animate-rise lg:mx-0">
          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-lift">
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-lg py-2 text-sm font-semibold transition-all ${
                    mode === m ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
                  }`}
                >
                  {m === "login" ? "تسجيل دخول" : "حساب جديد"}
                </button>
              ))}
            </div>

            {mode === "forgot" && (
              <p className="mb-4 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                اكتب بريدك ومنبعتلك رابط لإعادة تعيين كلمة السر. الرابط صالح لفترة قصيرة ولمرة وحدة.
              </p>
            )}

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <Field id="inst" label="اسم المعهد" icon={Building2}>
                    <Input
                      id="inst"
                      className="ps-9"
                      value={instituteName}
                      onChange={(e) => setInstituteName(e.target.value)}
                      placeholder="معهد النور"
                    />
                  </Field>
                  <Field id="phone" label="رقم هاتف المعهد (اختياري)" icon={Phone}>
                    <Input
                      id="phone"
                      className="num ps-9"
                      inputMode="tel"
                      dir="ltr"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="09xxxxxxxx"
                    />
                  </Field>
                </>
              )}
              <Field id="email" label="البريد الإلكتروني" icon={Mail}>
                <Input
                  id="email"
                  type="email"
                  required
                  dir="ltr"
                  className="ps-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              {mode !== "forgot" && (
                <Field id="password" label="كلمة السر" icon={Lock}>
                  <Input
                    id="password"
                    type="password"
                    required
                    dir="ltr"
                    minLength={mode === "signup" ? 8 : 6}
                    className="ps-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
              )}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading || cooldownLeft > 0}
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {cooldownLeft > 0
                  ? `جرب بعد ${cooldownLeft} ثانية`
                  : loading
                    ? "لحظة…"
                    : submitLabel}
              </Button>
            </form>

            {mode !== "forgot" && (
              <>
                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-medium text-muted-foreground">أو</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={googleLoading || loading}
                  onClick={signInWithGoogle}
                >
                  {googleLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <GoogleMark className="size-4" />
                  )}
                  المتابعة عبر غوغل
                </Button>
              </>
            )}


            <div className="mt-4 text-center">
              {mode === "forgot" ? (
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  رجوع لتسجيل الدخول
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  نسيت كلمة السر؟
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.1 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.6 6.9l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16.4z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.8-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.4-4.6 2.2-8.8 2.2-6.3 0-11.7-3.6-13.6-9.2l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}



function Field({
  id,
  label,
  icon: Icon,
  children,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
        {children}
      </div>
    </div>
  );
}
