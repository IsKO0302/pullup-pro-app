import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useI18n } from '../../app/i18n';
import { navigate } from '../../app/router';
import { daysBetween } from '../../domain/time';
import type { MaxPoint } from '../../domain/progress';
import { Button } from '../../ui';

const W = 320;
const H = 150;
const PAD = { top: 14, right: 12, bottom: 24, left: 28 };

/**
 * Best strict set per week on a true time axis (gaps stay visible). Fewer than two
 * points → a written empty state, never a fake line. Tap/drag or use the arrow
 * keys to move between weeks.
 */
export function MaxChart({ points }: { points: readonly MaxPoint[] }) {
  const { t, date } = useI18n();
  const [selected, setSelected] = useState(points.length - 1);
  const box = useRef<HTMLDivElement>(null);

  if (points.length < 2) return <p className="muted progress__empty-line">{t('progress.chartEmpty')}</p>;

  const idx = Math.min(Math.max(selected, 0), points.length - 1);
  const first = points[0]!;
  const span = Math.max(1, daysBetween(first.week, points[points.length - 1]!.week));
  const top = Math.max(...points.map((p) => p.value));
  const yMax = Math.max(top + 1, Math.ceil(top * 1.15));
  const x = (p: MaxPoint) => PAD.left + (daysBetween(first.week, p.week) / span) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / yMax) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const short = (d: string) => date(d, { day: 'numeric', month: 'short' });
  const label = (p: MaxPoint) => t('progress.chartPoint', { date: short(p.week), n: p.value }) + (p.test ? ` · ${t('progress.pointTest')}` : '');
  const sel = points[idx]!;

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const vx = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p) - vx) < Math.abs(x(points[best]!) - vx)) best = i;
    });
    setSelected(best);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = { ArrowLeft: idx - 1, ArrowDown: idx - 1, ArrowRight: idx + 1, ArrowUp: idx + 1, Home: 0, End: points.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setSelected(Math.min(Math.max(next, 0), points.length - 1));
  };

  return (
    <div className="chart">
      <div
        ref={box}
        className="chart__box"
        role="slider"
        tabIndex={0}
        aria-label={t('progress.chart')}
        aria-valuemin={1}
        aria-valuemax={points.length}
        aria-valuenow={idx + 1}
        aria-valuetext={label(sel)}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); pick(e); }}
        onPointerMove={(e) => { if (e.buttons) pick(e); }}
        onKeyDown={onKey}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="chart__svg" aria-hidden focusable="false">
          {[0, yMax].map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="chart__grid" />
              <text x={PAD.left - 8} y={y(v) + 4} className="chart__axis" textAnchor="end">{v}</text>
            </g>
          ))}
          <text x={PAD.left} y={H - 6} className="chart__axis">{short(first.week)}</text>
          <text x={W - PAD.right} y={H - 6} className="chart__axis" textAnchor="end">{short(points[points.length - 1]!.week)}</text>
          <line x1={x(sel)} x2={x(sel)} y1={PAD.top} y2={H - PAD.bottom} className="chart__cursor" />
          <path d={path} className="chart__line" />
          {points.map((p, i) => (
            <circle key={p.week} cx={x(p)} cy={y(p.value)} r={i === idx ? 5 : 3} className={i === idx ? 'chart__dot is-selected' : p.test ? 'chart__dot is-test' : 'chart__dot'} />
          ))}
        </svg>
      </div>
      <div className="chart__caption">
        <p className="num">{label(sel)}</p>
        <Button variant="link" onClick={() => navigate(`progress/${encodeURIComponent(sel.workoutId)}`)}>{t('progress.openWorkout')}</Button>
      </div>
    </div>
  );
}
