/**
 * Route map — declarative RouteObject[] consumed by createBrowserRouter.
 *
 * A single layout route renders the operator's shell (sidebar cover + inset) and
 * an <Outlet /> for the active surface; every surface joins as a child here.
 *
 * The map is the operator's day in the order they move through it: the archive
 * search they start from, the pre-check a packet goes through, and the register
 * of cases. A surface that addresses one subject takes the addressed path as
 * well as the bare one, so a particular case can be linked to and returned to.
 */
import { type RouteObject } from 'react-router-dom';

import { ArchiveSearch } from '@/pages/archive-search';
import { CaseIntake } from '@/pages/case-intake';
import { Cases } from '@/pages/cases';
import { VerificationDetails } from '@/pages/verification-details';
import { paths } from '@/shared/config';
import { AppShell } from '@/widgets/app-shell';

export const routeObjects: RouteObject[] = [
  {
    path: paths.search,
    element: <AppShell />,
    children: [
      { index: true, element: <ArchiveSearch /> },
      { path: 'intake', element: <CaseIntake /> },
      { path: 'cases', element: <Cases /> },
      { path: 'cases/:id', element: <VerificationDetails /> },
    ],
  },
];
