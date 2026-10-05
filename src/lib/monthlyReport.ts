import { supabase } from "@/integrations/supabase/client";
import { EXPENSE_CATEGORIES } from "@/lib/expenseCategories";
import { METHOD_LABELS } from "@/lib/format";

export type StudentPaymentReportRow = {
  id: string;
  amount: number;
  date: string;
  method: string;
  note: string | null;
  status: string;
  students: { name: string } | null;
};

export type TeacherPaymentReportRow = {
  id: string;
  amount: number;
  date: string;
  note: string | null;
  status: string;
  teachers: { name: string } | null;
};

export type ExpenseReportRow = {
  id: string;
  category: string;
  amount: number;
  date: string;
  note: string | null;
  status: string;
};

type RowCounts = {
  active: number;
  cancelled: number;
};

export type MonthlyReport = {
  year: number;
  month: number;
  generatedAt: Date;
  newStudents: number;
  studentPayments: StudentPaymentReportRow[];
  teacherPayments: TeacherPaymentReportRow[];
  expensesRows: ExpenseReportRow[];
  totals: {
    income: number;
    wages: number;
    expenses: number;
    net: number;
    incomeByMethod: Record<string, number>;
    expensesByCategory: Record<string, number>;
  };
  counts: {
    studentPayments: RowCounts;
    teacherPayments: RowCounts;
    expenses: RowCounts;
  };
};

type PageResult<T> = {
  data: T[] | null;
  error: unknown;
};

const PAGE_SIZE = 1000;

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function monthDate(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function nextMonthDate(year: number, month: number): string {
  const next = new Date(year, month + 1, 1);
  return monthDate(next.getFullYear(), next.getMonth());
}

function rowCounts<T extends { status: string }>(rows: T[]): RowCounts {
  return rows.reduce(
    (counts, row) => {
      if (row.status === "active") counts.active += 1;
      if (row.status === "cancelled") counts.cancelled += 1;
      return counts;
    },
    { active: 0, cancelled: 0 },
  );
}

export async function fetchMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
  const startDate = monthDate(year, month);
  const endDate = nextMonthDate(year, month);
  const startInstant = new Date(year, month, 1).toISOString();
  const endInstant = new Date(year, month + 1, 1).toISOString();

  const [studentPayments, teacherPayments, expensesRows, studentsResult] = await Promise.all([
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, date, method, note, status, students(name)")
        .gte("date", startDate)
        .lt("date", endDate)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
      return { data, error };
    }),
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("teacher_payments")
        .select("id, amount, date, note, status, teachers(name)")
        .gte("date", startDate)
        .lt("date", endDate)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
      return { data, error };
    }),
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, category, amount, date, note, status")
        .gte("date", startDate)
        .lt("date", endDate)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
      return { data, error };
    }),
    (async () => {
      const { count, error } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startInstant)
        .lt("created_at", endInstant);
      if (error) throw error;
      return count ?? 0;
    })(),
  ]);

  const activeStudentPayments = studentPayments.filter((row) => row.status === "active");
  const activeTeacherPayments = teacherPayments.filter((row) => row.status === "active");
  const activeExpenses = expensesRows.filter((row) => row.status === "active");
  const incomeByMethod = Object.fromEntries(
    Object.keys(METHOD_LABELS).map((method) => [
      method,
      activeStudentPayments
        .filter((row) => row.method === method)
        .reduce((total, row) => total + Number(row.amount), 0),
    ]),
  );
  const expensesByCategory = Object.fromEntries(
    EXPENSE_CATEGORIES.map(({ id }) => [
      id,
      activeExpenses
        .filter((row) => row.category === id)
        .reduce((total, row) => total + Number(row.amount), 0),
    ]),
  );
  const income = activeStudentPayments.reduce((total, row) => total + Number(row.amount), 0);
  const wages = activeTeacherPayments.reduce((total, row) => total + Number(row.amount), 0);
  const expenses = activeExpenses.reduce((total, row) => total + Number(row.amount), 0);

  return {
    year,
    month,
    generatedAt: new Date(),
    newStudents: studentsResult,
    studentPayments,
    teacherPayments,
    expensesRows,
    totals: {
      income,
      wages,
      expenses,
      net: income - wages - expenses,
      incomeByMethod,
      expensesByCategory,
    },
    counts: {
      studentPayments: rowCounts(studentPayments),
      teacherPayments: rowCounts(teacherPayments),
      expenses: rowCounts(expensesRows),
    },
  };
}
