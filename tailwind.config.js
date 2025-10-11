/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      borderRadius: { xl: "16px" },
      boxShadow: { soft: "0 1px 2px rgba(0,0,0,.06)" },
    },
  },
  plugins: [],
};
