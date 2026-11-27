import { useTheme } from '@/app/providers/theme-context';
import { PageHeader, Radio, ScreenContainer } from '@/design-system/ui';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import './Settings.css';
import { SETTINGS_COPY } from './settingsContent';
import { useBackToHub } from './useBackToHub';

const COPY = SETTINGS_COPY.appearance;

/** Settings > Appearance (master 6.6): System, Light or Dark. Applies at once. */
export function SettingsAppearancePage() {
  useDocumentTitle(COPY.title);
  const back = useBackToHub();
  const { preference, setPreference } = useTheme();

  return (
    <ScreenContainer
      placement="top"
      className="set-screen--left"
      bar={<PageHeader title={COPY.title} onBack={back} />}
    >
      <div role="radiogroup" aria-label={COPY.title} className="set__stack set__stack--tight">
        {COPY.options.map((option) => (
          <Radio
            key={option.value}
            name="appearance"
            label={SETTINGS_COPY.theme[option.value]}
            hint={option.hint}
            checked={preference === option.value}
            onChange={() => {
              setPreference(option.value);
            }}
          />
        ))}
      </div>
    </ScreenContainer>
  );
}
