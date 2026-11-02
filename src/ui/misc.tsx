import type { ReactNode } from 'react';
import { cx } from './cx';

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%', className }: { height?: number; width?: number | string; className?: string }) {
  return <div className={cx('skeleton', className)} style={{ height, width }} aria-hidden />;
}

export function Switch({ checked, onChange, label, description, stateLabel }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; stateLabel: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      <span>
        <span style={{ display: 'block' }}>{label}</span>
        {description && <span className="t-caption muted" style={{ display: 'block' }}>{description}</span>}
      </span>
      <span style={{ display: 'flex', alignItems: 'center' }}>
        <span className="switch__state">{stateLabel}</span>
        <span className="switch__track" aria-hidden><span className="switch__knob" /></span>
      </span>
    </button>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty__icon" aria-hidden>{icon}</div>}
      <p className="empty__title">{title}</p>
      <p className="empty__text">{text}</p>
      {action}
    </div>
  );
}

export function Banner({ icon, title, text, action, role }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode; role?: 'status' | 'alert' }) {
  return (
    <div className="banner" role={role}>
      {icon && <span aria-hidden className="muted">{icon}</span>}
      <div className="banner__body">
        <p>{title}</p>
        {text && <p>{text}</p>}
      </div>
      {action}
    </div>
  );
}
