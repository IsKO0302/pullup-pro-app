import { ChevronRight } from 'lucide-react';
import { useI18n } from '../../app/i18n';
import { useThoughtOfDay } from '../thoughts/daily';

/** One short quote at the bottom of TODAY; opens it in THOUGHTS. */
export function ThoughtOfDay() {
  const { t, lang } = useI18n();
  const thought = useThoughtOfDay();
  return (
    <a className="today-thought" href={`#/thoughts/${encodeURIComponent(thought.id)}`} data-thought-id={thought.id}>
      <span className="today-thought__label t-eyebrow">
        {t('thoughts.ofDay')}
        <ChevronRight size={16} strokeWidth={1.5} aria-hidden />
      </span>
      <span className="today-thought__text">{thought.text[lang]}</span>
    </a>
  );
}
