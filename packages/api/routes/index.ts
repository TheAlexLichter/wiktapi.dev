import { defineHandler, sendRedirect } from "nitro/h3";

export default defineHandler((event) => sendRedirect(event, "https://wiktapi.dev", 302));
