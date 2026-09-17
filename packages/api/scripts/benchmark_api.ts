/**
 * Reproducible origin benchmark for the SQLite request paths changed in v2.
 * Run against the origin, not Cloudflare, after building a production-size DB.
 */

interface Sample {
  label: string;
  milliseconds: number;
  status: number | "network-error" | "timeout";
}

class RequestTimeoutError extends Error {}

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

function corpusArgument(name: string, fallback: string): string[] {
  return argument(name, fallback)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

const baseUrl = argument("base-url", "http://127.0.0.1:3000").replace(/\/$/, "");
const edition = argument("edition", "en");
const broadPrefixes = corpusArgument("broad-prefixes", argument("broad-prefix", "a"));
const rarePrefixes = corpusArgument("rare-prefixes", argument("rare-prefix", "xyzxyz"));
const language = argument("language", "en");
const exactWords = corpusArgument("exact-words", argument("exact-word", "test"));
const requestCount = Number.parseInt(argument("requests", "500"), 10);
const concurrency = Number.parseInt(argument("concurrency", "10"), 10);
const warmupCount = Number.parseInt(argument("warmup", "100"), 10);
const timeoutMilliseconds = Number.parseInt(argument("timeout-ms", "30000"), 10);
let benchmarkFailed = false;

if (broadPrefixes.length === 0 || rarePrefixes.length === 0 || exactWords.length === 0) {
  throw new Error("Prefix and exact-word corpora must each contain at least one value");
}

if (!Number.isSafeInteger(requestCount) || requestCount < 1) {
  throw new Error("--requests must be a positive integer");
}
if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
  throw new Error("--concurrency must be a positive integer");
}
if (!Number.isSafeInteger(warmupCount) || warmupCount < 0) {
  throw new Error("--warmup must be a non-negative integer");
}
if (!Number.isSafeInteger(timeoutMilliseconds) || timeoutMilliseconds < 1) {
  throw new Error("--timeout-ms must be a positive integer");
}

const endpoints = {
  broad: broadPrefixes.map(
    (prefix) => `/v1/${encodeURIComponent(edition)}/search?q=${encodeURIComponent(prefix)}`,
  ),
  rare: rarePrefixes.map(
    (prefix) => `/v1/${encodeURIComponent(edition)}/search?q=${encodeURIComponent(prefix)}`,
  ),
  language: broadPrefixes.map(
    (prefix) =>
      `/v1/${encodeURIComponent(edition)}/search?q=${encodeURIComponent(prefix)}&lang=${encodeURIComponent(language)}`,
  ),
  exact: exactWords.map(
    (word) => `/v1/${encodeURIComponent(edition)}/word/${encodeURIComponent(word)}`,
  ),
};

function cycle(paths: readonly string[], index: number): string {
  return paths[index % paths.length]!;
}

function percentile(sorted: readonly number[], fraction: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

async function fetchAndConsume(path: string): Promise<number> {
  const signal = AbortSignal.timeout(timeoutMilliseconds);
  try {
    const response = await fetch(`${baseUrl}${path}`, { signal });
    await response.arrayBuffer();
    return response.status;
  } catch (error) {
    if (signal.aborted) {
      throw new RequestTimeoutError(`request timed out after ${timeoutMilliseconds} ms: ${path}`, {
        cause: error,
      });
    }
    throw error;
  }
}

async function runScenario(
  name: string,
  selectRequest: (index: number) => { label: string; path: string },
): Promise<void> {
  let nextIndex = 0;
  const samples: Sample[] = [];
  const started = performance.now();

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= requestCount) return;

      const request = selectRequest(index);
      const requestStarted = performance.now();
      try {
        const status = await fetchAndConsume(request.path);
        samples.push({
          label: request.label,
          milliseconds: performance.now() - requestStarted,
          status,
        });
      } catch (error) {
        samples.push({
          label: request.label,
          milliseconds: performance.now() - requestStarted,
          status: error instanceof RequestTimeoutError ? "timeout" : "network-error",
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, requestCount) }, () => worker()));
  const elapsedSeconds = (performance.now() - started) / 1000;

  console.log(`\n${name}: ${(samples.length / elapsedSeconds).toFixed(1)} requests/s`);
  for (const label of new Set(samples.map((sample) => sample.label))) {
    const group = samples.filter((sample) => sample.label === label);
    const timings = group.map((sample) => sample.milliseconds).sort((a, b) => a - b);
    const failures = group.filter(
      (sample) => typeof sample.status !== "number" || sample.status < 200 || sample.status >= 300,
    ).length;
    const statusCounts = new Map<string, number>();
    for (const sample of group) {
      const status = String(sample.status);
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    }
    benchmarkFailed ||= failures > 0;
    console.log(
      `  ${label}: n=${group.length}, p50=${percentile(timings, 0.5).toFixed(1)} ms, ` +
        `p95=${percentile(timings, 0.95).toFixed(1)} ms, ` +
        `p99=${percentile(timings, 0.99).toFixed(1)} ms, failures=${failures}, ` +
        `statuses=${[...statusCounts].map(([status, count]) => `${status}:${count}`).join(",")}`,
    );
  }
}

console.log(
  `Benchmarking ${baseUrl} with ${requestCount} requests/scenario at concurrency ${concurrency} ` +
    `and a ${timeoutMilliseconds} ms request timeout`,
);
const warmupPaths = Object.values(endpoints).flat();
if (warmupCount > 0) {
  console.log(`Warming routes with ${warmupCount} requests before measurement`);
  for (let index = 0; index < warmupCount; index++) {
    const path = cycle(warmupPaths, index);
    let status: number;
    try {
      status = await fetchAndConsume(path);
    } catch (error) {
      throw new Error(`Warmup failed for ${path}: ${String(error)}`, { cause: error });
    }
    if (status < 200 || status >= 300) {
      throw new Error(`Warmup failed for ${path} with HTTP ${status}`);
    }
  }
}

await runScenario("broad prefix corpus", (index) => ({
  label: "broad",
  path: cycle(endpoints.broad, index),
}));
await runScenario("rare prefix corpus", (index) => ({
  label: "rare",
  path: cycle(endpoints.rare, index),
}));
await runScenario("language-filtered broad prefix corpus", (index) => ({
  label: "language",
  path: cycle(endpoints.language, index),
}));
await runScenario("exact lookup corpus baseline", (index) => ({
  label: "exact",
  path: cycle(endpoints.exact, index),
}));
let mixedExactIndex = 0;
let mixedBroadIndex = 0;
await runScenario("mixed broad-prefix load (exact latency exposes event-loop impact)", (index) => {
  if (index % 5 === 0) {
    return {
      label: "exact-under-search-load",
      path: cycle(endpoints.exact, mixedExactIndex++),
    };
  }
  return { label: "broad", path: cycle(endpoints.broad, mixedBroadIndex++) };
});

if (benchmarkFailed) {
  console.error(
    "\nBenchmark failed because one or more requests timed out, failed over the network, or returned a non-2xx status.",
  );
  process.exitCode = 1;
}
