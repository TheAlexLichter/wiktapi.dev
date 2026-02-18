import { defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";

export default defineConfig({
  head: [["link", { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }]],
  vite: {
    plugins: [
      llmstxt({
        customLLMsTxtTemplate: `# {title}\n\n> {description}\n\n{details}\n\n{toc}\n\n## Optional\n\n- [OpenAPI spec](https://api.wiktapi.dev/_openapi.json): Machine-readable OpenAPI 3.x spec with all endpoints, parameters, and response schemas.\n- [Interactive API explorer](https://api.wiktapi.dev/_scalar): Scalar UI for browsing and trying all endpoints.`,
      }),
    ],
  },
  title: "Wiktapi",
  description: "Multilingual dictionary API built on Wiktionary",
  themeConfig: {
    logo: "/favicon.svg",
    nav: [
      { text: "Quickstart", link: "/quickstart" },
      { text: "API Explorer", link: "https://api.wiktapi.dev/_scalar", target: "_blank" },
      { text: "About", link: "/about" },
    ],
    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Introduction", link: "/" },
          { text: "Quickstart", link: "/quickstart" },
        ],
      },
      {
        text: "Concepts",
        items: [
          { text: "Editions & Languages", link: "/concepts/editions" },
          { text: "Data Pipeline", link: "/concepts/data-pipeline" },
        ],
      },
      {
        text: "Infrastructure",
        collapsed: true,
        items: [
          { text: "Self-Hosting", link: "/guides/self-hosting" },
          { text: "Updating Data", link: "/guides/updating-data" },
        ],
      },
      {
        text: "Project",
        items: [{ text: "About", link: "/about" }],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/TheAlexLichter/wiktionary-api" }],
  },
});
