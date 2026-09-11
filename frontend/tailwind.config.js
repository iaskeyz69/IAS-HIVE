/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        hive: {
          bg: "#050810",
          panel: "#0A1220",
          line: "rgba(56,189,248,0.28)",
          gold: "#38BDF8",
          muted: "#7B8A9E",
          threat: "#FF3B3B",
          live: "#3DFF8A",
          scan: "#6B6B78",
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', '"Helvetica Neue"', "Arial", "sans-serif"],
        mono: ['"Cascadia Mono"', "Consolas", '"Courier New"', "monospace"],
      },
      letterSpacing: {
        hud: "0.22em",
      },
    },
  },
  plugins: [],
};
