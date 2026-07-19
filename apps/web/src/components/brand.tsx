import { cn } from "@/lib/utils";

/** Cadastral-plot mark: a parcel grid with one registered cell highlighted. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-6", className)}
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="21"
        rx="3"
        className="fill-primary"
      />
      <path
        d="M9 2v20M15 2v20M2 9h20M2 15h20"
        className="stroke-primary-foreground/35"
        strokeWidth="1"
      />
      <rect
        x="15"
        y="15"
        width="6"
        height="6"
        className="fill-primary-foreground"
        opacity="0.92"
      />
    </svg>
  );
}

export function Wordmark({
  className,
  subtitle = true,
}: {
  className?: string;
  subtitle?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark />
      <span className="flex flex-col leading-none">
        <span className="text-[0.95rem] font-semibold tracking-tight">
          Кадастр
        </span>
        {subtitle && (
          <span className="font-mono text-[0.62rem] tracking-wide text-muted-foreground">
            проверка пакетов
          </span>
        )}
      </span>
    </span>
  );
}
