import { CreditCard, Landmark, MoreHorizontal, Plus, Wallet } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { ScopeBadge } from '../components/ScopeBadge';
import { coverCss } from '../covers';
import { formatAmount, parseToMinorUnits } from '../money';
import { Account, Currency } from '../types';

const TYPES = ['CHECKING', 'SAVINGS', 'CASH', 'CREDIT_CARD', 'OTHER'] as const;
const TYPE_ICON = {
  CHECKING: Landmark,
  SAVINGS: Wallet,
  CASH: Wallet,
  CREDIT_CARD: CreditCard,
  OTHER: Wallet,
};

export function AccountsPage() {
  const { t, i18n } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [form, setForm] = useState({
    name: '',
    type: 'CHECKING',
    currencyCode: 'EUR',
    initialBalance: '',
    shared: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showTools, setShowTools] = useState(false);

  const reload = () => api.get<Account[]>('/accounts').then(setAccounts);
  useEffect(() => {
    reload();
    api.get<Currency[]>('/currencies').then(setCurrencies);
  }, []);

  const currency =
    currencies.find((c) => c.code === form.currencyCode) ??
    ({ minorUnits: 2 } as Currency);

  async function create(e: FormEvent) {
    e.preventDefault();
    const minor = parseToMinorUnits(form.initialBalance || '0', currency.minorUnits);
    if (minor === null) {
      setError('errors.invalidAmount');
      return;
    }
    setError(null);
    await api.post('/accounts', {
      name: form.name,
      type: form.type,
      currencyCode: form.currencyCode,
      initialBalance: minor.toString(),
      shared: form.shared,
    });
    setForm({ ...form, name: '', initialBalance: '' });
    setShowCreate(false);
    reload();
  }

  const personal = accounts.filter((a) => a.ownerId !== null);
  const shared = accounts.filter((a) => a.ownerId === null);

  const Section = ({ title, items }: { title: string; items: Account[] }) => (
    <section className="space-y-3">
      <h2 className="lbl">{title}</h2>
      {items.length === 0 && (
        <p className="text-sm text-slate-500">{t('accounts.empty')}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((a) => {
          const Icon = TYPE_ICON[a.type] ?? Wallet;
          return (
            <Link
              key={a.id}
              to={`/accounts/${a.id}`}
              className="card card-hover relative flex items-center gap-3 overflow-hidden p-4"
            >
              {a.cover && (
                <>
                  <div
                    className="absolute inset-0 opacity-70"
                    style={{ background: coverCss(a.cover) }}
                  />
                  <div className="absolute inset-0 bg-night-950/60" />
                </>
              )}
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
                <Icon size={20} />
              </span>
              <div className="relative min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-white">{a.name}</span>
                  <ScopeBadge ownerId={a.ownerId} />
                </div>
                <p className="truncate text-xs text-white/60">
                  {t(`accountTypes.${a.type}`)} · {a.currencyCode}
                  {a.owner ? ` · ${a.owner.displayName}` : ''}
                </p>
              </div>
              <div className="relative text-right">
                <span className={`num block font-bold ${BigInt(a.balance) < 0n ? 'text-rose-300' : 'text-white'}`}>
                  {formatAmount(a.balance, a.currencyCode, a.currency.minorUnits, i18n.language)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );

  return (
    <Layout>
      <div className="animate-fade-up space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="page-title">{t('accounts.title')}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTools(true)}
              className="icon-btn"
              title={t('importExport.title')}
              aria-label={t('importExport.title')}
            >
              <MoreHorizontal size={18} />
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus size={16} />
              {t('accounts.new')}
            </button>
          </div>
        </div>

        {showCreate && (
          <Modal title={t('accounts.new')} onClose={() => setShowCreate(false)}>
            <form onSubmit={create} className="grid gap-3">
              <input required autoFocus className="input" placeholder={t('accounts.namePlaceholder')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((ty) => (
                  <option key={ty} value={ty}>{t(`accountTypes.${ty}`)}</option>
                ))}
              </select>
              <select className="input" value={form.currencyCode} onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}>
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
              <input className="input" placeholder={t('accounts.initialBalance')} inputMode="decimal" value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: e.target.value })} />
              <label className="flex items-center gap-2 text-sm text-slate-400">
                <input type="checkbox" checked={form.shared} onChange={(e) => setForm({ ...form, shared: e.target.checked })} className="accent-teal-400" />
                {t('scope.sharedCheckbox')}
              </label>
              {error && <p className="text-sm text-rose-400">{t(error)}</p>}
              <button className="btn-primary"><Plus size={16} />{t('common.add')}</button>
            </form>
          </Modal>
        )}

        <Section title={t('scope.personalSpace')} items={personal} />
        <Section title={t('scope.householdSpace')} items={shared} />

        {/* Import / export — derrière le bouton « … » de l'en-tête */}
        {showTools && (
          <Modal title={t('importExport.title')} onClose={() => setShowTools(false)}>
            <ImportExport accounts={accounts} onImported={reload} />
          </Modal>
        )}
      </div>
    </Layout>
  );
}

/** Import CSV + exports — affiché dans la modale du bouton « … ». */
function ImportExport({
  accounts,
  onImported,
}: {
  accounts: Account[];
  onImported: () => void;
}) {
  const { t } = useTranslation();
  const [accountId, setAccountId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function doImport(e: FormEvent) {
    e.preventDefault();
    if (!file || !accountId) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/v1/import/transactions?accountId=${accountId}`, {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });
    const body = await res.json().catch(() => ({}));
    setResult(
      res.ok
        ? t('import.result', { imported: body.imported, skipped: body.skipped })
        : t(body?.message ?? 'errors.generic'),
    );
    if (res.ok) {
      setFile(null);
      onImported();
    }
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={doImport} className="space-y-2">
          <label className="lbl">{t('importExport.importCsv')}</label>
          <select required className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">{t('transactions.account')}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <input
            type="file"
            accept=".csv,text/csv"
            required
            className="w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-slate-200 hover:file:bg-white/15"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button className="btn-ghost !py-2">{t('importExport.import')}</button>
          {result && <p className="text-sm text-slate-300">{result}</p>}
        <p className="text-xs text-slate-600">{t('importExport.csvHint')}</p>
      </form>
      <div className="space-y-2">
        <label className="lbl">{t('importExport.export')}</label>
        <div className="flex flex-wrap gap-2">
          <a href="/api/v1/export/transactions.csv" className="chip text-slate-300 hover:bg-white/10">
            transactions.csv
          </a>
          <a href="/api/v1/export/backup.json" className="chip text-slate-300 hover:bg-white/10">
            backup.json
          </a>
        </div>
        <p className="text-xs text-slate-600">{t('importExport.backupHint')}</p>
      </div>
    </div>
  );
}
