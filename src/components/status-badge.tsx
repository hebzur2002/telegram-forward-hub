import { cn } from "@/lib/utils";

type Status = "active" | "paused" | "error" | "success" | "failed" | string;

export function StatusBadge({ status }: { status: Status }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
    success: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
    paused: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
    error: "bg-red-500/15 text-red-400 ring-red-500/30",
    failed: "bg-red-500/15 text-red-400 ring-red-500/30",
  };
  const cls = map[status] || "bg-muted text-muted-foreground ring-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset capitalize",
        cls,
      )}
    >
      {status}
    </span>
  );
}
