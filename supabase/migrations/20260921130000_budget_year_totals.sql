CREATE OR REPLACE FUNCTION public.budget_year_totals(p_year integer)
RETURNS TABLE (month date, income numeric, wages numeric, expenses numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    m.month,
    COALESCE((SELECT sum(p.amount) FROM public.payments p
               WHERE p.status = 'active'
                 AND p.date >= m.month
                 AND p.date < (m.month + interval '1 month')::date), 0),
    COALESCE((SELECT sum(tp.amount) FROM public.teacher_payments tp
               WHERE tp.status = 'active'
                 AND tp.date >= m.month
                 AND tp.date < (m.month + interval '1 month')::date), 0),
    COALESCE((SELECT sum(e.amount) FROM public.expenses e
               WHERE e.status = 'active'
                 AND e.date >= m.month
                 AND e.date < (m.month + interval '1 month')::date), 0)
  FROM (
    SELECT make_date(p_year, g, 1) AS month
    FROM generate_series(1, 12) AS g
    WHERE p_year BETWEEN 2000 AND 2100
  ) m
  ORDER BY m.month;
$$;

REVOKE ALL ON FUNCTION public.budget_year_totals(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.budget_year_totals(integer) TO authenticated;
