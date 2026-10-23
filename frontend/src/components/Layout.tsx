import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  LayoutDashboard,
  Lock,
  LogOut,
  Moon,
  PiggyBank,
  Plus,
  Repeat,
  Settings,
  Sun,
  Wallet,
  X,
} from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { IconView } from '../icons';
import { formatAmount } from '../money';
import { TxTemplate } from '../types';
import { isLocked, isPinEnabled, requestLock } from '../pinlock';
import { getTheme, Theme, toggleTheme } from '../theme';
import { Modal } from './Modal';
import { PinLockScreen } from './PinLockScreen';
import { ToastHost } from './ToastHost';

/** Barre mobile : 2 onglets + FAB + 1 onglet + « Plus ». */
const NAV_MOBILE_LEFT = [
  { to: '/', icon: LayoutDashboard, key: 'nav.dashboard', end: true },
  { to: '/budget', icon: PiggyBank, key: 'nav.budget' },
];
const NAV_MOBILE_RIGHT = [
  { to: '/transactions', icon: ArrowLeftRight, key: 'nav.transactions' },
];

/** Sidebar : toutes les sections. `path` = pathname seul, `to` inclut le query. */
const NAV_ALL = [
  { to: '/', icon: LayoutDashboard, key: 'nav.dashboard', end: true },
  { to: '/budget', icon: PiggyBank, key: 'nav.budget' },
  { to: '/accounts', icon: Wallet, key: 'nav.accounts' },
  { to: '/transactions', icon: ArrowLeftRight, key: 'nav.transactions' },
  { to: '/planning', icon: CalendarClock, key: 'nav.planning' },
  { to: '/settings', icon: Settings, key: 'nav.settings' },
];

/** Destinations du menu « Plus » mobile. */
const NAV_MORE = [
  { to: '/accounts', icon: Wallet, key: 'nav.accounts' },
  { to: '/planning', icon: CalendarClock, key: 'nav.planning' },
  { to: '/settings', icon: Settings, key: 'nav.settings' },
];

const COLLAPSED_KEY = 'flouze:sidebar-collapsed';

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function Layout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState<Theme>(getTheme);
  const [locked, setLocked] = useState(isLocked);
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [sheet, setSheet] = useState<'actions' | 'more' | null>(null);
  // Modèles d'opérations affichés dans la feuille « + »
  const [templates, setTemplates] = useState<TxTemplate[]>([]);

  useEffect(() => {
    const onLock = () => setLocked(true);
    window.addEventListener('flouze-lock', onLock);
    return () => window.removeEventListener('flouze-lock', onLock);
  }, []);

  // Ferme les bottom-sheets à chaque navigation
  useEffect(() => {
    setSheet(null);
  }, [location.pathname, location.search]);

  // Charge les modèles à l'ouverture de la feuille « + »
  useEffect(() => {
    if (sheet === 'actions') {
      api.get<TxTemplate[]>('/tx-templates').then(setTemplates).catch(() => {});
    }
  }, [sheet]);

  // Retour haptique léger sur chaque tap — mobile uniquement
  useEffect(() => {
    const haptic = (e: MouseEvent) => {
      if (
        (e.target as HTMLElement).closest(
          'button, a, [role="button"], input[type="checkbox"]',
        )
      ) {
        try {
          navigator.vibrate?.(6);
        } catch {
          /* non supporté */
        }
      }
    };
    document.addEventListener('click', haptic, { passive: true });
    return () => document.removeEventListener('click', haptic);
  }, []);

  if (locked) return <PinLockScreen onUnlock={() => setLocked(false)} />;

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1');
      } catch {
        /* noop */
      }
      return !c;
    });
  }

  const actions = [
    {
      icon: ArrowUpRight,
      label: t('quick.expense'),
      cls: 'bg-rose-400/15 text-rose-300',
      to: '/transactions?add=EXPENSE',
    },
    {
      icon: ArrowDownLeft,
      label: t('quick.income'),
      cls: 'bg-emerald-400/15 text-emerald-300',
      to: '/transactions?add=INCOME',
    },
    {
      icon: ArrowLeftRight,
      label: t('quick.transfer'),
      cls: 'bg-sky-400/15 text-sky-300',
      to: '/transactions?add=ACCOUNT_TRANSFER',
    },
    {
      icon: Repeat,
      label: t('quick.envTransfer'),
      cls: 'bg-teal-400/15 text-teal-300',
      to: '/budget?transfer=1',
    },
  ];

  const itemActive = (item: (typeof NAV_ALL)[number]) =>
    item.end
      ? location.pathname === item.to
      : location.pathname.startsWith(item.to);
  const moreActive = NAV_MORE.some((m) => location.pathname.startsWith(m.to));

  const sideItem = (item: (typeof NAV_ALL)[number]) => {
    const { to, icon: Icon, key } = item;
    const active = itemActive(item);
    return (
      <Link
        key={to}
        to={to}
        title={collapsed ? t(key) : undefined}
        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition justify-center ${
          collapsed ? 'lg:justify-center lg:px-0' : 'lg:justify-start'
        } ${
          active
            ? 'bg-gradient-to-r from-teal-400/15 to-emerald-400/10 text-teal-300'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        }`}
      >
        <Icon strokeWidth={2} size={19} className="shrink-0" />
        <span
          className={`hidden truncate ${collapsed ? 'lg:hidden' : 'lg:inline'}`}
        >
          {t(key)}
        </span>
        {/* Infobulle quand le rail est réduit */}
        <span
          className={`pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-night-850 px-2.5 py-1.5 text-xs font-medium text-slate-200 opacity-0 shadow-lift transition group-hover:opacity-100 md:group-hover:block ${
            collapsed ? 'lg:group-hover:block' : 'lg:group-hover:hidden'
          }`}
        >
          {t(key)}
        </span>
      </Link>
    );
  };

  const tabItem = ({ to, icon: Icon, key, end }: (typeof NAV_MOBILE_LEFT)[number]) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition ${
          isActive ? 'text-teal-300' : 'text-slate-500 hover:text-slate-300'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} />
          <span className="leading-none">{t(key)}</span>
          <span
            className={`h-1 w-1 rounded-full transition ${
              isActive ? 'bg-teal-300' : 'bg-transparent'
            }`}
          />
        </>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-dvh">
      <ToastHost />

      {/* Halos d'ambiance animés — derrière le contenu, visibles
          à travers les surfaces translucides */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="anim-halo absolute -top-24 right-[8%] h-72 w-72 rounded-full bg-teal-400/[0.07] blur-3xl" />
        <div className="anim-halo-b absolute bottom-[12%] -left-24 h-80 w-80 rounded-full bg-violet-400/[0.06] blur-3xl" />
      </div>

      {/* ── Sidebar tablette (rail icônes) & desktop ────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/[0.06] bg-night-900/60 py-4 backdrop-blur-xl transition-[width] duration-200 md:flex ${
          collapsed ? 'w-[4.5rem] px-3 lg:w-[4.5rem]' : 'w-[4.5rem] px-3 lg:w-60 lg:px-4'
        }`}
      >
        {/* Logo */}
        <Link
          to="/"
          className={`mb-5 flex items-center gap-2.5 px-1.5 pt-1 ${
            collapsed ? 'lg:justify-center' : ''
          }`}
        >
          <span className="anim-glow flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 shadow-glow">
            <PiggyBank className="h-5 w-5 text-night-950" strokeWidth={2.5} />
          </span>
          <span className={`hidden ${collapsed ? 'lg:hidden' : 'lg:block'}`}>
            <span className="block text-lg font-extrabold tracking-tight">
              {t('app.name')}
            </span>
            <span className="-mt-1 block text-[11px] text-slate-500">
              {t('app.tagline')}
            </span>
          </span>
        </Link>

        {/* CTA nouvelle opération */}
        <button
          onClick={() => setSheet('actions')}
          title={t('quick.new')}
          className={`btn-primary mb-5 !shadow-none ${
            collapsed ? 'lg:!px-0' : ''
          } !px-0 lg:px-4`}
        >
          <Plus size={18} strokeWidth={2.6} className="shrink-0" />
          <span className={`hidden truncate ${collapsed ? 'lg:hidden' : 'lg:inline'}`}>
            {t('quick.new')}
          </span>
        </button>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {NAV_ALL.map(sideItem)}
        </nav>

        {/* Actions du bas */}
        <div className="mt-2 flex flex-col gap-0.5">
          {isPinEnabled() && (
            <button
              onClick={requestLock}
              title={t('pinlock.lockNow')}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 transition hover:bg-white/5 hover:text-teal-300 ${
                collapsed ? 'lg:justify-center lg:px-0' : ''
              } justify-center lg:justify-start`}
            >
              <Lock size={18} className="shrink-0" />
              <span className={`hidden ${collapsed ? 'lg:hidden' : 'lg:inline'}`}>
                {t('pinlock.lockNow')}
              </span>
            </button>
          )}
          <button
            onClick={() => setTheme(toggleTheme())}
            title={t(theme === 'dark' ? 'theme.light' : 'theme.dark')}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 transition hover:bg-white/5 hover:text-teal-300 ${
              collapsed ? 'lg:justify-center lg:px-0' : ''
            } justify-center lg:justify-start`}
          >
            {theme === 'dark' ? <Sun size={18} className="shrink-0" /> : <Moon size={18} className="shrink-0" />}
            <span className={`hidden ${collapsed ? 'lg:hidden' : 'lg:inline'}`}>
              {t(theme === 'dark' ? 'theme.light' : 'theme.dark')}
            </span>
          </button>
          <button
            onClick={logout}
            title={t('common.logout')}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 transition hover:bg-white/5 hover:text-rose-300 ${
              collapsed ? 'lg:justify-center lg:px-0' : ''
            } justify-center lg:justify-start`}
          >
            <LogOut size={18} className="shrink-0" />
            <span className={`hidden ${collapsed ? 'lg:hidden' : 'lg:inline'}`}>
              {t('common.logout')}
            </span>
          </button>
          {user && (
            <Link
              to="/settings"
              title={user.displayName}
              className={`mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2 transition hover:bg-white/5 ${
                collapsed ? 'lg:justify-center lg:px-0' : ''
              } justify-center lg:justify-start`}
            >
              <IconView
                icon={user.avatarUrl}
                fallback={user.displayName}
                size={30}
                className="shrink-0 rounded-full"
              />
              <span
                className={`hidden truncate text-xs font-medium text-slate-400 ${
                  collapsed ? 'lg:hidden' : 'lg:inline'
                }`}
              >
                {user.displayName}
              </span>
            </Link>
          )}
          {/* Bascule rail réduit / étendu — desktop uniquement */}
          <button
            onClick={toggleCollapsed}
            title={t(collapsed ? 'nav.expand' : 'nav.collapse')}
            className={`mt-1 hidden items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:bg-white/5 hover:text-slate-300 lg:flex ${
              collapsed ? 'lg:justify-center lg:px-0' : ''
            }`}
          >
            {collapsed ? (
              <ChevronRight size={18} className="shrink-0" />
            ) : (
              <ChevronLeft size={18} className="shrink-0" />
            )}
            <span className={collapsed ? 'hidden' : 'inline'}>
              {t('nav.collapse')}
            </span>
          </button>
        </div>
      </aside>

      {/* ── Contenu ─────────────────────────────────────── */}
      <main
        className={`relative z-10 mx-auto w-full max-w-5xl px-4 pb-32 pt-5 transition-[padding] duration-200 sm:px-6 md:pb-12 md:pl-[5.5rem] md:pt-7 xl:max-w-6xl max-md:pt-[max(1.25rem,env(safe-area-inset-top))] ${
          collapsed ? 'lg:pl-[5.5rem]' : 'lg:pl-[15.5rem]'
        }`}
      >
        <div className={collapsed ? '' : 'lg:pl-2'}>{children}</div>
      </main>

      {/* ── Bottom nav mobile flottante + FAB ─────────────── */}
      <nav
        className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-white/[0.08] bg-night-900/90 shadow-nav backdrop-blur-xl md:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5 items-end px-2 pb-1.5 pt-1">
          {NAV_MOBILE_LEFT.map(tabItem)}
          {/* FAB central */}
          <div className="flex justify-center">
            <button
              onClick={() => setSheet('actions')}
              aria-label={t('quick.new')}
              className="anim-glow -mt-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 text-night-950 shadow-fab transition duration-150 active:scale-90"
            >
              <Plus size={26} strokeWidth={2.6} />
            </button>
          </div>
          {NAV_MOBILE_RIGHT.map(tabItem)}
          <button
            onClick={() => setSheet('more')}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition ${
              sheet === 'more' || moreActive
                ? 'text-teal-300'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Ellipsis size={21} strokeWidth={1.9} />
            <span className="leading-none">{t('nav.more')}</span>
            <span
              className={`h-1 w-1 rounded-full ${moreActive ? 'bg-teal-300' : 'bg-transparent'}`}
            />
          </button>
        </div>
      </nav>

      {/* ── Bottom sheet actions rapides ──────────────────── */}
      {sheet === 'actions' && (
        <Modal title={t('quick.title')} onClose={() => setSheet(null)}>
          <div className="grid grid-cols-2 gap-2.5">
            {actions.map(({ icon: Icon, label, cls, to }) => (
              <button
                key={to}
                onClick={() => {
                  setSheet(null);
                  navigate(to);
                }}
                className="card card-hover flex flex-col items-center gap-2.5 rounded-2xl p-4 text-center"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${cls}`}>
                  <Icon size={20} />
                </span>
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Modèles d'opérations enregistrés → tap = formulaire pré-rempli */}
          {templates.length > 0 && (
            <div className="mt-4 border-t border-white/[0.07] pt-3">
              <p className="lbl mb-2">{t('quick.templates')}</p>
              <ul className="space-y-1">
                {templates.map((tp) => (
                  <li key={tp.id} className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setSheet(null);
                        navigate(`/transactions?tpl=${tp.id}`);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5"
                    >
                      <IconView
                        icon={tp.envelope?.icon}
                        fallback={tp.label}
                        size={18}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {tp.label}
                      </span>
                      <span
                        className={`num shrink-0 text-xs font-semibold ${
                          tp.type === 'INCOME' ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {tp.type === 'INCOME' ? '+' : '−'}
                        {formatAmount(tp.amount, 'EUR', 2, i18n.language)}
                      </span>
                    </button>
                    <button
                      onClick={() =>
                        void api
                          .delete(`/tx-templates/${tp.id}`)
                          .then(() =>
                            setTemplates((ts) => ts.filter((x) => x.id !== tp.id)),
                          )
                          .catch(() => {})
                      }
                      className="icon-btn !p-1.5 text-slate-600 hover:text-rose-300"
                      aria-label={t('common.delete')}
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Modal>
      )}

      {/* ── Bottom sheet « Plus » ─────────────────────────── */}
      {sheet === 'more' && (
        <Modal title={t('nav.more')} onClose={() => setSheet(null)}>
          {/* Profil + verrou + thème en tête de feuille */}
          <div className="mb-3 flex items-center gap-3 border-b border-white/[0.07] pb-3">
            <button
              onClick={() => {
                setSheet(null);
                navigate('/settings');
              }}
              className="flex min-w-0 items-center gap-3 text-left"
            >
              <IconView
                icon={user?.avatarUrl}
                fallback={user?.displayName}
                size={36}
                className="shrink-0 rounded-xl"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {user?.displayName}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {t('nav.settings')}
                </span>
              </span>
            </button>
            <div className="ml-auto flex items-center gap-1">
              {isPinEnabled() && (
                <button
                  onClick={requestLock}
                  className="icon-btn"
                  aria-label={t('pinlock.lockNow')}
                >
                  <Lock size={17} />
                </button>
              )}
              <button
                onClick={() => setTheme(toggleTheme())}
                className="icon-btn"
                aria-label={t(theme === 'dark' ? 'theme.light' : 'theme.dark')}
              >
                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            </div>
          </div>
          <ul className="space-y-1">
            {NAV_MORE.map((m) => (
              <li key={m.to}>
                <button
                  onClick={() => {
                    setSheet(null);
                    navigate(m.to);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    itemActive(m)
                      ? 'bg-teal-400/10 text-teal-300'
                      : 'text-slate-300 hover:bg-white/[0.05]'
                  }`}
                >
                  <m.icon size={19} />
                  {t(m.key)}
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}
