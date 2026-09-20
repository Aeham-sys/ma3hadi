import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitute, useIsAdmin } from "@/hooks/useApp";
import { resolveSubscription } from "@/lib/subscription";
import { usePrefs } from "@/lib/i18n";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  CalendarDays,
  Settings,
  ShieldCheck,
  LogOut,
  Lock,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PhoneGate } from "@/components/PhoneGate";
import { InstallAppButton } from "@/components/InstallAppButton";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppShell,
});

const NAV = [
  { to: "/dashboard", ar: "الداشبورد", en: "Dashboard", icon: LayoutDashboard },
  { to: "/students", ar: "الطلاب", en: "Students", icon: Users },
  { to: "/teachers", ar: "المدرسين", en: "Teachers", icon: GraduationCap },
  { to: "/courses", ar: "المواد", en: "Courses", icon: BookOpen },
  { to: "/schedule", ar: "برنامج الدوام", en: "Schedule", icon: CalendarDays },
] as const;

function AppShell() {
  const { t, lang } = usePrefs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: institute } = useInstitute();
  const { data: isAdmin } = useIsAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const sub = resolveSubscription(institute);

  const onPaymentPage = pathname.startsWith("/subscribe");
  const locked = sub.locked && !onPaymentPage && !isAdmin;

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const statusBadge = {
    trial: { ar: "تجربة", en: "Trial", cls: "bg-accent text-accent-foreground" },
    active: { ar: "مفعّل", en: "Active", cls: "bg-success/15 text-success" },
    grace: { ar: "مهلة", en: "Grace", cls: "bg-warning/20 text-warning-foreground" },
    expired: { ar: "منتهي", en: "Expired", cls: "bg-destructive/15 text-destructive" },
    cancelled: { ar: "ملغى", en: "Cancelled", cls: "bg-destructive/15 text-destructive" },
  }[sub.state];

  return (
    <div className="min-h-screen bg-background pb-20 lg:flex lg:pb-0">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-primary/15 bg-accent/50 px-3 py-5 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{institute?.name ?? "معهدي"}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("منصة إدارة المعهد", "Institute manager")}
            </p>
          </div>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4.5" />
                {lang === "ar" ? item.ar : item.en}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 space-y-1 border-t border-border pt-4">
          <button
            onClick={() => navigate({ to: "/settings" })}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="size-4.5" /> {t("الإعدادات", "Settings")}
          </button>
          <button
            onClick={() => navigate({ to: "/subscribe" })}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ShieldCheck className="size-4.5" /> {t("الاشتراك", "Subscription")}
          </button>
          {isAdmin && (
            <button
              onClick={() => navigate({ to: "/admin" })}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ShieldCheck className="size-4.5" /> {t("لوحة المؤسس", "Admin panel")}
            </button>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4.5 icon-flip" /> {t("تسجيل خروج", "Sign out")}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 lg:max-w-6xl lg:px-8 lg:py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
                <GraduationCap className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground lg:text-base">
                  {lang === "ar"
                    ? (NAV.find((n) => pathname.startsWith(n.to))?.ar ?? institute?.name ?? "معهدي")
                    : (NAV.find((n) => pathname.startsWith(n.to))?.en ?? institute?.name ?? "معهدي")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("منصة إدارة المعهد", "Institute manager")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <InstallAppButton />
              <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusBadge.cls}`}>
                {lang === "ar" ? statusBadge.ar : statusBadge.en}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={t("الإعدادات وقائمة الحساب", "Settings and account menu")}
                    className="flex size-9 items-center justify-center rounded-xl bg-muted text-foreground"
                  >
                    <Settings className="size-4.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={lang === "ar" ? "start" : "end"} className="w-48">
                  <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                    <Settings className="size-4" /> {t("الإعدادات", "Settings")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/subscribe" })}>
                    <ShieldCheck className="size-4" /> {t("الاشتراك", "Subscription")}
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
                      <ShieldCheck className="size-4" /> {t("لوحة المؤسس", "Admin panel")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="size-4 icon-flip" /> {t("تسجيل خروج", "Sign out")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {sub.banner && !locked && (
            <div
              className={`px-4 py-2 text-center text-xs font-semibold ${
                sub.banner.tone === "warn"
                  ? "bg-warning/20 text-warning-foreground"
                  : "bg-accent text-accent-foreground"
              }`}
            >
              <Link to="/subscribe" className="underline underline-offset-4">
                {lang === "ar" ? sub.banner.ar : sub.banner.en}
              </Link>
            </div>
          )}
        </header>

        <main
          className={`mx-auto max-w-3xl px-4 py-5 lg:max-w-6xl lg:px-8 lg:py-8 ${locked ? "locked-content" : ""}`}
        >
          <Outlet />
        </main>
      </div>

      {locked && (
        <div className="fixed inset-0 z-45 flex items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-xl bg-card p-7 text-center shadow-lift">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <Lock className="size-7" />
            </div>
            <h2 className="text-lg font-bold text-foreground">
              {t("انتهى اشتراكك", "Your subscription ended")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t(
                "جدد اشتراكك لتتابع إدارة طلابك ودفعاتك من جديد.",
                "Renew to continue managing your students and payments.",
              )}
            </p>
            <Button size="lg" className="mt-6 w-full" onClick={() => navigate({ to: "/subscribe" })}>
              {t("دفع الاشتراك", "Pay subscription")}
            </Button>
          </div>
        </div>
      )}

      <PhoneGate />

      <nav className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto max-w-3xl px-3 pb-3">
          <div className="flex items-stretch justify-between gap-1 rounded-2xl border border-primary/15 bg-accent/50 p-1.5 shadow-soft backdrop-blur-md">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition-all duration-200 ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <Icon
                    className={`size-5 transition-transform duration-200 ${
                      active ? "scale-110" : "opacity-70 group-active:scale-95"
                    }`}
                  />
                  <span className="w-full truncate text-center leading-tight">
                    {lang === "ar" ? item.ar : item.en}
                  </span>
                  <span
                    className={`absolute inset-x-4 -top-px h-0.5 rounded-full bg-primary transition-opacity duration-200 ${
                      active ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

    </div>
  );
}


