import { mockEvent } from "nitro/h3";

/**
 * Creates a mock H3 event with router params and query string.
 * Uses h3 v2's built-in mockEvent under the hood.
 */
export function createTestEvent(
  params: Record<string, string> = {},
  query: Record<string, string> = {},
) {
  const qs = new URLSearchParams(query).toString();
  const url = qs ? `/?${qs}` : "/";
  const event = mockEvent(url);
  event.context.params = params;
  return event;
}

/**
 * Calls a route handler, converting synchronous throws into promise rejections
 * so that Vitest's `rejects` matchers work correctly.
 */
export function call(
  handler: (e: ReturnType<typeof mockEvent>) => unknown,
  event: ReturnType<typeof mockEvent>,
) {
  return Promise.resolve().then(() => handler(event));
}
