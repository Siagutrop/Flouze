import { HandCoins, Landmark, Pin, Plus, RefreshCw, Repeat, Target } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { BrandPicker } from '../brands';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { ScopeBadge } from '../components/ScopeBadge';
import { Bar } from '../components/ui';
import { CoverBg } from '../covers';
import { IconPicker, IconView } from '../icons';
import { formatAmount, parseToMinorUnits } from '../money';
import { Account, Envelope } from '../types';
import { DebtsTab } from './DebtsTab';

const MINOR = 2;

interface Recurring {
  id: string;
  ownerId: string | null;
  kind: 'INCOME' | 'EXPENSE';
  amount: string;
  label: string;
  mandatory: boolean;
  isSubscription: boolean;
  icon: string | null;
  frequency: string;
  dayOfMonth: number | null;
  startDate: string;
  endDate: string | null;
  account: { id: string; name: string };
  envelope: { id: string; name: string } | null;
  owner: { displayName: string } | null;
}
interface Goal {
  id: string;
  ownerId: string | null;
  name: string;
  icon: string | null;
  cover: string | null;
  targetAmount: string;
  currentAmount: string;
  deadline: string | null;
  account: { id: string; name: string } | null;
}

const FREQ_FACTOR: Record<string, number> = {
  WEEKLY: 52 / 12,
  MONTHLY: 1,
  QUARTERLY: 1 / 3,
  YEARLY: 1 / 12,
};

/** Formulaire de création de récurrent (partagé par onglets récurrents & abonnements). */
function RecurringForm({
  subscription,
  onCreated,
}: {
  subscription?: boolean;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [form, setForm] = useState({
    kind: 'EXPENSE', accountId: '', envelopeId: '', amount: '', label: '',
    frequency: 'MONTHLY', dayOfMonth: '1', mandatory: false, icon: '',
    startDate: new Date().toISOString().slice(0, 10), shared: false,
  });
  // Libellé auto posé par la marque choisie (écrasé seulement si non modifié)
  const [autoLabel, setAutoLabel] = useState('');

  useEffect(() => {
    api.get<Account[]>('/accounts').then(setAccounts);
    api.get<Envelope[]>('/envelopes').then(setEnvelopes);
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    const v = parseToMinorUnits(form.amount, MINOR);
    if (v === null || v <= 0n) return;
    await api.post('/recurring', {
      kind: form.kind,
      accountId: form.accountId,
      envelopeId: form.envelopeId || undefined,
      amount: v.toString(),
      label: form.label,
      frequency: form.frequency,
      dayOfMonth: Number(form.dayOfMonth) || undefined,
      mandatory: form.mandatory,
      isSubscription: !!subscription,
      icon: form.icon || undefined,
      startDate: form.startDate,
      shared: form.shared,
    });
    setForm({ ...form, amount: '', label: '', mandatory: false, icon: '' });
    onCreated();
  }

  return (
    <form onSubmit={create} className="grid gap-3">
      {subscription && (
        <BrandPicker
          value={form.icon.startsWith('brand:') ? form.icon.slice(6) : null}
          onSelect={(b) => {
            setForm({
              ...form,
              icon: b ? `brand:${b.key}` : '',
              label:
                b && (!form.label || form.label === autoLabel)
                  ? b.name
                  : form.label,
            });
            setAutoLabel(b?.name ?? '');
          }}
        />
      )}
      {!subscription && (
        <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
          <option value="EXPENSE">{t('txTypes.EXPENSE')}</option>
          <option value="INCOME">{t('txTypes.INCOME')}</option>
        </select>
      )}
      <select required className="input" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
        <option value="">{t('transactions.account')}</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <select className="input" value={form.envelopeId} onChange={(e) => setForm({ ...form, envelopeId: e.target.value })}>
        <option value="">{t('transactions.noEnvelope')}</option>
        {envelopes.map((e2) => <option key={e2.id} value={e2.id}>{e2.name}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-3">
        <select className="input" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
          {['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'].map((f) => (
            <option key={f} value={f}>{t(`frequencies.${f}`)}</option>
          ))}
        </select>
        <input type="number" min={1} max={31} className="input" placeholder={t('recurring.dayOfMonth')} value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input required className="input" placeholder={t('transactions.amount')} inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <input type="date" required className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
      </div>
      <input required autoFocus={!subscription} className="input" placeholder={subscription ? t('subscriptions.namePlaceholder') : t('transactions.label')} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
      <div className="flex items-center justify-between gap-3">
        <label className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition cursor-pointer ${
          form.mandatory ? 'border-amber-400/40 bg-amber-400/15 text-amber-300' : 'border-white/10 bg-white/[0.03] text-slate-500'
        }`}>
          <input type="checkbox" className="sr-only" checked={form.mandatory} onChange={(e) => setForm({ ...form, mandatory: e.target.checked })} />
          <Pin size={12} />
          {t('transactions.mandatory')}
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-400">
          <input type="checkbox" checked={form.shared} onChange={(e) => setForm({ ...form, shared: e.target.checked })} className="accent-teal-400" />
          {t('scope.household')}
        </label>
      </div>
      <button className="btn-primary"><Plus size={16} />{t('common.add')}</button>
    </form>
  );
}

function RecurringRow({ r, onDeleted }: { r: Recurring; onDeleted: () => void }) {
  const { t, i18n } = useTranslation();
  return (
    <li className="flex items-center justify-between gap-3 p-3.5">
      <div className="flex min-w-0 items-center gap-3">
        {r.icon && <IconView icon={r.icon} fallback={r.label} size={30} />}
        <div className="min-w-0">
        <span className="font-medium">{r.label}</span>{' '}
        <ScopeBadge ownerId={r.ownerId} />
        {r.mandatory && (
          <span className="chip ml-1 border-amber-400/30 bg-amber-400/10 !py-0 text-amber-300">
            <Pin size={10} /> {t('transactions.mandatory')}
          </span>
        )}
        <p className="text-xs text-slate-500">
          {t(`frequencies.${r.frequency}`)}
          {r.dayOfMonth ? ` · ${t('recurring.onDay', { day: r.dayOfMonth })}` : ''} · {r.account.name}
          {r.envelope ? ` · ${r.envelope.name}` : ''}
        </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={`num font-semibold ${r.kind === 'INCOME' ? 'text-emerald-300' : 'text-rose-300'}`}>
          {r.kind === 'INCOME' ? '+' : '−'} {formatAmount(r.amount, 'EUR', MINOR, i18n.language)}
        </span>
        <button onClick={async () => { await api.delete(`/recurring/${r.id}`); onDeleted(); }} className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-300">×</button>
      </div>
    </li>
  );
}

function RecurringTab({
  createOpen,
  onCloseCreate,
}: {
  createOpen: boolean;
  onCloseCreate: () => void;
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Recurring[]>([]);
  const reload = () => api.get<Recurring[]>('/recurring').then(setItems);
  useEffect(() => {
    reload();
  }, []);
  const list = items.filter((r) => !r.isSubscription);
  return (
    <>
      {createOpen && (
        <Modal title={t('recurring.new')} onClose={onCloseCreate}>
          <RecurringForm
            onCreated={() => {
              onCloseCreate();
              reload();
            }}
          />
        </Modal>
      )}
      <div className="card overflow-hidden">
        <ul className="divide-y divide-white/[0.05]">
          {list.map((r) => (
            <RecurringRow key={r.id} r={r} onDeleted={reload} />
          ))}
          {list.length === 0 && <p className="p-8 text-center text-sm text-slate-500">{t('recurring.empty')}</p>}
        </ul>
      </div>
    </>
  );
}

function SubscriptionsTab({
  createOpen,
  onCloseCreate,
}: {
  createOpen: boolean;
  onCloseCreate: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<Recurring[]>([]);
  const reload = () => api.get<Recurring[]>('/recurring').then(setItems);
  useEffect(() => {
    reload();
  }, []);
  const subs = items.filter((r) => r.isSubscription);
  const monthlyCost = subs
    .filter((s) => s.kind === 'EXPENSE')
    .reduce((acc, s) => acc + Number(s.amount) * (FREQ_FACTOR[s.frequency] ?? 1), 0);
  const yearlyCost = monthlyCost * 12;

  return (
    <>
      {/* Carte total */}
      <div className="card relative mb-4 overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-violet-400/15 blur-3xl" />
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-400/15 text-violet-300">
            <RefreshCw size={20} />
          </span>
          <div>
            <p className="lbl">{t('subscriptions.monthlyCost')}</p>
            <p className="num text-2xl font-extrabold">
              {formatAmount(Math.round(monthlyCost), 'EUR', MINOR, i18n.language)}
              <span className="ml-2 text-sm font-normal text-slate-500">
                ≈ {formatAmount(Math.round(yearlyCost), 'EUR', MINOR, i18n.language)}/{t('subscriptions.perYear')}
              </span>
            </p>
          </div>
          <span className="chip ml-auto text-slate-400">
            {t('subscriptions.count', { count: subs.length })}
          </span>
        </div>
      </div>

      {createOpen && (
        <Modal title={t('subscriptions.new')} onClose={onCloseCreate}>
          <RecurringForm
            subscription
            onCreated={() => {
              onCloseCreate();
              reload();
            }}
          />
        </Modal>
      )}
      <div className="card overflow-hidden">
        <ul className="divide-y divide-white/[0.05]">
          {subs.map((r) => (
            <RecurringRow key={r.id} r={r} onDeleted={reload} />
          ))}
          {subs.length === 0 && <p className="p-8 text-center text-sm text-slate-500">{t('subscriptions.empty')}</p>}
        </ul>
      </div>
    </>
  );
}

function GoalsSection({
  createOpen,
  onCloseCreate,
}: {
  createOpen: boolean;
  onCloseCreate: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({ name: '', target: '', deadline: '', accountId: '', icon: '🎯', shared: false });
  const celebrated = useRef(new Set<string>());

  const reload = () => api.get<Goal[]>('/goals').then((goals) => {
    // Confettis la première fois qu'un objectif atteint 100 %
    for (const g of goals) {
      if (
        !celebrated.current.has(g.id) &&
        BigInt(g.targetAmount) > 0n &&
        BigInt(g.currentAmount) >= BigInt(g.targetAmount)
      ) {
        celebrated.current.add(g.id);
        import('canvas-confetti').then(({ default: confetti }) => {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        });
        navigator.vibrate?.([40, 60, 40]);
      }
    }
    setItems(goals);
  });
  useEffect(() => {
    reload();
    api.get<Account[]>('/accounts').then(setAccounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    const v = parseToMinorUnits(form.target, MINOR);
    if (!v || v <= 0n) return;
    await api.post('/goals', {
      name: form.name,
      icon: form.icon,
      targetAmount: v.toString(),
      deadline: form.deadline || undefined,
      accountId: form.accountId || undefined,
      shared: form.shared,
    });
    setForm({ ...form, name: '', target: '', deadline: '', icon: '🎯' });
    onCloseCreate();
    reload();
  }

  return (
    <section>
      <h2 className="lbl mb-3">{t('planning.goals')}</h2>
      {createOpen && (
        <Modal title={t('goals.new')} onClose={onCloseCreate}>
          <form onSubmit={create} className="grid gap-3">
            <input required autoFocus className="input" placeholder={t('goals.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input required className="input" placeholder={t('goals.target')} inputMode="decimal" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
              <input type="date" className="input" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
            <select className="input" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
              <option value="">{t('goals.noAccount')}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input type="checkbox" checked={form.shared} onChange={(e) => setForm({ ...form, shared: e.target.checked })} className="accent-teal-400" />
              {t('scope.sharedCheckbox')}
            </label>
            <button className="btn-primary"><Plus size={16} />{t('common.add')}</button>
          </form>
        </Modal>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((g) => {
          const pct = Math.min(1, Number(g.currentAmount) / Number(g.targetAmount));
          const done = pct >= 1;
          return (
            <Link
              to={`/goals/${g.id}`}
              key={g.id}
              className={`card card-hover relative overflow-hidden p-4 ${done ? '!border-emerald-400/40 shadow-glow' : ''}`}
            >
              <CoverBg cover={g.cover} dim={0.45} />
              <div className="relative flex items-center gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl ${done ? 'bg-emerald-400/15' : 'bg-white/[0.05]'}`}>
                  <IconView icon={g.icon} fallback="🎯" size={30} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">
                    {g.name} <ScopeBadge ownerId={g.ownerId} />
                  </h3>
                  <p className="num text-sm text-slate-400">
                    <b className="text-teal-300">{formatAmount(g.currentAmount, 'EUR', MINOR, i18n.language)}</b> / {formatAmount(g.targetAmount, 'EUR', MINOR, i18n.language)}
                    {g.deadline ? ` · ${new Date(g.deadline).toLocaleDateString(i18n.language)}` : ''}
                  </p>
                </div>
                <button onClick={async (e) => { e.preventDefault(); await api.delete(`/goals/${g.id}`); reload(); }} className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-300">×</button>
              </div>
              <div className="relative mt-3">
                <Bar value={pct} className={done ? '!from-emerald-400 !to-teal-300' : ''} />
                <div className="num mt-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span>{Math.round(pct * 100)} %</span>
                  {done && <span className="font-semibold text-emerald-300">{t('goals.reached')}</span>}
                </div>
              </div>
            </Link>
          );
        })}
        {items.length === 0 && <p className="card p-6 text-center text-sm text-slate-500 md:col-span-2">{t('goals.empty')}</p>}
      </div>
    </section>
  );
}

function SavingsTab({
  create,
  onCloseCreate,
}: {
  create: 'goal' | 'debt' | 'credit' | null;
  onCloseCreate: () => void;
}) {
  return (
    <div className="space-y-6">
      <GoalsSection
        createOpen={create === 'goal'}
        onCloseCreate={onCloseCreate}
      />
      <DebtsTab
        createKind={create === 'debt' || create === 'credit' ? create : null}
        onCloseCreate={onCloseCreate}
      />
    </div>
  );
}

export function PlanningPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const initial = params.get('tab');
  const [tab, setTab] = useState<'recurring' | 'subscriptions' | 'savings'>(
    initial === 'subscriptions' || initial === 'savings' || initial === 'debts'
      ? initial === 'debts'
        ? 'savings'
        : initial
      : 'recurring',
  );
  const [create, setCreate] = useState<
    'choice' | 'recurring' | 'subscription' | 'goal' | 'debt' | 'credit' | null
  >(null);
  const closeCreate = () => setCreate(null);
  const tabs = [
    { k: 'recurring', label: t('planning.recurring') },
    { k: 'subscriptions', label: t('planning.subscriptions') },
    { k: 'savings', label: t('planning.savings') },
  ] as const;
  const createOptions = [
    { k: 'recurring' as const, icon: Repeat, label: t('recurring.new'), tab: 'recurring' as const },
    { k: 'subscription' as const, icon: RefreshCw, label: t('subscriptions.new'), tab: 'subscriptions' as const },
    { k: 'goal' as const, icon: Target, label: t('goals.new'), tab: 'savings' as const },
    { k: 'debt' as const, icon: HandCoins, label: t('debts.new'), tab: 'savings' as const },
    { k: 'credit' as const, icon: Landmark, label: t('credits.new'), tab: 'savings' as const },
  ];
  return (
    <Layout>
      <div className="animate-fade-up space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">{t('planning.title')}</h1>
          <button
            onClick={() => setCreate('choice')}
            title={t('planning.create')}
            aria-label={t('planning.create')}
            className="icon-btn ml-auto border border-teal-400/30 bg-teal-400/10 text-teal-300"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="seg w-full sm:w-fit">
          {tabs.map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`seg-item flex-1 sm:flex-none ${tab === k ? 'seg-item-active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'recurring' && (
          <RecurringTab createOpen={create === 'recurring'} onCloseCreate={closeCreate} />
        )}
        {tab === 'subscriptions' && (
          <SubscriptionsTab createOpen={create === 'subscription'} onCloseCreate={closeCreate} />
        )}
        {tab === 'savings' && (
          <SavingsTab
            create={
              create === 'goal' || create === 'debt' || create === 'credit'
                ? create
                : null
            }
            onCloseCreate={closeCreate}
          />
        )}

        {/* Création — choix du type puis formulaire au premier plan */}
        {create === 'choice' && (
          <Modal title={t('planning.create')} onClose={closeCreate}>
            <div className="grid gap-2">
              {createOptions.map((o) => (
                <button
                  key={o.k}
                  onClick={() => {
                    setTab(o.tab);
                    setCreate(o.k);
                  }}
                  className="btn-ghost flex items-center gap-3 !justify-start"
                >
                  <o.icon size={17} className="text-teal-300" />
                  {o.label}
                </button>
              ))}
            </div>
          </Modal>
        )}
      </div>
    </Layout>
  );
}
