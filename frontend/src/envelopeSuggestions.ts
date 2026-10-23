/**
 * Catalogue de suggestions d'enveloppes, par catégorie.
 * Utilisé par l'assistant de démarrage et la modale « Nouvelle enveloppe ».
 * Les noms sont traduits via les clés onboarding.sug.<key>.
 */
export const SUGG_ENVELOPES: {
  key: string;
  icon: string;
  envelopes: { key: string; icon: string }[];
}[] = [
  {
    key: 'housing',
    icon: '🏠',
    envelopes: [
      { key: 'rent', icon: '🏡' },
      { key: 'energy', icon: '⚡' },
      { key: 'water', icon: '💧' },
      { key: 'internet', icon: '📶' },
      { key: 'homeInsurance', icon: '🛡️' },
      { key: 'repairs', icon: '🔧' },
    ],
  },
  {
    key: 'food',
    icon: '🍽️',
    envelopes: [
      { key: 'groceries', icon: '🛒' },
      { key: 'restaurant', icon: '🍕' },
      { key: 'bakery', icon: '🥖' },
      { key: 'coffee', icon: '☕' },
      { key: 'lunch', icon: '🥪' },
    ],
  },
  {
    key: 'transport',
    icon: '🚗',
    envelopes: [
      { key: 'fuel', icon: '⛽' },
      { key: 'transit', icon: '🚇' },
      { key: 'parking', icon: '🅿️' },
      { key: 'carMaintenance', icon: '🔩' },
      { key: 'toll', icon: '🛣️' },
      { key: 'carInsurance', icon: '📋' },
    ],
  },
  {
    key: 'health',
    icon: '💊',
    envelopes: [
      { key: 'pharmacy', icon: '💊' },
      { key: 'doctor', icon: '🩺' },
      { key: 'dentist', icon: '🦷' },
      { key: 'optician', icon: '👓' },
      { key: 'sport', icon: '🏋️' },
    ],
  },
  {
    key: 'leisure',
    icon: '🎉',
    envelopes: [
      { key: 'outings', icon: '🎬' },
      { key: 'streaming', icon: '📺' },
      { key: 'games', icon: '🎮' },
      { key: 'hobbies', icon: '🎨' },
      { key: 'books', icon: '📚' },
      { key: 'music', icon: '🎵' },
    ],
  },
  {
    key: 'shopping',
    icon: '🛍️',
    envelopes: [
      { key: 'clothes', icon: '👕' },
      { key: 'shoes', icon: '👟' },
      { key: 'home', icon: '🛋️' },
      { key: 'tech', icon: '💻' },
      { key: 'beauty', icon: '💄' },
      { key: 'gifts', icon: '🎁' },
    ],
  },
  {
    key: 'kids',
    icon: '🧸',
    envelopes: [
      { key: 'childcare', icon: '👶' },
      { key: 'school', icon: '🎒' },
      { key: 'activities', icon: '⚽' },
      { key: 'allowance', icon: '🪙' },
    ],
  },
  {
    key: 'pets',
    icon: '🐾',
    envelopes: [
      { key: 'petFood', icon: '🦴' },
      { key: 'vet', icon: '🩺' },
    ],
  },
  {
    key: 'travel',
    icon: '✈️',
    envelopes: [
      { key: 'holidays', icon: '🏖️' },
      { key: 'weekend', icon: '🧳' },
      { key: 'flights', icon: '🛫' },
    ],
  },
  {
    key: 'services',
    icon: '🔁',
    envelopes: [
      { key: 'subs', icon: '🔁' },
      { key: 'phone', icon: '📱' },
      { key: 'software', icon: '☁️' },
      { key: 'bankFees', icon: '🏦' },
    ],
  },
  {
    key: 'saving',
    icon: '💰',
    envelopes: [
      { key: 'emergency', icon: '🆘' },
      { key: 'projects', icon: '🎯' },
      { key: 'retirement', icon: '🌅' },
    ],
  },
  { key: 'misc', icon: '📦', envelopes: [{ key: 'miscEnv', icon: '📦' }] },
];
