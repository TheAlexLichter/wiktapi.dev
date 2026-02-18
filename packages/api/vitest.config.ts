import { defineConfig } from "vite-plus";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  resolve: {
    alias: {
      "~": root,
    },
  },
  test: {
    globalSetup: [join(root, "tests/global-setup.ts")],
    setupFiles: [join(root, "tests/setup.ts")],
    include: [join(root, "tests/**/*.test.ts")],
  },
});
