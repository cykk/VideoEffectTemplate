export class AnalyticsDedupeStore {
  private readonly seen = new Set<string>();

  has(key?: string | null) {
    if (!key) {
      return false;
    }

    return this.seen.has(key);
  }

  add(key?: string | null) {
    if (!key) {
      return;
    }

    this.seen.add(key);
  }

  clear() {
    this.seen.clear();
  }
}
