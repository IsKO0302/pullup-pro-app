/* Dev-only page (excluded from production builds). Sample strings are
   intentionally inline: this page exists to check EN/RU/TR text lengths. */
import { useState } from 'react';
import { Activity, BookOpen, Quote, Sun, User } from 'lucide-react';
import { Banner, BottomNav, Button, Chip, ChoiceGroup, EmptyState, ProgressBar, Ring, Sheet, Skeleton, Stepper, Switch } from '../../ui';

const samples = {
  en: { start: 'Start', setDone: 'Set done', skip: 'Skip set', swap: 'Swap exercise', nav: ['Today', 'Progress', 'Thoughts', 'You'], chip: 'Resistance bands', quote: 'Not every day has to be perfect.' },
  ru: { start: 'Начать', setDone: 'Подход сделан', skip: 'Пропустить подход', swap: 'Заменить упражнение', nav: ['Сегодня', 'Прогресс', 'Мысли', 'Ты'], chip: 'Резиновые петли', quote: 'Не каждый день обязан быть идеальным.' },
  tr: { start: 'Başla', setDone: 'Set tamam', skip: 'Seti atla', swap: 'Egzersizi değiştir', nav: ['Bugün', 'İlerleme', 'Düşünceler', 'Sen'], chip: 'Direnç bantları', quote: 'Her gün mükemmel olmak zorunda değil.' },
} as const;

export default function Styleguide() {
  const [reps, setReps] = useState(5);
  const [dur, setDur] = useState(30);
  const [sel, setSel] = useState(true);
  const [sw, setSw] = useState(false);
  const [sheet, setSheet] = useState(false);
  return (
    <main className="screen-pad" style={{ display: 'grid', gap: 32, paddingBottom: 120 }}>
      <h1 className="t-h1 upper">Styleguide</h1>
      {(Object.keys(samples) as Array<keyof typeof samples>).map((lang) => {
        const s = samples[lang];
        return (
          <section key={lang} lang={lang} style={{ display: 'grid', gap: 16 }}>
            <p className="t-eyebrow">{lang.toUpperCase()}</p>
            <Button variant="primary" size="xl" block glow>{s.start.toLocaleUpperCase(lang)}</Button>
            <Button variant="primary" block>{s.setDone}</Button>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button>{s.skip}</Button>
              <Button variant="ghost">{s.swap}</Button>
              <Button variant="link">{s.swap}</Button>
              <Button variant="danger">{s.skip}</Button>
            </div>
            <div className="chips"><Chip selected={sel} onToggle={() => setSel(!sel)}>{s.chip}</Chip><Chip selected={!sel} onToggle={() => setSel(!sel)}>{s.nav[0]}</Chip></div>
            <p className="quote">{s.quote}</p>
          </section>
        );
      })}
      <ChoiceGroup label="Duration" value={dur} onChange={setDur} options={[10, 20, 30, 45].map((v) => ({ value: v, label: `${v}` }))} grid />
      <Stepper value={reps} onChange={setReps} label="Reps" decreaseLabel="Fewer" increaseLabel="More" unit="reps" />
      <Stepper value={reps} onChange={setReps} size="md" label="Reps" decreaseLabel="Fewer" increaseLabel="More" />
      <div style={{ display: 'grid', placeItems: 'center' }}><Ring progress={0.62}><div className="t-numeral">74</div><div className="t-caption muted">s</div></Ring></div>
      <ProgressBar value={0.4} label="Progress" />
      <Switch checked={sw} onChange={setSw} label="Vibration" description="At the end of rest" stateLabel={sw ? 'On' : 'Off'} />
      <div className="card" style={{ display: 'grid', gap: 8 }}><Skeleton height={20} width="60%" /><Skeleton height={14} /><Skeleton height={14} width="80%" /></div>
      <Banner icon={<Activity size={20} />} title="Continue workout" text="Pull · Strength — 2 / 5" action={<Button>Open</Button>} />
      <EmptyState icon={<BookOpen size={28} />} title="No workouts yet" text="Finish your first workout and it will appear here." action={<Button variant="primary">Start</Button>} />
      <Button onClick={() => setSheet(true)}>Open sheet</Button>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="How to" closeLabel="Close"><p className="muted">Sheet content with technique cues.</p></Sheet>
      <BottomNav label="Main" activeKey="t" items={samples.tr.nav.map((l, i) => ({ key: i === 2 ? 't' : String(i), label: l, href: '#/styleguide', icon: [<Sun key="a" size={22} strokeWidth={1.5} />, <Activity key="b" size={22} strokeWidth={1.5} />, <Quote key="c" size={22} strokeWidth={1.5} />, <User key="d" size={22} strokeWidth={1.5} />][i] }))} />
    </main>
  );
}
