/**
 * Realistic demo history for development and automated screenshots ONLY.
 * Never bundled into production (imported behind DEV / e2e-mode checks) and
 * only ever written to the e2e or dev database.
 */
import { planDay } from '../../domain/plan';
import { scheduledType } from '../../domain/schedule';
import { addDays, weekStart, type LocalDate } from '../../domain/time';
import {
  emptyAppData,
  type AppData, type CompletedWorkout, type Equipment, type Lang, type LoggedExercise, type Mood, type Profile, type RecoveryDay,
} from '../../domain/types';
import { EXERCISES } from '../../data/exercises/catalog';

export interface DemoOptions {
  lang: Lang;
  /** Weeks of history before the current week. */
  weeks: number;
  today: LocalDate;
  /** Strict pull-up max given at setup. */
  max: number;
  name: string;
  daysPerWeek: number;
  equipment: Equipment[];
  seed: number;
}

const NOTES: Record<Lang, string[]> = {
  en: ['Felt strong on the last set.', 'Grip gave out before my back did.', 'Slow negatives today. Good control.', 'Low energy, but I showed up.', 'First set felt easy.', 'Short on sleep — kept every rep clean.', 'Better than last week.', 'Calm session. Exactly what I needed.'],
  ru: ['Последний подход дался легко.', 'Хват устал раньше спины.', 'Медленные негативы, хороший контроль.', 'Сил было мало, но тренировка состоялась.', 'Первый подход — легко.', 'Мало сна, но каждый повтор чистый.', 'Лучше, чем на прошлой неделе.', 'Спокойная тренировка. То, что нужно.'],
  tr: ['Son set güçlü hissettirdi.', 'Önce kavrama yoruldu, sırt değil.', 'Bugün yavaş negatifler. İyi kontrol.', 'Enerjim düşüktü ama geldim.', 'İlk set kolaydı.', 'Az uyudum, yine de her tekrar temizdi.', 'Geçen haftadan daha iyi.', 'Sakin bir antrenman. Tam ihtiyacım olan.'],
};

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function demoData(opts: Partial<DemoOptions> & { today: LocalDate }): AppData {
  const o: DemoOptions = { lang: 'en', weeks: 10, max: 5, name: 'Isa', daysPerWeek: 4, equipment: ['bar', 'dipBars', 'bands'], seed: 7, ...opts };
  const rand = rng(o.seed);
  const startDate = addDays(weekStart(o.today), -7 * o.weeks);
  const profile: Profile = {
    name: o.name, lang: o.lang, equipment: o.equipment, daysPerWeek: o.daysPerWeek, sessionMinutes: 30,
    goals: ['morePullups', 'muscleUp'], startDate, createdAtUtc: `${startDate}T08:00:00.000Z`, onboarding: 'done',
  };
  const data = emptyAppData();
  data.profile = profile;
  data.maxEntries = [{ value: o.max, source: 'setup', localDate: startDate, atUtc: `${startDate}T08:00:00.000Z`, timeZone: 'UTC' }];
  const workouts: CompletedWorkout[] = [];
  const recoveryDays: RecoveryDay[] = [];
  let noteIndex = 0;

  for (let date = startDate; date < o.today; date = addDays(date, 1)) {
    if (!scheduledType(o.daysPerWeek, date)) continue;
    const roll = rand();
    if (roll < 0.06) {
      recoveryDays.push({ localDate: date, reason: rand() < 0.5 ? 'tired' : 'busy', atUtc: `${date}T07:00:00.000Z`, timeZone: 'UTC' });
      continue;
    }
    if (roll < 0.1) continue; // a quiet gap: shown as "not trained", never as guilt
    const history = { workouts, recoveryDays, maxEntries: data.maxEntries };
    let plan = planDay(profile, history, date);
    if (plan.flags.maxTestSuggested && rand() < 0.8) plan = planDay(profile, history, date, { variant: 'maxTest' });
    const current = Math.max(o.max, ...workouts.flatMap((w) => w.exercises.filter((e) => e.exerciseId === 'strict-pullup').flatMap((e) => e.sets.map((s) => s.actual))));
    const startedAtUtc = `${date}T17:${String(Math.floor(rand() * 50)).padStart(2, '0')}:00.000Z`;
    const durationSec = Math.round(plan.estimatedMinutes * 60 * (0.9 + rand() * 0.2));
    const completedAtUtc = new Date(Date.parse(startedAtUtc) + durationSec * 1000).toISOString();
    const exercises: LoggedExercise[] = plan.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      slot: ex.slot,
      unit: EXERCISES[ex.exerciseId].unit,
      role: ex.role,
      target: ex.target,
      plannedSets: ex.sets,
      restSec: ex.restSec,
      swappedFrom: null,
      sets: Array.from({ length: ex.sets }, (_, i) => {
        let actual = ex.target;
        if (ex.role === 'test') actual = current + (rand() < 0.6 ? 1 : 0);
        else if (EXERCISES[ex.exerciseId].unit === 'reps') {
          const r = rand();
          if (i === 0 && r < 0.2) actual += 1;
          else if (i === ex.sets - 1 && r < 0.25) actual = Math.max(1, actual - 1);
        }
        return { target: ex.target, actual, status: 'done' as const, atUtc: completedAtUtc };
      }),
    }));
    const withNote = rand() < 0.4;
    workouts.push({
      id: `demo-${date}`,
      type: plan.type,
      level: plan.level,
      startedAtUtc,
      completedAtUtc,
      localDate: date,
      timeZone: 'UTC',
      durationSec,
      exercises,
      flags: plan.flags,
      mood: rand() < 0.85 ? ((3 + Math.floor(rand() * 3)) as Mood) : null,
      note: withNote ? NOTES[o.lang][noteIndex++ % NOTES[o.lang].length]! : '',
      finishedEarly: false,
    });
  }
  data.workouts = workouts;
  data.recoveryDays = recoveryDays;
  data.meta = { ...data.meta, persist: 'granted', lastExportAtUtc: `${addDays(o.today, -3)}T09:00:00.000Z` };
  return data;
}
