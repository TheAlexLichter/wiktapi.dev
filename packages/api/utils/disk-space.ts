import { stat, statfs } from "node:fs/promises";
import type { Stats } from "node:fs";
import { dirname } from "node:path";

const STAGING_HEADROOM_FACTOR = 1.5;
export const STAGING_FIXED_SAFETY_MARGIN_BYTES = 5 * 1024 ** 3;

async function fileInfo(path: string): Promise<Stats | null> {
  try {
    return await stat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function formatBytes(bytes: number): string {
  const gibibytes = bytes / 1024 ** 3;
  return `${gibibytes.toFixed(1)} GiB`;
}

export interface StagingDiskSpaceSummary {
  availableBytes: number;
  reusableTargetBytes: number;
  referenceBytes: number;
  requiredBytes: number;
  usableBytes: number;
  hasSufficientSpace: boolean;
}

export function calculateStagingDiskSpace(options: {
  availableBytes: number;
  reusableTargetBytes: number;
  liveDatabaseBytes: number;
  totalJsonlBytes: number;
}): StagingDiskSpaceSummary {
  const referenceBytes = Math.max(options.liveDatabaseBytes, options.totalJsonlBytes);
  if (referenceBytes === 0) {
    throw new Error(
      "Cannot estimate staging disk usage: no live database or JSONL input size found",
    );
  }

  const requiredBytes =
    Math.ceil(referenceBytes * STAGING_HEADROOM_FACTOR) + STAGING_FIXED_SAFETY_MARGIN_BYTES;
  const usableBytes = options.availableBytes + options.reusableTargetBytes;

  return {
    availableBytes: options.availableBytes,
    reusableTargetBytes: options.reusableTargetBytes,
    referenceBytes,
    requiredBytes,
    usableBytes,
    hasSufficientSpace: usableBytes >= requiredBytes,
  };
}

export async function assertFreeDiskSpace(
  path: string,
  requiredBytes: number,
  purpose: string,
): Promise<void> {
  const filesystem = await statfs(path);
  const availableBytes = filesystem.bavail * filesystem.bsize;
  if (availableBytes < requiredBytes) {
    throw new Error(
      `Insufficient free space for ${purpose}: ${formatBytes(availableBytes)} available, ${formatBytes(requiredBytes)} required`,
    );
  }
}

export async function assertStagingTargetIsIndependent(
  targetPath: string,
  liveDatabasePath: string,
): Promise<void> {
  if (targetPath === liveDatabasePath) {
    const target = await fileInfo(targetPath);
    if (target && target.nlink > 1) {
      throw new Error("Database target has multiple hard links; refusing to modify shared pages");
    }
    return;
  }
  const [target, liveDatabase] = await Promise.all([
    fileInfo(targetPath),
    fileInfo(liveDatabasePath),
  ]);
  if (
    target &&
    liveDatabase &&
    target.dev === liveDatabase.dev &&
    target.ino === liveDatabase.ino
  ) {
    throw new Error("Staging database is a hard link to the live database; refusing to modify it");
  }
  if (target && target.nlink > 1) {
    throw new Error("Staging database has multiple hard links; refusing to modify shared pages");
  }
}

/**
 * Fail conservatively before a complete fresh build if the filesystem cannot
 * hold a replacement database plus index-building headroom. Existing staging
 * file pages count as reusable, while JSONL files do not: they are deleted
 * progressively and therefore provide additional uncounted safety margin.
 */
export async function assertStagingDiskSpace(options: {
  targetPath: string;
  liveDatabasePath: string;
  jsonlPaths: readonly string[];
  reclaimablePaths?: readonly string[];
}): Promise<StagingDiskSpaceSummary> {
  await assertStagingTargetIsIndependent(options.targetPath, options.liveDatabasePath);
  const [filesystem, target, liveDatabase, jsonlFiles, reclaimableFiles] = await Promise.all([
    statfs(dirname(options.targetPath)),
    fileInfo(options.targetPath),
    fileInfo(options.liveDatabasePath),
    Promise.all(options.jsonlPaths.map(fileInfo)),
    Promise.all((options.reclaimablePaths ?? []).map(fileInfo)),
  ]);

  const availableBytes = filesystem.bavail * filesystem.bsize;
  const totalJsonlBytes = jsonlFiles.reduce((sum, file) => sum + (file?.size ?? 0), 0);
  // Unlinking one name does not reclaim a multiply-linked generation.
  const reclaimableBytes = reclaimableFiles.reduce(
    (sum, file) => sum + (file?.nlink === 1 ? file.size : 0),
    0,
  );
  const reusableTargetBytes = (target?.size ?? 0) + reclaimableBytes;
  const summary = calculateStagingDiskSpace({
    availableBytes,
    reusableTargetBytes,
    liveDatabaseBytes: liveDatabase?.size ?? 0,
    totalJsonlBytes,
  });

  if (!summary.hasSufficientSpace) {
    throw new Error(
      [
        "Insufficient disk space for a safe complete staging build.",
        `Available plus reusable staging file: ${formatBytes(summary.usableBytes)}.`,
        `Required from the ${formatBytes(summary.referenceBytes)} reference with 50% index headroom and a ${formatBytes(STAGING_FIXED_SAFETY_MARGIN_BYTES)} safety margin: ${formatBytes(summary.requiredBytes)}.`,
        "Expand the filesystem or, only after measuring peak usage elsewhere, pass --skip-disk-check.",
      ].join(" "),
    );
  }

  return summary;
}
