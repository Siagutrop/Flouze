import { Fingerprint, PiggyBank } from 'lucide-react';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth';

export function LoginPage() {
  const { t } = useTranslation();
  const { login, passkeyLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const supportsPasskey = browserSupportsWebAuthn();

  async function onPasskey() {
    setBusy(true);
    setError(null);
    try {
      await passkeyLogin(email);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'auth.passkeyFailed');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/');
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
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight">{t('app.name')}</h1>
            <p className="text-sm text-slate-500">{t('app.tagline')}</p>
          </div>
        </div>
        <input
          type="email"
          required
          autoComplete="email"
          placeholder={t('common.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder={t('common.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
        {error && <p className="text-sm text-rose-400">{t(error)}</p>}
        <button disabled={busy} className="btn-primary w-full py-3">
          {t('auth.login')}
        </button>
        {supportsPasskey && (
          <>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="h-px flex-1 bg-white/10" />
              {t('auth.or')}
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <button
              type="button"
              disabled={busy || !email}
              onClick={onPasskey}
              title={!email ? t('auth.passkeyNeedEmail') : undefined}
              className="btn-ghost w-full py-3"
            >
              <Fingerprint size={18} className="text-teal-300" />
              {t('auth.passkeyLogin')}
            </button>
          </>
        )}
        <p className="text-center text-sm text-slate-400">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-medium text-teal-300 hover:text-teal-200">
            {t('auth.register')}
          </Link>
        </p>
      </form>
    </div>
  );
}
