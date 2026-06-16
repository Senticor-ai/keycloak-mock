import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      all: true,
      exclude: [
        "src/cli.ts"
      ],
      include: [
        "src/**/*.ts"
      ],
      provider: "v8",
      reporter: [
        "text",
        "json-summary"
      ],
      thresholds: {
        branches: 77,
        functions: 92,
        lines: 90,
        statements: 89
      }
    },
    environment: "node",
    include: [
      "test/**/*.test.ts"
    ],
    pool: "forks"
  }
});
