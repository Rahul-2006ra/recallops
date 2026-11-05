/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "surface-workspace": "#F8FAFC",
        "navy-sidebar": "#111827",
        "navy-sidebar-dark": "#0B0F17",
        primary: {
          DEFAULT: "#3b82f6",
          container: "#2563eb",
          light: "#eff6ff",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(15, 23, 42, 0.05)",
        "2xs": "0 1px 1px 0 rgba(15, 23, 42, 0.03)",
      },
    },
  },
  plugins: [],
}
