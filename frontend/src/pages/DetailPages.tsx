import { ChevronLeft, Star, Trash2 } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { DeleteConfirm } from '../components/DeleteConfirm';
import { Layout } from '../components/Layout';
import { ScopeBadge } from '../components/ScopeBadge';
import { Bar, Ring } from '../components/ui';
import { CoverBg, CoverPicker } from '../covers';
import { IconPicker, IconView } from '../icons';
import { formatAmount, parseToMinorUnits } from '../money';
import { Account, Category, Envelope, Transaction } from '../types';

const MINOR = 2;

interface Goal {
  id: string;
  ownerId: string | null;
  name: string;
  icon: string | null;
  cover: string | null;
  targetAmount: string;
  currentAmount: string;
  deadline: string | null;
  accountId: string | null;
  account: { id: string; name: string } | null;
}

interface Credit {
  id: string;
  ownerId: string | null;
  name: string;
  cover: string | null;
  principal: string;
  remainingPrincipal: string;
  monthlyPayment: string;
  annualRatePercent: string;
  estimatedMonths: number | null;
  startDate: string;
  endDate: string | null;
  accountId: string | null;
}

function Shell({ back, children }: { back: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Layout>
      <div className="animate-fade-up space-y-4">
        <Link
          to={back}
          className="inline-flex items-center gap-1 text-sm text-slate-400 transition hover:text-teal-300"
        >
          <ChevronLeft size={16} />
          {t('detail.back')}
        </Link>
        {children}
      </div>
    </Layout>
  );
}

function NotFound({ back }: { back: string }) {
  const { t } = useTranslation();
  return (
    <Shell back={back}>
      <p className="card p-8 text-center text-sm text-slate-500">
        {t('errors.notFound')}
      </p>
    </Shell>
  );
}

const FIELD =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-teal-400/50';

/* ══════════════════════════ Compte ══════════════════════════ */

export function AccountDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reload = useCallback(() => {
    api.get<Account[]>('/accounts').then((list) => {
      setAccount(list.find((a) => a.id === id) ?? null);
      setLoaded(true);
    });
    api
      .get<Transaction[]>(`/transactions?accountId=${id}&limit=8`)
      .then(setRecent)
      .catch(() => {});
  }, [id]);
  useEffect(reload, [reload]);

  if (!loaded) {
    return (
      <Shell back="/accounts">
        <div className="skeleton h-48" />
      </Shell>
    );
  }
  if (!account) return <NotFound back="/accounts" />;

  const patch = (dto: Record<string, unknown>) =>
    api
      .patch<Account>(`/accounts/${account.id}`, dto)
      .then(setAccount)
      .catch(() => {});
  const fmt = (v: string | number | bigint) =>
    formatAmount(v, account.currencyCode, account.currency?.minorUnits ?? MINOR, i18n.language);

  return (
    <Shell back="/accounts">
      {/* Carte style Revolut : fond personnalisable */}
      <section className="card relative overflow-hidden p-6">
        <CoverBg cover={account.cover} dim={0.55} />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <span className="chip border-white/20 bg-white/10 text-white">
              {t(`accountTypes.${account.type}`)}
            </span>
            <ScopeBadge ownerId={account.ownerId} />
          </div>
          <p className="num mt-6 text-4xl font-extrabold text-white drop-shadow">
            {fmt(account.balance)}
          </p>
          <p className="mt-1 text-sm font-medium text-white/80">{account.name}</p>
          <p className="mt-0.5 text-xs text-white/50">{account.currencyCode}</p>
        </div>
      </section>

      {/* Édition */}
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">{t('detail.customize')}</h2>
        <div>
          <label className="lbl mb-1 block">{t('accounts.namePlaceholder')}</label>
          <input
            className={FIELD}
            defaultValue={account.name}
            onBlur={(e) =>
              e.target.value.trim() &&
              e.target.value !== account.name &&
              patch({ name: e.target.value.trim() })
            }
          />
        </div>
        <div>
          <label className="lbl mb-1 block">{t('detail.cardBg')}</label>
          <CoverPicker value={account.cover} onChange={(cover) => void patch({ cover })} />
        </div>
      </section>

      {/* Opérations récentes */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-200">{t('dash.recent')}</h2>
          <Link to="/transactions" className="text-xs font-medium text-teal-300 hover:text-teal-200">
            {t('dash.seeAll')}
          </Link>
        </div>
        <ul className="divide-y divide-white/[0.06]">
          {recent.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0 truncate">{tx.label}</span>
              <span
                className={`num shrink-0 font-semibold ${
                  tx.type === 'INCOME'
                    ? 'text-emerald-300'
                    : tx.type === 'EXPENSE'
                      ? 'text-rose-300'
                      : 'text-slate-300'
                }`}
              >
                {tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? '−' : '→'}
                {formatAmount(tx.amount, tx.account.currencyCode, MINOR, i18n.language)}
              </span>
            </li>
          ))}
          {recent.length === 0 && (
            <p className="py-6 text-sm text-slate-500">{t('dash.noData')}</p>
          )}
        </ul>
      </section>

      <button
        onClick={() => setConfirmDelete(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/25 bg-rose-400/[0.06] py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-400/15"
      >
        <Trash2 size={15} />
        {t('detail.delete')}
      </button>
      {confirmDelete && (
        <DeleteConfirm
          name={account.name}
          requireName
          body={t('confirm.accountBody')}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await api.delete(`/accounts/${account.id}`);
            navigate('/accounts');
          }}
        />
      )}
    </Shell>
  );
}

/* ══════════════════════════ Objectif ══════════════════════════ */

export function GoalDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showIcon, setShowIcon] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reload = useCallback(() => {
    api.get<Goal[]>('/goals').then((list) => {
      setGoal(list.find((g) => g.id === id) ?? null);
      setLoaded(true);
    });
    api.get<Account[]>('/accounts').then(setAccounts);
  }, [id]);
  useEffect(reload, [reload]);

  if (!loaded) {
    return (
      <Shell back="/planning">
        <div className="skeleton h-48" />
      </Shell>
    );
  }
  if (!goal) return <NotFound back="/planning" />;

  // currentAmount est calculé côté serveur → on recharge après chaque modif
  const patch = (dto: Record<string, unknown>) =>
    api
      .patch(`/goals/${goal.id}`, dto)
      .then(reload)
      .catch(() => {});
  const fmt = (v: string | number | bigint) => formatAmount(v, 'EUR', MINOR, i18n.language);
  const target = Number(goal.targetAmount);
  const pct = target > 0 ? Number(goal.currentAmount) / target : 0;
  const done = pct >= 1;

  return (
    <Shell back="/planning">
      <section className="card relative overflow-hidden p-6">
        <CoverBg cover={goal.cover} dim={0.55} />
        <div className="relative flex items-center gap-4">
          <Ring value={Math.min(1, pct)} size={104} stroke={10} color={done ? '#34d399' : undefined}>
            <IconView icon={goal.icon} fallback={goal.name} size={34} />
          </Ring>
          <div className="min-w-0">
            <p className="truncate text-xl font-bold text-white drop-shadow">
              {goal.name} <ScopeBadge ownerId={goal.ownerId} />
            </p>
            <p className="num mt-1 text-white/80">
              <b className="text-white">{fmt(goal.currentAmount)}</b> / {fmt(goal.targetAmount)}
            </p>
            <p className="mt-0.5 text-xs text-white/60">
              {Math.round(pct * 100)} %
              {goal.deadline && ` · ${new Date(goal.deadline).toLocaleDateString(i18n.language)}`}
              {goal.account && ` · ${goal.account.name}`}
            </p>
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">{t('detail.customize')}</h2>
        <div>
          <label className="lbl mb-1 block">{t('goals.name')}</label>
          <input
            className={FIELD}
            defaultValue={goal.name}
            onBlur={(e) =>
              e.target.value.trim() &&
              e.target.value !== goal.name &&
              patch({ name: e.target.value.trim() })
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="lbl mb-1 block">{t('goals.target')}</label>
            <input
              className={FIELD}
              inputMode="decimal"
              defaultValue={(Number(goal.targetAmount) / 100).toFixed(2)}
              onBlur={(e) => {
                const v = parseToMinorUnits(e.target.value, MINOR);
                if (v && v > 0n) void patch({ targetAmount: v.toString() });
              }}
            />
          </div>
          <div>
            <label className="lbl mb-1 block">{t('goals.deadline')}</label>
            <input
              type="date"
              className={FIELD}
              defaultValue={goal.deadline?.slice(0, 10) ?? ''}
              onChange={(e) => void patch({ deadline: e.target.value || null })}
            />
          </div>
        </div>
        <div>
          <label className="lbl mb-1 block">{t('goals.linkedAccount')}</label>
          <select
            className={FIELD}
            value={goal.accountId ?? ''}
            onChange={(e) => void patch({ accountId: e.target.value || null })}
          >
            <option value="">{t('goals.noAccount')}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">{t('goals.linkedHint')}</p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowIcon((v) => !v)}
            className="flex items-center gap-2 text-sm text-slate-300 transition hover:text-teal-300"
          >
            <IconView icon={goal.icon} fallback={goal.name} size={24} />
            {showIcon ? t('common.close') : t('iconLib.pick')}
          </button>
          {showIcon && (
            <div className="mt-2">
              <IconPicker value={goal.icon} onChange={(icon) => void patch({ icon })} />
            </div>
          )}
        </div>
        <div>
          <label className="lbl mb-1 block">{t('detail.cardBg')}</label>
          <CoverPicker value={goal.cover} onChange={(cover) => void patch({ cover })} />
        </div>
      </section>

      <button
        onClick={() => setConfirmDelete(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/25 bg-rose-400/[0.06] py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-400/15"
      >
        <Trash2 size={15} />
        {t('detail.delete')}
      </button>
      {confirmDelete && (
        <DeleteConfirm
          name={goal.name}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await api.delete(`/goals/${goal.id}`);
            navigate('/planning');
          }}
        />
      )}
    </Shell>
  );
}

/* ══════════════════════════ Crédit ══════════════════════════ */

export function CreditDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [credit, setCredit] = useState<Credit | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reload = useCallback(() => {
    api.get<Credit[]>('/credits').then((list) => {
      setCredit(list.find((c) => c.id === id) ?? null);
      setLoaded(true);
    });
    api.get<Account[]>('/accounts').then(setAccounts);
  }, [id]);
  useEffect(reload, [reload]);

  if (!loaded) {
    return (
      <Shell back="/planning">
        <div className="skeleton h-48" />
      </Shell>
    );
  }
  if (!credit) return <NotFound back="/planning" />;

  // remainingPrincipal est projeté côté serveur → on recharge après chaque modif
  const patch = (dto: Record<string, unknown>) =>
    api
      .patch(`/credits/${credit.id}`, dto)
      .then(reload)
      .catch(() => {});
  const fmt = (v: string | number | bigint) => formatAmount(v, 'EUR', MINOR, i18n.language);
  const pct =
    credit.principal === '0'
      ? 0
      : Math.min(1, 1 - Number(credit.remainingPrincipal) / Number(credit.principal));

  return (
    <Shell back="/planning">
      <section className="card relative overflow-hidden p-6">
        <CoverBg cover={credit.cover} dim={0.55} />
        <div className="relative">
          <p className="truncate text-xl font-bold text-white drop-shadow">
            {credit.name} <ScopeBadge ownerId={credit.ownerId} />
          </p>
          <p className="num mt-2 text-3xl font-extrabold text-white">
            {fmt(credit.remainingPrincipal)}
          </p>
          <p className="text-xs text-white/60">
            {t('credits.remaining')} / {fmt(credit.principal)} · {fmt(credit.monthlyPayment)}/
            {t('widgets.perMonth')} ·{' '}
            {Number(credit.annualRatePercent)} %
          </p>
          <div className="mt-3">
            <Bar value={pct} />
            <div className="num mt-1.5 flex justify-between text-xs text-white/60">
              <span>{Math.round(pct * 100)} %</span>
              {credit.estimatedMonths && (
                <span>{t('credits.monthsLeft', { count: credit.estimatedMonths })}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">{t('detail.customize')}</h2>
        <div>
          <label className="lbl mb-1 block">{t('credits.name')}</label>
          <input
            className={FIELD}
            defaultValue={credit.name}
            onBlur={(e) =>
              e.target.value.trim() &&
              e.target.value !== credit.name &&
              patch({ name: e.target.value.trim() })
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="lbl mb-1 block">{t('credits.monthly')}</label>
            <input
              className={FIELD}
              inputMode="decimal"
              defaultValue={(Number(credit.monthlyPayment) / 100).toFixed(2)}
              onBlur={(e) => {
                const v = parseToMinorUnits(e.target.value, MINOR);
                if (v && v > 0n) void patch({ monthlyPayment: v.toString() });
              }}
            />
          </div>
          <div>
            <label className="lbl mb-1 block">{t('credits.rate')}</label>
            <input
              className={FIELD}
              inputMode="decimal"
              defaultValue={credit.annualRatePercent}
              onBlur={(e) => {
                const v = parseFloat(e.target.value.replace(',', '.'));
                if (!isNaN(v)) void patch({ annualRatePercent: v });
              }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="lbl mb-1 block">{t('credits.startDate')}</label>
            <input
              type="date"
              className={FIELD}
              defaultValue={credit.startDate.slice(0, 10)}
              onChange={(e) => void patch({ startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="lbl mb-1 block">{t('goals.linkedAccount')}</label>
            <select
              className={FIELD}
              value={credit.accountId ?? ''}
              onChange={(e) => void patch({ accountId: e.target.value || null })}
            >
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="lbl mb-1 block">{t('detail.cardBg')}</label>
          <CoverPicker value={credit.cover} onChange={(cover) => void patch({ cover })} />
        </div>
      </section>

      <button
        onClick={() => setConfirmDelete(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/25 bg-rose-400/[0.06] py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-400/15"
      >
        <Trash2 size={15} />
        {t('detail.delete')}
      </button>
      {confirmDelete && (
        <DeleteConfirm
          name={credit.name}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await api.delete(`/credits/${credit.id}`);
            navigate('/planning');
          }}
        />
      )}
    </Shell>
  );
}

/* ══════════════════════════ Enveloppe ══════════════════════════ */

interface BudgetLineLite {
  allocated: string;
  spent: string;
  available: string;
  carryoverIn: string;
}

export function EnvelopeDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [env, setEnv] = useState<Envelope | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [line, setLine] = useState<BudgetLineLite | null>(null);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reload = useCallback(() => {
    api.get<Envelope[]>('/envelopes').then((list) => {
      setEnv(list.find((e) => e.id === id) ?? null);
      setLoaded(true);
    });
    api.get<Category[]>('/categories').then(setCategories).catch(() => {});
    api
      .get<{ household: { lines: ({ envelope: Envelope } & BudgetLineLite)[] } | null; personal: { lines: ({ envelope: Envelope } & BudgetLineLite)[] } | null }>(
        '/budgets?view=both',
      )
      .then((b) => {
        const all = [...(b.household?.lines ?? []), ...(b.personal?.lines ?? [])];
        const l = all.find((x) => x.envelope?.id === id);
        setLine(l ?? null);
      })
      .catch(() => {});
    api
      .get<Transaction[]>(`/transactions?envelopeId=${id}&limit=10`)
      .then(setRecent)
      .catch(() => {});
  }, [id]);
  useEffect(reload, [reload]);

  if (!loaded) {
    return (
      <Shell back="/budget">
        <div className="skeleton h-48" />
      </Shell>
    );
  }
  if (!env) return <NotFound back="/budget" />;

  const patch = (dto: Record<string, unknown>) =>
    api
      .patch<Envelope>(`/envelopes/${env.id}`, dto)
      .then(setEnv)
      .catch(() => {});
  const fmt = (v: string | number | bigint) =>
    formatAmount(v, 'EUR', MINOR, i18n.language);

  const allocated = line ? Number(line.allocated) + Number(line.carryoverIn) : 0;
  const spent = line ? Number(line.spent) : 0;
  const avail = line ? Number(line.available) : 0;
  const over = avail < 0;
  // Barre = part restante : pleine au départ, se vide en dépensant ;
  // en dépassement, une portion rouge reflète la profondeur du dépassement.
  const ratio =
    allocated > 0
      ? Math.abs(avail) / allocated
      : over || spent > 0 ? 1 : 0;

  return (
    <Shell back="/budget">
      {/* Carte héro */}
      <section className="card relative overflow-hidden p-6">
        <CoverBg cover={env.cover} dim={0.55} />
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-teal-400/15 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-2">
            <span className="flex items-center gap-3">
              <IconView icon={env.icon} fallback={env.name} size={44} />
              <span>
                {env.category ? (
                  <Link
                    to={`/categories/${env.category.id}`}
                    className="chip border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                  >
                    {env.category.name}
                  </Link>
                ) : (
                  <span className="chip border-white/20 bg-white/10 text-white">
                    {t('budget.noCategory')}
                  </span>
                )}
                <span className="mt-1 flex items-center gap-2 text-xs text-white/60">
                  <ScopeBadge ownerId={env.ownerId} />
                  {env.owner && env.ownerId !== null && env.owner.displayName}
                </span>
              </span>
            </span>
            <button
              onClick={() => void patch({ isFavorite: !env.isFavorite })}
              title={t('budget.favorite')}
              className={`icon-btn ${env.isFavorite ? 'text-amber-300' : ''}`}
            >
              <Star size={20} fill={env.isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
          <p className="mt-5 text-sm font-medium text-white/80">{env.name}</p>
          {line && (
            <>
              <p
                className={`num mt-1 text-4xl font-extrabold ${
                  BigInt(line.available) < 0n ? 'text-rose-300' : 'text-white'
                }`}
              >
                {fmt(line.available)}
              </p>
              <p className="mt-0.5 text-xs text-white/50">{t('budget.available')}</p>
              <div className="mt-4">
                <Bar
                  value={ratio}
                  className={
                    over
                      ? '!from-rose-400 !to-rose-500'
                      : allocated > 0 && ratio < 0.2
                        ? '!from-amber-400 !to-amber-500'
                        : ''
                  }
                />
                <div className="num mt-1.5 flex justify-between text-xs text-white/50">
                  <span className="text-rose-300/90">
                    {t('budget.spent')} {fmt(line.spent)}
                  </span>
                  <span>
                    {t('budget.allocated')} {fmt(line.allocated)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Édition */}
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">{t('detail.customize')}</h2>
        <div>
          <label className="lbl mb-1 block">{t('budget.envelope')}</label>
          <input
            className={FIELD}
            defaultValue={env.name}
            onBlur={(e) =>
              e.target.value.trim() &&
              e.target.value !== env.name &&
              patch({ name: e.target.value.trim() })
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="lbl mb-1 block">{t('budget.category')}</label>
            <select
              className={FIELD}
              value={env.categoryId ?? ''}
              onChange={(e) => patch({ categoryId: e.target.value || null })}
            >
              <option value="">{t('budget.noCategory')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl mb-1 block">{t('budget.alertThreshold')}</label>
            <input
              key={env.id + (env.alertThreshold ?? '')}
              className={FIELD}
              inputMode="decimal"
              placeholder="—"
              defaultValue={env.alertThreshold ? (Number(env.alertThreshold) / 100).toFixed(2) : ''}
              onBlur={(e) => {
                const minor = parseToMinorUnits(e.target.value || '0', MINOR);
                if (minor === null) return;
                patch({ alertThreshold: minor > 0n ? minor.toString() : null });
              }}
            />
          </div>
        </div>
        <div>
          <label className="lbl mb-1 block">{t('iconLib.pick')}</label>
          <IconPicker value={env.icon} onChange={(icon) => void patch({ icon })} />
        </div>
        <div>
          <label className="lbl mb-1 block">{t('detail.cardBg')}</label>
          <CoverPicker value={env.cover} onChange={(cover) => void patch({ cover })} />
        </div>
      </section>

      {/* Opérations récentes */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-200">{t('dash.recent')}</h2>
          <Link to="/transactions" className="text-xs font-medium text-teal-300 hover:text-teal-200">
            {t('dash.seeAll')}
          </Link>
        </div>
        <ul className="divide-y divide-white/[0.06]">
          {recent.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0 truncate">
                {tx.label}
                <span className="ml-2 text-xs text-slate-500">
                  {new Date(tx.date).toLocaleDateString(i18n.language)} · {tx.account.name}
                </span>
              </span>
              <span
                className={`num shrink-0 font-semibold ${
                  tx.type === 'INCOME'
                    ? 'text-emerald-300'
                    : tx.type === 'EXPENSE'
                      ? 'text-rose-300'
                      : 'text-slate-300'
                }`}
              >
                {tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? '−' : '→'}
                {formatAmount(tx.amount, tx.account.currencyCode, MINOR, i18n.language)}
              </span>
            </li>
          ))}
          {recent.length === 0 && (
            <p className="py-6 text-sm text-slate-500">{t('dash.noData')}</p>
          )}
        </ul>
      </section>

      <button
        onClick={() => setConfirmDelete(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/25 bg-rose-400/[0.06] py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-400/15"
      >
        <Trash2 size={15} />
        {t('detail.delete')}
      </button>
      {confirmDelete && (
        <DeleteConfirm
          name={env.name}
          body={t('confirm.envelopeBody')}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await api.delete(`/envelopes/${env.id}`);
            navigate('/budget');
          }}
        />
      )}
    </Shell>
  );
}

/* ══════════════════════════ Catégorie ══════════════════════════ */

export function CategoryDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [cat, setCat] = useState<Category | null>(null);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reload = useCallback(() => {
    api.get<Category[]>('/categories').then((list) => {
      setCat(list.find((c) => c.id === id) ?? null);
      setLoaded(true);
    });
    api
      .get<Envelope[]>('/envelopes')
      .then((list) => setEnvelopes(list.filter((e) => e.categoryId === id)))
      .catch(() => {});
  }, [id]);
  useEffect(reload, [reload]);

  if (!loaded) {
    return (
      <Shell back="/budget">
        <div className="skeleton h-48" />
      </Shell>
    );
  }
  if (!cat) return <NotFound back="/budget" />;

  const patch = (dto: Record<string, unknown>) =>
    api
      .patch<Category>(`/categories/${cat.id}`, dto)
      .then(setCat)
      .catch(() => {});

  return (
    <Shell back="/budget">
      {/* Carte héro */}
      <section className="card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-teal-400/15 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <IconView icon={cat.icon} fallback={cat.name} size={52} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold text-white">{cat.name}</h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-white/60">
              <ScopeBadge ownerId={cat.ownerId} />
              {cat.owner && cat.ownerId !== null && cat.owner.displayName}
              <span className="chip border-white/15 bg-white/10 !py-0 text-white/70">
                {envelopes.length} {envelopes.length > 1 ? t('budget.envelopes').toLowerCase() : t('envelope.one')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Édition */}
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">{t('detail.customize')}</h2>
        <div>
          <label className="lbl mb-1 block">{t('budget.category')}</label>
          <input
            className={FIELD}
            defaultValue={cat.name}
            onBlur={(e) =>
              e.target.value.trim() &&
              e.target.value !== cat.name &&
              patch({ name: e.target.value.trim() })
            }
          />
        </div>
        <div>
          <label className="lbl mb-1 block">{t('iconLib.pick')}</label>
          <IconPicker value={cat.icon} onChange={(icon) => void patch({ icon })} />
        </div>
      </section>

      {/* Enveloppes de la catégorie */}
      <section className="card p-5">
        <h2 className="mb-3 font-semibold text-slate-200">{t('budget.envelopes')}</h2>
        {envelopes.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">{t('dash.noData')}</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {envelopes.map((e) => (
              <li key={e.id}>
                <Link
                  to={`/envelopes/${e.id}`}
                  className="flex items-center gap-2.5 py-2.5 text-sm transition hover:text-teal-300"
                >
                  <IconView icon={e.icon} fallback={e.name} size={22} />
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  {e.ownerId === null && (
                    <span className="text-xs text-teal-300">{t('scope.household')}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        onClick={() => setConfirmDelete(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/25 bg-rose-400/[0.06] py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-400/15"
      >
        <Trash2 size={15} />
        {t('detail.delete')}
      </button>
      {confirmDelete && (
        <DeleteConfirm
          name={cat.name}
          body={t('confirm.categoryBody')}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await api.delete(`/categories/${cat.id}`);
            navigate('/budget');
          }}
        />
      )}
    </Shell>
  );
}
