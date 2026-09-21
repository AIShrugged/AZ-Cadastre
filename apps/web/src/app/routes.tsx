/**
 * Route map — declarative RouteObject[] consumed by createBrowserRouter.
 *
 * Three maps in one, and which of them a person walks is decided by the account
 * they signed in with (ADR-0029):
 *
 *  - **The gate**, outside every frame: sign in, and open an account. The only
 *    two paths reachable with no session at all.
 *  - **The workspace**, for an `operator`: the office's day in the order they
 *    move through it — the archive search they start from, the pre-check a
 *    packet goes through, and the register of cases.
 *  - **The cabinet**, for a `user`: the submissions they have filed, filing
 *    another, and one of them.
 *
 * Both signed-in maps are drawn in the same shell, which reads the role and
 * puts the matching navigation in the cover. A surface that addresses one
 * subject takes the addressed path as well as the bare one, so a particular
 * case — or a particular submission — can be linked to and returned to.
 *
 * The role is asked **above** the maps and never inside a surface: `RequireRole`
 * is a pathless layout route, so `/cases` is still written `/cases` and the
 * only thing the map gains for having two readers is one line of nesting.
 */
import { type RouteObject } from 'react-router-dom';

import { Analytics } from '@/pages/analytics';
import { ArchiveSearch } from '@/pages/archive-search';
import { CaseIntake } from '@/pages/case-intake';
import { Cases } from '@/pages/cases';
import { MySubmission } from '@/pages/my-submission';
import { MySubmissions } from '@/pages/my-submissions';
import { NewSubmission } from '@/pages/new-submission';
import { Register } from '@/pages/register';
import { SignIn } from '@/pages/sign-in';
import { VerificationDetails } from '@/pages/verification-details';
import { paths } from '@/shared/config';
import { AppShell } from '@/widgets/app-shell';

import { NoSuchRoute, RequireRole, RequireSession } from './access';

export const routeObjects: RouteObject[] = [
  { path: paths.login, element: <SignIn /> },
  { path: paths.register, element: <Register /> },
  {
    element: <RequireSession />,
    children: [
      {
        element: <RequireRole role='operator' />,
        children: [
          {
            path: paths.search,
            element: <AppShell />,
            children: [
              { index: true, element: <ArchiveSearch /> },
              { path: 'intake', element: <CaseIntake /> },
              { path: 'cases', element: <Cases /> },
              { path: 'cases/:id', element: <VerificationDetails /> },
              { path: 'analytics', element: <Analytics /> },
            ],
          },
        ],
      },
      {
        element: <RequireRole role='user' />,
        children: [
          {
            path: paths.cabinet,
            element: <AppShell />,
            children: [
              { index: true, element: <MySubmissions /> },
              // Before `:id`, so the form is the form and never a submission
              // whose id is the word "new".
              { path: 'new', element: <NewSubmission /> },
              { path: ':id', element: <MySubmission /> },
            ],
          },
        ],
      },
      /*
       * A path in neither map. Under the session gate rather than beside it, so
       * a stranger who followed a stale link is asked who they are first and
       * lands on it afterwards, instead of being bounced off a home page they
       * were never shown.
       */
      { path: '*', element: <NoSuchRoute /> },
    ],
  },
];
