import { ArrowDownLeft, ArrowRight, ArrowUpRight, Bookmark, Pin, Plus, Search } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { formatAmount, parseToMinorUnits } from '../money';
import { Account, Envelope, Transaction, TxTemplate } from '../types';

const TX_ICON = {
  EXPENSE: ArrowUpRight,
  INCOME: ArrowDownLeft,
  ACCOUNT_TRANSFER: ArrowRight,
};

const DAY = 86_400_000;

/** Regroupe par jour calendaire : Aujourd'hui / Hier / date formatée. */
function groupByDay(
  txs: Transaction[],
  lang: string,
  t: (k: string) => string,
): [string, Transaction[]][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const groups = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const d = new Date(tx.date);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    const arr = groups.get(key) ?? [];
    arr.push(tx);
    groups.set(key, arr);
  }
  return [...groups.entries()].map(([key, items]) => {
    const diff = Math.round(
      (today.getTime() - new Date(`${key}T00:00:00`).getTime()) / DAY,
    );
    const label =
      diff === 0
        ? t('transactions.today')
        : diff === 1
          ? t('transactions.yesterday')
          : new Date(`${key}T00:00:00`).toLocaleDateString(lang, {
              weekday: 'short',
              day: 'numeric',
              month: 'long',
            });
    return [label, items];
  });
}

export function TransactionsPage() {
  const { t, i18n } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [form, setForm] = useState({
    type: 'EXPENSE',
    accountId: '',
    toAccountId: '',
    envelopeId: '',
    amount: '',
    label: '',
    mandatory: false,
    date: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterEnv, setFilterEnv] = useState('');
  const [filterMandatory, setFilterMandatory] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [templates, setTemplates] = useState<TxTemplate[]>([]);
  const [saveTpl, setSaveTpl] = useState(false);
  const [params, setParams] = useSearchParams();

  // Deep-link « + » de la navigation : ?add=EXPENSE|INCOME|ACCOUNT_TRANSFER
  useEffect(() => {
    const type = params.get('add');
    if (type && ['EXPENSE', 'INCOME', 'ACCOUNT_TRANSFER'].includes(type)) {
      setForm((f) => ({ ...f, type }));
      setShowForm(true);
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Deep-link depuis un modèle (« + » → Modèles) : pré-remplit le formulaire
  useEffect(() => {
    const tplId = params.get('tpl');
    if (tplId) {
      const tpl = templates.find((x) => x.id === tplId);
      if (tpl) {
        setForm((f) => ({
          ...f,
          type: tpl.type,
          accountId: tpl.accountId ?? f.accountId,
          envelopeId: tpl.envelopeId ?? '',
          amount: (Number(tpl.amount) / 100).toFixed(2),
          label: tpl.label,
          mandatory: tpl.mandatory,
        }));
        setShowForm(true);
      }
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, templates]);

  const reload = () => {
    const p = new URLSearchParams();
    if (search) p.set('q', search);
    if (filterEnv) p.set('envelopeId', filterEnv);
    if (filterMandatory) p.set('mandatory', 'true');
    const qs = p.toString();
    return api
      .get<Transaction[]>(`/transactions${qs ? `?${qs}` : ''}`)
      .then(setTransactions);
  };

  useEffect(() => {
    api.get<Account[]>('/accounts').then(setAccounts);
    api.get<Envelope[]>('/envelopes').then(setEnvelopes);
    api.get<TxTemplate[]>('/tx-templates').then(setTemplates).catch(() => {});
  }, []);

  // Recherche + filtres côté API, déclenchés après 300 ms de pause
  useEffect(() => {
    const id = setTimeout(() => reload(), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterEnv, filterMandatory]);

  const account = accounts.find((a) => a.id === form.accountId);
  const minorDigits = account?.currency.minorUnits ?? 2;

  async function create(e: FormEvent) {
    e.preventDefault();
    const minor = parseToMinorUnits(form.amount, minorDigits);
    if (minor === null || minor <= 0n) {
      setError('errors.invalidAmount');
      return;
    }
    setError(null);
    try {
      await api.post('/transactions', {
        type: form.type,
        accountId: form.accountId,
        toAccountId: form.toAccountId || undefined,
        envelopeId: form.envelopeId || undefined,
        amount: minor.toString(),
        label: form.label,
        mandatory: form.type === 'EXPENSE' ? form.mandatory : false,
        date: form.date,
      });
      // « Enregistrer comme modèle » → réutilisable depuis le « + »
      if (saveTpl && form.type !== 'ACCOUNT_TRANSFER') {
        api
          .post<TxTemplate>('/tx-templates', {
            label: form.label,
            type: form.type,
            amount: minor.toString(),
            accountId: form.accountId,
            envelopeId: form.envelopeId || undefined,
            mandatory: form.mandatory,
          })
          .then((tpl) => setTemplates((ts) => [...ts, tpl]))
          .catch(() => {});
        setSaveTpl(false);
      }
      setForm({ ...form, amount: '', label: '', envelopeId: '', mandatory: false });
      setShowForm(false);
      reload();
    } catch {
      setError('errors.generic');
    }
  }

  async function remove(id: string) {
    await api.delete(`/transactions/${id}`);
    reload();
  }

  const isTransfer = form.type === 'ACCOUNT_TRANSFER';
  const sign = (tx: Transaction) =>
    tx.type === 'INCOME' ? '+' : tx.type === 'ACCOUNT_TRANSFER' ? '→' : '−';

  return (
    <Layout>
      <div className="animate-fade-up space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="page-title">{t('transactions.title')}</h1>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={16} />
            {t('transactions.new')}
          </button>
        </div>

        {showForm && (
          <Modal title={t('transactions.new')} onClose={() => setShowForm(false)}>
            <form onSubmit={create} className="grid gap-3">
              <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                {(['EXPENSE', 'INCOME', 'ACCOUNT_TRANSFER'] as const).map((ty) => (
                  <button
                    type="button"
                    key={ty}
                    onClick={() => setForm({ ...form, type: ty })}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                      form.type === ty
                        ? ty === 'EXPENSE'
                          ? 'bg-rose-400/20 text-rose-300'
                          : ty === 'INCOME'
                            ? 'bg-emerald-400/20 text-emerald-300'
                            : 'bg-sky-400/20 text-sky-300'
                        : 'text-slate-500'
                    }`}
                  >
                    {t(`txTypes.${ty}`)}
                  </button>
                ))}
              </div>
              <select required className="input" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                <option value="">{t('transactions.account')}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              {isTransfer ? (
                <select required className="input" value={form.toAccountId} onChange={(e) => setForm({ ...form, toAccountId: e.target.value })}>
                  <option value="">{t('transactions.toAccount')}</option>
                  {accounts.filter((a) => a.id !== form.accountId).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              ) : (
                <select className="input" value={form.envelopeId} onChange={(e) => setForm({ ...form, envelopeId: e.target.value })}>
                  <option value="">{t('transactions.noEnvelope')}</option>
                  {envelopes.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              )}
              <div className="grid grid-cols-2 gap-3">
                <input required autoFocus className="input" placeholder={t('transactions.amount')} inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                <input type="date" required className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <input required className="input" placeholder={t('transactions.label')} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              {!isTransfer && (
                <label
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-medium transition cursor-pointer ${
                    form.mandatory && form.type === 'EXPENSE'
                      ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                      : 'border-white/10 bg-white/[0.03] text-slate-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={form.mandatory}
                    disabled={form.type !== 'EXPENSE'}
                    onChange={(e) => setForm({ ...form, mandatory: e.target.checked })}
                  />
                  <Pin size={13} />
                  {t('transactions.mandatory')}
                </label>
              )}
              {!isTransfer && (
                <label
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-medium transition cursor-pointer ${
                    saveTpl
                      ? 'border-teal-400/40 bg-teal-400/15 text-teal-300'
                      : 'border-white/10 bg-white/[0.03] text-slate-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={saveTpl}
                    onChange={(e) => setSaveTpl(e.target.checked)}
                  />
                  <Bookmark size={13} />
                  {t('transactions.saveTemplate')}
                </label>
              )}
              {error && <p className="text-sm text-rose-400">{t(error)}</p>}
              <button className="btn-primary"><Plus size={16} />{t('common.add')}</button>
            </form>
          </Modal>
        )}

        {/* Recherche */}
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input !pl-10"
            placeholder={t('transactions.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filtres : enveloppe + dépenses obligatoires */}
        <div className="flex gap-2">
          <select
            className="input min-w-0 flex-1"
            value={filterEnv}
            onChange={(e) => setFilterEnv(e.target.value)}
            aria-label={t('transactions.filterEnvelope')}
          >
            <option value="">{t('transactions.allEnvelopes')}</option>
            {envelopes.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
          <button
            onClick={() => setFilterMandatory(!filterMandatory)}
            aria-pressed={filterMandatory}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
              filterMandatory
                ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07]'
            }`}
          >
            <Pin size={13} />
            {t('transactions.mandatory')}
          </button>
        </div>

        {/* Liste regroupée par jour */}
        {transactions.length === 0 && (
          <p className="card p-8 text-center text-sm text-slate-500">{t('transactions.empty')}</p>
        )}
        {groupByDay(transactions, i18n.language, t).map(([dayLabel, items]) => (
          <section key={dayLabel}>
            <p className="lbl mb-1.5 mt-4 px-1 first:mt-0">{dayLabel}</p>
            <div className="card overflow-hidden">
              <ul className="divide-y divide-white/[0.05]">
                {items.map((tx) => {
                  const Icon = TX_ICON[tx.type];
                  const iconCls =
                    tx.type === 'INCOME'
                      ? 'bg-emerald-400/15 text-emerald-300'
                      : tx.type === 'EXPENSE'
                        ? 'bg-rose-400/15 text-rose-300'
                        : 'bg-sky-400/15 text-sky-300';
                  return (
                    <li key={tx.id} className="flex items-center gap-3 p-3 transition hover:bg-white/[0.03]">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconCls}`}>
                        <Icon size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {tx.label}
                          {tx.mandatory && (
                            <span className="chip ml-2 border-amber-400/30 bg-amber-400/10 !py-0 text-amber-300">
                              <Pin size={10} />
                              {t('transactions.mandatory')}
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {tx.account.name}
                          {tx.toAccount ? ` → ${tx.toAccount.name}` : ''}
                          {tx.envelope ? ` · ${tx.envelope.name}` : ''} · {tx.createdBy.displayName}
                        </p>
                      </div>
                      <span
                        className={`num font-semibold ${
                          tx.type === 'INCOME'
                            ? 'text-emerald-300'
                            : tx.type === 'EXPENSE'
                              ? 'text-rose-300'
                              : 'text-sky-300'
                        }`}
                      >
                        {sign(tx)} {formatAmount(tx.amount, tx.account.currencyCode, 2, i18n.language)}
                      </span>
                      <button onClick={() => remove(tx.id)} className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-300">×</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </Layout>
  );
}
