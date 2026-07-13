// Theme switching for the game: sets `data-theme` on <html>, which swaps the
// CSS variables every brand color and surface reads from (see index.css).
export const THEMES = [
  { key: 'ocean', label: 'Ocean', swatch: ['#0B3D91', '#22D3EE'] },
  { key: 'sunset', label: 'Sunset', swatch: ['#C2410C', '#F59E0B'] },
  { key: 'forest', label: 'Forest', swatch: ['#166534', '#34D399'] },
  { key: 'midnight', label: 'Midnight', swatch: ['#0B1220', '#22D3EE'] },
  { key: 'dark', label: 'Dark', swatch: ['#0A0C10', '#94D1FF'] },
];

const STORAGE_KEY = 'rq_theme';

export function getTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return THEMES.some((t) => t.key === saved) ? saved : 'ocean';
}

export function applyTheme(key) {
  document.documentElement.setAttribute('data-theme', key);
  localStorage.setItem(STORAGE_KEY, key);
}

export function initTheme() {
  document.documentElement.setAttribute('data-theme', getTheme());
}
