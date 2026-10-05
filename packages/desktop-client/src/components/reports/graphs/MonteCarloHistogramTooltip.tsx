import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { css } from '@emotion/css';

type PayloadItem = {
  payload: {
    year: number;
    age: number;
    count: number;
  };
};

type MonteCarloHistogramTooltipProps = {
  active?: boolean;
  payload?: PayloadItem[];
  simulationCount: number;
};

export function MonteCarloHistogramTooltip({
  active,
  payload,
  simulationCount,
}: MonteCarloHistogramTooltipProps) {
  const { t } = useTranslation();

  if (active && payload && payload.length) {
    const point = payload[0].payload;
    return (
      <div
        className={css({
          zIndex: 1000,
          pointerEvents: 'none',
          borderRadius: 6,
          border: '1px solid ' + theme.cardBorder,
          boxShadow: 'none',
          backgroundColor: theme.menuBackground,
          color: theme.menuItemText,
          padding: 10,
        })}
      >
        {t(
          '{{failedCount}} of {{total}} scenarios ran out of money at age {{age}}',
          {
            failedCount: point.count,
            total: simulationCount,
            age: point.age,
          },
        )}
      </div>
    );
  }
  return null;
}
