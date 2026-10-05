import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

type MonthSwitcherProps = {
  month: string;
  onChange: (month: string) => void;
};

export function MonthSwitcher({ month, onChange }: MonthSwitcherProps) {
  const { t } = useTranslation();

  return (
    <View style={{ flexDirection: 'row', gap: 8, flexShrink: 0 }}>
      <Button
        style={{ height: 32 }}
        aria-label={t('Previous month')}
        onPress={() => onChange(monthUtils.prevMonth(month))}
      >
        ‹
      </Button>
      <Button
        style={{ height: 32 }}
        onPress={() => onChange(monthUtils.currentMonth())}
      >
        <Trans>Today</Trans>
      </Button>
      <Button
        style={{ height: 32 }}
        aria-label={t('Next month')}
        onPress={() => onChange(monthUtils.nextMonth(month))}
      >
        ›
      </Button>
    </View>
  );
}
