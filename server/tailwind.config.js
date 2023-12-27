// Start a tailwind watcher:
//   tailwindcss -i public/src.css -o public/app.css --watch

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"],
  theme: {
    extend: {},
  },
  plugins: [],
}

