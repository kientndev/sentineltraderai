/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080b10",
        foreground: "#adbac7",
        border: "#1d242e",
        accent: "#3fb950",
        paused: "#f85149",
        terminalBg: "#05070a",
      },
    },
  },
  plugins: [],
}
