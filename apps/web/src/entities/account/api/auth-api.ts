/**
 * The four auth routes, and the one query every signed-in screen is drawn from.
 *
 * `GET /auth/me` is the session as far as this client is concerned: there is no
 * token to keep, because the session is an httpOnly cookie the browser carries
 * and JavaScript cannot read. So "am I signed in" is a question with an answer
 * on the wire and nowhere else — which is also why a hard refresh keeps the
 * reader where they were, and why nothing here writes to `localStorage`.
 *
 * Answers are parsed through the contract's own schema, like every other
 * endpoint on this base query: a session whose shape has drifted must fail here,
 * named, rather than draw an empty name in the sidebar.
 */
import { api } from '@/shared/api';
import {
  AccountDtoSchema,
  type AccountDto,
  type LoginRequest,
  type RegisterAccountRequest,
} from '@cadastre/api-contracts/accounts';

export const authApi = api.injectEndpoints({
  endpoints: build => ({
    /*
     * A 401 from here is an answer and not a failure: it says nobody is signed
     * in, which is exactly what the app asks at boot in order to know whether
     * to draw the shell or the gate.
     */
    getMe: build.query<AccountDto, void>({
      query: () => '/auth/me',
      transformResponse: (response: unknown) =>
        AccountDtoSchema.parse(response),
      providesTags: ['Session'],
    }),
    /*
     * Signing in sets the cookie and answers with the account. `Package` goes
     * with `Session` because whose submissions `GET /packages` answers with is
     * decided by the session: anything read before this call was read as
     * somebody else.
     */
    signIn: build.mutation<AccountDto, LoginRequest>({
      query: body => ({ url: '/auth/login', method: 'POST', body }),
      transformResponse: (response: unknown) =>
        AccountDtoSchema.parse(response),
      invalidatesTags: ['Session', 'Package'],
    }),
    /*
     * Opening an account does **not** sign the caller in — the service is
     * explicit about it — so this invalidates nothing. The form calls `signIn`
     * next with the same credentials.
     */
    registerAccount: build.mutation<AccountDto, RegisterAccountRequest>({
      query: body => ({ url: '/auth/register', method: 'POST', body }),
      transformResponse: (response: unknown) =>
        AccountDtoSchema.parse(response),
    }),
    /*
     * 204 and the cookie cleared. Everything the session decided the contents
     * of goes with it: the next reader of this browser must not be handed a
     * page of somebody else's register out of a cache.
     */
    signOut: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      invalidatesTags: ['Session', 'Package', 'RegistrySummary'],
    }),
  }),
});

export const {
  useGetMeQuery,
  useSignInMutation,
  useRegisterAccountMutation,
  useSignOutMutation,
} = authApi;
