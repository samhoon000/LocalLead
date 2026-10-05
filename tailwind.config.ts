import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ink: "#111827", canvas: "#f7f8fa", accent: "#5b5bd6" },
      boxShadow: { card: "0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.05)" }
    }
  },
  plugins: []
} satisfies Config;
