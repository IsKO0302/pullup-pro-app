import { currentTimeZone } from '../../app/clock';
import { APP_VERSION } from '../../app/config';
import { makeStamp } from '../../domain/time';
import type { AppData } from '../../domain/types';
import { buildExport, exportFileName, serializeExport } from '../../storage/exportFile';

/**
 * Builds the export file (everything, readable JSON) and hands it to the
 * browser as a download. Returns the export time (UTC) to record in meta.
 */
export function downloadExport(data: AppData, now = new Date()): string {
  const stamp = makeStamp(now, currentTimeZone());
  const text = serializeExport(buildExport(data, stamp, APP_VERSION));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(stamp.localDate);
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return stamp.atUtc;
}
