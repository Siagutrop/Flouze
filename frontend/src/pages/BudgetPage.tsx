import { ChevronLeft, ChevronRight, Copy, PiggyBank, Plus, Share2, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Bar } from '../components/ui';
import { CoverBg } from '../covers';
import { SUGG_ENVELOPES } from '../envelopeSuggestions';
import { IconPicker, IconView } from '../icons';
import { formatAmount, parseToMinorUnits } from '../money';
import { Category, Envelope } from '../types';

interface BudgetLine {
  id: string | null;
  envelope: Envelope;
  allocated: string;
  carryoverIn: string;
  spent: string;
  prevSpent: string;
  netTransfers: string;
  available: string;
}

interface Period {
  id: string;
  year: number;
  month: number;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  lines: BudgetLine[];
  totals: {
    allocated: string;
    spent: string;
    available: string;
    scopeFunds: string;
    unassigned: string;
  };
}

interface BudgetResponse {
  household: Period | null;
  personal: Period | null;
}

const MINOR = 2; // EUR — affiné par devise du foyer si besoin

export function BudgetPage() {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [scope, setScope] = useState<'household' | 'personal'>('household');
  const [data, setData] = useState<BudgetResponse | null>(null);
  const [transfer, setTransfer] = useState<{
    from: string;
    to: string;
    amount: string;
  } | null>(null);
  const [fill, setFill] = useState<{
    prev: Record<string, string>;
    values: Record<string, string>;
  } | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [createModal, setCreateModal] = useState<'choice' | 'cat' | 'env' | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catName, setCatName] = useState('');
  const [catShared, setCatShared] = useState(false);
  const [envName, setEnvName] = useState('');
  const [envCategory, setEnvCategory] = useState('');
  const [envShared, setEnvShared] = useState(false);
  const [envIcon, setEnvIcon] = useState('');
  // Suggestion choisie : sa catégorie est créée à la volée si absente
  const [envSuggCat, setEnvSuggCat] = useState<string | null>(null);

  // Swipe horizontal (mobile) → navigation entre mois
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const reload = useCallback(
    () => api.get<BudgetResponse>(`/budgets?year=${year}&month=${month}`).then(setData),
    [year, month],
  );
  const reloadCategories = useCallback(
    () => api.get<Category[]>('/categories').then(setCategories),
    [],
  );
  useEffect(() => {
    reload();
    reloadCategories();
  }, [reload, reloadCategories]);

  const period = data?.[scope] ?? null;

  // Deep-link « + » → transfert entre enveloppes
  useEffect(() => {
    if (params.get('transfer') && period?.lines.length) {
      setTransfer({ from: period.lines[0].envelope.id, to: '', amount: '' });
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, period?.lines.length]);

  const fmt = (v: string | bigint | number) => formatAmount(v, 'EUR', MINOR, i18n.language);
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    i18n.language,
    { month: 'long', year: 'numeric' },
  );

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
  }

  async function generate() {
    await api.post('/budgets/generate', { year, month });
    reload();
  }

  /** Reprend les allocations du mois précédent en un clic. */
  async function copyPrevious() {
    if (!period) return;
    await api.post(`/budgets/${period.id}/copy-previous`, {});
    reload();
  }

  const prevMonthName = new Date(
    Date.UTC(year, month - 2, 1),
  ).toLocaleDateString(i18n.language, { month: 'long' });

  async function setAlloc(line: BudgetLine, input: string) {
    const v = parseToMinorUnits(input || '0', MINOR);
    if (v === null || !period) return;
    await api.patch(`/budgets/${period.id}/lines/${line.envelope.id}`, {
      allocated: v.toString(),
    });
    reload();
  }

  async function doTransfer(e: FormEvent) {
    e.preventDefault();
    if (!transfer || !period) return;
    const v = parseToMinorUnits(transfer.amount, MINOR);
    if (v === null || v <= 0n) return;
    await api.post(`/budgets/${period.id}/transfers`, {
      fromEnvelopeId: transfer.from,
      toEnvelopeId: transfer.to,
      amount: v.toString(),
    });
    setTransfer(null);
    reload();
  }

  /** Remplissage guidé : propose les allocations du mois précédent. */
  async function openFill() {
    if (!period) return;
    const d = new Date(Date.UTC(year, month - 2, 1));
    const prev = await api.get<BudgetResponse>(
      `/budgets?year=${d.getUTCFullYear()}&month=${d.getUTCMonth() + 1}`,
    );
    const prevMap: Record<string, string> = {};
    for (const l of prev[scope]?.lines ?? [])
      prevMap[l.envelope.id] = l.allocated;
    const values: Record<string, string> = {};
    for (const l of period.lines) {
      const v = BigInt(l.allocated) > 0n ? l.allocated : (prevMap[l.envelope.id] ?? '0');
      values[l.envelope.id] = (Number(v) / 100).toFixed(2);
    }
    setFill({ prev: prevMap, values });
  }

  async function applyFill(e: FormEvent) {
    e.preventDefault();
    if (!fill || !period) return;
    for (const l of period.lines) {
      const v = parseToMinorUnits(fill.values[l.envelope.id] ?? '0', MINOR);
      if (v !== null && v.toString() !== l.allocated) {
        await api.patch(`/budgets/${period.id}/lines/${l.envelope.id}`, {
          allocated: v.toString(),
        });
      }
    }
    setFill(null);
    reload();
  }

  /** Exporte une carte image du budget (partage mobile ou téléchargement). */
  async function shareBudget() {
    if (!shareRef.current || !period) return;
    try {
      const { toBlob } = await import('html-to-image');
      const blob = await toBlob(shareRef.current, { pixelRatio: 2 });
      if (!blob) return;
      const file = new File([blob], `flouze-budget-${year}-${month}.png`, {
        type: 'image/png',
      });
      const nav = navigator as Navigator & {
        canShare?: (d: { files: File[] }) => boolean;
        share?: (d: { files?: File[]; title?: string }) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: `Flouze — ${monthName}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      /* partage annulé ou indisponible */
    }
  }

  async function validate() {
    if (period) await api.post(`/budgets/${period.id}/validate`);
    reload();
  }
  async function close() {
    if (period) await api.post(`/budgets/${period.id}/close`);
    reload();
  }

  async function createCategory(e: FormEvent) {
    e.preventDefault();
    await api.post('/categories', { name: catName, shared: catShared });
    setCatName('');
    setCreateModal(null);
    reloadCategories();
    reload();
  }
  /** Remplit le formulaire depuis une suggestion ; la catégorie correspondante
   *  est pré-sélectionnée si elle existe déjà, sinon créée à l'envoi. */
  function pickSuggestion(catKey: string, envKey: string, icon: string) {
    const catName = t(`onboarding.sug.${catKey}`);
    const existing = categories.find(
      (c) => c.name.toLowerCase() === catName.toLowerCase(),
    );
    setEnvName(t(`onboarding.sug.${envKey}`));
    setEnvIcon(icon);
    setEnvSuggCat(catKey);
    setEnvCategory(existing?.id ?? '');
  }

  async function createEnvelope(e: FormEvent) {
    e.preventDefault();
    let categoryId = envCategory || undefined;
    // Suggestion sans catégorie existante → création à la volée
    if (!categoryId && envSuggCat) {
      try {
        const sugg = SUGG_ENVELOPES.find((c) => c.key === envSuggCat);
        const cat = await api.post<Category>('/categories', {
          name: t(`onboarding.sug.${envSuggCat}`),
          icon: sugg?.icon,
          shared: envShared,
        });
        categoryId = cat.id;
        reloadCategories();
      } catch {
        /* la catégorie n'a pas pu être créée → enveloppe sans catégorie */
      }
    }
    await api.post('/envelopes', {
      name: envName,
      categoryId,
      icon: envIcon || undefined,
      shared: envShared,
    });
    setEnvName('');
    setEnvIcon('');
    setEnvCategory('');
    setEnvSuggCat(null);
    setCreateModal(null);
    reload();
  }

  const editable = period && period.status !== 'CLOSED';
  const statusStyle: Record<string, string> = {
    DRAFT: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    ACTIVE: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    CLOSED: 'border-white/10 bg-white/5 text-slate-400',
  };

  // Regroupement des lignes par catégorie : les enveloppes de la même
  // catégorie partagent une tuile, les autres sont chacune isolées.
  const lineGroups = (() => {
    if (!period) return [] as { cat: { id: string; name: string } | null; lines: BudgetLine[] }[];
    const catIds: string[] = [];
    const names = new Map<string, string>();
    for (const l of period.lines) {
      const c = l.envelope.category;
      if (c && !catIds.includes(c.id)) {
        catIds.push(c.id);
        names.set(c.id, c.name);
      }
    }
    catIds.sort(
      (a, b) =>
        categories.findIndex((c) => c.id === a) - categories.findIndex((c) => c.id === b),
    );
    const grouped = catIds.map((id) => ({
      cat: { id, name: names.get(id)! },
      lines: period.lines.filter((l) => l.envelope.category?.id === id),
    }));
    const alone = period.lines
      .filter((l) => !l.envelope.category)
      .map((l) => ({ cat: null, lines: [l] }));
    return [...grouped, ...alone];
  })();

  function renderLine(l: BudgetLine) {
    const allocated = Number(l.allocated);
    const spent = Number(l.spent);
    const available = BigInt(l.available);
    const budget = allocated + Number(l.carryoverIn);
    const over = available < 0n;
    // Barre = part restante : pleine au départ, se vide en dépensant ;
    // en dépassement, une portion rouge reflète la profondeur du dépassement.
    const ratio =
      budget > 0
        ? Math.abs(Number(available)) / budget
        : over || spent > 0 ? 1 : 0;
    return (
      <div
        key={l.envelope.id}
        onClick={() => navigate(`/envelopes/${l.envelope.id}`)}
        className="relative cursor-pointer overflow-hidden px-4 py-3 transition hover:bg-white/[0.04]"
      >
        <CoverBg cover={l.envelope.cover} dim={0.5} />
        <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-semibold">
              <IconView icon={l.envelope.icon} fallback={l.envelope.name} size={20} />
              {l.envelope.name}
            </p>
            {(BigInt(l.carryoverIn) !== 0n || BigInt(l.netTransfers) !== 0n) && (
              <p className="text-xs text-slate-500">
                {BigInt(l.carryoverIn) !== 0n && (
                  <>{t('budget.carryover')} {fmt(l.carryoverIn)}</>
                )}
                {BigInt(l.carryoverIn) !== 0n && BigInt(l.netTransfers) !== 0n && ' · '}
                {BigInt(l.netTransfers) !== 0n && <>⇄ {fmt(l.netTransfers)}</>}
              </p>
            )}
          </div>
          <span
            className={`num shrink-0 text-lg font-bold ${
              available < 0n ? 'text-rose-300' : 'text-emerald-300'
            }`}
          >
            {fmt(l.available)}
          </span>
        </div>
        <div className="mt-2">
          <Bar
            value={ratio}
            className={
              over
                ? '!from-rose-400 !to-rose-500'
                : budget > 0 && ratio < 0.2
                  ? '!from-amber-400 !to-amber-500'
                  : ''
            }
          />
          <div className="num mt-1.5 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 text-rose-300/90">
              {fmt(l.spent)}
              {BigInt(l.prevSpent) > 0n &&
                (() => {
                  const pct = Math.round(
                    (Number(l.spent) / Number(l.prevSpent) - 1) * 100,
                  );
                  const up = pct > 0;
                  return (
                    <span
                      title={t('budget.vsLastMonth')}
                      className={`flex items-center gap-0.5 text-[10px] font-semibold ${
                        up ? 'text-rose-300' : 'text-emerald-300'
                      }`}
                    >
                      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {up ? '+' : ''}
                      {pct}%
                    </span>
                  );
                })()}
            </span>
            <span>
              {editable ? (
                <input
                  key={l.id ?? l.envelope.id + l.allocated}
                  defaultValue={(allocated / 100).toFixed(2)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => setAlloc(l, e.target.value)}
                  className="w-20 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-right text-slate-200 outline-none focus:border-teal-400/50"
                  inputMode="decimal"
                />
              ) : (
                fmt(l.allocated)
              )}
            </span>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Budget « vide » : aucune allocation saisie → proposer de copier le mois N-1
  const emptyBudget =
    !!period &&
    period.status !== 'CLOSED' &&
    period.lines.length > 0 &&
    period.lines.every((l) => BigInt(l.allocated) === 0n);

  // Swipe horizontal sur la page → mois précédent / suivant (mobile)
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    // geste clairement horizontal uniquement (ne pas gêner le scroll)
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      navigator.vibrate?.(8);
      shiftMonth(dx < 0 ? 1 : -1);
    }
  };

  return (
    <Layout>
      <div className="animate-fade-up space-y-5">
        {/* En-tête : mois + périmètre */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="card flex items-center gap-1 px-1 py-1">
            <button onClick={() => shiftMonth(-1)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-slate-200">
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-32 text-center text-sm font-semibold capitalize">{monthName}</span>
            <button onClick={() => shiftMonth(1)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-slate-200">
              <ChevronRight size={18} />
            </button>
          </div>
          {/* Création — choix catégorie/enveloppe en modale, comme les comptes */}
          <button
            onClick={() => setCreateModal('choice')}
            title={t('budget.create')}
            aria-label={t('budget.create')}
            className="icon-btn border border-teal-400/30 bg-teal-400/10 text-teal-300"
          >
            <Plus size={18} />
          </button>
          <div className="seg ml-auto">
            {(['household', 'personal'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`seg-item ${scope === s ? 'seg-item-active' : ''}`}
              >
                {t(`scope.${s}`)}
              </button>
            ))}
          </div>
        </div>

        {!period && data && (
          <div className="card p-10 text-center">
            <p className="mb-5 text-slate-400">{t('budget.noPeriod')}</p>
            <button onClick={generate} className="btn-primary mx-auto">
              <Sparkles size={16} />
              {t('budget.generate')}
            </button>
          </div>
        )}

        {period && (
          <>
            {/* Bandeau état */}
            <div className="card flex flex-wrap items-center gap-3 p-4">
              <span className={`chip ${statusStyle[period.status]}`}>
                {t(`budget.status.${period.status}`)}
              </span>
              <span className="text-sm text-slate-400">
                {t('budget.unassigned')} :{' '}
                <b className={`num ${BigInt(period.totals.unassigned) < 0n ? 'text-rose-300' : 'text-teal-300'}`}>
                  {fmt(period.totals.unassigned)}
                </b>
              </span>
              <span className="text-sm text-slate-400">
                {t('budget.spent')} : <b className="num">{fmt(period.totals.spent)}</b>
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={shareBudget}
                  className="btn-ghost !p-2"
                  title={t('budget.share')}
                  aria-label={t('budget.share')}
                >
                  <Share2 size={15} />
                </button>
                {editable && (
                  <button onClick={openFill} className="btn-ghost !py-2">
                    <Sparkles size={15} />
                    {t('budget.guidedFill')}
                  </button>
                )}
                {period.status === 'DRAFT' && (
                  <button onClick={validate} className="btn-primary !py-2">
                    {t('budget.validate')}
                  </button>
                )}
                {period.status === 'ACTIVE' && (
                  <button onClick={close} className="btn-ghost !py-2">
                    {t('budget.close')}
                  </button>
                )}
              </div>
            </div>

            {/* Budget vide → proposer de reprendre les allocations de N-1 */}
            {emptyBudget && (
              <div className="card flex flex-wrap items-center gap-3 border-dashed p-4">
                <span className="text-sm text-slate-400">
                  {t('budget.emptyAlloc', { month: prevMonthName })}
                </span>
                <button onClick={copyPrevious} className="btn-ghost !py-1.5 ml-auto">
                  <Copy size={14} />
                  {t('budget.copyPrevious')}
                </button>
              </div>
            )}

            {/* Enveloppes — regroupées par catégorie ; les sans-catégorie
                sont chacune dans leur propre tuile.
                Le swipe horizontal pour changer de mois ne s'applique qu'ici. */}
            <div
              className="space-y-3"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {lineGroups.map((g) => (
                <div key={g.cat?.id ?? `solo-${g.lines[0]?.envelope.id}`}>
                  {g.cat && (
                    <Link
                      to={`/categories/${g.cat.id}`}
                      className="mb-1.5 block px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-teal-300"
                    >
                      {g.cat.name}
                    </Link>
                  )}
                  <div className="card divide-y divide-white/[0.06] overflow-hidden">
                    {g.lines.map((l) => renderLine(l))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </div>

      {/* Création — choix du type puis modale de formulaire au premier plan */}
      {createModal === 'choice' && (
        <Modal title={t('budget.create')} onClose={() => setCreateModal(null)}>
          <div className="grid gap-2">
            <button
              onClick={() => setCreateModal('cat')}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm font-medium transition hover:bg-white/[0.07]"
            >
              <Plus size={16} className="text-teal-300" />
              {t('budget.newCategory')}
            </button>
            <button
              onClick={() => setCreateModal('env')}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm font-medium transition hover:bg-white/[0.07]"
            >
              <Plus size={16} className="text-teal-300" />
              {t('budget.newEnvelope')}
            </button>
          </div>
        </Modal>
      )}
      {createModal === 'cat' && (
        <Modal title={t('budget.newCategory')} onClose={() => setCreateModal(null)}>
          <form onSubmit={createCategory} className="grid gap-3">
            <input required autoFocus className="input" placeholder={t('budget.newCategory')} value={catName} onChange={(e) => setCatName(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input type="checkbox" checked={catShared} onChange={(e) => setCatShared(e.target.checked)} className="accent-teal-400" />
              {t('scope.sharedCheckbox')}
            </label>
            <button className="btn-primary"><Plus size={16} />{t('common.add')}</button>
          </form>
        </Modal>
      )}
      {createModal === 'env' && (
        <Modal title={t('budget.newEnvelope')} onClose={() => setCreateModal(null)}>
          <form onSubmit={createEnvelope} className="grid gap-3">
            <input required autoFocus className="input" placeholder={t('budget.newEnvelope')} value={envName} onChange={(e) => setEnvName(e.target.value)} />
            <select className="input" value={envCategory} onChange={(e) => setEnvCategory(e.target.value)}>
              <option value="">{t('budget.noCategory')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {/* Suggestions : remplit nom + icône (+ catégorie auto) */}
            <div>
              <p className="lbl mb-1.5">{t('budget.suggestions')}</p>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
                {SUGG_ENVELOPES.map((c) => (
                  <div key={c.key}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {c.icon} {t(`onboarding.sug.${c.key}`)}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {c.envelopes.map((e) => (
                        <button
                          type="button"
                          key={e.key}
                          onClick={() => pickSuggestion(c.key, e.key, e.icon)}
                          className="chip !py-1 !text-[11px] text-slate-400 transition hover:border-teal-400/40 hover:text-teal-300"
                        >
                          {e.icon} {t(`onboarding.sug.${e.key}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <IconPicker value={envIcon} onChange={setEnvIcon} />
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input type="checkbox" checked={envShared} onChange={(e) => setEnvShared(e.target.checked)} className="accent-teal-400" />
              {t('scope.sharedCheckbox')}
            </label>
            <button className="btn-primary"><Plus size={16} />{t('common.add')}</button>
          </form>
        </Modal>
      )}

      {/* Carte exportée en image (rendue hors écran) */}
      {period && (
        <div
          ref={shareRef}
          aria-hidden
          className="fixed -left-[3000px] top-0 w-[400px] rounded-3xl bg-[#0a0f1c] p-6 text-slate-100"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500">
              <PiggyBank className="h-5 w-5 text-[#05080f]" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-extrabold leading-tight">Flouze</p>
              <p className="text-xs capitalize text-slate-500">{monthName}</p>
            </div>
            <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs">
              {t(`budget.status.${period.status}`)}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {t('budget.spent')}
              </p>
              <p className="num mt-0.5 text-xl font-bold text-rose-300">
                {fmt(period.totals.spent)}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {t('budget.available')}
              </p>
              <p className="num mt-0.5 text-xl font-bold text-emerald-300">
                {fmt(period.totals.available)}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            {[...period.lines]
              .sort((a, b) => Number(b.spent) - Number(a.spent))
              .slice(0, 5)
              .filter((l) => BigInt(l.spent) > 0n || BigInt(l.allocated) > 0n)
              .map((l) => {
                const base = Number(l.allocated) + Number(l.carryoverIn);
                const r = base > 0 ? Number(l.spent) / base : Number(l.spent) > 0 ? 1 : 0;
                return (
                  <div key={l.envelope.id}>
                    <div className="num mb-1 flex justify-between text-xs">
                      <span className="text-slate-300">{l.envelope.name}</span>
                      <span className="text-slate-500">
                        {fmt(l.spent)} / {fmt(l.allocated)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${
                          r > 1
                            ? 'bg-rose-400'
                            : 'bg-gradient-to-r from-teal-400 to-emerald-400'
                        }`}
                        style={{ width: `${Math.min(100, r * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
          <p className="mt-5 text-center text-[10px] text-slate-600">
            {t('share.footer')}
          </p>
        </div>
      )}

      {/* Modale remplissage guidé */}
      {fill && period && (
        <Modal title={t('budget.guidedFill')} onClose={() => setFill(null)}>
          <form onSubmit={applyFill} className="space-y-3">
            <p className="text-xs text-slate-500">{t('budget.guidedFillHint')}</p>
            {period.lines.map((l) => (
              <div key={l.envelope.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.envelope.name}</p>
                  {fill.prev[l.envelope.id] !== undefined && (
                    <p className="text-[11px] text-teal-300">
                      {t('budget.suggested', { amount: fmt(fill.prev[l.envelope.id]) })}
                    </p>
                  )}
                </div>
                <input
                  className="input !w-28 text-right"
                  inputMode="decimal"
                  value={fill.values[l.envelope.id]}
                  onChange={(e) =>
                    setFill({
                      ...fill,
                      values: { ...fill.values, [l.envelope.id]: e.target.value },
                    })
                  }
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setFill(null)} className="btn-ghost">
                {t('common.cancel')}
              </button>
              <button className="btn-primary">{t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modale transfert */}
      {transfer && period && (
        <Modal title={t('budget.transferTitle')} onClose={() => setTransfer(null)}>
          <form onSubmit={doTransfer} className="space-y-3">
            <select className="input" value={transfer.from} onChange={(e) => setTransfer({ ...transfer, from: e.target.value })}>
              {period.lines.map((l) => (
                <option key={l.envelope.id} value={l.envelope.id}>{l.envelope.name}</option>
              ))}
            </select>
            <select required className="input" value={transfer.to} onChange={(e) => setTransfer({ ...transfer, to: e.target.value })}>
              <option value="">{t('budget.transferTo')}</option>
              {period.lines.filter((l) => l.envelope.id !== transfer.from).map((l) => (
                <option key={l.envelope.id} value={l.envelope.id}>{l.envelope.name}</option>
              ))}
            </select>
            <input required className="input" placeholder={t('transactions.amount')} inputMode="decimal" value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })} />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setTransfer(null)} className="btn-ghost">
                {t('common.cancel')}
              </button>
              <button className="btn-primary">{t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
