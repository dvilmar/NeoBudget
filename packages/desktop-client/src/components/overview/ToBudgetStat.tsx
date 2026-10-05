import { useTranslation } from 'react-i18next';

import { useSheetValue } from '#hooks/useSheetValue';
import type { Binding } from '#spreadsheet';
import { envelopeBudget } from '#spreadsheet/bindings';

import { Stat } from './Stat';

export function ToBudgetStat({
  money,
}: {
  money: (cents: number | null | undefined) => string;
}) {
  const { t } = useTranslation();
  const toBudget = useSheetValue<'envelope-budget', 'to-budget'>(
    envelopeBudget.toBudget as Binding<'envelope-budget', 'to-budget'>,
  );

  return (
    <Stat
      label={t('To budget')}
      value={money(toBudget)}
      note={t('Income not yet assigned')}
    />
  );
}
