/*
 * ─── Direction contract · AZ-Cadastre · "The Register" ──────────────────────
 * THESIS: The verification queue is a governed register, not a SaaS dashboard.
 *   It refuses the category default — Inter on floating white cards over gray,
 *   candy status pills, a decorative chart — for a ruled page of record.
 * OWN-WORLD: Swiss International Typographic system. Paper-white ground, ink
 *   type, hairline rules as the visible grid, Geist + Geist Mono (tabular for
 *   every ID/date/count/confidence), one federal-blue signal, ink-toned
 *   disposition marks. Square corners, flat at rest (The Square / Flat-Page
 *   Rules). Recognizable with all content removed.
 * STORY: An inspector arrives, reads which packages need them (in-progress,
 *   issues, incomplete) down a scannable register, opens one, and trusts that
 *   the system reported evidence — it never decided.
 * FIRST VIEWPORT: Left register-cover sidebar (mark, nav, RU/EN/AZ, inspector).
 *   Main: title + "New verification" (the one blue action), a segment+search
 *   control strip, then the ruled register. In-progress rows animate a
 *   segmented six-stage bar — the focal moment where the register visibly works.
 * FORM: Grounded direction #5 of 7 (Swiss administrative system); assigned by
 *   concept-seed key bb6f553a, corroborated by the dealt Swiss-grid challenger.
 * ────────────────────────────────────────────────────────────────────────── */
import { ThemeProvider } from "next-themes"
import { createBrowserRouter, RouterProvider } from "react-router-dom"

import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { I18nProvider } from "@/lib/i18n"
import { PackagesProvider } from "@/lib/packages-store"
import { routeObjects } from "@/routes"

const router = createBrowserRouter(routeObjects)

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <I18nProvider>
        <PackagesProvider>
          <TooltipProvider>
            <RouterProvider router={router} />
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </PackagesProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}

export default App
