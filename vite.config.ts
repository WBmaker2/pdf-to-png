import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/pdf-to-png/",
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ["./src/setupTests.ts"],
    environment: "jsdom",
  },
});
