import { money } from "./format";

export const DEFAULT_REMINDER_TEMPLATE = `مرحبا {student}، تحية من {institute} 👋
تذكير بخصوص الرصيد المستحق: {amount}
يرجى التسديد بأقرب وقت. شكراً لتعاونكم.`;

/** Turns a local Syrian number into international format for wa.me (no + sign). */
export function waPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "963" + d.slice(1);
  else if (!d.startsWith("963") && d.length <= 10) d = "963" + d;
  return d.length >= 10 ? d : null;
}

export function buildReminderMessage(
  template: string | null | undefined,
  vars: { student: string; institute: string; amount: number; due?: number; paid?: number },
): string {
  const tpl = template?.trim() ? template : DEFAULT_REMINDER_TEMPLATE;
  return tpl
    .replaceAll("{student}", vars.student)
    .replaceAll("{institute}", vars.institute)
    .replaceAll("{amount}", money(vars.amount))
    .replaceAll("{due}", money(vars.due ?? vars.amount))
    .replaceAll("{paid}", money(vars.paid ?? 0));
}

export function waLink(phone: string | null | undefined, message: string): string | null {
  const p = waPhone(phone);
  if (!p) return null;
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
}
