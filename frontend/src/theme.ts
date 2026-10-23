/** Thème clair/sombre : class="light" sur <html>, persistance localStorage. */

export type Theme = 'dark' | 'light';
const KEY = 'flouze-theme';

export function getTheme(): Theme {
  return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem(KEY, next);
  applyTheme(next);
  return next;
}

applyTheme(getTheme());
