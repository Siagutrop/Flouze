import { BellRing, Crown, Fingerprint, Link2, Lock, LogOut, Sparkles, Trash2, Users } from 'lucide-react';
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Layout } from '../components/Layout';
import { IconPicker, IconView } from '../icons';
import { clearPin, isPinEnabled, requestLock, setPin, verifyPin } from '../pinlock';
import { RewardsSection } from './RewardsSection';

interface Household {
  id: string;
  name: string;
  defaultCurrencyCode: string;
  budgetGenerationDay: number;
  users: { id: string; email: string; displayName: string; role: string }[];
}
interface Currency {
  code: string;
  name: string;
  symbol: string;
}
interface Invitation {
  id: string;
  email: string;
  token: string;
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, updateMe } = useAuth();
  const [avatar, setAvatar] = useState<string | null | undefined>(user?.avatarUrl);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [household, setHousehold] = useState<Household | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [lastInvite, setLastInvite] = useState<string | null>(null);
  const [languages, setLanguages] = useState<Record<string, string>>({});

  const isOwner = user?.role === 'OWNER';

  useEffect(() => {
    api.get<Household>('/household').then(setHousehold);
    api.get<Currency[]>('/currencies').then(setCurrencies);
    fetch('/locales/languages.json')
      .then((r) => r.json())
      .then(setLanguages)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isOwner) {
      api.get<Invitation[]>('/household/invitations').then(setInvitations);
    }
  }, [isOwner]);

  async function updateHousehold(patch: Partial<Household>) {
    setHousehold(await api.patch<Household>('/household', patch));
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    const inv = await api.post<Invitation>('/household/invitations', {
      email: inviteEmail,
    });
    setInvitations([...invitations, inv]);
    setLastInvite(`${location.origin}/register?invite=${inv.token}`);
    setInviteEmail('');
  }

  async function changeLocale(lng: string) {
    await i18n.changeLanguage(lng);
    await api.patch('/users/me', { locale: lng });
  }

  if (!household)
    return (
      <Layout>
        <div className="space-y-3">
          <div className="skeleton h-40" />
          <div className="skeleton h-40" />
        </div>
      </Layout>
    );

  return (
    <Layout>
      <div className="animate-fade-up space-y-5">
        <h1 className="page-title">{t('settings.title')}</h1>
        <section className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <IconView icon={user?.avatarUrl} fallback={user?.displayName} size={22} />
            {t('settings.profile')}
          </h2>
          <div className="flex items-center gap-3">
            <IconView
              icon={avatar}
              fallback={user?.displayName}
              size={52}
              className="rounded-2xl"
            />
            <div className="min-w-0">
              <p className="truncate font-medium">{user?.displayName}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
            <button
              onClick={() => setShowAvatarPicker((v) => !v)}
              className="btn-ghost ml-auto !px-3 !py-1.5 text-xs"
            >
              {showAvatarPicker ? t('common.close') : t('settings.changeAvatar')}
            </button>
          </div>
          {showAvatarPicker && (
            <IconPicker
              value={avatar}
              onChange={async (ic) => {
                setAvatar(ic);
                await updateMe({ avatarUrl: ic || null });
              }}
            />
          )}
        </section>
        <RewardsSection />
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card space-y-3 p-5">
            <h2 className="font-semibold">{t('settings.household')}</h2>
            <input
              className="input"
              defaultValue={household.name}
              disabled={!isOwner}
              onBlur={(e) =>
                e.target.value !== household.name &&
                updateHousehold({ name: e.target.value })
              }
            />
            <label className="lbl block">{t('settings.generationDay')}</label>
            <input
              type="number"
              min={1}
              max={28}
              className="input"
              defaultValue={household.budgetGenerationDay}
              disabled={!isOwner}
              onBlur={(e) =>
                updateHousehold({ budgetGenerationDay: Number(e.target.value) })
              }
            />
            <label className="lbl block">{t('settings.currency')}</label>
            <select
              className="input"
              value={household.defaultCurrencyCode}
              disabled={!isOwner}
              onChange={(e) =>
                updateHousehold({ defaultCurrencyCode: e.target.value })
              }
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <label className="lbl block">{t('settings.language')}</label>
            <select
              className="input"
              value={i18n.language}
              onChange={(e) => changeLocale(e.target.value)}
            >
              {Object.entries(languages).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </section>

          <section className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Users size={17} className="text-teal-300" />
              {t('settings.members')}
            </h2>
            <ul className="divide-y divide-white/[0.05]">
              {household.users.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2.5">
                  <span>
                    {m.displayName}{' '}
                    <span className="text-sm text-slate-500">({m.email})</span>
                  </span>
                  {m.role === 'OWNER' ? (
                    <span className="chip border-amber-400/30 bg-amber-400/10 text-amber-300">
                      <Crown size={12} /> {m.role}
                    </span>
                  ) : (
                    <span className="text-xs uppercase text-slate-500">{m.role}</span>
                  )}
                </li>
              ))}
            </ul>
            {isOwner && (
              <form onSubmit={invite} className="flex gap-2 pt-2">
                <input
                  type="email"
                  required
                  className="input flex-1"
                  placeholder={t('common.email')}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <button className="btn-primary !px-3 !py-2">
                  <Link2 size={16} />
                  {t('settings.invite')}
                </button>
              </form>
            )}
            {lastInvite && (
              <p className="break-all rounded-xl border border-teal-400/25 bg-teal-400/10 p-3 text-sm text-teal-200">
                {t('settings.inviteLink')} : {lastInvite}
              </p>
            )}
          </section>

          <PinSection />
          <PushSection />
          <PasskeySection />
        </div>
        <section className="card flex items-center justify-between gap-3 p-5">
          <div>
            <h2 className="font-semibold">{t('onboarding.relaunch')}</h2>
            <p className="text-xs text-slate-500">{t('onboarding.relaunchHint')}</p>
          </div>
          <Link to="/onboarding" className="btn-ghost shrink-0 !py-2">
            <Sparkles size={15} />
            {t('onboarding.start')}
          </Link>
        </section>
        <LogoutSection />
      </div>
    </Layout>
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Notifications push de rappel (PWA installée requise). */
function PushSection() {
  const { t } = useTranslation();
  const supported =
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    api
      .get<{ subscribed: boolean }>('/push/status')
      .then((r) => setSubscribed(r.subscribed))
      .catch(() => setSubscribed(null));
  }, [supported]);

  async function enable() {
    setBusy(true);
    setErr(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setErr('push.denied');
        return;
      }
      const reg = (await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('no-sw')), 3000),
        ),
      ])) as ServiceWorkerRegistration;
      const { publicKey } = await api.get<{ publicKey: string }>(
        '/push/vapid-key',
      );
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = sub.toJSON();
      await api.post('/push/subscribe', {
        endpoint: sub.endpoint,
        keys: json.keys,
      });
      setSubscribed(true);
    } catch (e) {
      setErr(
        (e as Error).message === 'no-sw' ? 'push.needsPwa' : 'push.failed',
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.delete('/push/subscribe', { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <section className="card space-y-3 p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <BellRing size={17} className="text-teal-300" />
        {t('push.title')}
      </h2>
      <p className="text-sm text-slate-400">{t('push.hint')}</p>
      {err && <p className="text-sm text-rose-400">{t(err)}</p>}
      {subscribed === null ? (
        <p className="text-sm text-slate-500">{t('common.loading')}</p>
      ) : subscribed ? (
        <button onClick={disable} disabled={busy} className="btn-danger w-fit">
          {t('push.disable')}
        </button>
      ) : (
        <button onClick={enable} disabled={busy} className="btn-primary w-fit">
          <BellRing size={16} />
          {t('push.enable')}
        </button>
      )}
    </section>
  );
}

/** Déconnexion explicite depuis les paramètres. */
function LogoutSection() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  return (
    <section className="card flex items-center justify-between p-5">
      <div>
        <h2 className="font-semibold">{t('settings.session')}</h2>
        <p className="text-sm text-slate-500">{t('settings.sessionHint')}</p>
      </div>
      <button onClick={logout} className="btn-danger">
        <LogOut size={16} />
        {t('common.logout')}
      </button>
    </section>
  );
}

const PIN_RE = /^\d{4,6}$/;

/** Activation/changement/suppression du code PIN de déverrouillage. */
function PinSection() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(isPinEnabled);
  const [mode, setMode] = useState<'none' | 'change' | 'disable'>('none');
  const [pin, setPinInput] = useState('');
  const [confirm, setConfirm] = useState('');
  const [current, setCurrent] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setPinInput('');
    setConfirm('');
    setCurrent('');
    setErr(null);
  }

  async function enable(e: FormEvent) {
    e.preventDefault();
    reset_keep_msg();
    if (!PIN_RE.test(pin)) return setErr('pinlock.tooShort');
    if (pin !== confirm) return setErr('pinlock.mismatch');
    await setPin(pin);
    setEnabled(true);
    setMsg('pinlock.enabledMsg');
    reset();
  }

  async function change(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!(await verifyPin(current))) return setErr('pinlock.invalid');
    if (!PIN_RE.test(pin)) return setErr('pinlock.tooShort');
    if (pin !== confirm) return setErr('pinlock.mismatch');
    await setPin(pin);
    setMode('none');
    setMsg('pinlock.enabledMsg');
    reset();
  }

  async function disable(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!(await verifyPin(current))) return setErr('pinlock.invalid');
    clearPin();
    setEnabled(false);
    setMode('none');
    setMsg('pinlock.disabledMsg');
    reset();
  }

  function reset_keep_msg() {
    setErr(null);
    setMsg(null);
  }

  const pinInput = (
    value: string,
    set: (v: string) => void,
    placeholder: string,
  ) => (
    <input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={6}
      className="input text-center tracking-[0.5em]"
      placeholder={placeholder}
      value={value}
      onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
    />
  );

  return (
    <section className="card space-y-3 p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Lock size={17} className="text-teal-300" />
        {t('pinlock.title')}
      </h2>
      <p className="text-sm text-slate-400">{t('pinlock.hint')}</p>
      {msg && <p className="text-sm text-emerald-300">{t(msg)}</p>}
      {err && <p className="text-sm text-rose-400">{t(err)}</p>}

      {!enabled ? (
        <form onSubmit={enable} className="space-y-2">
          {pinInput(pin, setPinInput, t('pinlock.pin'))}
          {pinInput(confirm, setConfirm, t('pinlock.confirm'))}
          <button className="btn-primary w-fit">{t('pinlock.enable')}</button>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button onClick={requestLock} className="btn-ghost !py-2">
              <Lock size={15} />
              {t('pinlock.lockNow')}
            </button>
            <button
              onClick={() => {
                setMode(mode === 'change' ? 'none' : 'change');
                reset();
              }}
              className="btn-ghost !py-2"
            >
              {t('pinlock.change')}
            </button>
            <button
              onClick={() => {
                setMode(mode === 'disable' ? 'none' : 'disable');
                reset();
              }}
              className="btn-danger !py-2"
            >
              {t('pinlock.disable')}
            </button>
          </div>
          {mode !== 'none' && (
            <form
              onSubmit={mode === 'change' ? change : disable}
              className="space-y-2 animate-fade-up"
            >
              {pinInput(current, setCurrent, t('pinlock.current'))}
              {mode === 'change' && (
                <>
                  {pinInput(pin, setPinInput, t('pinlock.pin'))}
                  {pinInput(confirm, setConfirm, t('pinlock.confirm'))}
                </>
              )}
              <button className="btn-primary w-fit">{t('common.save')}</button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

interface Passkey {
  id: string;
  name: string;
  createdAt: string;
}

/** Enregistrement/gestion des passkeys (empreinte, Face ID, Windows Hello). */
function PasskeySection() {
  const { t, i18n } = useTranslation();
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const supported = browserSupportsWebAuthn();

  const reload = () =>
    api.get<Passkey[]>('/auth/webauthn/credentials').then(setKeys).catch(() => {});
  useEffect(() => {
    if (supported) reload();
  }, [supported]);

  async function register() {
    setBusy(true);
    setError(null);
    try {
      const options = await api.post<PublicKeyCredentialCreationOptionsJSON>(
        '/auth/webauthn/register-options',
      );
      const attestation = await startRegistration({ optionsJSON: options });
      await api.post('/auth/webauthn/register-verify', {
        response: attestation,
        name: t('webauthn.deviceName'),
      });
      reload();
    } catch {
      setError('webauthn.registerFailed');
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <section className="card space-y-3 p-5 md:col-span-2">
      <h2 className="flex items-center gap-2 font-semibold">
        <Fingerprint size={17} className="text-teal-300" />
        {t('webauthn.title')}
      </h2>
      <p className="text-sm text-slate-400">{t('webauthn.hint')}</p>
      <ul className="divide-y divide-white/[0.05]">
        {keys.map((k) => (
          <li key={k.id} className="flex items-center justify-between py-2.5 text-sm">
            <span className="flex items-center gap-2">
              <Fingerprint size={15} className="text-slate-500" />
              {k.name}
              <span className="text-xs text-slate-500">
                · {new Date(k.createdAt).toLocaleDateString(i18n.language)}
              </span>
            </span>
            <button
              onClick={async () => {
                await api.delete(`/auth/webauthn/credentials/${k.id}`);
                reload();
              }}
              className="text-slate-600 hover:text-rose-400"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {keys.length === 0 && (
          <p className="py-2 text-sm text-slate-500">{t('webauthn.empty')}</p>
        )}
      </ul>
      {error && <p className="text-sm text-rose-400">{t(error)}</p>}
      <button onClick={register} disabled={busy} className="btn-primary w-fit">
        <Fingerprint size={16} />
        {t('webauthn.register')}
      </button>
    </section>
  );
}
