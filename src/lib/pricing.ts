import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PLANS, type PlanId } from "@/lib/subscription";

export type Pricing = { monthly: number; yearly: number };

export function usePricing() {
  return useQuery({
    queryKey: ["pricing"],
    queryFn: async (): Promise<Pricing> => {
      const { data: rows } = await supabase.rpc("get_payment_settings");
      const data = Array.isArray(rows) ? rows[0] : rows;

      return {
        monthly: Number(data?.price_monthly ?? PLANS.monthly.price),
        yearly: Number(data?.price_yearly ?? PLANS.yearly.price),
      };
    },
  });
}

export function planPrice(pricing: Pricing | undefined, plan: PlanId) {
  if (!pricing) return PLANS[plan].price;
  return plan === "monthly" ? pricing.monthly : pricing.yearly;
}

/** Adds days/months on top of the later of now and the current end date. */
export function extendFrom(currentEnd: string | null | undefined, opts: { days?: number; months?: number }) {
  const now = Date.now();
  const cur = currentEnd ? new Date(currentEnd).getTime() : 0;
  const base = new Date(Math.max(now, cur));
  if (opts.months) base.setMonth(base.getMonth() + opts.months);
  if (opts.days) base.setDate(base.getDate() + opts.days);
  return base.toISOString();
}
