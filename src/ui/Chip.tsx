import { useRef, type KeyboardEvent, type ReactNode } from 'react';
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

const STEP: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Single choice (radio semantics) rendered as chips. Keyboard: one Tab stop
 * (the selected chip), arrow keys / Home / End move and select — the ARIA
 * radio-group pattern.
 */
export function ChoiceGroup<T extends string | number>({ label, options, value, onChange, grid }: ChoiceGroupProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = Math.max(0, options.findIndex((o) => o.value === value));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = STEP[e.key];
    const next = step !== undefined ? (current + step + options.length) % options.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? options.length - 1
      : null;
    const option = next === null ? undefined : options[next];
    if (next === null || !option) return;
    e.preventDefault();
    onChange(option.value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cx('chips', grid && 'chips--grid')} onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={i === current ? 0 : -1}
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
