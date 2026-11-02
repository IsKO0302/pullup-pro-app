import { useMemo } from 'react';
import type { History } from '../domain/history';
import { useStore } from './store';

/** The engine's view of the stored data (memoised per change). */
export function useHistory(): History {
  const { data } = useStore();
  const { workouts, recoveryDays, maxEntries } = data;
  return useMemo(() => ({ workouts, recoveryDays, maxEntries }), [workouts, recoveryDays, maxEntries]);
}
