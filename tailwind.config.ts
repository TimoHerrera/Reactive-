import type { Config } from "tailwindcss";

// Tokens del design system (PDF «REACTIVE — MVP mobile», sección 01–03).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0A",
        surface: "#161616",
        "surface-2": "#222222",
        line: "#2E2E2E",
        ink: "#FFFFFF",
        muted: "#9A9A9A",
        title: "#BDBDBD",
        accent: { DEFAULT: "#2457E6", deep: "#1B3A9E" },
        success: "#34C759",
        warning: "#F5B841",
        danger: { DEFAULT: "#E53935", ink: "#FF7A75" },
      },
      fontFamily: {
        display: ["var(--font-display)", '"Barlow Condensed"', "sans-serif"],
        sans: ["var(--font-sans)", "Barlow", "sans-serif"],
      },
      fontSize: {
        "display-xl": ["3.75rem", { lineHeight: ".92" }], // 56–64
        "display-section": ["3.375rem", { lineHeight: ".92" }], // 52–56
        h1: ["2.5rem", { lineHeight: ".95" }], // 40
        h2: ["1.875rem", { lineHeight: "1" }], // 28–30
        button: ["1.375rem", { lineHeight: "1" }], // 18–26
        label: ["0.75rem", { lineHeight: "1rem", letterSpacing: ".1em", fontWeight: "700" }],
        "title-sm": ["1.0625rem", { lineHeight: "1.3rem", fontWeight: "700" }], // 17
        body: ["0.9375rem", { lineHeight: "1.4rem" }], // 15
        small: ["0.8125rem", { lineHeight: "1.15rem" }], // 13
        caption: ["0.75rem", { lineHeight: "1rem" }], // 11–12
      },
      borderRadius: { sm: "8px", md: "12px", lg: "16px" },
      boxShadow: { none: "none" },
      spacing: { gutter: "16px", tap: "44px", tabbar: "84px" },
      maxWidth: { phone: "480px" },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)",
      },
      backgroundSize: { grid: "28px 28px" },
    },
  },
  plugins: [],
};

export default config;
