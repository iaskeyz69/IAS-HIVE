/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        hive: {
          bg: "#0A0A0F",
          panel: "#0C0C14",
          line: "rgba(0, 212, 255, 0.28)",
          ink: "#E8EAED",
          quiet: "rgba(232, 234, 237, 0.55)",
          blue: "#00D4FF",
          cyan: "#00D4FF",
          rec: "#33FF33",
          sting: "#FF4D4D",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        card: "16px",
      },
    },
  },
  plugins: [],
};
