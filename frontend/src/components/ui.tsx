import { ReactNode, useId } from 'react';

/** Anneau de progression SVG (niveau, objectifs). */
export function Ring({
  value,
  size = 96,
  stroke = 8,
  children,
  gradient = true,
  color,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  children?: ReactNode;
  gradient?: boolean;
  /** Couleur unie du trait (prioritaire sur le dégradé) */
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  const id = useId().replace(/:/g, '');
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color ?? (gradient ? `url(#${id})` : '#2dd4bf')}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/** Petite carte statistique. */
export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'good' | 'bad';
}) {
  const color =
    tone === 'good'
      ? 'text-emerald-300'
      : tone === 'bad'
        ? 'text-rose-300'
        : 'text-slate-100';
  return (
    <div className="card card-hover p-4">
      <p className="lbl">{label}</p>
      <p className={`num mt-1 truncate text-xl font-bold sm:text-2xl ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Barre de progression fine. */
export function Bar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-500 ${className}`}
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}
