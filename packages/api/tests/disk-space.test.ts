import { describe, expect, it } from "vite-plus/test";
import { link, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertStagingDiskSpace,
  calculateStagingDiskSpace,
  STAGING_FIXED_SAFETY_MARGIN_BYTES,
} from "../utils/disk-space.ts";

describe("staging disk-space calculation", () => {
  it("uses the live database as the reference and adds 50% headroom", () => {
    expect(
      calculateStagingDiskSpace({
        availableBytes: STAGING_FIXED_SAFETY_MARGIN_BYTES + 1_000,
        reusableTargetBytes: 200,
        liveDatabaseBytes: 600,
        totalJsonlBytes: 500,
      }),
    ).toEqual({
      availableBytes: STAGING_FIXED_SAFETY_MARGIN_BYTES + 1_000,
      reusableTargetBytes: 200,
      referenceBytes: 600,
      requiredBytes: STAGING_FIXED_SAFETY_MARGIN_BYTES + 900,
      usableBytes: STAGING_FIXED_SAFETY_MARGIN_BYTES + 1_200,
      hasSufficientSpace: true,
    });
  });

  it("falls back to JSONL size for a first build", () => {
    const result = calculateStagingDiskSpace({
      availableBytes: STAGING_FIXED_SAFETY_MARGIN_BYTES + 1_000,
      reusableTargetBytes: 0,
      liveDatabaseBytes: 0,
      totalJsonlBytes: 501,
    });

    expect(result.referenceBytes).toBe(501);
    expect(result.requiredBytes).toBe(STAGING_FIXED_SAFETY_MARGIN_BYTES + 752);
    expect(result.hasSufficientSpace).toBe(true);
  });

  it("uses an explicit first-build reference when no database or JSONL exists", () => {
    const result = calculateStagingDiskSpace({
      availableBytes: STAGING_FIXED_SAFETY_MARGIN_BYTES + 2_000,
      reusableTargetBytes: 0,
      liveDatabaseBytes: 0,
      totalJsonlBytes: 0,
      fallbackReferenceBytes: 1_000,
    });

    expect(result.referenceBytes).toBe(1_000);
    expect(result.requiredBytes).toBe(STAGING_FIXED_SAFETY_MARGIN_BYTES + 1_500);
    expect(result.hasSufficientSpace).toBe(true);
  });

  it("prefers measured sizes over a larger first-build fallback", () => {
    const result = calculateStagingDiskSpace({
      availableBytes: STAGING_FIXED_SAFETY_MARGIN_BYTES + 2_000,
      reusableTargetBytes: 0,
      liveDatabaseBytes: 1_000,
      totalJsonlBytes: 500,
      fallbackReferenceBytes: 10_000,
    });

    expect(result.referenceBytes).toBe(1_000);
    expect(result.requiredBytes).toBe(STAGING_FIXED_SAFETY_MARGIN_BYTES + 1_500);
  });

  it("counts reusable staging pages but rejects insufficient total capacity", () => {
    const result = calculateStagingDiskSpace({
      availableBytes: STAGING_FIXED_SAFETY_MARGIN_BYTES + 500,
      reusableTargetBytes: 100,
      liveDatabaseBytes: 500,
      totalJsonlBytes: 400,
    });

    expect(result.usableBytes).toBe(STAGING_FIXED_SAFETY_MARGIN_BYTES + 600);
    expect(result.requiredBytes).toBe(STAGING_FIXED_SAFETY_MARGIN_BYTES + 750);
    expect(result.hasSufficientSpace).toBe(false);
  });

  it("uses the larger of the live database and retained JSONL inputs", () => {
    const result = calculateStagingDiskSpace({
      availableBytes: 20_000_000_000,
      reusableTargetBytes: 0,
      liveDatabaseBytes: 600,
      totalJsonlBytes: 900,
    });

    expect(result.referenceBytes).toBe(900);
  });

  it("rejects an estimate without a live database or JSONL input", () => {
    expect(() =>
      calculateStagingDiskSpace({
        availableBytes: 1_000,
        reusableTargetBytes: 0,
        liveDatabaseBytes: 0,
        totalJsonlBytes: 0,
      }),
    ).toThrow(/Cannot estimate staging disk usage/);
  });

  it("rejects a staging path hard-linked to the live database", async () => {
    const directory = await mkdtemp(join(tmpdir(), "wiktapi-disk-"));
    const livePath = join(directory, "wiktionary.db");
    const stagingPath = join(directory, "wiktionary.db.new");
    try {
      await writeFile(livePath, "database");
      await link(livePath, stagingPath);
      await expect(
        assertStagingDiskSpace({
          targetPath: stagingPath,
          liveDatabasePath: livePath,
          jsonlPaths: [],
        }),
      ).rejects.toThrow(/hard link to the live database/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
