import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Premium accent — "Orkestra" violet/indigo
        brand: {
          50: "#eef0ff",
          100: "#e0e3ff",
          200: "#c7cbff",
          300: "#a5a8ff",
          400: "#8782fb",
          500: "#6d5ef2",
          600: "#5d44e3",
          700: "#4f37c8",
          800: "#4030a1",
          900: "#372d80",
          950: "#221b4a",
        },
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5d9e2",
          300: "#b0b7c6",
          400: "#8590a5",
          500: "#67728a",
          600: "#525b71",
          700: "#434a5c",
          800: "#3a3f4e",
          900: "#262a35",
          950: "#171a21",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
        card: "0 1px 3px rgba(16,24,40,0.06), 0 8px 24px -12px rgba(16,24,40,0.12)",
        pop: "0 12px 40px -12px rgba(16,24,40,0.22)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
