import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: "#fdf4f3",
          100: "#fbe8e6",
          200: "#f8d5d0",
          500: "#e0533c",
          600: "#c73e28",
          700: "#a62f1c",
        },
      },
    },
  },
  plugins: [],
};

export default config;
