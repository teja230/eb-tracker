import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    environment: "node",
    include: ["client/src/**/*.test.ts", "client/src/**/*.test.tsx"],
    environmentMatchGlobs: [
      ["client/src/components/**/*.test.tsx", "jsdom"],
      ["client/src/pages/**/*.test.tsx", "jsdom"],
    ],
    setupFiles: ["client/src/test-setup.ts"],
    globals: true,
  },
});
