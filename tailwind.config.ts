import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-inter)", "system-ui", "sans-serif"], arabic: ["var(--font-arabic)", "var(--font-inter)", "system-ui", "sans-serif"] },
      colors: {
        brand: { 50: "#eefbf4", 100: "#d6f5e3", 500: "#16a34a", 600: "#15803d", 700: "#166534" },
        ink: { 900: "#0b1220", 800: "#111a2e", 700: "#1f2a44" },
        accent: "#ef4444",
      },
    },
  },
  plugins: [],
} satisfies Config;
