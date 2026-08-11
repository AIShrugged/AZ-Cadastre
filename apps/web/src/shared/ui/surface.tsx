/**
 * Surface layout — the shared band scaffold every register surface is composed
 * on, so their chrome aligns with the sidebar's bookends and can't drift apart.
 *
 * The global app bar (a SurfaceMasthead rendered once by the shell) sits above
 * every route; a surface then fills the region beneath it as a flex column of a
 * fixed page heading, a scrolling body, and a fixed h-16 footer that lines up
 * with the sidebar inspector band. On narrow screens the sidebar is an
 * off-canvas sheet, so the footer relaxes to auto height there (bookend
 * alignment only matters on desktop, where both bands are visible side by side).
 */
import { type ComponentProps, type ReactNode } from "react"

import { cn } from "@/shared/lib/cn"

/** Fills the region below the global app bar. Heading + footer stay fixed; the
 *  body scrolls. Forwards div props so a surface can attach page-level handlers
 *  (e.g. drag-and-drop). */
export function SurfacePage({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)} {...props}>
      {children}
    </div>
  )
}

/** Fixed h-16 chrome band — used by the shell's global app bar (trigger left,
 *  controls right). Its bottom rule aligns with the sidebar logo band. */
export function SurfaceMasthead({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "flex h-16 shrink-0 items-center justify-between gap-4 border-b border-rule-strong px-4 md:px-6",
        className,
      )}
    >
      {children}
    </header>
  )
}

/** The page's identity block, sitting just below the global app bar: a title
 *  (with an optional badge) over an optional subtitle. This is where a route
 *  names itself now that the app bar is title-free. */
export function SurfaceHeading({
  title,
  subtitle,
  badge,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  badge?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("shrink-0 border-b border-rule px-4 py-3.5 md:px-6", className)}>
      {/* The title wraps rather than truncates: a surface named by its subject
          — a package by the verification it is — must not have that subject cut
          to an ellipsis on a narrow screen. Short titles are unaffected; a long
          one balances across its lines and takes the badge onto the first. */}
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h1 className="min-w-0 text-balance text-[1.375rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        {badge && <span className="shrink-0">{badge}</span>}
      </div>
      {subtitle && (
        <p className="mt-1 text-[0.875rem] leading-relaxed text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )
}

/** The scrolling region between the bands. */
export function SurfaceBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", className)}>
      {children}
    </div>
  )
}

/** Fixed bottom band — h-16 on desktop (bookends the sidebar inspector band),
 *  auto height on mobile where the sidebar is an off-canvas sheet. */
export function SurfaceFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <footer
      className={cn(
        "mt-auto flex shrink-0 items-center justify-between gap-4 border-t border-rule-strong px-4 py-3 md:h-16 md:py-0 md:px-6",
        className,
      )}
    >
      {children}
    </footer>
  )
}
