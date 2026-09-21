/**
 * Opening an account — an applicant's, and only ever an applicant's.
 *
 * The route creates a `user` and cannot be asked for anything else, so there is
 * no role on this form and no place for one: an operator is the office's own
 * account and is seeded, never self-registered. The form says so rather than
 * leaving a person to wonder where the other kind of account is opened.
 *
 * **A login, not an email**, and the same for the same reasons as the sign-in
 * form: most applicants will type their address in, and nothing validates it as
 * one. The hint says what the box takes rather than the box refusing what it
 * was given.
 *
 * **The name arrives in two boxes** because the contract takes two, and a
 * display name is this client's to compose afterwards.
 *
 * **Registering does not sign anybody in** — the service is explicit about it —
 * so this form does what the caller has to do next: it registers, then signs in
 * with the credentials just used. The person typed them once and there is
 * nothing left to ask them; a screen that stopped at "account created, now sign
 * in" would be asking them to prove the form worked.
 *
 * What is checked here is only what the contract publishes as the shape of the
 * request — the lengths, and nothing invented beside them. A field the server
 * would refuse is worth saying before the round trip; a rule the server does
 * not have is a rule that locks somebody out of a login they could have had.
 */
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';

import {
  useRegisterAccountMutation,
  useSession,
  useSignInMutation,
} from '@/entities/account';
import { failureCode } from '@/shared/api';
import { paths } from '@/shared/config';
import { translateOr, useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Gate, GateField } from '@/widgets/gate';
import {
  LOGIN_MAX_LENGTH,
  LOGIN_MIN_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@cadastre/api-contracts/accounts';

type Draft = {
  firstName: string;
  lastName: string;
  login: string;
  password: string;
};

const BLANK: Draft = { firstName: '', lastName: '', login: '', password: '' };

type Field = keyof Draft;

/**
 * What the request shape refuses, said before it is sent — and nothing else.
 *
 * The login is folded the way the schema folds it (trimmed, lower-cased) before
 * it is measured, so a login that would be accepted is never refused here for
 * the spaces around it.
 */
function faults(draft: Draft): Partial<Record<Field, string>> {
  const found: Partial<Record<Field, string>> = {};
  const login = draft.login.trim().toLowerCase();
  const name = (value: string) => value.trim().length;

  if (login.length < LOGIN_MIN_LENGTH || login.length > LOGIN_MAX_LENGTH) {
    found.login = 'gate.fault.login';
  }
  if (
    name(draft.firstName) < NAME_MIN_LENGTH ||
    name(draft.firstName) > NAME_MAX_LENGTH
  ) {
    found.firstName = 'gate.fault.name';
  }
  if (
    name(draft.lastName) < NAME_MIN_LENGTH ||
    name(draft.lastName) > NAME_MAX_LENGTH
  ) {
    found.lastName = 'gate.fault.name';
  }
  if (
    draft.password.length < PASSWORD_MIN_LENGTH ||
    draft.password.length > PASSWORD_MAX_LENGTH
  ) {
    found.password = 'gate.fault.password';
  }

  return found;
}

export function Register() {
  const { t } = useI18n();
  const { session } = useSession();
  const [registerAccount, { isLoading: opening }] =
    useRegisterAccountMutation();
  const [signIn, { isLoading: signingIn }] = useSignInMutation();

  const [draft, setDraft] = useState<Draft>(BLANK);
  /* Nothing is marked wrong until the form has been sent once: a name box that
     turns red while it is still being typed into is a box scolding somebody for
     not having finished. */
  const [checked, setChecked] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [handingOver, setHandingOver] = useState(false);

  if (session.state === 'signed-in') {
    return <Navigate to={paths.home(session.account.role)} replace />;
  }

  const found = faults(draft);
  const set = (field: Field) => (event: ChangeEvent<HTMLInputElement>) =>
    setDraft(current => ({ ...current, [field]: event.target.value }));
  const fault = (field: Field): string | null => {
    const key = checked ? found[field] : undefined;
    if (key === undefined) return null;
    return t(key, {
      min: field === 'password' ? PASSWORD_MIN_LENGTH : LOGIN_MIN_LENGTH,
      max: field === 'password' ? PASSWORD_MAX_LENGTH : LOGIN_MAX_LENGTH,
    });
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setChecked(true);
    setRefusal(null);
    if (Object.keys(faults(draft)).length > 0) return;

    const credentials = {
      login: draft.login.trim().toLowerCase(),
      password: draft.password,
    };

    try {
      await registerAccount({
        ...credentials,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
      }).unwrap();
    } catch (error) {
      // `LOGIN_ALREADY_TAKEN` is the one a person can act on, and it is the one
      // they will meet: it is said as itself and never as "registration failed".
      const code = failureCode(error);
      setRefusal(
        code
          ? translateOr(t, `error.${code}`, t('gate.register.unavailable'))
          : t('gate.register.unavailable'),
      );
      return;
    }

    try {
      await signIn(credentials).unwrap();
      setHandingOver(true);
    } catch {
      // The account exists; only the second call failed. Say that, rather than
      // leaving them to register again and be told the login is taken.
      setRefusal(t('gate.register.opened_not_signed_in'));
    }
  }

  const busy = opening || signingIn || handingOver;

  return (
    <Gate
      title={t('gate.register.title')}
      lead={t('gate.register.lead')}
      footer={
        <>
          {t('gate.register.have_account')}{' '}
          <Link
            to={paths.login}
            className='font-medium text-primary underline-offset-4 hover:underline'
          >
            {t('gate.register.to_sign_in')}
          </Link>
        </>
      }
    >
      <form
        onSubmit={event => void onSubmit(event)}
        className='flex flex-col gap-4'
      >
        <div className='grid gap-4 sm:grid-cols-2'>
          <GateField
            label={t('gate.field.first_name')}
            name='given-name'
            autoComplete='given-name'
            autoFocus
            value={draft.firstName}
            onChange={set('firstName')}
            error={fault('firstName')}
          />
          <GateField
            label={t('gate.field.last_name')}
            name='family-name'
            autoComplete='family-name'
            value={draft.lastName}
            onChange={set('lastName')}
            error={fault('lastName')}
          />
        </div>
        <GateField
          label={t('gate.field.login')}
          hint={t('gate.field.login_hint')}
          name='login'
          autoComplete='username'
          value={draft.login}
          onChange={set('login')}
          error={fault('login')}
        />
        <GateField
          label={t('gate.field.password')}
          hint={t('gate.field.password_hint', { min: PASSWORD_MIN_LENGTH })}
          type='password'
          name='new-password'
          autoComplete='new-password'
          value={draft.password}
          onChange={set('password')}
          error={fault('password')}
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
          {busy ? t('gate.register.opening') : t('gate.register.action')}
        </Button>

        <p className='text-[0.75rem] leading-snug text-muted-foreground'>
          {t('gate.register.applicants_only')}
        </p>
      </form>
    </Gate>
  );
}
