import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cx } from './cx';

interface ChipProps {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}

/** Multi-select toggle chip. The check mark makes the state visible without color. */
export function Chip({ selected, onToggle, children, className }: ChipProps) {
  return (
    <button type="button" className={cx('chip', className)} aria-pressed={selected} onClick={onToggle}>
      {selected && <Check className="chip__mark" strokeWidth={1.75} aria-hidden />}
      <span>{children}</span>
    </button>
  );
}

interface ChoiceGroupProps<T extends string | number> {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  grid?: boolean;
}

/** Single choice (radio semantics) rendered as chips. */
export function ChoiceGroup<T extends string | number>({ label, options, value, onChange, grid }: ChoiceGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('chips', grid && 'chips--grid')}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="chip"
          onClick={() => onChange(o.value)}
        >
          {o.value === value && <Check className="chip__mark" strokeWidth={1.75} aria-hidden />}
          <span className="num">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
