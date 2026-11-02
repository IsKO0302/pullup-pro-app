import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cx } from './cx';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: 'xl' | 'md';
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  unit?: string;
  format?: (value: number) => string;
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, size = 'xl', label, decreaseLabel, increaseLabel, unit, format }: StepperProps) {
  const [bump, setBump] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setBump((b) => b + 1);
  }, [value]);
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className={cx('stepper', size === 'md' && 'stepper--md')} role="group" aria-label={label}>
      <button type="button" className="stepper__btn" aria-label={decreaseLabel} onClick={() => set(value - step)} disabled={value <= min}>
        <Minus size={26} strokeWidth={1.5} aria-hidden />
      </button>
      <div>
        <output key={bump} className={cx('stepper__value', bump > 0 && 'is-bumped')} aria-live="polite" aria-atomic="true">
          {format ? format(value) : value}
        </output>
        {unit && <span className="stepper__unit" style={{ textAlign: 'center' }}>{unit}</span>}
      </div>
      <button type="button" className="stepper__btn" aria-label={increaseLabel} onClick={() => set(value + step)} disabled={value >= max}>
        <Plus size={26} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}
