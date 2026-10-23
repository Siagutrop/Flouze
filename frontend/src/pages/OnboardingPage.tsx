import {
  ArrowLeft,
  ArrowRight,
  Check,
  Fingerprint,
  Landmark,
  Lock,
  PiggyBank,
  Plus,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { SUGG_ENVELOPES } from '../envelopeSuggestions';
import { IconView } from '../icons';
import { parseToMinorUnits } from '../money';
import { setPin } from '../pinlock';
import { Category } from '../types';

const ONBOARDED_KEY = (uid: string) => `flouze:onboarded:${uid}`;

/** Suggestions de comptes — les clés sont traduites via onboarding.sug.* */
const SUGG_ACCOUNTS = [
  { key: 'checking', type: 'CHECKING', icon: '🏦' },
  { key: 'savings', type: 'SAVINGS', icon: '🐷' },
  { key: 'cash', type: 'CASH', icon: '💵' },
] as const;

const STEPS = 5;
const PIN_RE = /^\d{4,6}$/;

interface AccRow {
  key: string;
  name: string;
  type: string;
  balance: string;
  on: boolean;
}

export function OnboardingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [finishErr, setFinishErr] = useState<string | null>(null);
  const [shared, setShared] = useState(true);
  const [accs, setAccs] = useState<AccRow[]>([
    { key: 'checking', name: '', type: 'CHECKING', balance: '', on: true },
  ]);
  const [newAcc, setNewAcc] = useState('');
  const [selCats, setSelCats] = useState<Set<string>>(new Set(['food', 'housing']));
  const [selEnvs, setSelEnvs] = useState<Set<string>>(
    new Set(['housing/rent', 'food/groceries']),
  );
  const [customEnvs, setCustomEnvs] = useState<string[]>([]);
  const [newEnv, setNewEnv] = useState('');
  // Sécurité : PIN + passkey (optionnels)
  const [pin, setPinV] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinDone, setPinDone] = useState(false);
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [pkDone, setPkDone] = useState(false);
  const [pkErr, setPkErr] = useState<string | null>(null);
  const [pkBusy, setPkBusy] = useState(false);
  const pkSupported = browserSupportsWebAuthn();

  const accName = (key: string) => t(`onboarding.sug.${key}`);

  const toggleSet = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const toggleCat = (key: string) => {
    const cat = SUGG_ENVELOPES.find((c) => c.key === key)!;
    const next = new Set(selCats);
    const envs = new Set(selEnvs);
    if (next.has(key)) {
      next.delete(key);
      cat.envelopes.forEach((e) => envs.delete(`${key}/${e.key}`));
    } else {
      next.add(key);
      cat.envelopes.forEach((e) => envs.add(`${key}/${e.key}`));
    }
    setSelCats(next);
    setSelEnvs(envs);
  };

  const addCustomEnv = () => {
    const name = newEnv.trim();
    if (!name) return;
    setCustomEnvs((l) => [...l, name]);
    setNewEnv('');
  };

  const done = () => {
    if (user?.id) localStorage.setItem(ONBOARDED_KEY(user.id), '1');
    navigate('/');
  };

  /**
   * Crée comptes, catégories et enveloppes choisis, puis génère le budget
   * du mois. Chaque création est tentée individuellement : un échec n'arrête
   * pas les autres ; en cas d'échecs, ils sont affichés et on reste ici.
   */
  async function finish() {
    setBusy(true);
    setFinishErr(null);
    const failed: string[] = [];
    const attempt = (label: string, p: Promise<unknown>) =>
      p.catch(() => failed.push(label));

    const jobs: Promise<unknown>[] = [];
    for (const a of accs) {
      const name = (
        a.name ||
        (SUGG_ACCOUNTS.some((s) => s.key === a.key) ? accName(a.key) : '')
      ).trim();
      if (!a.on || !name) continue;
      jobs.push(
        attempt(
          name,
          api.post('/accounts', {
            name,
            type: a.type,
            currencyCode: 'EUR',
            initialBalance: (parseToMinorUnits(a.balance || '0', 2) ?? 0n).toString(),
            shared,
          }),
        ),
      );
    }
    await Promise.all(jobs);

    // Catégories en série : les enveloppes ont besoin de leur id
    const catIds: Record<string, string> = {};
    for (const c of SUGG_ENVELOPES) {
      if (!selCats.has(c.key)) continue;
      const name = t(`onboarding.sug.${c.key}`);
      try {
        const cat = await api.post<Category>('/categories', {
          name,
          icon: c.icon,
          shared,
        });
        catIds[c.key] = cat.id;
      } catch {
        failed.push(name);
      }
    }

    const envJobs: Promise<unknown>[] = [];
    for (const c of SUGG_ENVELOPES) {
      for (const e of c.envelopes) {
        if (!selEnvs.has(`${c.key}/${e.key}`) || !catIds[c.key]) continue;
        const name = t(`onboarding.sug.${e.key}`);
        envJobs.push(
          attempt(
            name,
            api.post('/envelopes', {
              name,
              icon: e.icon,
              categoryId: catIds[c.key],
              shared,
            }),
          ),
        );
      }
    }
    for (const name of customEnvs) {
      if (name.trim()) {
        envJobs.push(attempt(name, api.post('/envelopes', { name: name.trim(), shared })));
      }
    }
    await Promise.all(envJobs);

    // Budget du mois courant prêt à l'emploi (foyer si partagé)
    const now = new Date();
    await api
      .post('/budgets/generate', { year: now.getFullYear(), month: now.getMonth() + 1 })
      .catch(() => {});

    setBusy(false);
    if (failed.length) {
      setFinishErr(failed.join(', '));
      return;
    }
    done();
  }

  async function enablePin() {
    setPinErr(null);
    if (!PIN_RE.test(pin)) return setPinErr('pinlock.tooShort');
    if (pin !== pinConfirm) return setPinErr('pinlock.mismatch');
    await setPin(pin);
    setPinDone(true);
  }

  /** Enregistrement passkey : options → cérémonie biométrique → vérif. */
  async function enablePasskey() {
    setPkBusy(true);
    setPkErr(null);
    try {
      const options = await api.post<PublicKeyCredentialCreationOptionsJSON>(
        '/auth/webauthn/register-options',
      );
      const attestation = await startRegistration({ optionsJSON: options });
      await api.post('/auth/webauthn/register-verify', {
        response: attestation,
        name: t('webauthn.deviceName'),
      });
      setPkDone(true);
    } catch {
      setPkErr('webauthn.registerFailed');
    } finally {
      setPkBusy(false);
    }
  }

  const toggleAcc = (i: number) =>
    setAccs((l) => l.map((a, j) => (j === i ? { ...a, on: !a.on } : a)));

  const accRows = [
    ...accs,
    // Suggestions pas encore ajoutées
    ...SUGG_ACCOUNTS.filter((s) => !accs.some((a) => a.key === s.key)).map((s) => ({
      key: s.key,
      name: '',
      type: s.type,
      balance: '',
      on: false,
    })),
  ];

  const setRow = (key: string, patch: Partial<AccRow>) =>
    setAccs((l) => {
      const i = l.findIndex((a) => a.key === key);
      if (i >= 0) return l.map((a, j) => (j === i ? { ...a, ...patch } : a));
      return [...l, { key, name: '', type: 'CHECKING', balance: '', on: true, ...patch }];
    });

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-teal-400/15 blur-3xl" />
      <div className="card relative w-full max-w-lg space-y-5 p-6 animate-fade-up sm:p-8">
        {/* Progression */}
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: STEPS }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-teal-300' : i < step ? 'w-1.5 bg-teal-400/60' : 'w-1.5 bg-white/15'
              }`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 shadow-glow">
              <PiggyBank className="text-night-950" size={34} strokeWidth={2.4} />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {t('onboarding.welcome', { name: user?.displayName })}
            </h1>
            <p className="text-sm text-slate-400">{t('onboarding.welcomeBody')}</p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Landmark size={18} className="text-teal-300" />
              {t('onboarding.stepAccounts')}
            </h2>
            <p className="text-sm text-slate-400">{t('onboarding.accountsHint')}</p>
            <div className="space-y-2">
              {accRows.map((a) => {
                const sugg = SUGG_ACCOUNTS.find((s) => s.key === a.key);
                const icon = sugg?.icon ?? '💳';
                const name = a.name || accName(a.key);
                return (
                  <div key={a.key} className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        const i = accs.findIndex((x) => x.key === a.key);
                        if (i >= 0) toggleAcc(i);
                        else setRow(a.key, { name, on: true });
                      }}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-base transition ${
                        a.on
                          ? 'border-teal-400/40 bg-teal-400/15'
                          : 'border-white/10 bg-white/[0.03] opacity-50'
                      }`}
                    >
                      {icon}
                    </button>
                    <input
                      className="input min-w-0 flex-1"
                      value={name}
                      disabled={!a.on}
                      onChange={(e) => setRow(a.key, { name: e.target.value })}
                      placeholder={t('accounts.namePlaceholder')}
                    />
                    <input
                      className="input !w-24 text-right"
                      placeholder={t('onboarding.initialBalance')}
                      inputMode="decimal"
                      value={a.balance}
                      disabled={!a.on}
                      onChange={(e) => setRow(a.key, { balance: e.target.value })}
                    />
                  </div>
                );
              })}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newAcc.trim();
                  if (!name) return;
                  setAccs((l) => [...l, { key: `custom-${Date.now()}`, name, type: 'CHECKING', balance: '', on: true }]);
                  setNewAcc('');
                }}
                className="flex gap-2"
              >
                <input
                  className="input flex-1"
                  placeholder={t('onboarding.customAccount')}
                  value={newAcc}
                  onChange={(e) => setNewAcc(e.target.value)}
                />
                <button type="submit" className="icon-btn shrink-0 text-teal-300" aria-label={t('common.add')}>
                  <Plus size={16} />
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Wallet size={18} className="text-teal-300" />
              {t('onboarding.stepEnvelopes')}
            </h2>
            <p className="text-sm text-slate-400">{t('onboarding.envelopesHint')}</p>
            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {SUGG_ENVELOPES.map((c) => (
                <div key={c.key}>
                  <button
                    type="button"
                    onClick={() => toggleCat(c.key)}
                    className={`mb-1.5 flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm font-semibold transition ${
                      selCats.has(c.key) ? 'text-teal-300' : 'text-slate-400'
                    }`}
                  >
                    <span className="text-base">{c.icon}</span>
                    {t(`onboarding.sug.${c.key}`)}
                    <span className={`ml-auto h-4 w-4 rounded border transition ${
                      selCats.has(c.key) ? 'border-teal-400 bg-teal-400/30' : 'border-white/20'
                    }`} />
                  </button>
                  {c.envelopes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-7">
                      {c.envelopes.map((e) => {
                        const k = `${c.key}/${e.key}`;
                        const on = selEnvs.has(k);
                        return (
                          <button
                            type="button"
                            key={k}
                            onClick={() => setSelEnvs((s) => toggleSet(s, k))}
                            className={`chip transition ${
                              on
                                ? 'border-teal-400/40 bg-teal-400/15 text-teal-200'
                                : 'text-slate-400'
                            }`}
                          >
                            <span className="mr-1">{e.icon}</span>
                            {t(`onboarding.sug.${e.key}`)}
                            {on && <X size={11} className="ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {customEnvs.map((n, i) => (
                <span key={i} className="chip border-teal-400/40 bg-teal-400/15 text-teal-200">
                  {n}
                  <button
                    type="button"
                    onClick={() => setCustomEnvs((l) => l.filter((_, j) => j !== i))}
                    className="ml-1"
                    aria-label={t('common.delete')}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addCustomEnv();
              }}
              className="flex gap-2"
            >
              <input
                className="input flex-1"
                placeholder={t('onboarding.customEnvelope')}
                value={newEnv}
                onChange={(e) => setNewEnv(e.target.value)}
              />
              <button type="submit" className="icon-btn shrink-0 text-teal-300" aria-label={t('common.add')}>
                <Plus size={16} />
              </button>
            </form>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Lock size={18} className="text-teal-300" />
              {t('onboarding.stepSecurity')}
            </h2>
            <p className="text-sm text-slate-400">{t('onboarding.securityHint')}</p>

            {/* Code PIN */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Lock size={15} className="text-teal-300" />
                {t('pinlock.title')}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{t('pinlock.hint')}</p>
              {pinDone ? (
                <p className="mt-2.5 flex items-center gap-1.5 text-sm font-medium text-emerald-300">
                  <Check size={15} />
                  {t('pinlock.enabledMsg')}
                </p>
              ) : (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    className="input !w-32 text-center tracking-[0.4em]"
                    placeholder={t('pinlock.pin')}
                    value={pin}
                    onChange={(e) => setPinV(e.target.value.replace(/\D/g, ''))}
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    className="input !w-32 text-center tracking-[0.4em]"
                    placeholder={t('pinlock.confirm')}
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                  />
                  <button
                    type="button"
                    onClick={enablePin}
                    disabled={!pin}
                    className="btn-ghost !py-2 disabled:opacity-40"
                  >
                    {t('pinlock.enable')}
                  </button>
                </div>
              )}
              {pinErr && <p className="mt-2 text-sm text-rose-400">{t(pinErr)}</p>}
            </div>

            {/* Passkey / empreinte */}
            {pkSupported && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Fingerprint size={15} className="text-teal-300" />
                  {t('webauthn.title')}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{t('onboarding.passkeyHint')}</p>
                {pkDone ? (
                  <p className="mt-2.5 flex items-center gap-1.5 text-sm font-medium text-emerald-300">
                    <Check size={15} />
                    {t('onboarding.activated')}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={enablePasskey}
                    disabled={pkBusy}
                    className="btn-ghost mt-2.5 !py-2"
                  >
                    <Fingerprint size={15} />
                    {t('webauthn.register')}
                  </button>
                )}
                {pkErr && <p className="mt-2 text-sm text-rose-400">{t(pkErr)}</p>}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Sparkles size={18} className="text-teal-300" />
              {t('onboarding.stepTour')}
            </h2>
            <div className="space-y-2.5">
              {(['envelopes', 'plus', 'budget'] as const).map((k, i) => (
                <div key={k} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-400/15 text-teal-300">
                    {[<Wallet key="w" size={16} />, <Plus key="p" size={16} />, <IconView key="i" icon="📅" fallback="?" size={16} />][i]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{t(`onboarding.tour.${k}.title`)}</p>
                    <p className="text-xs text-slate-400">{t(`onboarding.tour.${k}.body`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Périmètre — visible sur les étapes de création */}
        {(step === 1 || step === 2) && (
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
              className="accent-teal-400"
            />
            {t('scope.sharedCheckbox')}
          </label>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-1">
          {step === 0 ? (
            <span />
          ) : (
            <button onClick={() => setStep(step - 1)} className="btn-ghost !py-2">
              <ArrowLeft size={15} />
              {t('onboarding.prev')}
            </button>
          )}
          <div className="flex gap-2">
            {step < STEPS - 1 && (
              <button onClick={done} className="btn-ghost !py-2 text-slate-500">
                {t('onboarding.skip')}
              </button>
            )}
            {step < STEPS - 1 ? (
              <button onClick={() => setStep(step + 1)} className="btn-primary !py-2">
                {step === 0 ? t('onboarding.start') : t('onboarding.next')}
                <ArrowRight size={15} />
              </button>
            ) : (
              <button onClick={finish} disabled={busy} className="btn-primary !py-2">
                {t('onboarding.finish')}
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
        {finishErr && (
          <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-300">
            {t('onboarding.finishFailed', { items: finishErr })}
          </p>
        )}
      </div>
    </div>
  );
}
