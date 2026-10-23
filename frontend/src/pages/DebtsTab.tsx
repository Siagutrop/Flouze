import { CheckCircle2, HandCoins, Landmark, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { DeleteConfirm } from '../components/DeleteConfirm';
import { Modal } from '../components/Modal';
import { ScopeBadge } from '../components/ScopeBadge';
import { Bar } from '../components/ui';
import { CoverBg } from '../covers';
import { formatAmount, parseToMinorUnits } from '../money';
import { Account, Debt } from '../types';

const MINOR = 2;

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
}

export function DebtsTab({
  createKind,
  onCloseCreate,
}: {
  createKind: 'debt' | 'credit' | null;
  onCloseCreate: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payTarget, setPayTarget] = useState<Debt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  // Formulaire de création
  const [person, setPerson] = useState('');
  const [direction, setDirection] = useState<'OWED_TO_ME' | 'I_OWE'>('OWED_TO_ME');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [shared, setShared] = useState(true);

  const reload = () => api.get<Debt[]>('/debts').then(setDebts).catch(() => {});
  useEffect(() => {
    reload();
  }, []);

  const fmt = (v: string | bigint | number) =>
    formatAmount(v, 'EUR', MINOR, i18n.language);

  async function create(e: FormEvent) {
    e.preventDefault();
    const minor = parseToMinorUnits(amount, MINOR);
    if (minor === null || minor <= 0n) return;
    await api.post('/debts', {
      person,
      direction,
      amount: minor.toString(),
      note: note || undefined,
      shared,
    });
    setPerson('');
    setAmount('');
    setNote('');
    onCloseCreate();
    reload();
  }

  async function pay(e: FormEvent) {
    e.preventDefault();
    if (!payTarget) return;
    const minor = parseToMinorUnits(payAmount, MINOR);
    if (minor === null || minor <= 0n) return;
    await api.post(`/debts/${payTarget.id}/pay`, { amount: minor.toString() });
    setPayTarget(null);
    setPayAmount('');
    reload();
  }

  const open = debts.filter((d) => !d.closedAt);
  const closed = debts.filter((d) => d.closedAt);
  const owedToMe = open.filter((d) => d.direction === 'OWED_TO_ME');
  const iOwe = open.filter((d) => d.direction === 'I_OWE');

  function card(d: Debt) {
    const remaining = BigInt(d.amount) - BigInt(d.paid);
    const pct =
      BigInt(d.amount) > 0n ? Number(d.paid) / Number(d.amount) : 0;
    const toMe = d.direction === 'OWED_TO_ME';
    return (
      <li key={d.id} className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                  toMe
                    ? 'bg-emerald-400/15 text-emerald-300'
                    : 'bg-rose-400/15 text-rose-300'
                }`}
              >
                {d.person.slice(0, 2).toUpperCase()}
              </span>
              <span className="truncate">{d.person}</span>
              <ScopeBadge ownerId={d.ownerId} />
            </p>
            {d.note && (
              <p className="mt-1 truncate text-xs text-slate-500">{d.note}</p>
            )}
          </div>
          <div className="text-right">
            <p
              className={`num font-bold ${
                toMe ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {fmt(remaining)}
            </p>
            <p className="text-[11px] text-slate-500">
              {t('debts.remaining')} · {fmt(d.amount)}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <Bar
            value={pct}
            className={toMe ? '' : '!from-rose-400 !to-rose-500'}
          />
          <div className="num mt-1 flex justify-between text-[11px] text-slate-500">
            <span>
              {t('debts.paid')} {fmt(d.paid)}
            </span>
            <span>{Math.round(pct * 100)} %</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => {
              setPayTarget(d);
              setPayAmount('');
            }}
            className="btn-ghost !py-1.5 !text-xs"
          >
            <HandCoins size={13} />
            {t('debts.addPayment')}
          </button>
          <button
            onClick={() =>
              void api.patch(`/debts/${d.id}`, { closed: true }).then(reload)
            }
            className="btn-ghost !py-1.5 !text-xs"
          >
            <CheckCircle2 size={13} />
            {t('debts.markSettled')}
          </button>
          <button
            onClick={() => setDeleteTarget(d)}
            className="icon-btn ml-auto !p-1.5 text-slate-600 hover:text-rose-300"
            aria-label={t('common.delete')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </li>
    );
  }

  return (
    <>
      <div className="space-y-5">

        {open.length === 0 && closed.length === 0 && (
          <div className="card p-10 text-center text-sm text-slate-500">
            {t('debts.empty')}
          </div>
        )}

        {owedToMe.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-emerald-300/80">
              {t('debts.owedToMe')}
            </h2>
            <ul className="space-y-3">{owedToMe.map(card)}</ul>
          </section>
        )}

        {iOwe.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-rose-300/80">
              {t('debts.iOwe')}
            </h2>
            <ul className="space-y-3">{iOwe.map(card)}</ul>
          </section>
        )}

        <CreditsSection
          createOpen={createKind === 'credit'}
          onCloseCreate={onCloseCreate}
        />

        {closed.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('debts.settled')}
            </h2>
            <ul className="space-y-2">
              {closed.map((d) => (
                <li
                  key={d.id}
                  className="card flex items-center justify-between gap-3 p-3.5 opacity-60"
                >
                  <span className="min-w-0 truncate text-sm text-slate-400">
                    {d.person} · {fmt(d.amount)}
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        void api
                          .patch(`/debts/${d.id}`, { closed: false })
                          .then(reload)
                      }
                      className="icon-btn !p-1.5"
                      title={t('debts.reopen')}
                      aria-label={t('debts.reopen')}
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(d)}
                      className="icon-btn !p-1.5 text-slate-600 hover:text-rose-300"
                      aria-label={t('common.delete')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Création */}
      {createKind === 'debt' && (
        <Modal title={t('debts.new')} onClose={onCloseCreate}>
          <form onSubmit={create} className="grid gap-3">
            <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
              {(['OWED_TO_ME', 'I_OWE'] as const).map((dir) => (
                <button
                  type="button"
                  key={dir}
                  onClick={() => setDirection(dir)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                    direction === dir
                      ? dir === 'OWED_TO_ME'
                        ? 'bg-emerald-400/20 text-emerald-300'
                        : 'bg-rose-400/20 text-rose-300'
                      : 'text-slate-500'
                  }`}
                >
                  {t(`debts.dir.${dir}`)}
                </button>
              ))}
            </div>
            <input
              required
              autoFocus
              className="input"
              placeholder={t('debts.person')}
              value={person}
              onChange={(e) => setPerson(e.target.value)}
            />
            <input
              required
              className="input"
              placeholder={t('debts.amount')}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              className="input"
              placeholder={t('debts.notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={shared}
                onChange={(e) => setShared(e.target.checked)}
              />
              {t('scope.sharedCheckbox')}
            </label>
            <button className="btn-primary">
              <Plus size={16} />
              {t('common.add')}
            </button>
          </form>
        </Modal>
      )}

      {/* Remboursement */}
      {payTarget && (
        <Modal
          title={t('debts.paymentFor', { person: payTarget.person })}
          onClose={() => setPayTarget(null)}
        >
          <form onSubmit={pay} className="grid gap-3">
            <input
              required
              autoFocus
              className="input"
              placeholder={t('debts.amount')}
              inputMode="decimal"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              {t('debts.remaining')} :{' '}
              {fmt(BigInt(payTarget.amount) - BigInt(payTarget.paid))}
            </p>
            <button className="btn-primary">{t('debts.addPayment')}</button>
          </form>
        </Modal>
      )}

      {/* Suppression */}
      {deleteTarget && (
        <DeleteConfirm
          name={`${deleteTarget.person} · ${fmt(deleteTarget.amount)}`}
          body={t('confirm.debtBody')}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await api.delete(`/debts/${deleteTarget.id}`);
            setDeleteTarget(null);
            reload();
          }}
        />
      )}
    </>
  );
}

/* ══════════ Crédits — crédits bancaires suivis avec remboursement ══════════ */

function CreditsSection({
  createOpen,
  onCloseCreate,
}: {
  createOpen: boolean;
  onCloseCreate: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<Credit[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({
    name: '', principal: '', monthlyPayment: '', rate: '', startDate: new Date().toISOString().slice(0, 10), accountId: '', shared: false,
  });

  const reload = () => api.get<Credit[]>('/credits').then(setItems);
  useEffect(() => {
    reload();
    api.get<Account[]>('/accounts').then(setAccounts);
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    const p = parseToMinorUnits(form.principal, MINOR);
    const m = parseToMinorUnits(form.monthlyPayment, MINOR);
    if (!p || !m || p <= 0n || m <= 0n) return;
    await api.post('/credits', {
      name: form.name,
      principal: p.toString(),
      monthlyPayment: m.toString(),
      annualRatePercent: parseFloat(form.rate.replace(',', '.')) || 0,
      startDate: form.startDate,
      accountId: form.accountId || undefined,
      shared: form.shared,
    });
    setForm({ ...form, name: '', principal: '', monthlyPayment: '', rate: '' });
    onCloseCreate();
    reload();
  }

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Landmark size={13} />
        {t('planning.credits')}
      </h2>
      {createOpen && (
        <Modal title={t('credits.new')} onClose={onCloseCreate}>
          <form onSubmit={create} className="grid gap-3">
            <input required autoFocus className="input" placeholder={t('credits.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input required className="input" placeholder={t('credits.principal')} inputMode="decimal" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input required className="input" placeholder={t('credits.monthly')} inputMode="decimal" value={form.monthlyPayment} onChange={(e) => setForm({ ...form, monthlyPayment: e.target.value })} />
              <input className="input" placeholder={t('credits.rate')} inputMode="decimal" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" required className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              <select className="input" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                <option value="">{t('transactions.account')}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input type="checkbox" checked={form.shared} onChange={(e) => setForm({ ...form, shared: e.target.checked })} className="accent-teal-400" />
              {t('scope.sharedCheckbox')}
            </label>
            <button className="btn-primary"><Plus size={16} />{t('common.add')}</button>
          </form>
        </Modal>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((c) => {
          const pct = c.principal === '0' ? 0 : Math.min(1, 1 - Number(c.remainingPrincipal) / Number(c.principal));
          return (
            <Link
              to={`/credits/${c.id}`}
              key={c.id}
              className="card card-hover relative overflow-hidden p-4"
            >
              <CoverBg cover={c.cover} dim={0.45} />
              <div className="relative flex items-center justify-between">
                <h3 className="font-semibold">{c.name} <ScopeBadge ownerId={c.ownerId} /></h3>
                <button onClick={async (e) => { e.preventDefault(); await api.delete(`/credits/${c.id}`); reload(); }} className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-300">×</button>
              </div>
              <div className="relative">
                <p className="num mt-1 text-sm text-slate-400">
                  {t('credits.remaining')} : <b className="text-slate-200">{formatAmount(c.remainingPrincipal, 'EUR', MINOR, i18n.language)}</b> / {formatAmount(c.principal, 'EUR', MINOR, i18n.language)}
                </p>
                <div className="mt-3">
                  <Bar value={pct} />
                </div>
                <p className="num mt-1.5 text-xs text-slate-500">
                  {formatAmount(c.monthlyPayment, 'EUR', MINOR, i18n.language)}/
                  {t('widgets.perMonth')}
                  {c.estimatedMonths ? ` · ${t('credits.monthsLeft', { count: c.estimatedMonths })}` : ''}
                </p>
              </div>
            </Link>
          );
        })}
        {items.length === 0 && <p className="card p-6 text-center text-sm text-slate-500 md:col-span-2">{t('credits.empty')}</p>}
      </div>
    </section>
  );
}
