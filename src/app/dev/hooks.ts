/**
 * Test hooks for development and the e2e build (separate database) ONLY.
 * `import.meta.env` checks at the call site keep this out of production bundles.
 */
import { DEFAULT_DB_NAME } from '../../storage/db';
import { replaceAll } from '../../storage/repo';
import { storeLang } from '../config';
import { demoData, type DemoOptions } from './demo';

declare global {
  interface Window {
    __pullupTest?: { seedDemo: (opts: Partial<DemoOptions> & { today: string }) => Promise<void> };
  }
}

export function installTestHooks(getDb: () => IDBDatabase | null, reload: () => Promise<void>) {
  window.__pullupTest = {
    async seedDemo(opts) {
      const db = getDb();
      if (!db) throw new Error('database not open');
      // Guardrail 2: demo data may only ever replace a separate dev/e2e database.
      if (db.name === DEFAULT_DB_NAME) throw new Error(`refusing to seed the real database "${DEFAULT_DB_NAME}"`);
      const data = demoData(opts);
      await replaceAll(db, data);
      if (data.profile) storeLang(data.profile.lang);
      await reload();
    },
  };
}
