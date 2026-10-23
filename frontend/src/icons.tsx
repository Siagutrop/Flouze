import { Ban, ImagePlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandMark } from './brands';

/**
 * Bibliothèque d'icônes : émojis par thème + upload d'image (redimensionnée
 * en data-URL 96px) — utilisée pour enveloppes, objectifs, avatar…
 */
export const EMOJI_GROUPS: { key: string; icons: string[] }[] = [
  { key: 'food', icons: ['🛒', '🥖', '🍔', '🍕', '🥗', '🍷', '☕', '🧀', '🍽️', '🎂'] },
  { key: 'home', icons: ['🏠', '🛋️', '💡', '🔌', '🧹', '🔧', '🪴', '🚿', '🛏️', '🏡'] },
  { key: 'transport', icons: ['🚗', '⛽', '🚇', '🚌', '🚲', '🛴', '✈️', '🚄', '🅿️', '🛺'] },
  { key: 'leisure', icons: ['🎮', '🎬', '🎵', '📚', '⚽', '🏋️', '🎾', '🎲', '🎨', '🍿'] },
  { key: 'health', icons: ['💊', '🩺', '🦷', '💪', '🧘', '❤️', '👶', '🐶', '🐱', '🧴'] },
  { key: 'finance', icons: ['💰', '💳', '🏦', '📈', '🧾', '💸', '🎁', '💎', '🏷️', '🪙'] },
  { key: 'tech', icons: ['📱', '💻', '🖥️', '⌚', '🎧', '📷', '📺', '🤖', '🔋', '🕹️'] },
  { key: 'travel', icons: ['🏖️', '🏔️', '🗺️', '🧳', '⛺', '🚢', '🌴', '🎡', '🌍', '🏕️'] },
  { key: 'misc', icons: ['🎯', '⭐', '🎓', '👕', '👟', '💄', '🌱', '🎉', '❤️‍🔥', '📦'] },
];

/**
 * Redimensionne une image en PNG → data-URL.
 * `aspect` = largeur/hauteur du recadrage (1 = carré icône, 16/9 = fond de carte).
 */
export function fileToDataUrl(
  file: File,
  size = 96,
  aspect = 1,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = size;
      const h = Math.round(size / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      // Plus grand rectangle source au ratio `aspect`, centré
      let sw = img.width;
      let sh = sw / aspect;
      if (sh > img.height) {
        sh = img.height;
        sw = sh * aspect;
      }
      ctx.drawImage(
        img,
        (img.width - sw) / 2,
        (img.height - sh) / 2,
        sw,
        sh,
        0,
        0,
        w,
        h,
      );
      URL.revokeObjectURL(img.src);
      // PNG pour les icônes (transparence), JPEG pour les fonds (poids)
      resolve(
        aspect === 1
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', 0.85),
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Affiche une icône : data-URL → image, `brand:x` → logo, sinon émoji. */
export function IconView({
  icon,
  fallback,
  size = 22,
  className = '',
}: {
  icon?: string | null;
  fallback?: string;
  size?: number;
  className?: string;
}) {
  if (icon?.startsWith('data:')) {
    return (
      <img
        src={icon}
        alt=""
        className={`shrink-0 rounded-lg object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  if (icon?.startsWith('brand:')) {
    return <BrandMark brandKey={icon.slice(6)} size={size} className={className} />;
  }
  if (icon) {
    // Boîte carrée centrée : les émojis s'alignent comme les tuiles image/marque
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.8, lineHeight: 1 }}
      >
        {icon}
      </span>
    );
  }
  return (
    <span
      className={`flex items-center justify-center rounded-lg bg-white/[0.06] font-bold text-slate-400 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {(fallback?.[0] ?? '·').toUpperCase()}
    </span>
  );
}

/**
 * Sélecteur d'icône complet : bibliothèque d'émojis par thème + upload
 * d'image personnalisée + option « aucune ».
 */
export function IconPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (icon: string) => void;
}) {
  const { t } = useTranslation();
  const [group, setGroup] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {EMOJI_GROUPS.map((g, i) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setGroup(i)}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-sm transition ${
              group === i
                ? 'border border-teal-400/40 bg-teal-400/15'
                : 'border border-white/[0.06] bg-white/[0.02] opacity-60 hover:opacity-100'
            }`}
            title={t(`iconLib.${g.key}`)}
          >
            {g.icons[0]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
        <button
          type="button"
          title={t('iconLib.upload')}
          onClick={() => fileRef.current?.click()}
          className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-teal-400/30 bg-teal-400/[0.06] text-teal-300 transition hover:bg-teal-400/15"
        >
          <ImagePlus size={16} />
        </button>
        <button
          type="button"
          title={t('iconLib.none')}
          onClick={() => onChange('')}
          className={`flex aspect-square items-center justify-center rounded-xl border text-slate-500 transition hover:bg-white/[0.06] ${
            !value ? 'border-teal-400/50 bg-teal-400/10' : 'border-white/[0.08] bg-white/[0.02]'
          }`}
        >
          <Ban size={15} />
        </button>
        {EMOJI_GROUPS[group].icons.map((ic) => (
          <button
            key={ic}
            type="button"
            onClick={() => onChange(ic)}
            className={`flex aspect-square items-center justify-center rounded-xl border text-lg transition active:scale-90 ${
              value === ic
                ? 'border-teal-400/50 bg-teal-400/15'
                : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06]'
            }`}
          >
            {ic}
          </button>
        ))}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onChange(await fileToDataUrl(f));
          e.target.value = '';
        }}
      />
    </div>
  );
}
