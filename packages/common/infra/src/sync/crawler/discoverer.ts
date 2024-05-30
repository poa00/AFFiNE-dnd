/**
 * Discoverer is responsible for finding and subscribing to updates of searching targets.
 *
 * `Info` type is the additional information that can be used in crawler.
 */
export interface Discoverer<Info = undefined> {
  /**
   * Subscribe to updates.
   *
   * When any item is added or removed or updated, the callback be called with its id.
   */
  subscribe(callback: (updateIds: { id: string; info?: Info }[]) => void): {
    dispose(): void;
  };

  /**
   * Find all existing ids, and their info if available.
   */
  discover(signal?: AbortSignal): Promise<{ id: string; info?: Info }[]>;
}
