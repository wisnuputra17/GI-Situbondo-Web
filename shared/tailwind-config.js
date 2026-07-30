/**
 * shared/tailwind-config.js
 * Token desain (warna, font, radius) dipakai bersama semua halaman.
 * Load setelah <script src="https://cdn.tailwindcss.com">, sebelum konten di-render.
 */
tailwind.config = {
  theme: {
    extend: {
      colors: {
        "on-surface-variant": "#444748",
        "surface-variant": "#d3e4fe",
        "on-surface": "#0b1c30",
        "error-container": "#ffdad6",
        "secondary": "#006d35",
        "outline-variant": "#c4c7c7",
        "on-secondary": "#ffffff",
        "on-error": "#ffffff",
        "on-primary": "#ffffff",
        "surface": "#f8f9ff",
        "background": "#f8f9ff",
        "surface-container": "#e5eeff",
        "on-secondary-container": "#007439",
        "outline": "#747878",
        "surface-container-lowest": "#ffffff",
        "on-error-container": "#93000a",
        "surface-container-high": "#dce9ff",
        "secondary-container": "#c9f5d4",
        "tertiary": "#8a5300",
        "tertiary-container": "#ffe0b3",
        "on-tertiary-container": "#6e3900",
        "error": "#ba1a1a",
        "surface-container-highest": "#d3e4fe",
        "primary": "#0b1c30",
        "surface-container-low": "#eff4ff"
      },
      fontFamily: {
        headline: ["Manrope"],
        body: ["Inter"]
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem"
      }
    }
  }
};
