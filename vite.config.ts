import { defineConfig, UserConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
const config: UserConfig = {
  server: {
    host: "::",
    port: 8080,
    headers: {
      // Fix for Cross-Origin-Opener-Policy error with Firebase Auth popups
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
    },
  },
  plugins: [
    react(),
  ].filter(Boolean), // Remove falsy values
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // Matches tsconfig.json "baseUrl": "src"
    },
  },
  define: {
    "process.env": {}, // Define process.env for compatibility
  },
};

export default defineConfig((envConfig) => {
  if (envConfig.mode === "development") {
    config.plugins = [...config.plugins, componentTagger()]; // Add componentTagger in dev mode
  }
  return config;
});