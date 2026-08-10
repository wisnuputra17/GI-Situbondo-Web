/**
 * shared/tailwind-config.js
 * Token desain bersama + sistem tema gelap/terang.
 *
 * Cara kerjanya: nama warna Tailwind dipetakan ke CSS variable, bukan ke hex
 * langsung. Jadi mengganti tema cukup dengan menukar nilai variabel di
 * <html class="dark"> — seluruh kelas yang sudah dipakai (bg-surface,
 * text-on-surface, dst.) otomatis ikut berubah tanpa perlu menyentuh markup.
 */

const V = (n) => `var(--${n})`;

tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: V('background'),
        surface: V('surface'),
        'surface-variant': V('surface-variant'),
        'surface-container-lowest': V('sc-lowest'),
        'surface-container-low': V('sc-low'),
        'surface-container': V('sc'),
        'surface-container-high': V('sc-high'),
        'surface-container-highest': V('sc-highest'),
        'on-surface': V('on-surface'),
        'on-surface-variant': V('on-surface-variant'),
        outline: V('outline'),
        'outline-variant': V('outline-variant'),
        primary: V('primary'),
        'on-primary': V('on-primary'),
        secondary: V('secondary'),
        'on-secondary': V('on-secondary'),
        'secondary-container': V('secondary-container'),
        'on-secondary-container': V('on-secondary-container'),
        tertiary: V('tertiary'),
        'tertiary-container': V('tertiary-container'),
        'on-tertiary-container': V('on-tertiary-container'),
        error: V('error'),
        'on-error': V('on-error'),
        'error-container': V('error-container'),
        'on-error-container': V('on-error-container')
      },
      fontFamily: { headline: ['Manrope'], body: ['Inter'] },
      borderRadius: { DEFAULT: '0.25rem', lg: '0.5rem', xl: '0.75rem' }
    }
  }
};

// ---------- Definisi nilai tiap tema ----------
(function injectThemeVars() {
  const css = `
:root {
  --background:#f8f9ff; --surface:#f8f9ff; --surface-variant:#d3e4fe;
  --sc-lowest:#ffffff; --sc-low:#eff4ff; --sc:#e5eeff; --sc-high:#dce9ff; --sc-highest:#d3e4fe;
  --on-surface:#0b1c30; --on-surface-variant:#444748;
  --outline:#747878; --outline-variant:#c4c7c7;
  --primary:#0b1c30; --on-primary:#ffffff;
  --secondary:#006d35; --on-secondary:#ffffff;
  --secondary-container:#c9f5d4; --on-secondary-container:#007439;
  --tertiary:#8a5300; --tertiary-container:#ffe0b3; --on-tertiary-container:#6e3900;
  --error:#ba1a1a; --on-error:#ffffff; --error-container:#ffdad6; --on-error-container:#93000a;
  --shadow-color: 0 0% 40%;
}
html.dark {
  --background:#0d1117; --surface:#0d1117; --surface-variant:#2d3742;
  --sc-lowest:#141a22; --sc-low:#1a212b; --sc:#1f2731; --sc-high:#262f3a; --sc-highest:#2d3742;
  --on-surface:#e3e8ef; --on-surface-variant:#9aa5b1;
  --outline:#6b7684; --outline-variant:#364150;
  --primary:#7fb3ff; --on-primary:#0a1420;
  --secondary:#4ade80; --on-secondary:#052e16;
  --secondary-container:#14532d; --on-secondary-container:#86efac;
  --tertiary:#fbbf24; --tertiary-container:#453113; --on-tertiary-container:#fcd34d;
  --error:#f87171; --on-error:#450a0a; --error-container:#4c1d1d; --on-error-container:#fca5a5;
  --shadow-color: 0 0% 0%;
}
html.dark ::-webkit-scrollbar { width: 10px; height: 10px; }
html.dark ::-webkit-scrollbar-track { background: var(--sc-low); }
html.dark ::-webkit-scrollbar-thumb { background: var(--outline-variant); border-radius: 5px; }
html { color-scheme: light; }
html.dark { color-scheme: dark; }
`;
  const el = document.createElement('style');
  el.id = 'tema-vars';
  el.textContent = css;
  document.head.appendChild(el);
})();

// ---------- Terapkan tema tersimpan sedini mungkin (mencegah kedip) ----------
const TEMA_KEY = 'pln_gi_tema';

function temaAktif() {
  const t = localStorage.getItem(TEMA_KEY);
  if (t === 'dark' || t === 'light') return t;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function terapkanTema(t) {
  document.documentElement.classList.toggle('dark', t === 'dark');
  localStorage.setItem(TEMA_KEY, t);
  document.dispatchEvent(new CustomEvent('tema:ubah', { detail: t }));
}

function toggleTema() {
  terapkanTema(temaAktif() === 'dark' ? 'light' : 'dark');
}

terapkanTema(temaAktif());
