import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/climate/**/*.test.ts", "tests/lib/**/*.test.ts"],
    // Unit tests must never touch the network; source.ts tests inject a fake fetch.
    restoreMocks: true,
  },
});
