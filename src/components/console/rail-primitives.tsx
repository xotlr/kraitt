import { cn } from "@/lib/utils";

/** Mono label under a control. Three tones: active (amber), dimmed
 *  (faceplate filler), default (faint, brightens on group-hover). */
export function RailLabel({
  children,
  active,
  dimmed,
}: {
  children: React.ReactNode;
  active?: boolean;
  dimmed?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-mono text-[8px] uppercase tracking-[0.18em] tabular-nums transition-colors duration-500",
        active
          ? "text-[color:var(--color-string)]"
          : dimmed
          ? "text-ink-faint/60"
          : "text-ink-faint group-hover:text-ink-muted"
      )}
    >
      {children}
    </span>
  );
}
