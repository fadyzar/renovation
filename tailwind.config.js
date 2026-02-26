/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // וודא שהנתיב כולל את כל הקבצים שלך
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#FE5F20",
          navy: "#1F263E",
          blue: "#1336F6",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
