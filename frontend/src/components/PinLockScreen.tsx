import { Delete, Lock, PiggyBank } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lockoutSeconds, verifyPin } from '../pinlock';

/** Écran de verrouillage plein écran : pavé PIN 4-6 chiffres. */
export function PinLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const [cooldown, setCooldown] = useState(lockoutSeconds());

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(lockoutSeconds()), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const submit = async (value: string) => {
    if (value.length < 4) return;
    if (await verifyPin(value)) onUnlock();
    else {
      setErr(true);
      setCooldown(lockoutSeconds());
      setPin('');
      setTimeout(() => setErr(false), 500);
    }
  };

  const press = (d: string) => {
    if (cooldown > 0) return;
    const next = (pin + d).slice(0, 6);
    setPin(next);
    if (next.length >= 4) void submit(next);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-night-950 px-6">
      <div className="anim-halo pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-teal-400/15 blur-3xl" />
      <span className="anim-glow flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500">
        <PiggyBank className="text-night-950" strokeWidth={2.5} size={28} />
      </span>
      <h1 className="mt-4 text-xl font-extrabold">{t('pinlock.locked')}</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
        <Lock size={13} /> {t('pinlock.enterPin')}
      </p>

      <div
        className={`mt-6 flex gap-2.5 ${err ? 'animate-shake' : ''}`}
        aria-live="polite"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full border transition ${
              i < pin.length
                ? 'border-teal-300 bg-teal-300'
                : i < 4
                  ? 'border-white/25'
                  : 'border-white/10'
            }`}
          />
        ))}
      </div>
      {cooldown > 0 && (
        <p className="mt-3 text-sm text-rose-300">
          {t('pinlock.tooMany', { seconds: cooldown })}
        </p>
      )}

      <div className="mt-8 grid w-64 grid-cols-3 gap-3">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k) =>
          k === '' ? (
            <span key="empty" />
          ) : k === '⌫' ? (
            <button
              key="del"
              onClick={() => setPin((p) => p.slice(0, -1))}
              className="flex h-16 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white/[0.06] active:bg-white/10"
              aria-label="delete"
            >
              <Delete size={20} />
            </button>
          ) : (
            <button
              key={k}
              onClick={() => press(k)}
              disabled={cooldown > 0}
              className="flex h-16 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04] text-xl font-bold transition hover:border-teal-400/40 active:scale-95 disabled:opacity-40"
            >
              {k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
