/**
 * Header action slot — lets a route drop a control (e.g. a primary button) into
 * the global app bar's right side without the page owning the bar. The shell
 * renders one slot element and shares it through context; a route renders
 * <HeaderActions> anywhere in its tree and its children portal into that slot.
 * A route that renders nothing simply leaves the bar chrome-only.
 */
import { createContext, useContext, type ReactNode } from "react"
import { createPortal } from "react-dom"

// eslint-disable-next-line react-refresh/only-export-components
export const HeaderSlotContext = createContext<HTMLElement | null>(null)

export function HeaderActions({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderSlotContext)
  return slot ? createPortal(children, slot) : null
}
