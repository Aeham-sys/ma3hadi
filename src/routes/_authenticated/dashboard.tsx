import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCourses, useInstitute, useSections, useStudents, studentBalance } from "@/hooks/useApp";
import { usePrefs } from "@/lib/i18n";
import { money, hhmm, shortDate, DAYS_AR, DAYS_EN, METHOD_LABELS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpLeft,
  BookOpen,
  CalendarClock,
  CalendarPlus,
  Check,
  CircleDollarSign,
  Clock3,
  CreditCard,
  ReceiptText,
  TrendingUp,
  UserRoundPlus,
  Users,
  WalletCards,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "الداشبورد — معهدي" },
      { name: "description", content: "نظرة سريعة على دوام اليوم، المستحقات المتأخرة، والدفعات الأخيرة." },
      { property: "og:title", content: "الداشبورد — معهدي" },
      { property: "og:description", content: "دوام اليوم، المستحقات، والدفعات الأخيرة بمكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { t, lang } = usePrefs();
  const navigate = useNavigate();
  const { data: institute } = useInstitute();
  const { data: students = [] } = useStudents();
  const { data: sections = [] } = useSections();
  const { data: courses = [] } = useCourses();

  const { data: recent } = useQuery({
    queryKey: ["recent-feed"],
    queryFn: async () => {
      const [studentPayments, teacherPayments] = await Promise.all([
        supabase
          .from("payments")
          .select("id, amount, date, method, students(name)")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("teacher_payments")
          .select("id, amount, date, teachers(name)")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      return { student: studentPayments.data ?? [], teacher: teacherPayments.data ?? [] };
    },
  });

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const { data: monthly = { current: 0, previous: 0 } } = useQuery({
    queryKey: ["monthly-collections", currentMonthStart.toISOString().slice(0, 10)],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("amount,date")
        .eq("status", "active")
        .gte("date", previousMonthStart.toISOString().slice(0, 10));
      const currentStart = currentMonthStart.getTime();
      return (data ?? []).reduce(
        (totals, payment) => {
          const amount = Number(payment.amount);
          if (new Date(payment.date).getTime() >= currentStart) totals.current += amount;
          else totals.previous += amount;
          return totals;
        },
        { current: 0, previous: 0 },
      );
    },
  });

  const today = new Date().getDay();
  const todaySections = sections
    .filter((section) => section.day_of_week === today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const balances = students.map((student) => ({ student, ...studentBalance(student) }));
  const totalDue = balances.reduce((sum, balance) => sum + balance.due, 0);
  const totalPaid = balances.reduce((sum, balance) => sum + balance.paid, 0);
  const totalOwed = balances.reduce((sum, balance) => sum + Math.max(0, balance.owed), 0);
  const overdueCount = balances.filter((balance) => balance.owed > 0).length;
  const topDebtors = [...balances]
    .filter((balance) => balance.owed > 0)
    .sort((a, b) => b.owed - a.owed)
    .slice(0, 3);
  const recentCount = (recent?.student.length ?? 0) + (recent?.teacher.length ?? 0);
  const trend = monthly.previous > 0
    ? ((monthly.current - monthly.previous) / monthly.previous) * 100
    : null;
  const onboardingDone =
    institute?.onboarding_completed || (courses.length > 0 && students.length >= 1 && totalPaid > 0);

  return (
    <div className="space-y-4 lg:space-y-6">
      {!onboardingDone && (
        <OnboardingStrip courseCount={courses.length} studentCount={students.length} paid={totalPaid > 0} />
      )}

      <section aria-labelledby="financial-heading" className="space-y-4 lg:space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-primary">{t("نظرة تنفيذية", "Executive overview")}</p>
            <h1 id="financial-heading" className="mt-1 text-xl font-bold text-foreground lg:text-2xl">
              {t("الأداء المالي", "Financial performance")}
            </h1>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <TrendingUp className="size-5" strokeWidth={1.8} />
          </div>
        </div>

        <div className="grid gap-4 lg:auto-rows-fr lg:grid-cols-12 lg:gap-6">
          <article className="flex min-h-40 flex-col justify-between rounded-xl border border-primary/15 bg-card p-4 shadow-lift sm:min-h-48 sm:p-5 lg:col-span-5 lg:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  {t("المحصّل هذا الشهر", "Collected this month")}
                </p>
                <p className="num mt-3 text-3xl font-extrabold text-primary sm:text-4xl lg:text-[2.5rem]">
                  {money(monthly.current)}
                </p>
              </div>
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
                <WalletCards className="size-5" strokeWidth={1.8} />
              </div>
            </div>
            {trend !== null ? (
              <div className={`mt-5 flex items-center gap-2 text-xs font-bold ${trend >= 0 ? "text-success" : "text-destructive"}`}>
                {trend >= 0 ? <ArrowUpLeft className="size-4" /> : <ArrowDownLeft className="size-4" />}
                <span className="num">{Math.abs(trend).toFixed(0)}%</span>
                <span className="font-medium text-muted-foreground">{t("مقارنة بالشهر الماضي", "vs. previous month")}</span>
              </div>
            ) : (
              <p className="mt-5 text-xs leading-5 text-muted-foreground">
                {t("تظهر المقارنة الشهرية بعد تسجيل دفعات في شهرين متتاليين.", "Monthly comparison appears after two months of payments.")}
              </p>
            )}
          </article>

          <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:col-span-7 lg:gap-6">
            <MetricCard
              icon={CircleDollarSign}
              label={t("محصّل كلي", "Total collected")}
              value={totalPaid}
              emptyText={t("يُحتسب بعد أول دفعة", "Calculated after the first payment")}
            />
            <MetricCard
              icon={AlertTriangle}
              label={t("مستحقات متبقية", "Outstanding")}
              value={totalOwed}
              tone="danger"
              emptyText={t("لا توجد مستحقات حالياً", "No outstanding dues")}
            />
            <MetricCard
              icon={ReceiptText}
              label={t("مستحقات متوقعة", "Expected dues")}
              value={totalDue}
              emptyText={t("أضف طالباً إلى مادة", "Enroll a student in a course")}
              className="col-span-2 sm:col-span-1"
            />
          </div>
        </div>
      </section>

      <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 sm:gap-4 lg:gap-6">
        <CompactStat
          icon={Users}
          label={t("طلاب فعّالين", "Active students")}
          value={students.length}
          emptyText={t("أضف أول طالب للبدء", "Add your first student")}
        />
        <CompactStat
          icon={AlertTriangle}
          label={t("طلاب عليهم مستحقات", "Students with dues")}
          value={overdueCount}
          emptyText={t("لا توجد مستحقات متأخرة", "No overdue balances")}
          tone="danger"
        />
      </div>

      <div className="grid auto-rows-fr gap-4 lg:grid-cols-12 lg:gap-6">
        <section className="flex min-h-64 flex-col rounded-xl bg-card shadow-soft lg:min-h-80 lg:col-span-5">
          <SectionHeading
            icon={CalendarClock}
            title={t("دوام اليوم", "Today's schedule")}
            detail={lang === "ar" ? DAYS_AR[today] : DAYS_EN[today]}
          />
          {todaySections.length === 0 ? (
            <EmptyState
              icon={CalendarPlus}
              title={t("يومك جاهز للتنظيم", "Your day is ready to plan")}
              description={t("ستظهر هنا شعب اليوم مرتبة حسب وقت البداية.", "Today's sections will appear here in start-time order.")}
              action={t("أضف شعبة", "Add a section")}
              to="/schedule"
            />
          ) : (
            <ul className="flex-1 space-y-3 p-4 sm:p-5">
              {todaySections.map((section) => (
                <li key={section.id} className="flex items-center gap-4 rounded-xl border border-border bg-muted/35 p-3.5">
                  <span className="num flex min-w-20 shrink-0 flex-col text-center text-xs font-bold text-primary">
                    <span>{hhmm(section.start_time)}</span>
                    <span className="mt-1 text-muted-foreground">{hhmm(section.end_time)}</span>
                  </span>
                  <span className="h-10 w-px bg-border" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{section.name}</p>
                    <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
                      {(section.courses as { name: string } | null)?.name}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex min-h-64 flex-col rounded-xl bg-card shadow-soft lg:min-h-80 lg:col-span-7">
          <SectionHeading icon={CreditCard} title={t("آخر الحركات المالية", "Recent payments")} />
          {recentCount === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title={t("لا توجد حركات مالية بعد", "No financial activity yet")}
              description={t("ستظهر هنا آخر دفعات الطلاب والمدرسين فور تسجيلها.", "Your latest student and teacher payments will appear here.")}
              action={t("تسجيل أول دفعة", "Record the first payment")}
              onClick={() => navigate({ to: "/students" })}
            />
          ) : (
            <div className="flex-1 divide-y divide-border px-4 pb-3 sm:px-5">
              {(recent?.student ?? []).map((payment) => (
                <PaymentRow
                  key={payment.id}
                  name={(payment.students as { name: string } | null)?.name ?? t("طالب", "Student")}
                  meta={`${lang === "ar" ? METHOD_LABELS[payment.method]?.ar : METHOD_LABELS[payment.method]?.en} · ${shortDate(payment.date)}`}
                  amount={Number(payment.amount)}
                  incoming
                />
              ))}
              {(recent?.teacher ?? []).map((payment) => (
                <PaymentRow
                  key={payment.id}
                  name={(payment.teachers as { name: string } | null)?.name ?? t("مدرّس", "Teacher")}
                  meta={shortDate(payment.date)}
                  amount={Number(payment.amount)}
                  incoming={false}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {topDebtors.length > 0 && (
        <section className="rounded-xl bg-card p-4 shadow-soft sm:p-5">
          <SectionHeading icon={Clock3} title={t("أولوية المتابعة", "Follow-up priority")} compact />
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {topDebtors.map(({ student, owed }) => (
              <li key={student.id}>
                <Link
                  to="/students/$id"
                  params={{ id: student.id }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:bg-muted/60"
                >
                  <span className="truncate text-sm font-semibold text-foreground">{student.name}</span>
                  <span className="num shrink-0 text-sm font-bold text-destructive">{money(owed)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type DashboardIcon = typeof WalletCards;

function MetricCard({
  icon: Icon,
  label,
  value,
  emptyText,
  tone = "primary",
  className = "",
}: {
  icon: DashboardIcon;
  label: string;
  value: number;
  emptyText: string;
  tone?: "primary" | "danger";
  className?: string;
}) {
  return (
    <article className={`flex min-h-36 flex-col justify-between rounded-xl bg-card p-3.5 shadow-soft sm:min-h-48 sm:p-4 ${className}`}>
      <div className={`flex size-9 items-center justify-center rounded-xl ${tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"}`}>
        <Icon className="size-4.5" strokeWidth={1.8} />
      </div>
      <div className="mt-4 sm:mt-5">
        <p className="text-xs font-semibold leading-5 text-muted-foreground">{label}</p>
        <p className={`num mt-1 text-xl font-extrabold sm:text-2xl ${tone === "danger" && value > 0 ? "text-destructive" : "text-foreground"}`}>
          {money(value)}
        </p>
        <p className="mt-1.5 text-[11px] font-medium leading-5 text-muted-foreground sm:mt-2">{emptyText}</p>
      </div>
    </article>
  );
}

function CompactStat({
  icon: Icon,
  label,
  value,
  emptyText,
  tone = "primary",
}: {
  icon: DashboardIcon;
  label: string;
  value: number;
  emptyText: string;
  tone?: "primary" | "danger";
}) {
  return (
    <article className="flex min-h-20 items-center gap-3.5 rounded-xl bg-card p-3.5 shadow-soft sm:min-h-24 sm:gap-4 sm:p-4">
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"}`}>
        <Icon className="size-5" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-bold text-foreground">{label}</p>
          <p className="num text-2xl font-extrabold text-foreground">{value}</p>
        </div>
        <p className="mt-1 truncate text-xs font-medium text-muted-foreground">{emptyText}</p>
      </div>
    </article>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  detail,
  compact = false,
}: {
  icon: DashboardIcon;
  title: string;
  detail?: string | undefined;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b border-border ${compact ? "border-b-0 p-0" : "p-4 sm:p-5"}`}>
      <h2 className="flex items-center gap-2.5 text-sm font-bold text-foreground">
        <Icon className="size-4.5 text-primary" strokeWidth={1.8} />
        {title}
      </h2>
      {detail && <span className="rounded-lg bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">{detail}</span>}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  to,
  onClick,
}: {
  icon: DashboardIcon;
  title: string;
  description: string;
  action: string;
  to?: "/schedule";
  onClick?: () => void;
}) {
  const content = (
    <>
      <Icon className="size-4" strokeWidth={1.8} />
      {action}
    </>
  );
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground">
        <Icon className="size-6" strokeWidth={1.6} />
      </div>
      <h3 className="mt-4 text-sm font-bold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs font-medium leading-6 text-muted-foreground">{description}</p>
      {to ? (
        <Button asChild className="mt-5 shadow-lift">
          <Link to={to}>{content}</Link>
        </Button>
      ) : (
        <Button className="mt-5 shadow-lift" onClick={onClick}>{content}</Button>
      )}
    </div>
  );
}

function PaymentRow({ name, meta, amount, incoming }: { name: string; meta: string; amount: number; incoming: boolean }) {
  return (
    <div className="flex min-h-18 items-center gap-3 py-3.5">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${incoming ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
        {incoming ? <ArrowDownLeft className="size-4" /> : <ArrowUpLeft className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{name}</p>
        <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{meta}</p>
      </div>
      <span className={`num shrink-0 text-sm font-extrabold ${incoming ? "text-success" : "text-destructive"}`}>
        {incoming ? "+" : "−"}{money(amount)}
      </span>
    </div>
  );
}

function OnboardingStrip({
  courseCount,
  studentCount,
  paid,
}: {
  courseCount: number;
  studentCount: number;
  paid: boolean;
}) {
  const { t } = usePrefs();
  const steps = [
    { done: courseCount > 0, ar: "أضف أول مادة", en: "Add your first course", to: "/courses" as const, icon: BookOpen },
    { done: studentCount >= 1, ar: "أضف أول طالب", en: "Add your first student", to: "/students" as const, icon: UserRoundPlus },
    { done: paid, ar: "سجّل أول دفعة", en: "Record your first payment", to: "/students" as const, icon: ReceiptText },
  ];
  const completed = steps.filter((step) => step.done).length;
  const remaining = steps.length - completed;
  const next = steps.find((step) => !step.done);

  if (!next) return null;
  const NextIcon = next.icon;

  return (
    <section className="flex flex-col justify-center gap-3 rounded-xl border border-primary/20 bg-accent p-4 shadow-soft sm:min-h-24 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 lg:px-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Check className="size-4.5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground">{t("أكمل إعداد معهدك", "Complete your institute setup")}</h2>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              {t(`${remaining} ${remaining === 1 ? "خطوة متبقية" : "خطوات متبقية"} لتفعيل معهدك`, `${remaining} ${remaining === 1 ? "step" : "steps"} left to activate your institute`)}
            </p>
          </div>
        </div>
        <div className="mt-3 flex max-w-md items-center gap-2" aria-label={`${completed} / 3`}>
          {steps.map((step, index) => (
            <span key={index} className={`h-1.5 flex-1 rounded-full ${step.done ? "bg-primary" : "bg-primary/20"}`} />
          ))}
        </div>
      </div>
      <Button asChild className="w-full shrink-0 shadow-lift sm:w-auto">
        <Link to={next.to} search={{ add: true }}>
          <NextIcon className="size-4" strokeWidth={1.8} />
          {t(next.ar, next.en)}
        </Link>
      </Button>
    </section>
  );
}