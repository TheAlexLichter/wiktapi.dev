// Set DATA_PATH before any module that imports utils/db is loaded.
// globalSetup creates the fixture DB at this path before workers start.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.DATA_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../data/test.db");
