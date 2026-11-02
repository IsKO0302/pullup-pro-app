import { useMemo } from 'react';
import type { History } from '../domain/history';
import type { RotationState } from '../domain/types';
import { useStore } from './store';

/** The engine's view of the stored data (memoised per change). */
export function useHistory(): History {
  const { data } = useStore();
  const { workouts, recoveryDays, maxEntries } = data;
  return useMemo(() => ({ workouts, recoveryDays, maxEntries }), [workouts, recoveryDays, maxEntries]);
}

/** The stored rotation checkpoint (a shortcut for the scheduler; never required). */
export function useRotation(): RotationState | null {
  return useStore().data.rotation;
}
