import confetti from 'canvas-confetti';
import { Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const CONFETTI_COLORS = ['#2dd4bf', '#34d399', '#a78bfa', '#fbbf24', '#f472b6'];

/** Popup de célébration quand un ou plusieurs badges viennent d'être gagnés. */
export function BadgeCelebration({
  codes,
  pointsByCode,
  onClose,
}: {
  codes: string[];
  pointsByCode: Record<string, number>;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    const end = Date.now() + 1200;
    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.7 },
        colors: CONFETTI_COLORS,
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.7 },
        colors: CONFETTI_COLORS,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
    navigator.vibrate?.([30, 50, 30]);
  }, []);

  if (!codes.length) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-xs space-y-4 !bg-night-800 p-6 text-center animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 shadow-glow">
          <Sparkles className="h-7 w-7 text-night-950" />
        </div>
        <p className="text-lg font-bold">{t('celebration.title')}</p>
        <ul className="space-y-2">
          {codes.map((c) => (
            <li
              key={c}
              className="flex items-center justify-between rounded-xl border border-teal-400/25 bg-teal-400/10 px-3 py-2 text-sm font-medium"
            >
              {t(`badges.${c}`)}
              <span className="chip border-teal-400/40 bg-teal-400/15 text-teal-200">
                +{pointsByCode[c] ?? 0} {t('gamification.points')}
              </span>
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="btn-primary w-full">
          {t('celebration.cta')}
        </button>
      </div>
    </div>
  );
}
