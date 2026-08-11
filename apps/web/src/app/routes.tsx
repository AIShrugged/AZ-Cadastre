/**
 * Route map — declarative RouteObject[] consumed by createBrowserRouter.
 *
 * A single layout route renders the register shell (sidebar cover + inset) and
 * an <Outlet /> for the active surface; future surfaces join as children here.
 *
 * A surface that addresses one subject takes both paths — the bare one, which
 * opens on the first entry, and the addressed one, so a particular package or
 * profile can be linked to and returned to.
 */
import { type RouteObject } from "react-router-dom"

import { AppShell } from "@/widgets/app-shell"
import { Dashboard } from "@/pages/dashboard"
import { NewVerification } from "@/pages/new-verification"
import { Profiles } from "@/pages/profiles"
import { VerificationDetails } from "@/pages/verification-details"
import { paths } from "@/shared/config"

export const routeObjects: RouteObject[] = [
  {
    path: paths.register,
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "new", element: <NewVerification /> },
      { path: "profiles", element: <Profiles /> },
      { path: "profiles/:profileKey", element: <Profiles /> },
      { path: "package/:id", element: <VerificationDetails /> },
    ],
  },
]
