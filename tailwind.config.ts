import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#3b82f6",
          dark: "#2563eb",
        },
        secondary: "#8b5cf6",
        accent: "#06b6d4",
        success: "#10b981",
        error: "#ef4444",
        warning: "#f59e0b",
      },
    },
  },
  plugins: [],
};

export default config;
