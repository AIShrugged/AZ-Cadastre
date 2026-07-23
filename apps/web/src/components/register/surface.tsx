/**
 * Surface layout — the shared band scaffold every register surface is composed
 * on, so their chrome aligns with the sidebar's bookends and can't drift apart.
 *
 * A surface fills the inset height (`h-svh`) and is a flex column of three
 * parts: a fixed h-16 masthead that lines up with the sidebar logo band, a
 * scrolling body, and a fixed h-16 footer that lines up with the sidebar
 * inspector band. On narrow screens the sidebar is an off-canvas sheet, so the
 * footer relaxes to auto height there (bookend alignment only matters on
 * desktop, where both bands are visible side by side).
 */
import { type ComponentProps, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Inset-filling flex column. Masthead + footer stay fixed; the body scrolls.
 *  Forwards div props so a surface can attach page-level handlers (e.g. drag). */
export function SurfacePage({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("flex h-svh min-h-0 flex-col overflow-hidden", className)} {...props}>
      {children}
    </div>
  )
}

/** Fixed top band (h-16) — aligns with the sidebar logo band's bottom rule. */
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
