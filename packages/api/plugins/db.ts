import { definePlugin } from "nitro";
import { db } from "../utils/db";

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("close", () => {
    db.close();
  });
});
