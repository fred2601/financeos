/**
 * In-memory per-client rate limit for the public demo. It is per server instance (best effort
 * on serverless) — it reduces cost, it is not a security boundary. Results are cached in the
 * shared platform cache (see generate.ts); a spend limit on the API key is the real safeguard.
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
