import { CheckCircle2, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

/** File de toasts globaux — dispatch `toast('msg')` depuis n'importe où. */

type Tone = 'info' | 'success' | 'error';
interface Toast {
  id: number;
  text: string;
  tone: Tone;
}
let seq = 0;

export function toast(text: string, tone: Tone = 'info') {
  window.dispatchEvent(
    new CustomEvent('flouze-toast', { detail: { text, tone } }),
  );
}

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const { text, tone } = (e as CustomEvent).detail;
      const id = ++seq;
      setToasts((ts) => [...ts, { id, text, tone }]);
      setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 3500);
    };
    window.addEventListener('flouze-toast', onToast);
    return () => window.removeEventListener('flouze-toast', onToast);
  }, []);

  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-fade-up pointer-events-auto flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-xl backdrop-blur-md ${
            t.tone === 'error'
              ? 'border-rose-400/30 bg-rose-950/90 text-rose-200'
              : t.tone === 'success'
                ? 'border-emerald-400/30 bg-emerald-950/90 text-emerald-200'
                : 'border-white/10 bg-night-800/95 text-slate-200'
          }`}
        >
          {t.tone === 'success' ? (
            <CheckCircle2 size={15} />
          ) : (
            <Info size={15} />
          )}
          <span>{t.text}</span>
          <button
            onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
            className="ml-1 opacity-60 transition hover:opacity-100"
            aria-label="close"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
