/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                "primary": "#c1a571",
                "background-dark": "#08090a",
                "surface-dark": "#121316",
                "accent-gold": "#d4af37",
                "danger": "#ef4444"
            },
            fontFamily: {
                "display": ["Noto Serif", "serif"],
                "sans": ["Manrope", "sans-serif"]
            }
        },
    },
    plugins: [],
}
