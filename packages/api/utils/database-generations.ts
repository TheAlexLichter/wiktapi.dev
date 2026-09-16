import { link, open, rename, stat, unlink } from "node:fs/promises";
import { dirname } from "node:path";

export interface FileIdentity {
  dev: number;
  ino: number;
  size: number;
}

export function sameFileIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size;
}

export async function fsyncFile(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function fsyncDirectory(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function unlinkIfPresent(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function linkIfPresent(source: string, destination: string): Promise<boolean> {
  try {
    await stat(source);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
  await link(source, destination);
  return true;
}

/** Atomically replace livePath while retaining its inode at previousPath. */
export async function installDatabaseGeneration(options: {
  stagingPath: string;
  livePath: string;
  previousPath: string;
}): Promise<void> {
  const directory = dirname(options.livePath);
  await unlinkIfPresent(options.previousPath);
  const retainedPrevious = await linkIfPresent(options.livePath, options.previousPath);
  if (retainedPrevious) await fsyncDirectory(directory);

  await rename(options.stagingPath, options.livePath);
  await fsyncDirectory(directory);
}

/** Restore previousPath atomically and retain the replaced generation as failedPath. */
export async function rollbackDatabaseGeneration(options: {
  previousPath: string;
  livePath: string;
  failedPath: string;
  temporaryPath: string;
}): Promise<void> {
  const directory = dirname(options.livePath);
  await unlinkIfPresent(options.failedPath);
  await linkIfPresent(options.livePath, options.failedPath);
  await unlinkIfPresent(options.temporaryPath);
  await link(options.previousPath, options.temporaryPath);
  await fsyncFile(options.temporaryPath);
  await fsyncDirectory(directory);
  await rename(options.temporaryPath, options.livePath);
  await fsyncDirectory(directory);
}
