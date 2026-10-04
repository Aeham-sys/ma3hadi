import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { studentBalance, useInstitute, useRefresh, useStudents } from "@/hooks/useApp";
import { usePrefs } from "@/lib/i18n";
import { money, METHOD_LABELS, shortDate } from "@/lib/format";
import { isActivePayment } from "@/lib/fees";
import {
  EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  type ExpenseCategoryId,
} from "@/lib/expenseCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { FabButton } from "@/components/FabButton";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Pencil,
  PiggyBank,
  RotateCcw,
  Wallet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type ExpenseRow = {
  id: string;
  category: string;
  amount: number;
  date: string;
  note: string | null;
  status: string;
};

type ExpenseForm = {
  amount: string;
  date: string;
  category: ExpenseCategoryId;
  note: string;
};

type ExpensePatch = {
  category: ExpenseCategoryId;
  amount: number;
  date: string;
  note: string | null;
  status: string;
};

const PAYMENT_METHODS = ["cash", "shamcash", "transfer"] as const;

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function monthDate(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

export const Route = createFileRoute("/_authenticated/budget")({
  head: () => ({
    meta: [
      { title: "الميزانية — معهدي" },
      { name: "description", content: "تابع دخل المعهد ومصاريفه شهرياً." },
      { property: "og:title", content: "الميزانية — معهدي" },
      { property: "og:description", content: "تابع دخل المعهد ومصاريفه شهرياً." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BudgetPage,
});

function BudgetPage() {
  const { t, lang } = usePrefs();
  const { data: institute } = useInstitute();
  const {
    data: students = [],
    isLoading: studentsLoading,
    error: studentsError,
    refetch: refetchStudents,
  } = useStudents();
  const refresh = useRefresh();
  const today = new Date();
  const [viewedMonth, setViewedMonth] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);

  const { year, month } = viewedMonth;
  const startDate = monthDate(year, month);
  const nextMonth = new Date(year, month + 1, 1);
  const endDate = monthDate(nextMonth.getFullYear(), nextMonth.getMonth());
  const startInstant = new Date(year, month, 1).toISOString();
  const endInstant = new Date(year, month + 1, 1).toISOString();
  const viewingCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const {
    data: report,
    isLoading: reportLoading,
    error: reportError,
    refetch: refetchReport,
  } = useQuery({
    queryKey: ["budget", "month", year, month],
    queryFn: async () => {
      const [incomeResult, wagesResult, expensesResult, newStudentsResult] = await Promise.all([
        supabase
          .from("payments")
          .select("amount, method")
          .eq("status", "active")
          .gte("date", startDate)
          .lt("date", endDate),
        supabase
          .from("teacher_payments")
          .select("amount")
          .eq("status", "active")
          .gte("date", startDate)
          .lt("date", endDate),
        supabase
          .from("expenses")
          .select("id, category, amount, date, note, status")
          .gte("date", startDate)
          .lt("date", endDate)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .gte("created_at", startInstant)
          .lt("created_at", endInstant),
      ]);
      if (incomeResult.error) throw incomeResult.error;
      if (wagesResult.error) throw wagesResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (newStudentsResult.error) throw newStudentsResult.error;
      return {
        income: incomeResult.data ?? [],
        wages: wagesResult.data ?? [],
        expenses: expensesResult.data ?? [],
        newStudentCount: newStudentsResult.count ?? 0,
      };
    },
  });

  const expenses = (report?.expenses ?? []) as ExpenseRow[];
  const activeExpenses = expenses.filter(isActivePayment);
  const incomeTotal = (report?.income ?? []).reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const wagesTotal = (report?.wages ?? []).reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const expensesTotal = activeExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const net = incomeTotal - wagesTotal - expensesTotal;
  const methodTotals = PAYMENT_METHODS.map((method) => ({
    method,
    amount: (report?.income ?? [])
      .filter((payment) => payment.method === method)
      .reduce((sum, payment) => sum + Number(payment.amount), 0),
  }));
  const categoryTotals = EXPENSE_CATEGORIES.map((category) => {
    const amount = activeExpenses
      .filter((expense) => expense.category === category.id)
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
    return {
      ...category,
      amount,
      share: expensesTotal > 0 ? (amount / expensesTotal) * 100 : 0,
    };
  }).filter((category) => category.amount > 0);
  const totalOutstanding = students.reduce(
    (sum, student) => sum + Math.max(0, studentBalance(student).owed),
    0,
  );

  const changeMonth = (offset: number) => {
    setViewedMonth((current) => {
      const next = new Date(current.year, current.month + offset, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const openCreateDialog = () => {
    if (!institute) {
      toast.error(
        t(
          "ما قدرنا نجيب بيانات معهدك، حدّث الصفحة وجرّب كمان مرة",
          "Could not load your institute, refresh and try again",
        ),
      );
      return;
    }
    setEditingExpense(null);
    setExpenseDialogOpen(true);
  };

  const openEditDialog = (expense: ExpenseRow) => {
    setEditingExpense(expense);
    setExpenseDialogOpen(true);
  };

  const closeExpenseDialog = () => {
    setExpenseDialogOpen(false);
    setEditingExpense(null);
  };

  const saveExpense = async (expense: ExpenseRow | null, patch: ExpensePatch) => {
    if (!expense) {
      if (!institute) {
        toast.error(
          t(
            "ما قدرنا نجيب بيانات معهدك، حدّث الصفحة وجرّب كمان مرة",
            "Could not load your institute, refresh and try again",
          ),
        );
        return false;
      }
      const { error } = await supabase.from("expenses").insert({
        institute_id: institute.id,
        category: patch.category,
        amount: patch.amount,
        date: patch.date,
        note: patch.note,
      });
      if (error) {
        toast.error(error.message);
        return false;
      }
      refresh("budget");
      toast.success(t("تم تسجيل المصروف", "Expense added"));
      return true;
    }

    const { data, error } = await supabase
      .from("expenses")
      .update({
        category: patch.category,
        amount: patch.amount,
        date: patch.date,
        note: patch.note,
        status: patch.status,
      })
      .eq("id", expense.id)
      .select("id");
    if (error) {
      toast.error(error.message);
      return false;
    }
    if (!data?.length) {
      toast.error(t("تعذّر تعديل المصروف", "Could not update the expense"));
      return false;
    }
    refresh("budget");
    toast.success(
      patch.status === "cancelled"
        ? t("تم إلغاء المصروف", "Expense cancelled")
        : expense.status === "cancelled"
          ? t("تمت استعادة المصروف", "Expense restored")
          : t("تم تحديث المصروف", "Expense updated"),
    );
    return true;
  };

  const displayMonth = new Date(year, month, 1).toLocaleDateString(lang === "ar" ? "ar" : "en", {
    month: "long",
    year: "numeric",
  });
  const errorMessage = reportError?.message ?? studentsError?.message;

  if (reportLoading || studentsLoading) {
    return (
      <div className="space-y-4 pb-24">
        <h1 className="text-xl font-extrabold text-foreground">{t("الميزانية", "Budget")}</h1>
        <p className="text-sm text-muted-foreground">{t("جاري التحميل…", "Loading…")}</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-4 pb-24">
        <h1 className="text-xl font-extrabold text-foreground">{t("الميزانية", "Budget")}</h1>
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            void refetchReport();
            void refetchStudents();
          }}
        >
          {t("إعادة المحاولة", "Try again")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-foreground">{t("الميزانية", "Budget")}</h1>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("الشهر السابق", "Previous month")}
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft className="size-4 icon-flip" />
          </Button>
          <span className="min-w-32 text-center text-sm font-bold text-foreground">
            {displayMonth}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("الشهر التالي", "Next month")}
            onClick={() => changeMonth(1)}
            disabled={viewingCurrentMonth}
          >
            <ChevronRight className="size-4 icon-flip" />
          </Button>
        </div>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        {t(
          "على أساس نقدي: يُحتسب ما تم قبضه وصرفه فعليًا خلال الشهر",
          "Cash basis: only amounts actually collected/paid in the month",
        )}
      </p>

      <section
        aria-label={t("ملخص الشهر", "Monthly summary")}
        className="grid gap-3 sm:grid-cols-2"
      >
        <SummaryCard
          icon={<CircleDollarSign className="size-5" />}
          label={t("دخل الطلاب", "Student income")}
          amount={incomeTotal}
          tone="primary"
        />
        <SummaryCard
          icon={<Wallet className="size-5" />}
          label={t("أجور المدرسين", "Teacher wages")}
          amount={wagesTotal}
        />
        <SummaryCard
          icon={<PiggyBank className="size-5" />}
          label={t("مصاريف أخرى", "Other expenses")}
          amount={expensesTotal}
        />
        <SummaryCard
          icon={<CircleDollarSign className="size-5" />}
          label={t("الصافي", "Net")}
          amount={net}
          tone={net >= 0 ? "success" : "danger"}
        />
      </section>

      <section className="rounded-xl bg-card p-4 shadow-soft sm:p-5">
        <h2 className="text-sm font-bold text-foreground">
          {t("تفصيل الدخل حسب طريقة الدفع", "Income by payment method")}
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
          {methodTotals.map(({ method, amount }) => (
            <div key={method} className="rounded-xl bg-muted/50 p-3">
              <p className="truncate text-xs font-semibold text-muted-foreground">
                {lang === "ar"
                  ? (METHOD_LABELS[method]?.ar ?? method)
                  : (METHOD_LABELS[method]?.en ?? method)}
              </p>
              <p className="num mt-1 text-sm font-extrabold text-foreground">{money(amount)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-soft sm:p-5">
        <h2 className="text-sm font-bold text-foreground">
          {t("تفصيل المصاريف حسب التصنيف", "Expenses by category")}
        </h2>
        {categoryTotals.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("ما في مصاريف أخرى بهالشهر.", "No other expenses this month.")}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {categoryTotals.map((category) => (
              <li key={category.id}>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-semibold text-foreground">
                    {t(category.ar, category.en)}
                  </span>
                  <span className="num shrink-0 text-muted-foreground">
                    {money(category.amount)} · {category.share.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${category.share}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-card p-4 shadow-soft sm:p-5">
        <h2 className="text-sm font-bold text-foreground">
          {t("معلومات الطلاب", "Student information")}
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
          <InfoMetric label={t("إجمالي الطلاب", "Total students")} value={money(students.length)} />
          <InfoMetric
            label={t("طلاب جدد هالشهر", "New this month")}
            value={money(report?.newStudentCount ?? 0)}
          />
          <InfoMetric
            label={t(
              "ذمم مستحقة (للعلم، غير محسوبة بالصافي)",
              "Outstanding dues (info only, not in net)",
            )}
            value={money(totalOutstanding)}
          />
        </div>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-soft sm:p-5">
        <h2 className="text-sm font-bold text-foreground">
          {t("مصاريف الشهر", "Monthly expenses")}
        </h2>
        {expenses.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={<PiggyBank className="size-6" />}
              title={t("ما في مصاريف بهالشهر", "No expenses this month")}
              description={t(
                "سجّل أول مصروف حتى تتابع تكاليف المعهد.",
                "Add your first expense to track institute costs.",
              )}
              actionLabel={t("تسجيل مصروف", "Add expense")}
              onAction={openCreateDialog}
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {expenses.map((expense) => {
              const cancelled = !isActivePayment(expense);
              return (
                <li key={expense.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p
                      className={`num text-sm font-bold ${
                        cancelled ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {money(expense.amount)}
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="break-words [overflow-wrap:anywhere]">
                        {expenseCategoryLabel(expense.category, t)}
                        {expense.note ? ` · ${expense.note}` : ""}
                      </span>
                      {cancelled && (
                        <span className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                          <Ban className="size-3" />
                          {t("ملغاة", "Cancelled")}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="num text-xs text-muted-foreground">
                      {shortDate(expense.date)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditDialog(expense)}
                      aria-label={t("تعديل المصروف", "Edit expense")}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <Pencil className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <FabButton
        label={t("تسجيل مصروف", "Add expense")}
        icon={<Wallet className="size-5" />}
        onClick={openCreateDialog}
      />

      <ExpenseDialog
        open={expenseDialogOpen}
        expense={editingExpense}
        onClose={closeExpenseDialog}
        onSave={saveExpense}
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  amount,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  amount: number;
  tone?: "default" | "primary" | "success" | "danger";
}) {
  const amountClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-destructive"
        : tone === "primary"
          ? "text-primary"
          : "text-foreground";

  return (
    <article className="rounded-xl bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-xs font-semibold">{label}</p>
      </div>
      <p className={`num mt-3 text-2xl font-extrabold ${amountClass}`}>{money(amount)}</p>
    </article>
  );
}

function InfoMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/50 p-3">
      <p className="min-h-8 text-[11px] font-semibold leading-4 text-muted-foreground">{label}</p>
      <p className="num mt-1 text-sm font-extrabold text-foreground">{value}</p>
    </div>
  );
}

function ExpenseDialog({
  open,
  expense,
  onClose,
  onSave,
}: {
  open: boolean;
  expense: ExpenseRow | null;
  onClose: () => void;
  onSave: (expense: ExpenseRow | null, patch: ExpensePatch) => Promise<boolean>;
}) {
  const { t } = usePrefs();
  const [form, setForm] = useState<ExpenseForm>({
    amount: "",
    date: localDateString(new Date()),
    category: "other",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      expense
        ? {
            amount: String(expense.amount),
            date: expense.date,
            category: EXPENSE_CATEGORIES.some((category) => category.id === expense.category)
              ? (expense.category as ExpenseCategoryId)
              : "other",
            note: expense.note ?? "",
          }
        : {
            amount: "",
            date: localDateString(new Date()),
            category: "other",
            note: "",
          },
    );
  }, [expense, open]);

  const cancelled = expense ? !isActivePayment(expense) : false;

  const submit = async (status: string) => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(t("أدخل مبلغ صحيح", "Enter a valid amount"));
      return;
    }
    if (!form.date) {
      toast.error(t("أدخل التاريخ", "Enter a date"));
      return;
    }
    if (!EXPENSE_CATEGORIES.some((category) => category.id === form.category)) {
      toast.error(t("اختر تصنيف صحيح", "Choose a valid category"));
      return;
    }
    if (form.note.length > 500) {
      toast.error(t("الملاحظة أطول من المسموح", "The note is too long"));
      return;
    }
    setSaving(true);
    const ok = await onSave(expense, {
      category: form.category,
      amount,
      date: form.date,
      note: form.note || null,
      status,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {expense ? t("تعديل المصروف", "Edit expense") : t("تسجيل مصروف", "Add expense")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5">
          {cancelled && (
            <p className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              <Ban className="size-4" />
              {t(
                "هالمصروف ملغى وما بينحسب بالإجمالي.",
                "This expense is cancelled and excluded from totals.",
              )}
            </p>
          )}
          <div className="space-y-1.5">
            <Label>{t("المبلغ", "Amount")}</Label>
            <Input
              dir="ltr"
              type="number"
              inputMode="numeric"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("التاريخ", "Date")}</Label>
            <Input
              dir="ltr"
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("التصنيف", "Category")}</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EXPENSE_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setForm({ ...form, category: category.id })}
                  className={`rounded-xl px-2 py-2.5 text-xs font-semibold transition-colors ${
                    form.category === category.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {t(category.ar, category.en)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("ملاحظة", "Note")}</Label>
            <Textarea
              rows={2}
              maxLength={500}
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={() => submit(cancelled ? "cancelled" : "active")}
            disabled={saving}
            size="lg"
            className="w-full"
          >
            {saving
              ? t("لحظة…", "Saving…")
              : expense
                ? t("حفظ التعديلات", "Save changes")
                : t("تسجيل المصروف", "Add expense")}
          </Button>
          {expense &&
            (cancelled ? (
              <Button
                variant="outline"
                onClick={() => submit("active")}
                disabled={saving}
                className="w-full"
              >
                <RotateCcw className="size-4" />
                {t("استعادة المصروف", "Restore expense")}
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => submit("cancelled")}
                disabled={saving}
                className="w-full"
              >
                <Ban className="size-4" />
                {t("إلغاء المصروف (بدون حذف)", "Cancel expense (keep record)")}
              </Button>
            ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
