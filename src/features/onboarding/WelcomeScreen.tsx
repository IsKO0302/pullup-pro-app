import { useI18n } from '../../app/i18n';
import { Button, cx } from '../../ui';
import './onboarding.css';

/** Isa's welcome: typographic, lines fade in one after another. */
export function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  const { t } = useI18n();
  const lines = t('welcome.text').split('\n');
  return (
    <main className="welcome">
      <h1 className="visually-hidden">{t('welcome.label')}</h1>
      <div className="welcome__text">
        {lines.map((line, i) => (
          <p
            key={`${i}-${line}`}
            className={cx('welcome__line', line === 'YOU VS. YOU.' && 'welcome__line--motto')}
            style={{ animationDelay: `${250 + i * 620}ms` }}
          >
            {line}
          </p>
        ))}
      </div>
      <div className="welcome__foot">
        <Button variant="primary" size="xl" block className="welcome__cta" onClick={onContinue}>
          {t('common.continue')}
        </Button>
      </div>
    </main>
  );
}
