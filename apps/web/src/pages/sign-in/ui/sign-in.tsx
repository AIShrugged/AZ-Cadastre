/**
 * Signing in — a login, a password, and nothing else on the page.
 *
 * **The field is a login and not an address.** The office's own account is
 * `cadastre-operator`, which no address validator would accept; an applicant
 * will very likely type their email in, and that is fine — the system stores
 * and compares the string either way. So no `type='email'`, no pattern, no
 * "that doesn't look like an email": a box that refuses a valid login is a box
 * nobody can sign in through.
 *
 * **Nothing is checked before it is sent.** The credential offered is either
 * somebody's or it is not, and a form that refused a short password locally
 * would be telling a caller what this system has on file. The contract says the
 * same thing about the wire (`LoginRequestSchema`), and the screen agrees with
 * it rather than adding a rule of its own.
 *
 * **The refusal is said once, under the form.** One sentence for a login nobody
 * answers to and for the wrong password against one that exists, because the
 * service answers the same 401 to both on purpose.
 *
 * **Where it lands is not decided here.** A successful sign-in invalidates the
 * session, `GET /auth/me` answers afresh, and this page redirects on what it
 * reads — so the route a person was sent here from, the role they turn out to
 * have, and a reader who was signed in all along take one code path.
 */
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { useSession, useSignInMutation } from '@/entities/account';
import { failureCode } from '@/shared/api';
import { paths } from '@/shared/config';
import { translateOr, useI18n } from '@/shared/i18n';
import { intendedRoute } from '@/shared/lib/intended-route';
import { Button } from '@/shared/ui/button';
import { Gate, GateField } from '@/widgets/gate';

export function SignIn() {
  const { t } = useI18n();
  const location = useLocation();
  const { session } = useSession();
  const [signIn, { isLoading }] = useSignInMutation();

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  /*
   * Held past the mutation's own `isLoading`: the session is asked again after
   * a successful sign-in, and a button that went idle in the gap would invite a
   * second submission of credentials that have already been accepted.
   */
  const [handingOver, setHandingOver] = useState(false);

  if (session.state === 'signed-in') {
    return (
      <Navigate
        to={intendedRoute(location.state) ?? paths.home(session.account.role)}
        replace
      />
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setRefusal(null);
    try {
      await signIn({ login, password }).unwrap();
      setHandingOver(true);
    } catch (error) {
      // The service names the rule it refused with a stable code; anything
      // else — a network drop, the service not there at all — is said as
      // itself rather than as "wrong password", which would send a person
      // looking for a mistake they did not make.
      const code = failureCode(error);
      setRefusal(
        code
          ? translateOr(t, `error.${code}`, t('gate.sign_in.unavailable'))
          : t('gate.sign_in.unavailable'),
      );
    }
  }

  const busy = isLoading || handingOver;

  return (
    <Gate
      title={t('gate.sign_in.title')}
      lead={t('gate.sign_in.lead')}
      footer={
        <>
          {t('gate.sign_in.no_account')}{' '}
          <Link
            to={paths.register}
            className='font-medium text-primary underline-offset-4 hover:underline'
          >
            {t('gate.sign_in.to_register')}
          </Link>
        </>
      }
    >
      <form
        onSubmit={event => void onSubmit(event)}
        className='flex flex-col gap-4'
      >
        <GateField
          label={t('gate.field.login')}
          hint={t('gate.field.login_hint')}
          name='login'
          autoComplete='username'
          autoFocus
          required
          value={login}
          onChange={event => setLogin(event.target.value)}
        />
        <GateField
          label={t('gate.field.password')}
          type='password'
          name='password'
          autoComplete='current-password'
          required
          value={password}
          onChange={event => setPassword(event.target.value)}
        />

        {refusal && (
          <p
            role='alert'
            className='rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-[0.8125rem] leading-snug text-destructive'
          >
            {refusal}
          </p>
        )}

        <Button
          type='submit'
          size='lg'
          disabled={busy}
          aria-disabled={busy}
          className='mt-1 w-full'
        >
          {busy ? t('gate.sign_in.signing') : t('gate.sign_in.action')}
        </Button>
      </form>
    </Gate>
  );
}
