import {
  ArrowLeftRight,
  Award,
  CalendarClock,
  CheckCircle2,
  FileUp,
  Flame,
  Lock,
  PiggyBank,
  Sparkles,
  TrendingDown,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { Bar, Ring } from '../components/ui';

interface Gamification {
  points: number;
  tier: string;
  nextTier: { key: string; min: number } | null;
  progressToNext: number;
  achievements: { code: string; earnedAt: string; points: number }[];
  newBadges: string[];
  catalog: { code: string; points: number }[];
}

const TIERS = [
  { key: 'bronze', min: 0, grad: 'from-amber-600 to-amber-400', text: 'text-amber-300' },
  { key: 'argent', min: 50, grad: 'from-slate-300 to-slate-100', text: 'text-slate-200' },
  { key: 'or', min: 120, grad: 'from-yellow-400 to-amber-300', text: 'text-yellow-300' },
  { key: 'platine', min: 220, grad: 'from-cyan-300 to-sky-200', text: 'text-cyan-200' },
  { key: 'diamant', min: 400, grad: 'from-violet-400 to-fuchsia-300', text: 'text-violet-300' },
];

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

export function RewardsSection() {
  const { t, i18n } = useTranslation();
  const [gam, setGam] = useState<Gamification | null>(null);

  useEffect(() => {
    api.get<Gamification>('/gamification/me').then(setGam).catch(() => {});
  }, []);

  const earned = new Map(gam?.achievements.map((a) => [a.code, a.earnedAt]) ?? []);
  const earnedCount = gam?.achievements.length ?? 0;
  const total = gam?.catalog.length ?? 0;
  const tierIdx = TIERS.findIndex((x) => x.key === (gam?.tier ?? 'bronze'));
  const tier = TIERS[Math.max(0, tierIdx)];

  return (
    <div className="space-y-5">
      <h2 className="flex items-center gap-2 px-1 font-semibold">
        <Trophy size={17} className="text-amber-300" />
        {t('nav.rewards')}
      </h2>

        {/* ── Palier actuel ──────────────────────────────── */}
        <section className="card relative overflow-hidden p-6">
          <div className={`pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-gradient-to-br ${tier.grad} opacity-15 blur-3xl`} />
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <Ring value={gam?.progressToNext ?? 0} size={140} stroke={12}>
              <div className="text-center">
                <Trophy className={`mx-auto ${tier.text}`} size={30} />
                <p className="num mt-1 text-2xl font-extrabold">{gam?.points ?? 0}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">pts</p>
              </div>
            </Ring>
            <div className="flex-1 text-center sm:text-left">
              <p className="lbl">{t('gamification.level')}</p>
              <p className={`bg-gradient-to-r ${tier.grad} bg-clip-text text-4xl font-extrabold capitalize text-transparent`}>
                {t(`tiers.${tier.key}`)}
              </p>
              {gam?.nextTier ? (
                <div className="mt-3 max-w-xs max-sm:mx-auto">
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>{t(`tiers.${tier.key}`)}</span>
                    <span>{t(`tiers.${gam.nextTier.key}`)} · {gam.nextTier.min} pts</span>
                  </div>
                  <Bar value={gam.progressToNext} />
                </div>
              ) : (
                <p className="mt-2 flex items-center gap-2 text-sm text-violet-300 max-sm:justify-center">
                  <Sparkles size={15} /> {t('gamification.maxTier')}
                </p>
              )}
              <p className="mt-3 text-sm text-slate-400">
                {t('gamification.earnedCount', { earned: earnedCount, total })}
              </p>
            </div>
          </div>
          {gam && gam.newBadges.length > 0 && (
            <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-sm font-medium text-amber-200">
              {t('gamification.newBadges', { count: gam.newBadges.length })}
            </p>
          )}
        </section>

        {/* ── Échelle des paliers ────────────────────────── */}
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">{t('gamification.ladder')}</h2>
          <div className="flex items-center gap-1">
            {TIERS.map((x, i) => {
              const reached = i <= tierIdx;
              return (
                <div key={x.key} className="flex-1 text-center">
                  <div className={`mx-auto mb-1.5 h-1.5 rounded-full ${reached ? `bg-gradient-to-r ${x.grad}` : 'bg-white/10'}`} />
                  <p className={`text-xs font-semibold capitalize ${reached ? x.text : 'text-slate-600'}`}>
                    {t(`tiers.${x.key}`)}
                  </p>
                  <p className="num text-[10px] text-slate-600">{x.min} pts</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Badges ─────────────────────────────────────── */}
        <section>
          <h2 className="lbl mb-3">{t('gamification.badgesTitle')}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(gam?.catalog ?? []).map((b) => {
              const Icon = BADGE_ICON[b.code] ?? Award;
              const at = earned.get(b.code);
              const has = at !== undefined;
              return (
                <div
                  key={b.code}
                  className={`card p-4 text-center transition ${
                    has ? 'border-teal-400/25 bg-teal-400/[0.06]' : 'opacity-60'
                  }`}
                >
                  <span
                    className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${
                      has
                        ? 'bg-gradient-to-br from-teal-400/25 to-emerald-400/15 text-teal-300'
                        : 'bg-white/[0.04] text-slate-600'
                    }`}
                  >
                    {has ? <Icon size={22} /> : <Lock size={18} />}
                  </span>
                  <p className="mt-2 text-sm font-semibold leading-tight">
                    {t(`badges.${b.code}`)}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    {t(`badgeDesc.${b.code}`)}
                  </p>
                  <p className="num mt-1.5 text-xs font-semibold text-amber-300/90">
                    +{b.points} {t('gamification.points')}
                  </p>
                  {has && (
                    <p className="mt-1 text-[10px] text-slate-500">
                      {new Date(at).toLocaleDateString(i18n.language)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
    </div>
  );
}
