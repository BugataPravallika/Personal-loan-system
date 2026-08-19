/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F2C4C",
        inkdeep: "#0A1F38",
        paper: "#F5F7FA",
        teal: {
          DEFAULT: "#1B7A6B",
          dark: "#145A4F",
          light: "#E4F1EE",
        },
        gold: {
          DEFAULT: "#E8A33D",
          light: "#FBF0DC",
        },
        danger: {
          DEFAULT: "#C1443C",
          light: "#FBE9E7",
        },
        ink900: "#101826",
        ink500: "#5B6472",
        hairline: "#DCE2E8",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
}

