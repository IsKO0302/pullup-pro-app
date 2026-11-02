/**
 * Test hooks for development and the e2e build (separate database) ONLY.
 * `import.meta.env` checks at the call site keep this out of production bundles.
 */
import { DEFAULT_DB_NAME } from '../../storage/db';
import { replaceAll } from '../../storage/repo';
import { storeLang } from '../config';
import { simulateUpdateForTest } from '../pwa';
import { demoData, type DemoOptions } from './demo';

declare global {
  interface Window {
    __pullupTest?: {
      seedDemo: (opts: Partial<DemoOptions> & { today: string }) => Promise<void>;
      /** Lays out every thought on every poster variant with the real fonts; returns misfits. */
      posterSweep: () => Promise<string[]>;
      /** Pretends a new version is waiting; `updatesApplied` counts "Restart now" taps that went through. */
      simulateUpdate: () => void;
      updatesApplied: number;
    };
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
    simulateUpdate() {
      simulateUpdateForTest(async () => {
        if (window.__pullupTest) window.__pullupTest.updatesApplied += 1;
      });
    },
    updatesApplied: 0,
    async posterSweep() {
      const { sweepPosters } = await import('../../features/poster/sweep');
      return sweepPosters();
    },
  };
}
