import {
  siApplearcade,
  siApplemusic,
  siAppletv,
  siAudible,
  siBattledotnet,
  siClaude,
  siCrunchyroll,
  siDazn,
  siDeezer,
  siDiscord,
  siDropbox,
  siDuolingo,
  siEpicgames,
  siExpressvpn,
  siFitbit,
  siGarmin,
  siGithub,
  siGoogle,
  siHbo,
  siHeadspace,
  siIcloud,
  siMax,
  siMubi,
  siNetflix,
  siNike,
  siNordvpn,
  siNotion,
  siOrange,
  siParamountplus,
  siPatreon,
  siPeloton,
  siPlaystation,
  siPlex,
  siRakutenkobo,
  siRoblox,
  siRunkeeper,
  siShadow,
  siSpotify,
  siSteam,
  siStrava,
  siTodoist,
  siTwitch,
  siUbisoft,
  siWattpad,
  siYoutube,
  siZoom,
} from 'simple-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BrandIcon {
  path: string;
  hex: string;
}

export interface KnownBrand {
  key: string;
  name: string;
  icon?: BrandIcon;
  /** Couleur de marque (fond de tuile si pas de logo SVG). */
  color: string;
}

/**
 * Catalogue de services d'abonnement connus. Les logos proviennent de
 * simple-icons ; les marques retirées du pack (Disney, Microsoft…) ont une
 * tuile initiale aux couleurs de la marque.
 */
export const KNOWN_BRANDS: KnownBrand[] = [
  { key: 'netflix', name: 'Netflix', icon: siNetflix, color: '#E50914' },
  { key: 'disneyplus', name: 'Disney+', color: '#113CCF' },
  { key: 'primevideo', name: 'Prime Video', color: '#00A8E1' },
  { key: 'max', name: 'Max', icon: siMax, color: '#002BE7' },
  { key: 'paramountplus', name: 'Paramount+', icon: siParamountplus, color: '#0064FF' },
  { key: 'appletv', name: 'Apple TV+', icon: siAppletv, color: '#1d1d1f' },
  { key: 'canalplus', name: 'Canal+', color: '#000000' },
  { key: 'ocs', name: 'OCS', color: '#E30613' },
  { key: 'crunchyroll', name: 'Crunchyroll', icon: siCrunchyroll, color: '#F47521' },
  { key: 'dazn', name: 'DAZN', icon: siDazn, color: '#0C1618' },
  { key: 'mubi', name: 'MUBI', icon: siMubi, color: '#00145A' },
  { key: 'plex', name: 'Plex', icon: siPlex, color: '#EBAF00' },
  { key: 'spotify', name: 'Spotify', icon: siSpotify, color: '#1DB954' },
  { key: 'deezer', name: 'Deezer', icon: siDeezer, color: '#A238FF' },
  { key: 'applemusic', name: 'Apple Music', icon: siApplemusic, color: '#FA243C' },
  { key: 'youtube', name: 'YouTube Premium', icon: siYoutube, color: '#FF0000' },
  { key: 'audible', name: 'Audible', icon: siAudible, color: '#F8991C' },
  { key: 'wattpad', name: 'Wattpad', icon: siWattpad, color: '#FF500A' },
  { key: 'kobo', name: 'Kobo Plus', icon: siRakutenkobo, color: '#BF0000' },
  { key: 'icloud', name: 'iCloud+', icon: siIcloud, color: '#3693F3' },
  { key: 'googleone', name: 'Google One', icon: siGoogle, color: '#4285F4' },
  { key: 'microsoft365', name: 'Microsoft 365', color: '#D83B01' },
  { key: 'adobe', name: 'Adobe CC', color: '#FA0F00' },
  { key: 'dropbox', name: 'Dropbox', icon: siDropbox, color: '#0061FF' },
  { key: 'notion', name: 'Notion', icon: siNotion, color: '#000000' },
  { key: 'openai', name: 'ChatGPT', color: '#10A37F' },
  { key: 'claude', name: 'Claude', icon: siClaude, color: '#D97757' },
  { key: 'github', name: 'GitHub', icon: siGithub, color: '#181717' },
  { key: 'canva', name: 'Canva', color: '#00C4CC' },
  { key: 'playstation', name: 'PS Plus', icon: siPlaystation, color: '#0070D1' },
  { key: 'xbox', name: 'Xbox Game Pass', color: '#107C10' },
  { key: 'nintendo', name: 'Nintendo Switch Online', color: '#E60012' },
  { key: 'ea', name: 'EA Play', color: '#000000' },
  { key: 'ubisoft', name: 'Ubisoft+', icon: siUbisoft, color: '#000000' },
  { key: 'steam', name: 'Steam', icon: siSteam, color: '#171A21' },
  { key: 'epicgames', name: 'Epic Games', icon: siEpicgames, color: '#313131' },
  { key: 'battlenet', name: 'Battle.net', icon: siBattledotnet, color: '#148EFF' },
  { key: 'roblox', name: 'Roblox', icon: siRoblox, color: '#000000' },
  { key: 'twitch', name: 'Twitch', icon: siTwitch, color: '#9146FF' },
  { key: 'discord', name: 'Discord Nitro', icon: siDiscord, color: '#5865F2' },
  { key: 'strava', name: 'Strava', icon: siStrava, color: '#FC4C02' },
  { key: 'fitbit', name: 'Fitbit Premium', icon: siFitbit, color: '#00B0B9' },
  { key: 'garmin', name: 'Garmin', icon: siGarmin, color: '#007CC3' },
  { key: 'headspace', name: 'Headspace', icon: siHeadspace, color: '#F47D31' },
  { key: 'peloton', name: 'Peloton', icon: siPeloton, color: '#181A1D' },
  { key: 'nike', name: 'Nike Training', icon: siNike, color: '#111111' },
  { key: 'runkeeper', name: 'Runkeeper', icon: siRunkeeper, color: '#001E62' },
  { key: 'duolingo', name: 'Duolingo', icon: siDuolingo, color: '#58CC02' },
  { key: 'todoist', name: 'Todoist', icon: siTodoist, color: '#E44332' },
  { key: 'nordvpn', name: 'NordVPN', icon: siNordvpn, color: '#4687FF' },
  { key: 'expressvpn', name: 'ExpressVPN', icon: siExpressvpn, color: '#DA3940' },
  { key: 'orange', name: 'Orange', icon: siOrange, color: '#FF7900' },
  { key: 'shadow', name: 'Shadow PC', icon: siShadow, color: '#0A1929' },
  { key: 'patreon', name: 'Patreon', icon: siPatreon, color: '#FF424D' },
  { key: 'zoom', name: 'Zoom', icon: siZoom, color: '#0B5CFF' },
  { key: 'hbo', name: 'HBO', icon: siHbo, color: '#000000' },
  { key: 'applearcade', name: 'Apple Arcade', icon: siApplearcade, color: '#000000' },
];

const BY_KEY = new Map(KNOWN_BRANDS.map((b) => [b.key, b]));

/** Luminance relative approximative (0 = noir, 1 = blanc). */
function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(
    (c) => c / 255,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Logo de marque : SVG simple-icons ou tuile initiale aux couleurs. */
export function BrandMark({
  brandKey,
  size = 22,
  className = '',
}: {
  brandKey: string;
  size?: number;
  className?: string;
}) {
  const b = BY_KEY.get(brandKey);
  if (!b) {
    return (
      <span
        className={`flex items-center justify-center rounded-lg bg-white/[0.06] font-bold text-slate-400 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        ?
      </span>
    );
  }
  if (b.icon) {
    // Logos sombres (Notion, Steam, GitHub…) : tuile claire pour rester
    // lisible sur le thème nuit, comme le font les applis bancaires.
    const dark = luminance(b.icon.hex) < 0.18;
    return (
      <span
        className={`flex items-center justify-center rounded-lg ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: dark ? '#e2e8f0' : `${b.color}22`,
        }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} aria-hidden>
          <path d={b.icon.path} fill={b.icon.hex} />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`flex items-center justify-center rounded-lg border border-white/15 font-bold text-white ${className}`}
      style={{ width: size, height: size, backgroundColor: b.color, fontSize: size * 0.42 }}
    >
      {b.name[0]}
    </span>
  );
}

/**
 * Grille de sélection de service pour les abonnements : vrais logos,
 * recherche instantanée, tuile « autre » pour les cas customs.
 */
export function BrandPicker({
  value,
  onSelect,
}: {
  value?: string | null;
  onSelect: (brand: KnownBrand | null) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const selected = value ? BY_KEY.get(value) : null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-slate-400 transition hover:border-violet-400/40 hover:text-slate-200"
      >
        {selected ? (
          <>
            <BrandMark brandKey={selected.key} size={24} />
            <span className="font-medium text-slate-200">{selected.name}</span>
            <span className="ml-auto text-xs text-slate-500">{t('brandPicker.change')}</span>
          </>
        ) : (
          <>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-400/15 text-violet-300">★</span>
            {t('brandPicker.choose')}
            <span className="ml-auto text-xs text-slate-500">{KNOWN_BRANDS.length}+</span>
          </>
        )}
      </button>
    );
  }

  const list = q
    ? KNOWN_BRANDS.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()))
    : KNOWN_BRANDS;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <input
        autoFocus
        className="input mb-2 !py-1.5 text-sm"
        placeholder={t('brandPicker.search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="grid max-h-44 grid-cols-4 gap-1 overflow-y-auto sm:grid-cols-6">
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setOpen(false);
          }}
          className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-white/10 p-1.5 text-[10px] text-slate-400 transition hover:bg-white/[0.06]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06]">Aa</span>
          {t('brandPicker.custom')}
        </button>
        {list.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => {
              onSelect(b);
              setOpen(false);
              setQ('');
            }}
            className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[10px] transition hover:bg-white/[0.07] ${
              value === b.key
                ? 'border-violet-400/50 bg-violet-400/10 text-violet-200'
                : 'border-transparent text-slate-300'
            }`}
          >
            <BrandMark brandKey={b.key} size={26} />
            <span className="w-full truncate text-center">{b.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
