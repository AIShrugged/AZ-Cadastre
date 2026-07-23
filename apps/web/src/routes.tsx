/**
 * Route map — declarative RouteObject[] consumed by createBrowserRouter.
 *
 * A single layout route renders the register shell (sidebar cover + inset) and
 * an <Outlet /> for the active surface. Add future surfaces (Verification
 * Details, Profiles, Audit trail) as children here.
 */
import { type RouteObject } from "react-router-dom"

import { AppShell } from "@/components/app-shell"
import { Dashboard } from "@/components/register/dashboard"
import { NewVerification } from "@/components/register/new-verification"
import { paths } from "@/lib/paths"

export const routeObjects: RouteObject[] = [
  {
    path: paths.register,
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "new", element: <NewVerification /> },
    ],
  },
]
