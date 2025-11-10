import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#8C7BFF",
          light: "#B6AEFF",
          dark: "#5C4CD3"
        }
      }
    }
  },
  plugins: []
};

export default config;


