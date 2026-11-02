/**
 * Storage protection (spec §8): asks the browser not to evict our IndexedDB
 * under storage pressure. Some browsers decide silently (Chrome: engagement,
 * installation), Firefox may ask the user once. Never throws.
 */
export type PersistResult = 'granted' | 'denied' | 'unsupported';

function storageManager(): StorageManager | null {
  return typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function' ? navigator.storage : null;
}

export async function requestPersistence(): Promise<PersistResult> {
  const s = storageManager();
  if (!s) return 'unsupported';
  try {
    if (typeof s.persisted === 'function' && (await s.persisted())) return 'granted';
    return (await s.persist()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Current status without asking (no prompt anywhere); null when unknown. */
export async function checkPersistence(): Promise<PersistResult | null> {
  const s = storageManager();
  if (!s) return 'unsupported';
  try {
    if (typeof s.persisted !== 'function') return null;
    return (await s.persisted()) ? 'granted' : null;
  } catch {
    return null;
  }
}
