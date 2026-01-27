import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "tui-bg": "#0D1117",
        "tui-fg": "#C9D1D9",
        "tui-blue": "#58A6FF",
        "tui-violet": "#BC8CFF",
        "tui-green": "#3FB950",
        "tui-red": "#FF7B72",
        "tui-yellow": "#D29922",
        "tui-border": "#30363D",
        "tui-selection": "#1F2428",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
