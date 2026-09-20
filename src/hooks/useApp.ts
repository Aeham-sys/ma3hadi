import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Institute } from "@/lib/subscription";
import { enrollmentFee, isActivePayment, type EnrollmentRow } from "@/lib/fees";

export function useInstitute() {
  return useQuery({
    queryKey: ["institute"],
    queryFn: async () => {
      // Scope to the signed-in owner: admins can read every institute row,
      // so an unfiltered maybeSingle() breaks (multiple rows) for them.
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;
      const { data, error } = await supabase
        .from("institutes")
        .select("*")
        .eq("owner_id", uid)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Institute | null;
    },
  });
}


export function useIsAdmin() {
  return useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("role", "admin");
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  });
}

export function useCourses() {
  return useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(
          "*, teachers:teacher_id(id,name), teacher_courses(id, teacher_id, price, teachers(id,name)), student_courses(id), sections(id,name,day_of_week,start_time,end_time)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useStudents() {
  return useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select(
          "*, student_courses(id, custom_fee, teacher_id, courses(id,name,price, teacher_courses(teacher_id, price))), payments(id,amount,status)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTeachers() {
  return useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select(
          "*, courses:course_id(id,name), teacher_courses(id, course_id, courses(id,name)), teacher_payments(id,amount)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSections() {
  return useQuery({
    queryKey: ["sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("*, courses(id,name)")
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** total owed for a student row shaped by useStudents() */
export function studentBalance(s: {
  student_courses?: EnrollmentRow[] | null;
  payments?: { amount: number; status?: string | null }[] | null;
}) {
  const due = (s.student_courses ?? []).reduce((sum, sc) => sum + enrollmentFee(sc), 0);
  const paid = (s.payments ?? [])
    .filter(isActivePayment)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  return { due, paid, owed: due - paid };
}

export function useRefresh() {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}
