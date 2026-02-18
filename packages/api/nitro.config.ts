import { defineConfig } from "nitro";

// https://nitro.build/config
export default defineConfig({
  serverDir: "./",
  experimental: {
    openAPI: true,
  },
  openAPI: {
    meta: {
      title: "Wiktapi",
      description: "Multilingual dictionary REST API built on Wiktionary data",
      version: "1",
    },
    production: "runtime",
  },
  routeRules: {
    // All API data is static between dump imports (~monthly).
    // After re-importing, purge the Cloudflare cache manually:
    // npx wrangler pages deployment tail  (or via the dashboard → Caching → Purge Everything)
    "/v1/**": {
      headers: {
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
        "access-control-allow-origin": "*",
      },
    },
  },
});
