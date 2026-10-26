/**
 * Waits a bit before resolving, so stub services feel like a real network
 * call and screens show their loading states. Delete with the stubs.
 */
export function fakeDelay(ms = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
