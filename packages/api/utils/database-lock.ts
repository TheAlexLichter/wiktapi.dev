import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const DATABASE_LOCK_TOKEN_ENV = "WIKTAPI_DATABASE_LOCK_TOKEN";
export const DEFAULT_DATABASE_LOCK_PATH = resolve("data/database-maintenance.lock");

interface LockRecord {
  token: string;
  pid: number;
  createdAt: string;
}

export interface DatabaseMaintenanceLock {
  token: string;
  inherited: boolean;
  release(): Promise<void>;
}

async function readRecord(path: string): Promise<LockRecord | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as LockRecord;
  } catch {
    return null;
  }
}

export async function acquireDatabaseMaintenanceLock(
  lockPath = DEFAULT_DATABASE_LOCK_PATH,
): Promise<DatabaseMaintenanceLock> {
  await mkdir(dirname(lockPath), { recursive: true });
  const inheritedToken = process.env[DATABASE_LOCK_TOKEN_ENV];
  if (inheritedToken) {
    const record = await readRecord(lockPath);
    if (record?.token !== inheritedToken) {
      throw new Error("Inherited database maintenance lock token does not match the active lock");
    }
    return { token: inheritedToken, inherited: true, release: async () => {} };
  }

  const token = randomUUID();
  try {
    const handle = await open(lockPath, "wx", 0o600);
    const record: LockRecord = { token, pid: process.pid, createdAt: new Date().toISOString() };
    await handle.writeFile(`${JSON.stringify(record)}\n`);
    await handle.sync();

    return {
      token,
      inherited: false,
      release: async () => {
        await handle.close();
        const active = await readRecord(lockPath);
        if (active?.token === token) await unlink(lockPath);
      },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const record = await readRecord(lockPath);
    throw new Error(
      `Database maintenance is already running${record ? ` (PID ${record.pid}, since ${record.createdAt})` : ""}. If that process crashed, verify no child import is running before removing ${lockPath}.`,
    );
  }
}
