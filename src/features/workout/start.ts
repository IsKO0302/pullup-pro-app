import { useCallback } from 'react';
import { currentTimeZone, newId } from '../../app/clock';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { startSession } from '../../domain/session';
import { localDateOf } from '../../domain/time';
import type { SessionVariant, Workout } from '../../domain/types';

/** START goes straight into the workout: no menu, no questionnaire. */
export function useStartWorkout(): (plan: Workout, variant: SessionVariant) => Promise<void> {
  const { actions } = useStore();
  return useCallback(async (plan, variant) => {
    const now = new Date();
    const timeZone = currentTimeZone();
    const session = startSession(plan, { id: newId(), variant, now, timeZone, localDate: localDateOf(now, timeZone) });
    if (await actions.saveActive(session)) navigate('workout');
  }, [actions]);
}
