import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111114",
        "ink-2": "#1C1C21",
        line: "#2A2A31",
        cream: "#F3F0E8",
        paper: "#FBF9F4",
        lime: "#C8F04A",
        olive: "#5A6B12",
        "muted-dark": "#B9B7B0",
        "muted-light": "#4A4A50",
      },
      fontFamily: {
        display: ["var(--font-oswald)", "Impact", "sans-serif"],
        serif: ["var(--font-instrument)", "Georgia", "serif"],
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      maxWidth: {
        site: "1200px",
      },
      backgroundImage: {
        glow: "radial-gradient(circle at 80% 40%, #2B3A0E 0%, #111114 55%)",
      },
      boxShadow: {
        lime: "0 8px 32px rgba(200,240,74,0.35)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
