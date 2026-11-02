import type { ReactNode } from 'react';

interface RingProps {
  /** 0 … 1, share of the ring that is filled. */
  progress: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  label?: string;
}

export function Ring({ progress, size = 248, stroke = 4, children, label }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <div className="ring" style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={1} />
        <circle
          className="ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
        />
      </svg>
      <div className="ring__center">{children}</div>
    </div>
  );
}
