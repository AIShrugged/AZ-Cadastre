/**
 * Route map — declarative RouteObject[] consumed by createBrowserRouter.
 *
 * A single layout route renders the register shell (sidebar cover + inset) and
 * an <Outlet /> for the active surface. Add future surfaces (Verification
 * Details, Profiles, Audit trail) as children here.
 */
import { type RouteObject } from "react-router-dom"

import { AppShell } from "@/widgets/app-shell"
import { Dashboard } from "@/pages/dashboard"
import { NewVerification } from "@/pages/new-verification"
import { VerificationDetails } from "@/pages/verification-details"
import { paths } from "@/shared/config"

export const routeObjects: RouteObject[] = [
  {
    path: paths.register,
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "new", element: <NewVerification /> },
      { path: "package/:id", element: <VerificationDetails /> },
    ],
  },
]
