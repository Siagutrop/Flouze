import {
  AlertTriangle,
  ArrowLeftRight,
  Award,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileUp,
  Flame,
  Gauge,
  HandCoins,
  Info,
  Landmark,
  Lightbulb,
  Lock,
  PiggyBank,
  Pin,
  PieChart as PieChartIcon,
  Plus,
  RefreshCw,
  Repeat,
  Settings2,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
  X,
  Zap,
  Users,
} from 'lucide-react';
import { Fragment, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api';
import { useAuth } from '../auth';
import { BadgeCelebration } from '../components/BadgeCelebration';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Bar as ProgressBar, Ring, Stat } from '../components/ui';
import { IconView } from '../icons';
import { formatAmount } from '../money';
import { Account, Debt, Envelope, Transaction } from '../types';
import {
  defaultLayout,
  loadLayout,
  reserveOf,
  saveLayout,
  WidgetId,
  WidgetLayout,
} from '../dashboardWidgets';

const MINOR = 2;

interface Summary {
  totals: { accountsBalance: string; accountsCount: number };
  accounts: Account[];
  budget: {
    household: { status: string; totals: { spent: string; unassigned: string } } | null;
    personal: { status: string; totals: { spent: string; unassigned: string } } | null;
  };
  monthlySpend: { month: string; total: string }[];
  breakdown: {
    byEnvelope: {
      id: string | null;
      name: string | null;
      icon: string | null;
      amount: string;
      mandatory: string;
      prev: string;
    }[];
    mandatory: string;
    optional: string;
    total: string;
  };
  pace: {
    projected: string;
    dailyLeft: string;
    daysLeft: number;
    available: string;
  };
  alerts: {
    envelopeId: string;
    name: string;
    icon: string | null;
    available: string;
    threshold: string | null;
    severity: 'over' | 'low';
    scope: 'household' | 'personal';
  }[];
  recent: (Transaction & { account: { name: string; currencyCode: string } })[];
}

interface Gamification {
  points: number;
  tier: string;
  nextTier: { key: string; min: number } | null;
  progressToNext: number;
  achievements: { code: string; earnedAt: string; points: number }[];
  newBadges: string[];
  catalog: { code: string; points: number }[];
}

interface Insights {
  date: string;
  negativeCount: number;
  items: {
    code: string;
    severity: 'good' | 'info' | 'warning' | 'action';
    params: Record<string, string | number>;
  }[];
}

interface FavLine {
  envelope: Envelope | null;
  allocated: string;
  spent: string;
  available: string;
}

interface FavEntry {
  line: FavLine;
  scope: 'household' | 'personal';
}

interface Goal {
  id: string;
  name: string;
  icon: string | null;
  targetAmount: string;
  currentAmount: string;
}

interface Recurring {
  id: string;
  kind: 'INCOME' | 'EXPENSE';
  amount: string;
  label: string;
  icon: string | null;
  isSubscription: boolean;
  frequency: string;
}

/** Conversion vers un coût mensuel équivalent. */
const FREQ_FACTOR: Record<string, number> = {
  WEEKLY: 52 / 12,
  MONTHLY: 1,
  QUARTERLY: 1 / 3,
  YEARLY: 1 / 12,
};

const TIER_STYLE: Record<string, { grad: string; icon: typeof Trophy }> = {
  bronze: { grad: 'from-amber-600 to-amber-400', icon: Award },
  argent: { grad: 'from-slate-300 to-slate-100', icon: Award },
  or: { grad: 'from-yellow-400 to-amber-300', icon: Trophy },
  platine: { grad: 'from-cyan-300 to-sky-200', icon: Trophy },
  diamant: { grad: 'from-violet-400 to-fuchsia-300', icon: Sparkles },
};

const SEVERITY = {
  warning: { icon: AlertTriangle, cls: 'border-amber-400/30 bg-amber-400/10 text-amber-200' },
  action: { icon: CalendarClock, cls: 'border-sky-400/30 bg-sky-400/10 text-sky-200' },
  info: { icon: Info, cls: 'border-white/10 bg-white/5 text-slate-300' },
  good: { icon: CheckCircle2, cls: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' },
};

const BADGE_ICON: Record<string, typeof Award> = {
  first_transaction: Wallet,
  budget_validated: CheckCircle2,
  under_budget_month: TrendingDown,
  duo: Users,
  planner: CalendarClock,
  mover: ArrowLeftRight,
  importer: FileUp,
  goal_set: Trophy,
  week_streak: Flame,
  month_streak: Flame,
  no_overspend: CheckCircle2,
  nest_egg: PiggyBank,
};

/** Carrousel à slides : swipe horizontal (scroll-snap) + pastilles de navigation. */
function SnapCarousel({
  children,
  a11y,
  start = 0,
}: {
  children: ReactNode[];
  a11y: string;
  start?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(start);
  useEffect(() => {
    const el = trackRef.current;
    if (el && start > 0) el.scrollTo({ left: start * el.clientWidth });
  }, [start]);
  const go = (i: number) => {
    const el = trackRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };
  return (
    <>
      <div
        ref={trackRef}
        onTouchStart={(e) => e.stopPropagation()}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth > 0) setIdx(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex snap-x snap-mandatory select-none overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children.map((c, i) => (
          <div key={i} className="w-full shrink-0 snap-start">
            {c}
          </div>
        ))}
      </div>
      {children.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {children.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`${a11y} ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? 'w-4 bg-teal-300' : 'w-1.5 bg-teal-300/30 hover:bg-teal-300/50'
              }`}
            />
          ))}
        </div>
      )}
    </>
  );
}

/** Astuces défilables : slide du jour pré-positionnée. */
function TipCarousel({ tips, start }: { tips: string[]; start: number }) {
  const { t } = useTranslation();
  return (
    <section className="card border-teal-400/20 bg-gradient-to-br from-teal-400/10 to-transparent p-5 pb-4">
      <SnapCarousel a11y={t('widgets.items.tip')} start={start}>
        {tips.map((tip, i) => (
          <p key={i} className="flex items-start gap-2.5 text-sm text-teal-100">
            <Zap size={16} className="mt-0.5 shrink-0 text-teal-300" />
            {tip}
          </p>
        ))}
      </SnapCarousel>
    </section>
  );
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [gam, setGam] = useState<Gamification | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [favs, setFavs] = useState<FavEntry[]>([]);
  const [leftToSpend, setLeftToSpend] = useState<bigint | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subs, setSubs] = useState<Recurring[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [layout, setLayout] = useState<WidgetLayout>(defaultLayout);
  const [editing, setEditing] = useState(false);
  const [pull, setPull] = useState(0);
  const pullStart = useRef<{ x: number; y: number } | null>(null);

  // Charge l'agencement perso dès que l'utilisateur est connu
  useEffect(() => {
    if (user?.id) setLayout(loadLayout(user.id));
  }, [user?.id]);

  const persist = (l: WidgetLayout) => {
    setLayout(l);
    if (user?.id) saveLayout(user.id, l);
  };
  const moveWidget = (id: WidgetId, dir: -1 | 1) => {
    const order = [...layout.order];
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    persist({ ...layout, order });
  };
  const removeWidget = (id: WidgetId) =>
    persist({ order: layout.order.filter((o) => o !== id) });
  const addWidget = (id: WidgetId) =>
    persist({ order: [...layout.order, id] });

  const reload = useCallback(() => {
    api.get<Summary>('/dashboard/summary').then(setData).catch(() => {});
    api
      .get<Gamification>('/gamification/me')
      .then((g) => {
        setGam(g);
        if (g.newBadges.length) setNewBadges(g.newBadges);
      })
      .catch(() => {});
    api.get<Insights>('/insights/today')
      .then((i) => {
        setInsights(i);
        // Badge de l'icône PWA = nombre d'enveloppes en négatif
        const nav = navigator as Navigator & {
          setAppBadge?: (n: number) => Promise<void>;
          clearAppBadge?: () => Promise<void>;
        };
        try {
          if (i.negativeCount > 0) void nav.setAppBadge?.(i.negativeCount);
          else void nav.clearAppBadge?.();
        } catch {
          /* API badge non supportée */
        }
      })
      .catch(() => {});
    // Enveloppes épinglées : jauges circulaires du mois courant
    api
      .get<{ household: { lines: FavLine[] } | null; personal: { lines: FavLine[] } | null }>(
        '/budgets?view=both',
      )
      .then((b) => {
        const entries: FavEntry[] = [];
        let left = 0n;
        for (const scope of ['household', 'personal'] as const) {
          for (const line of b[scope]?.lines ?? []) {
            if (line.envelope?.isFavorite) entries.push({ line, scope });
            const avail = BigInt(line.available ?? '0');
            if (avail > 0n) left += avail;
          }
        }
        setFavs(entries);
        setLeftToSpend(left);
      })
      .catch(() => {});
    api.get<Goal[]>('/goals').then(setGoals).catch(() => {});
    api
      .get<Recurring[]>('/recurring')
      .then((r) => setSubs(r.filter((x) => x.isSubscription)))
      .catch(() => {});
    api.get<Debt[]>('/debts').then(setDebts).catch(() => {});
  }, []);

  useEffect(() => {
    reload();
    const es = new EventSource('/api/v1/dashboard/events');
    es.onmessage = () => reload();
    const poll = setInterval(reload, 30_000);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [reload]);

  const fmt = (v: string | number | bigint) =>
    formatAmount(v, 'EUR', MINOR, i18n.language);
  const chartData = (data?.monthlySpend ?? []).map((m) => ({
    month: m.month,
    total: Number(m.total) / 100,
  }));

  const earned = new Set(gam?.achievements.map((a) => a.code) ?? []);
  const tier = TIER_STYLE[gam?.tier ?? 'bronze'];
  const TierIcon = tier.icon;

  const insightText = (it: Insights['items'][number]) => {
    const p = { ...it.params };
    for (const k of ['amount', 'income', 'thisWeek', 'lastWeek', 'target', 'allocated'])
      if (typeof p[k] === 'string') p[k] = fmt(p[k] as string);
    p.scope = t(`scope.${p.scope === 'household' ? 'household' : 'personal'}`);
    return t(`insights.${it.code}`, p);
  };

  // Pull-to-refresh : tirer vers le bas en haut de page recharge le tableau
  const onTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0)
      pullStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = pullStart.current;
    if (!s) return;
    const dy = e.touches[0].clientY - s.y;
    const dx = Math.abs(e.touches[0].clientX - s.x);
    // geste clairement vertical uniquement — pas de refresh sur swipe horizontal
    if (dy > 30 && dy > dx * 1.5 && window.scrollY <= 0)
      setPull(Math.min(dy - 30, 110));
  };
  const onTouchEnd = () => {
    if (pull > 75) {
      navigator.vibrate?.(12);
      reload();
    }
    setPull(0);
    pullStart.current = null;
  };

  const pointsByCode = Object.fromEntries(
    (gam?.catalog ?? []).map((c) => [c.code, c.points]),
  );

  /** Rend chaque widget du dashboard (le contenu, pas l'ordonnancement). */
  const renderWidget = (id: WidgetId): ReactNode => {
    switch (id) {
      case 'hero': {
        const spent =
          BigInt(data?.budget.household?.totals.spent ?? '0') +
          BigInt(data?.budget.personal?.totals.spent ?? '0');
        const unassigned =
          BigInt(data?.budget.household?.totals.unassigned ?? '0') +
          BigInt(data?.budget.personal?.totals.unassigned ?? '0');
        // Évolution des dépenses vs le mois précédent
        const months = data?.monthlySpend ?? [];
        const prev = months.length >= 2 ? BigInt(months[months.length - 2].total) : null;
        const cur = months.length >= 1 ? BigInt(months[months.length - 1].total) : null;
        const delta =
          prev !== null && prev > 0n && cur !== null
            ? Number((cur - prev) * 10000n / prev) / 100
            : null;
        const heroStats = [
          {
            label: t('dash.leftToSpend'),
            value: leftToSpend,
            cls: 'text-teal-300',
          },
          {
            label: t('dash.spentMonth'),
            value: data ? spent : null,
            cls: 'text-rose-300',
          },
          {
            label: t('dash.unassignedHousehold'),
            value: data ? unassigned : null,
            cls: 'text-amber-300',
          },
        ];
        return (
          <section className="card relative overflow-hidden p-6 sm:p-7">
            <div className="anim-halo pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl" />
            <div className="anim-halo-b pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-violet-400/10 blur-3xl" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="lbl">{t('dashboard.welcome', { name: user?.displayName })}</p>
                <p className="num mt-2 bg-gradient-to-r from-teal-300 via-emerald-300 to-teal-200 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
                  {data ? fmt(data.totals.accountsBalance) : '—'}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {t('dash.totalBalance')} · {data?.totals.accountsCount ?? '—'} {t('dash.accounts').toLowerCase()}
                </p>
              </div>
              {delta !== null && (
                <span
                  className={`chip !py-1.5 !text-sm font-semibold ${
                    delta > 0
                      ? 'border-rose-400/30 bg-rose-400/10 text-rose-300'
                      : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                  }`}
                >
                  {delta > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {delta > 0 ? '+' : ''}
                  {Math.round(delta)} % {t('budget.vsLastMonth')}
                </span>
              )}
            </div>
            <div className="relative mt-5 grid grid-cols-3 gap-2 sm:gap-3">
              {heroStats.map(({ label, value, cls }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 sm:px-4"
                >
                  <p className="truncate text-[11px] font-medium text-slate-500">
                    {label}
                  </p>
                  <p className={`num mt-1 truncate text-sm font-bold sm:text-lg ${cls}`}>
                    {value === null ? '—' : fmt(value)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        );
      }
      case 'level':
        return (
          <section className="card card-hover h-full p-5">
            <div className="flex items-center gap-4">
              <Ring value={gam?.progressToNext ?? 0} size={96} stroke={9}>
                <TierIcon className="text-teal-300" size={26} />
              </Ring>
              <div className="min-w-0">
                <p className="lbl">{t('gamification.level')}</p>
                <p className={`bg-gradient-to-r ${tier.grad} bg-clip-text text-2xl font-extrabold capitalize text-transparent`}>
                  {t(`tiers.${gam?.tier ?? 'bronze'}`)}
                </p>
                <p className="num text-sm text-slate-400">
                  {gam?.points ?? 0} {t('gamification.points')}
                  {gam?.nextTier && (
                    <> · {t('gamification.nextTier', { tier: t(`tiers.${gam.nextTier.key}`), points: gam.nextTier.min })}</>
                  )}
                </p>
              </div>
            </div>
            {gam && gam.newBadges.length > 0 && (
              <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                {t('gamification.newBadges', { count: gam.newBadges.length })}
              </p>
            )}
            {/* Badges */}
            <div className="mt-4 grid grid-cols-6 gap-2">
              {(gam?.catalog ?? []).map((b) => {
                const Icon = BADGE_ICON[b.code] ?? Award;
                const has = earned.has(b.code);
                return (
                  <div
                    key={b.code}
                    title={`${t(`badges.${b.code}`)} · ${b.points} ${t('gamification.points')}`}
                    className={`flex aspect-square flex-col items-center justify-center rounded-xl border p-1 text-center transition ${
                      has
                        ? 'border-teal-400/30 bg-teal-400/10 text-teal-300'
                        : 'border-white/[0.06] bg-white/[0.02] text-slate-600'
                    }`}
                  >
                    {has ? <Icon size={18} /> : <Lock size={16} />}
                  </div>
                );
              })}
            </div>
          </section>
        );
      case 'insights':
        return (
          <section className="card h-full p-5">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="text-amber-300" size={18} />
              <h2 className="font-semibold">{t('insights.title')}</h2>
            </div>
            {!insights ? (
              <div className="space-y-2">
                <div className="skeleton h-12" />
                <div className="skeleton h-12" />
              </div>
            ) : (
              <SnapCarousel a11y={t('insights.title')}>
                {insights.items.map((it, i) => {
                  const s = SEVERITY[it.severity];
                  const Icon = s.icon;
                  return (
                    <div
                      key={i}
                      className={`flex h-full items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${s.cls}`}
                    >
                      <Icon size={17} className="mt-0.5 shrink-0" />
                      <span>{insightText(it)}</span>
                    </div>
                  );
                })}
              </SnapCarousel>
            )}
          </section>
        );
      case 'stats':
        return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label={t('dash.spentMonth')}
            value={data ? fmt(data.budget.household?.totals.spent ?? '0') : '—'}
            tone="bad"
          />
          <Stat
            label={t('dash.spentPersonal')}
            value={data ? fmt(data.budget.personal?.totals.spent ?? '0') : '—'}
          />
          <Stat
            label={t('dash.unassignedHousehold')}
            value={data?.budget.household ? fmt(data.budget.household.totals.unassigned) : '—'}
            tone="good"
          />
          <Stat
            label={t('dash.accounts')}
            value={data?.totals.accountsCount ?? '—'}
          />
        </div>
        );
      case 'favorites': {
        if (!favs.length) return null;
        return (
          <section className="card p-5">
            <h2 className="mb-4 font-semibold text-slate-200">{t('dashboard.favorites')}</h2>
            <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-4">
              {favs.map(({ line, scope }) => {
                const env = line.envelope!;
                const alloc = Number(line.allocated);
                const avail = Number(line.available);
                // Part restante de l'enveloppe (alloué + reports/transferts − dépensé)
                const ratio = alloc > 0 ? avail / alloc : avail > 0 ? 1 : 0;
                const color =
                  avail < 0 ? '#fb7185' : ratio < 0.2 ? '#fbbf24' : undefined;
                return (
                  <Link
                    key={`${scope}-${env.id}`}
                    to={`/envelopes/${env.id}`}
                    className="card-hover flex w-36 shrink-0 flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center sm:w-auto"
                  >
                    <Ring value={Math.max(0, ratio)} size={92} stroke={9} color={color}>
                      <span className={`num text-sm font-bold leading-tight ${avail < 0 ? 'text-rose-300' : 'text-slate-100'}`}>
                        {fmt(avail)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {alloc > 0 ? `${Math.round(ratio * 100)} %` : '—'}
                      </span>
                    </Ring>
                    <div className="flex min-w-0 flex-col items-center">
                      <div className="flex max-w-full items-center gap-1.5">
                        <IconView icon={env.icon} fallback={env.name} size={20} />
                        <p className="truncate text-sm font-medium text-slate-200">{env.name}</p>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {scope === 'household' ? t('scope.household') : t('scope.personal')}
                        {alloc > 0 && ` · ${fmt(alloc)}`}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      }
      case 'chart':
        return (
          <section className="card h-full p-5">
            <h2 className="mb-3 font-semibold text-slate-200">{t('dash.monthlySpend')}</h2>
            {chartData.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">{t('dash.noData')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <XAxis dataKey="month" fontSize={12} stroke="#64748b" tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} stroke="#64748b" tickLine={false} axisLine={false} width={44} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{
                      background: '#101828',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 12,
                      fontSize: 13,
                    }}
                    formatter={(v) => fmt(Math.round(Number(v) * 100))}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={i === chartData.length - 1 ? '#34d399' : '#0d9488'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </section>
        );
      case 'breakdown': {
        const bk = data?.breakdown;
        const total = Number(bk?.total ?? '0');
        const mand = Number(bk?.mandatory ?? '0');
        const envs = (bk?.byEnvelope ?? []).map((e) => ({
          ...e,
          amountN: Number(e.amount),
          mandatoryN: Number(e.mandatory),
          prevN: Number(e.prev ?? '0'),
        }));
        const COLORS = ['#2dd4bf', '#34d399', '#a78bfa', '#60a5fa', '#f472b6', '#fbbf24', '#64748b'];
        const TOP = 6;
        const restSum = envs.slice(TOP).reduce((a, e) => a + e.amountN, 0);
        const donut = [
          ...envs.slice(0, TOP).map((e, i) => ({
            name: e.name ?? t('dash.unassignedEnv'),
            value: e.amountN,
            color: COLORS[i % (COLORS.length - 1)],
          })),
          ...(restSum > 0
            ? [{ name: t('dash.others'), value: restSum, color: COLORS[COLORS.length - 1] }]
            : []),
        ];
        const mandPct = total > 0 ? mand / total : 0;
        return (
          <section className="card h-full p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-slate-200">
                <PieChartIcon size={16} className="text-teal-300" />
                {t('widgets.items.breakdown')}
              </h2>
              <span className="num text-sm font-bold text-slate-100">
                {data ? fmt(bk?.total ?? '0') : '—'}
              </span>
            </div>
            {!data ? (
              <div className="skeleton h-40" />
            ) : total === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">{t('dash.noData')}</p>
            ) : (
              <>
                <div className="flex items-center gap-5">
                  {/* Donut par enveloppe */}
                  <div className="relative h-32 w-32 shrink-0">
                    <PieChart width={128} height={128}>
                      <Pie
                        data={donut}
                        dataKey="value"
                        innerRadius={40}
                        outerRadius={58}
                        strokeWidth={0}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {donut.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                    </PieChart>
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="num text-sm font-bold text-slate-100">{fmt(total)}</span>
                    </span>
                  </div>
                  {/* Répartition obligatoires / variables */}
                  <div className="min-w-0 flex-1">
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
                      <div className="bg-amber-400/80 transition-all duration-500" style={{ width: `${mandPct * 100}%` }} />
                    </div>
                    <div className="mt-2.5 space-y-1 text-xs">
                      <p className="flex items-center justify-between gap-2 text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <i className="h-2 w-2 rounded-full bg-amber-400" />
                          {t('widgets.breakdown.mandatory')}
                        </span>
                        <span className="num font-semibold text-amber-300">
                          {fmt(mand)} · {Math.round(mandPct * 100)} %
                        </span>
                      </p>
                      <p className="flex items-center justify-between gap-2 text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <i className="h-2 w-2 rounded-full bg-teal-400" />
                          {t('widgets.breakdown.optional')}
                        </span>
                        <span className="num font-semibold text-teal-300">
                          {fmt(total - mand)} · {Math.round((1 - mandPct) * 100)} %
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                {/* Top enveloppes */}
                <ul className="mt-4 space-y-2">
                  {envs.slice(0, 8).map((e, i) => {
                    const pct = total > 0 ? e.amountN / total : 0;
                    const color = COLORS[i % COLORS.length];
                    const row = (
                      <div className="flex items-center gap-2.5">
                        <IconView icon={e.icon} fallback={e.name ?? '?'} size={20} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="truncate text-slate-300">
                              {e.name ?? t('dash.unassignedEnv')}
                              {e.mandatoryN > 0 && (
                                <Pin size={10} className="ml-1 inline text-amber-300" />
                              )}
                            </span>
                            <span className="num shrink-0 font-semibold text-slate-200">
                              {fmt(e.amount)}
                              <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                                {Math.round(pct * 100)} %
                              </span>
                              {/* Évolution vs mois dernier */}
                              {e.prevN > 0 && (
                                <span
                                  title={t('widgets.breakdown.vsPrev')}
                                  className={`ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold ${
                                    e.amountN <= e.prevN
                                      ? 'text-emerald-300'
                                      : 'text-rose-300'
                                  }`}
                                >
                                  {e.amountN <= e.prevN ? (
                                    <TrendingDown size={10} />
                                  ) : (
                                    <TrendingUp size={10} />
                                  )}
                                  {Math.abs(Math.round(((e.amountN - e.prevN) / e.prevN) * 100))} %
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct * 100}%`, background: color }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                    return (
                      <li key={e.id ?? 'unassigned'}>
                        {e.id ? (
                          <Link to={`/envelopes/${e.id}`} className="block transition hover:opacity-80">
                            {row}
                          </Link>
                        ) : (
                          row
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        );
      }
      case 'pace': {
        const pace = data?.pace;
        const alerts = data?.alerts ?? [];
        const projectedNeg = pace ? BigInt(pace.projected) < 0n : false;
        return (
          <section className="card h-full p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-200">
              <Gauge size={16} className="text-teal-300" />
              {t('widgets.items.pace')}
            </h2>
            {!data ? (
              <div className="skeleton h-36" />
            ) : (
              <>
                {/* Alertes enveloppes : dépassée ou sous le seuil */}
                {alerts.length > 0 && (
                  <ul className="mb-4 space-y-1.5">
                    {alerts.slice(0, 4).map((a) => (
                      <li key={a.envelopeId}>
                        <Link
                          to={`/envelopes/${a.envelopeId}`}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition hover:opacity-80 ${
                            a.severity === 'over'
                              ? 'border-rose-400/30 bg-rose-400/10 text-rose-200'
                              : 'border-amber-400/30 bg-amber-400/10 text-amber-200'
                          }`}
                        >
                          <AlertTriangle size={13} className="shrink-0" />
                          <IconView icon={a.icon} fallback={a.name} size={16} />
                          <span className="min-w-0 flex-1 truncate">
                            {a.name}
                            {a.scope === 'personal' && (
                              <span className="ml-1.5 text-[10px] opacity-60">
                                {t('scope.personal')}
                              </span>
                            )}
                          </span>
                          <span className="num shrink-0 font-semibold">
                            {a.severity === 'over'
                              ? fmt(a.available)
                              : t('widgets.pace.lowAt', { amount: fmt(a.available) })}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {/* Reste à vivre / jour + solde projeté */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-teal-400/20 bg-teal-400/[0.06] p-3.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-teal-300/80">
                      {t('widgets.pace.dailyLeft')}
                    </p>
                    <p className="num mt-1.5 truncate text-xl font-extrabold text-teal-200 sm:text-2xl">
                      {pace ? fmt(pace.dailyLeft) : '—'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {t('widgets.pace.daysLeft', { count: pace?.daysLeft ?? 0 })}
                    </p>
                  </div>
                  <div
                    className={`rounded-xl border p-3.5 ${
                      projectedNeg
                        ? 'border-rose-400/20 bg-rose-400/[0.06]'
                        : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {t('widgets.pace.projected')}
                    </p>
                    <p
                      className={`num mt-1.5 truncate text-xl font-extrabold sm:text-2xl ${
                        projectedNeg ? 'text-rose-300' : 'text-slate-100'
                      }`}
                    >
                      {pace ? fmt(pace.projected) : '—'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {t('widgets.pace.projectedHint')}
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        );
      }
      case 'debts': {
        const open = debts.filter((d) => !d.closedAt);
        const owedToMe = open
          .filter((d) => d.direction === 'OWED_TO_ME')
          .reduce((a, d) => a + BigInt(d.amount) - BigInt(d.paid), 0n);
        const iOwe = open
          .filter((d) => d.direction === 'I_OWE')
          .reduce((a, d) => a + BigInt(d.amount) - BigInt(d.paid), 0n);
        return (
          <section className="card h-full p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-slate-200">
                <HandCoins size={16} className="text-teal-300" />
                {t('widgets.items.debts')}
              </h2>
              <Link to="/planning?tab=savings" className="text-xs font-medium text-teal-300 hover:text-teal-200">
                {t('dash.seeAll')}
              </Link>
            </div>
            {open.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {t('debts.empty')}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-300/80">
                    {t('debts.owedToMe')}
                  </p>
                  <p className="num mt-1.5 truncate text-xl font-extrabold text-emerald-200">
                    {fmt(owedToMe)}
                  </p>
                </div>
                <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-rose-300/80">
                    {t('debts.iOwe')}
                  </p>
                  <p className="num mt-1.5 truncate text-xl font-extrabold text-rose-200">
                    {fmt(iOwe)}
                  </p>
                </div>
              </div>
            )}
          </section>
        );
      }
      case 'recent':
        return (
          <section className="card h-full p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-200">{t('dash.recent')}</h2>
              <Link to="/transactions" className="text-xs font-medium text-teal-300 hover:text-teal-200">
                {t('dash.seeAll')}
              </Link>
            </div>
            <ul className="divide-y divide-white/[0.06]">
              {(data?.recent ?? []).map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate">
                    {tx.label}
                    <span className="ml-2 text-xs text-slate-500">
                      {tx.account.name}
                      {tx.envelope ? ` · ${tx.envelope.name}` : ''}
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
                    {fmt(tx.amount)}
                  </span>
                </li>
              ))}
              {data && data.recent.length === 0 && (
                <p className="py-6 text-sm text-slate-500">{t('dash.noData')}</p>
              )}
            </ul>
          </section>
        );
      case 'quickAdd':
        return (
          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-200">{t('widgets.items.quickAdd')}</h2>
            <div className="grid grid-cols-3 gap-2">
              <Link
                to="/transactions"
                className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] py-3 text-xs text-slate-300 transition hover:border-rose-400/40 hover:text-rose-300"
              >
                <Plus size={18} />
                {t('widgets.quick.expense')}
              </Link>
              <Link
                to="/accounts"
                className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] py-3 text-xs text-slate-300 transition hover:border-teal-400/40 hover:text-teal-300"
              >
                <ArrowLeftRight size={18} />
                {t('widgets.quick.transfer')}
              </Link>
              <Link
                to="/budget"
                className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] py-3 text-xs text-slate-300 transition hover:border-violet-400/40 hover:text-violet-300"
              >
                <Wallet size={18} />
                {t('widgets.quick.budget')}
              </Link>
            </div>
          </section>
        );
      case 'accounts':
        return (
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-slate-200">
                <Landmark size={16} className="text-teal-300" />
                {t('widgets.items.accounts')}
              </h2>
              <Link to="/accounts" className="text-xs font-medium text-teal-300 hover:text-teal-200">
                {t('dash.seeAll')}
              </Link>
            </div>
            {!data || data.accounts.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">{t('accounts.empty')}</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {data.accounts.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/accounts/${a.id}`}
                      className="flex items-center justify-between gap-3 py-2 text-sm transition hover:text-teal-300"
                    >
                      <span className="min-w-0 truncate text-slate-300">
                        {a.name}
                        {a.ownerId === null && (
                          <span className="ml-2 text-xs text-teal-300">{t('scope.household')}</span>
                        )}
                      </span>
                      <span className="num shrink-0 font-semibold text-slate-100">
                        {formatAmount(a.balance, a.currencyCode, a.currency?.minorUnits ?? MINOR, i18n.language)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      case 'goals':
        return (
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-slate-200">
                <Target size={16} className="text-emerald-300" />
                {t('widgets.items.goals')}
              </h2>
              <Link to="/planning" className="text-xs font-medium text-teal-300 hover:text-teal-200">
                {t('dash.seeAll')}
              </Link>
            </div>
            {goals.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">{t('dash.noData')}</p>
            ) : (
              <ul className="space-y-3">
                {goals.slice(0, 4).map((g) => {
                  const target = Number(g.targetAmount);
                  const pct = target > 0 ? Number(g.currentAmount) / target : 0;
                  return (
                    <li key={g.id}>
                      <Link to={`/goals/${g.id}`} className="block transition hover:opacity-80">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex min-w-0 items-center gap-1.5 text-slate-300">
                            <IconView icon={g.icon} fallback={g.name} size={18} />
                            <span className="truncate">{g.name}</span>
                          </span>
                          <span className="num shrink-0 text-xs font-semibold text-teal-300">
                            {Math.round(pct * 100)} %
                          </span>
                        </div>
                        <ProgressBar value={pct} className="mt-1" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      case 'subscriptions': {
        const monthly = subs.reduce(
          (acc, s) => acc + Number(s.amount) * (FREQ_FACTOR[s.frequency] ?? 1),
          0,
        );
        return (
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-slate-200">
                <Repeat size={16} className="text-violet-300" />
                {t('widgets.items.subscriptions')}
              </h2>
              <Link to="/planning" className="text-xs font-medium text-teal-300 hover:text-teal-200">
                {t('dash.seeAll')}
              </Link>
            </div>
            {subs.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">{t('dash.noData')}</p>
            ) : (
              <>
                <p className="num truncate text-2xl font-bold text-slate-100">
                  {fmt(Math.round(monthly))}
                  <span className="ml-1 text-sm font-normal text-slate-400">
                    / {t('widgets.perMonth')}
                  </span>
                </p>
                <ul className="mt-2 space-y-1.5 text-xs text-slate-400">
                  {subs.slice(0, 3).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <IconView icon={s.icon} fallback={s.label} size={18} />
                        <span className="truncate">{s.label}</span>
                      </span>
                      <span className="num shrink-0">{fmt(s.amount)}</span>
                    </li>
                  ))}
                  {subs.length > 3 && (
                    <li className="text-slate-500">+{subs.length - 3}</li>
                  )}
                </ul>
              </>
            )}
          </section>
        );
      }
      case 'tip': {
        const tips = t('widgets.tips', { returnObjects: true });
        if (!Array.isArray(tips) || !tips.length) return null;
        const dayOfYear = Math.floor(
          (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 864e5,
        );
        return <TipCarousel tips={tips as string[]} start={dayOfYear % tips.length} />;
      }
    }
  };

  // Niveau+Avis et Graphique+Récentes partagent une grille côte à côte
  const PAIR_A: WidgetId[] = ['level', 'insights'];
  const PAIR_B: WidgetId[] = ['chart', 'recent'];
  const visible = layout.order;
  const used = new Set<WidgetId>();
  const sections = visible.flatMap((id) => {
    if (used.has(id)) return [];
    const pair = [PAIR_A, PAIR_B].find((p) => p.includes(id));
    if (!pair) {
      used.add(id);
      const node = renderWidget(id);
      return node ? [{ id, node }] : [];
    }
    const members = pair
      .filter((m) => visible.includes(m))
      .sort((a, b) => visible.indexOf(a) - visible.indexOf(b));
    members.forEach((m) => used.add(m));
    if (!members.length) return [];
    const isA = pair === PAIR_A;
    const solo = members.length === 1;
    return [
      {
        id: pair[0],
        node: (
          <div className={`grid gap-4 ${isA ? 'lg:grid-cols-5' : 'lg:grid-cols-2'}`}>
            {members.map((m) => (
              <div
                key={m}
                className={`min-w-0 ${
                  solo
                    ? isA
                      ? 'lg:col-span-5'
                      : 'lg:col-span-2'
                    : m === 'level'
                      ? 'lg:col-span-2'
                      : m === 'insights'
                        ? 'lg:col-span-3'
                        : ''
                }`}
              >
                {renderWidget(m)}
              </div>
            ))}
          </div>
        ),
      },
    ];
  });

  return (
    <Layout>
      {newBadges.length > 0 && (
        <BadgeCelebration
          codes={newBadges}
          pointsByCode={pointsByCode}
          onClose={() => setNewBadges([])}
        />
      )}
      <div
        className="space-y-5 animate-fade-up"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {pull > 0 && (
          <div
            className="flex items-center justify-center text-teal-300 transition-opacity"
            style={{ height: Math.min(pull, 56), opacity: pull / 75 }}
          >
            <RefreshCw
              size={20}
              className={pull > 75 ? 'animate-spin' : ''}
              style={{ transform: `rotate(${pull * 3}deg)` }}
            />
          </div>
        )}
        <p className="lbl capitalize">
          {new Date().toLocaleDateString(i18n.language, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
        {sections.map((s) => (
          <Fragment key={s.id}>{s.node}</Fragment>
        ))}
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setEditing(true)}
            className="chip flex items-center gap-1.5 text-slate-400 transition hover:border-teal-400/40 hover:text-teal-300"
          >
            <Settings2 size={14} />
            {t('widgets.customize')}
          </button>
        </div>
      </div>

      {/* ── Panneau de personnalisation ─────────────────── */}
      {editing && (
        <Modal title={t('widgets.customize')} onClose={() => setEditing(false)}>
          <div>
            <p className="mt-1 text-xs text-slate-500">{t('widgets.hint')}</p>
            <p className="lbl mt-4">{t('widgets.onHome')}</p>
            <ul className="mt-2 space-y-1.5">
              {layout.order.map((id, idx) => (
                <li
                  key={id}
                  className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-slate-200"
                >
                  <span className="flex-1 truncate">{t(`widgets.items.${id}`)}</span>
                  <button
                    onClick={() => moveWidget(id, -1)}
                    disabled={idx === 0}
                    className="rounded p-1 text-slate-400 transition hover:text-teal-300 disabled:opacity-25"
                    aria-label="up"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    onClick={() => moveWidget(id, 1)}
                    disabled={idx === layout.order.length - 1}
                    className="rounded p-1 text-slate-400 transition hover:text-teal-300 disabled:opacity-25"
                    aria-label="down"
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button
                    onClick={() => removeWidget(id)}
                    className="rounded p-1 text-slate-400 transition hover:text-rose-300"
                    aria-label="remove"
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
            {reserveOf(layout.order).length > 0 && (
              <>
                <p className="lbl mt-4">{t('widgets.reserve')}</p>
                <ul className="mt-2 space-y-1.5">
                  {reserveOf(layout.order).map((id) => (
                    <li
                      key={id}
                      className="flex items-center gap-1 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-slate-400"
                    >
                      <span className="flex-1 truncate">{t(`widgets.items.${id}`)}</span>
                      <button
                        onClick={() => {
                          navigator.vibrate?.(8);
                          addWidget(id);
                        }}
                        className="flex items-center gap-1 rounded-lg border border-teal-400/30 bg-teal-400/10 px-2 py-1 text-xs font-medium text-teal-300 transition hover:bg-teal-400/20"
                      >
                        <Plus size={13} />
                        {t('widgets.add')}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => persist(defaultLayout())}
                className="text-xs font-medium text-slate-400 transition hover:text-slate-200"
              >
                {t('widgets.reset')}
              </button>
              <button onClick={() => setEditing(false)} className="btn-primary !px-4 !py-1.5 text-sm">
                {t('common.close')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
