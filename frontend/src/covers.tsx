import { Ban, ImagePlus } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { fileToDataUrl } from './icons';

/**
 * Bibliothèque de fonds façon Revolut : dégradés prédéfinis ou image
 * personnalisée (data-URL), appliqués aux cartes comptes/objectifs/crédits.
 * Valeur stockée : `cover:<clé>` ou data-URL.
 */
export const COVERS: { key: string; label: string; css: string }[] = [
  { key: 'aurora', label: 'Aurora', css: 'linear-gradient(135deg,#0f766e 0%,#14b8a6 50%,#34d399 100%)' },
  { key: 'sunset', label: 'Sunset', css: 'linear-gradient(135deg,#f97316 0%,#f43f5e 50%,#a855f7 100%)' },
  { key: 'ocean', label: 'Océan', css: 'linear-gradient(135deg,#0ea5e9 0%,#6366f1 55%,#8b5cf6 100%)' },
  { key: 'royal', label: 'Royal', css: 'linear-gradient(135deg,#312e81 0%,#7c3aed 55%,#c084fc 100%)' },
  { key: 'lime', label: 'Lime', css: 'linear-gradient(135deg,#65a30d 0%,#22c55e 55%,#6ee7b7 100%)' },
  { key: 'rose', label: 'Rose', css: 'linear-gradient(135deg,#be185d 0%,#f472b6 55%,#fb7185 100%)' },
  { key: 'carbon', label: 'Carbon', css: 'linear-gradient(135deg,#0f172a 0%,#334155 60%,#64748b 100%)' },
  { key: 'gold', label: 'Gold', css: 'linear-gradient(135deg,#92400e 0%,#f59e0b 55%,#fde047 100%)' },
  { key: 'neon', label: 'Néon', css: 'linear-gradient(135deg,#164e63 0%,#06b6d4 55%,#67e8f9 100%)' },
  { key: 'ember', label: 'Ember', css: 'linear-gradient(135deg,#7f1d1d 0%,#dc2626 55%,#fb923c 100%)' },
  { key: 'grape', label: 'Grape', css: 'linear-gradient(135deg,#581c87 0%,#a855f7 55%,#e879f9 100%)' },
  { key: 'forest', label: 'Forêt', css: 'linear-gradient(135deg,#064e3b 0%,#059669 55%,#6ee7b7 100%)' },
];

const BY_KEY = new Map(COVERS.map((c) => [`cover:${c.key}`, c]));

/** Convertit la valeur stockée en `background` CSS. */
export function coverCss(cover?: string | null): string | undefined {
  if (!cover) return undefined;
  const preset = BY_KEY.get(cover);
  if (preset) return preset.css;
  if (cover.startsWith('data:')) return `url(${cover}) center/cover`;
  return undefined;
}

/** Fond absolu d'une carte : dégradé ou image, avec voile pour lisibilité. */
export function CoverBg({ cover, dim = 0.25 }: { cover?: string | null; dim?: number }) {
  const css = coverCss(cover);
  if (!css) return null;
  return (
    <>
      <div className="absolute inset-0" style={{ background: css }} />
      <div
        className="absolute inset-0"
        style={{ background: `rgba(4,10,24,${dim})` }}
      />
    </>
  );
}

/** Sélecteur de fond : nuancier de dégradés + upload + « aucun ». */
export function CoverPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (cover: string) => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        <button
          type="button"
          title={t('iconLib.upload')}
          onClick={() => fileRef.current?.click()}
          className="flex aspect-[2/1] items-center justify-center rounded-lg border border-dashed border-teal-400/30 bg-teal-400/[0.06] text-teal-300 transition hover:bg-teal-400/15"
        >
          <ImagePlus size={15} />
        </button>
        <button
          type="button"
          title={t('iconLib.none')}
          onClick={() => onChange('')}
          className={`flex aspect-[2/1] items-center justify-center rounded-lg border text-slate-500 transition hover:bg-white/[0.06] ${
            !value ? 'border-teal-400/50 bg-teal-400/10' : 'border-white/[0.08] bg-white/[0.02]'
          }`}
        >
          <Ban size={14} />
        </button>
        {COVERS.map((c) => (
          <button
            key={c.key}
            type="button"
            title={t(`covers.${c.key}`, { defaultValue: c.label })}
            onClick={() => onChange(`cover:${c.key}`)}
            className={`aspect-[2/1] rounded-lg border transition active:scale-95 ${
              value === `cover:${c.key}`
                ? 'border-white ring-2 ring-teal-400/60'
                : 'border-white/10 hover:border-white/30'
            }`}
            style={{ background: c.css }}
          />
        ))}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onChange(await fileToDataUrl(f, 640, 16 / 9));
          e.target.value = '';
        }}
      />
    </div>
  );
}
