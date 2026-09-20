import type { ReactNode } from "react";
import { Plus } from "lucide-react";

/** Fixed bottom action button, thumb-reachable above the bottom nav. */
export function FabButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[4.75rem] z-30 flex justify-center px-4 lg:bottom-8 lg:justify-end lg:px-10">
      <button
        onClick={onClick}
        className="pointer-events-auto flex h-13 min-w-[13rem] items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lift transition-transform active:scale-[0.97]"
      >
        {icon ?? <Plus className="size-5" />}
        {label}
      </button>
    </div>
  );
}
