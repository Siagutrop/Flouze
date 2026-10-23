/**
 * Catalogue de widgets du dashboard : l'utilisateur compose son accueil en
 * ajoutant/retirant/réordonnant des widgets depuis la réserve intégrée.
 * L'agencement est persisté par utilisateur dans localStorage.
 */
export type WidgetId =
  | 'hero'
  | 'level'
  | 'insights'
  | 'stats'
  | 'favorites'
  | 'chart'
  | 'breakdown'
  | 'pace'
  | 'debts'
  | 'recent'
  | 'quickAdd'
  | 'accounts'
  | 'goals'
  | 'subscriptions'
  | 'tip';

/** Catalogue complet : les widgets absents de l'agencement restent en réserve. */
export const WIDGET_IDS: WidgetId[] = [
  'hero',
  'level',
  'insights',
  'stats',
  'favorites',
  'chart',
  'breakdown',
  'pace',
  'debts',
  'recent',
  'quickAdd',
  'accounts',
  'goals',
  'subscriptions',
  'tip',
];

/** Agencement par défaut (les autres widgets démarrent en réserve). */
export const DEFAULT_ORDER: WidgetId[] = [
  'hero',
  'level',
  'insights',
  'stats',
  'favorites',
  'chart',
  'breakdown',
  'pace',
  'recent',
];

export interface WidgetLayout {
  /** Widgets actifs, dans l'ordre d'affichage. */
  order: WidgetId[];
}

const storageKey = (uid: string) => `flouze:widgets:${uid}`;

export const defaultLayout = (): WidgetLayout => ({ order: [...DEFAULT_ORDER] });

export function loadLayout(uid?: string | null): WidgetLayout {
  if (!uid) return defaultLayout();
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return defaultLayout();
    const p = JSON.parse(raw) as { order?: unknown; hidden?: unknown };
    const valid = (i: unknown): i is WidgetId =>
      WIDGET_IDS.includes(i as WidgetId);
    let order = (Array.isArray(p.order) ? p.order : []).filter(valid);
    // Migration : l'ancien format avait hidden[] = widgets retirés
    if (Array.isArray(p.hidden)) {
      const hidden = p.hidden.filter(valid);
      order = order.filter((i) => !hidden.includes(i));
    }
    // Migration : widget « répartition » ajouté après coup → inséré après le graphique
    if (!order.includes('breakdown')) {
      const i = order.indexOf('chart');
      const at = i >= 0 ? i + 1 : order.length;
      order = [...order.slice(0, at), 'breakdown', ...order.slice(at)];
    }
    // Migration : widget « où j'en suis » → inséré après la répartition
    if (!order.includes('pace')) {
      const i = order.indexOf('breakdown');
      const at = i >= 0 ? i + 1 : order.length;
      order = [...order.slice(0, at), 'pace', ...order.slice(at)];
    }
    if (!order.length) return defaultLayout();
    return { order };
  } catch {
    return defaultLayout();
  }
}

export function saveLayout(uid: string, l: WidgetLayout) {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(l));
  } catch {
    /* stockage plein/indisponible */
  }
}

/** Widgets disponibles en réserve (catalogue moins les actifs). */
export const reserveOf = (order: WidgetId[]): WidgetId[] =>
  WIDGET_IDS.filter((i) => !order.includes(i));
