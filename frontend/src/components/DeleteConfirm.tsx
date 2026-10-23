import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';

/**
 * Confirmation de suppression : demande de taper le nom exact
 * quand `requireName` est posé (comptes, enveloppes, dettes…).
 */
export function DeleteConfirm({
  name,
  requireName = false,
  body,
  onCancel,
  onConfirm,
}: {
  name: string;
  requireName?: boolean;
  body?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ok = !requireName || typed.trim() === name;

  return (
    <Modal title={t('confirm.title', { name })} onClose={onCancel}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-400/10 text-rose-300">
          <AlertTriangle size={18} />
        </span>
        <p className="text-sm text-slate-400">
          {body ?? t('confirm.generic')}
        </p>
      </div>
      {requireName && (
        <input
          className="input mt-4"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={t('confirm.typeName', { name })}
          autoFocus
        />
      )}
      {err && <p className="mt-2 text-sm text-rose-300">{t(err)}</p>}
      <div className="mt-5 flex gap-2">
        <button onClick={onCancel} className="btn-ghost flex-1" disabled={busy}>
          {t('common.cancel')}
        </button>
        <button
          disabled={!ok || busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await onConfirm();
            } catch (e) {
              setErr(e instanceof Error && e.message.includes('.') ? e.message : 'errors.generic');
              setBusy(false);
            }
          }}
          className="btn-danger flex-1 disabled:opacity-40"
        >
          {t('confirm.delete')}
        </button>
      </div>
    </Modal>
  );
}
