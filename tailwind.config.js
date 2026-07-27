/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Core brand — white / black / nude-beige
        ink: {
          DEFAULT: "#17140F", // near-black, warm not cold
          soft: "#332D24",
          muted: "#5C5346",
        },
        paper: {
          DEFAULT: "#FBF9F5", // warm off-white
          raised: "#FFFFFF",
        },
        nude: {
          50: "#FBF6EE",
          100: "#F5EBDA",
          200: "#EADCC0",
          300: "#DCC69C",
          400: "#CBAB77",
          500: "#B8925A", // primary accent
          600: "#9C7847",
          700: "#7C5F39",
          800: "#5E482B",
          900: "#40311E",
        },
        line: "#E7DFD1", // hairline border on paper
        success: "#3D7A56",
        warning: "#B8823A",
        danger: "#B4442E",
        info: "#3D6B7A",
      },
      fontFamily: {
        sans: ["Poppins", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1.1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(23,20,15,0.04), 0 8px 24px -12px rgba(23,20,15,0.12)",
        float: "0 12px 32px -8px rgba(23,20,15,0.22)",
        nav: "0 -1px 0 rgba(23,20,15,0.06), 0 -8px 24px -12px rgba(23,20,15,0.15)",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      maxWidth: {
        app: "480px",
      },
      keyframes: {
        "toast-in": {
          "0%": { transform: "translateY(12px)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
        "sheet-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        "toast-in": "toast-in 0.22s ease-out",
        "sheet-up": "sheet-up 0.28s cubic-bezier(0.22,1,0.36,1)",
        "fade-in": "fade-in 0.18s ease-out",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
