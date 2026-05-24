import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: false,
    // Don't pull Tauri-specific globals into tests; those modules are mocked
    // per-test where needed.
  },
});
