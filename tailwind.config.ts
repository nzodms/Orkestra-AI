import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Premium accent — "Orkestra" blue (Linear / Shopify premium feel)
        brand: {
          50: "#eff5ff",
          100: "#dbe8fe",
          200: "#bfd7fe",
          300: "#93b8fd",
          400: "#6092fa",
          500: "#3b73f5",
          600: "#2459e6",
          700: "#1c47c4",
          800: "#1d3f9e",
          900: "#1d397d",
          950: "#16244c",
        },
        // Secondaire — vert "data / confiance"
        teal: {
          50: "#ecfdf6",
          100: "#d1faea",
          200: "#a6f3d6",
          300: "#6ce6bd",
          400: "#33d199",
          500: "#10b77f",
          600: "#059467",
          700: "#047654",
          800: "#065d44",
          900: "#064c39",
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
        soft: "0 1px 2px rgba(16,24,40,0.03), 0 1px 3px rgba(16,24,40,0.04)",
        card: "0 1px 2px rgba(16,24,40,0.04), 0 10px 30px -16px rgba(16,24,40,0.10)",
        pop: "0 16px 50px -16px rgba(16,24,40,0.18)",
        glass: "0 1px 1px rgba(255,255,255,0.6) inset, 0 12px 40px -18px rgba(36,89,230,0.22)",
        lift: "0 2px 4px rgba(16,24,40,0.04), 0 24px 60px -24px rgba(36,89,230,0.18)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "step-in": {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "60%": { transform: "scale(1.12)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "float-slow": {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(2%, -3%) scale(1.05)" },
        },
        "draw": {
          "0%": { strokeDashoffset: "var(--dash)" },
          "100%": { strokeDashoffset: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "step-in": "step-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        pop: "pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "scale-in": "scale-in 0.3s ease-out both",
        shimmer: "shimmer 1.6s infinite",
        "rise-in": "rise-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "float-slow": "float-slow 14s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
