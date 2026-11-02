import { navigate } from '../../app/router';
import type { ThoughtCategory } from '../../domain/types';

export type ThoughtsTab = 'all' | 'favorites' | 'recent';

/** Remembered while the app is open, so "back" from a thought lands where you were. */
export const thoughtsMemory: { tab: ThoughtsTab; topic: ThoughtCategory | null; scrollY: number; restore: boolean } = {
  tab: 'all', topic: null, scrollY: 0, restore: false,
};

/** YOU → Saved thoughts: opens THOUGHTS on the Favorites tab. */
export function openSavedThoughts() {
  thoughtsMemory.tab = 'favorites';
  thoughtsMemory.restore = false;
  thoughtsMemory.scrollY = 0;
  navigate('thoughts');
}
