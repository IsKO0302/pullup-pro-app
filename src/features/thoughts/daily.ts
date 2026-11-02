import { useEffect, useMemo } from 'react';
import { useToday } from '../../app/clock';
import { useStore } from '../../app/store';
import { dailyThoughtId, thoughtById } from '../../domain/thoughts';
import type { Thought } from '../../domain/types';

/**
 * Today's thought. Pinned in IndexedDB the first time it is shown, so it stays the same for the
 * whole local calendar day (and the 30-day no-repeat rule can see it tomorrow). It switches at
 * local midnight because useToday() re-renders then.
 */
export function useThoughtOfDay(): Thought {
  const { data, actions } = useStore();
  const today = useToday();
  const id = useMemo(() => dailyThoughtId(today, data.thoughtDays), [today, data.thoughtDays]);
  const pinned = data.thoughtDays.some((d) => d.localDate === today && d.thoughtId === id);
  useEffect(() => {
    if (!pinned) void actions.saveThoughtDay({ localDate: today, thoughtId: id, atUtc: new Date().toISOString() });
  }, [pinned, today, id, actions]);
  return thoughtById(id)!;
}
