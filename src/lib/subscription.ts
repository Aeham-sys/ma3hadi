export type SubStatus = "trial" | "active" | "grace" | "expired" | "cancelled";

export type Institute = {
  id: string;
  owner_id: string;
  name: string;
  subscription_status: SubStatus;
  trial_end: string;
  subscription_end: string | null;
  onboarding_completed: boolean;
  language: string;
  theme: string;
  reminder_template?: string | null;
  phone?: string | null;
  owner_email?: string | null;
};

export type SubView = {
  state: SubStatus;
  locked: boolean;
  daysLeft: number;
  banner: { ar: string; en: string; tone: "info" | "warn" } | null;
};

const DAY = 86400000;

export function daysBetween(target: string | Date) {
  const t = new Date(target).getTime();
  return Math.max(0, Math.ceil((t - Date.now()) / DAY));
}

export const PLANS = {
  monthly: { id: "monthly", price: 29, months: 1, ar: "شهر واحد", en: "1 month" },
  yearly: { id: "yearly", price: 232, months: 12, ar: "سنة كاملة", en: "1 year" },
} as const;

export type PlanId = keyof typeof PLANS;

/** Derives the live subscription state from stored dates. */
export function resolveSubscription(inst: Institute | null | undefined): SubView {
  if (!inst) return { state: "trial", locked: false, daysLeft: 0, banner: null };

  if (inst.subscription_status === "cancelled" || inst.subscription_status === "expired") {
    return { state: inst.subscription_status, locked: true, daysLeft: 0, banner: null };
  }

  if (inst.subscription_status === "trial") {
    const left = daysBetween(inst.trial_end);
    if (new Date(inst.trial_end).getTime() <= Date.now()) {
      return { state: "expired", locked: true, daysLeft: 0, banner: null };
    }
    return {
      state: "trial",
      locked: false,
      daysLeft: left,
      banner: {
        ar: `تبقى لك ${left} أيام من التجربة المجانية — جدد الاشتراك هلق`,
        en: `${left} days left in your free trial — renew now`,
        tone: "info",
      },
    };
  }

  // active / grace
  const end = inst.subscription_end ? new Date(inst.subscription_end).getTime() : 0;
  if (!end || end > Date.now()) {
    return { state: "active", locked: false, daysLeft: end ? daysBetween(inst.subscription_end!) : 0, banner: null };
  }
  const graceEnd = end + 7 * DAY;
  if (graceEnd > Date.now()) {
    return {
      state: "grace",
      locked: false,
      daysLeft: daysBetween(new Date(graceEnd)),
      banner: {
        ar: "انتهى اشتراكك — عندك أسبوع لتجدد وإلا بيتقفل حسابك",
        en: "Your subscription ended — you have one week to renew before your account locks",
        tone: "warn",
      },
    };
  }
  return { state: "expired", locked: true, daysLeft: 0, banner: null };
}
