/**
 * Small in-memory guards for the public demo: a per-client rate limit and a result cache.
 * Both are per server instance (best effort on serverless) — they reduce cost, they are not
 * a security boundary. Set a spend limit on the Anthropic API key as the real safeguard.
 */

export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Returns true when the request is allowed. `now` is injectable for tests. */
  allow(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

export class TtlCache<T> {
  private store = new Map<string, { value: T; expires: number }>();
  constructor(private readonly ttlMs: number) {}

  get(key: string, now: number): T | undefined {
    const hit = this.store.get(key);
    if (!hit || hit.expires <= now) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T, now: number): void {
    this.store.set(key, { value, expires: now + this.ttlMs });
  }
}
