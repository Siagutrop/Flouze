import { PiggyBank } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth';

export function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    householdName: '',
    invitationToken: params.get('invite') ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({
        email: form.email,
        password: form.password,
        displayName: form.displayName,
        householdName: form.householdName || undefined,
        invitationToken: form.invitationToken || undefined,
      });
      navigate('/onboarding');
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'errors.generic');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-teal-400/15 blur-3xl" />
      <form
        onSubmit={onSubmit}
        className="card relative w-full max-w-sm space-y-4 p-8 animate-fade-up"
      >
        <div className="mb-2 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 shadow-glow">
            <PiggyBank className="text-night-950" size={30} strokeWidth={2.4} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {t('auth.register')}
          </h1>
        </div>
        <input
          type="email"
          required
          autoComplete="email"
          placeholder={t('common.email')}
          value={form.email}
          onChange={set('email')}
          className="input"
        />
        <input
          required
          placeholder={t('auth.displayName')}
          value={form.displayName}
          onChange={set('displayName')}
          className="input"
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder={`${t('common.password')} (${t('auth.passwordHint')})`}
          value={form.password}
          onChange={set('password')}
          className="input"
        />
        {form.invitationToken ? (
          <input
            placeholder={t('auth.invitationToken')}
            value={form.invitationToken}
            onChange={set('invitationToken')}
            className="input"
          />
        ) : (
          <input
            placeholder={t('auth.householdName')}
            value={form.householdName}
            onChange={set('householdName')}
            className="input"
          />
        )}
        {error && <p className="text-sm text-rose-400">{t(error)}</p>}
        <button disabled={busy} className="btn-primary w-full py-3">
          {t('auth.register')}
        </button>
        <p className="text-center text-sm text-slate-400">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="font-medium text-teal-300 hover:text-teal-200">
            {t('auth.login')}
          </Link>
        </p>
      </form>
    </div>
  );
}
