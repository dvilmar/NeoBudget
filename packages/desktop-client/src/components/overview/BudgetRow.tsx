import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { FinancialText } from '#components/FinancialText';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPref } from '#hooks/useSyncedPref';
import type { Binding } from '#spreadsheet';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import { monoFont } from './monoFont';
import { rowStyle } from './rowStyle';

export function BudgetRow({
  category,
  money,
}: {
  category: CategoryEntity;
  money: (cents: number | null | undefined) => string;
}) {
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const isTracking = budgetType === 'tracking';

  const budgeted = useSheetValue<'envelope-budget', 'budget'>(
    (isTracking
      ? trackingBudget.catBudgeted(category.id)
      : envelopeBudget.catBudgeted(category.id)) as Binding<
      'envelope-budget',
      'budget'
    >,
  );
  const spent = useSheetValue<'envelope-budget', 'sum-amount'>(
    (isTracking
      ? trackingBudget.catSumAmount(category.id)
      : envelopeBudget.catSumAmount(category.id)) as Binding<
      'envelope-budget',
      'sum-amount'
    >,
  );
  const balance = useSheetValue<'envelope-budget', 'leftover'>(
    (isTracking
      ? trackingBudget.catBalance(category.id)
      : envelopeBudget.catBalance(category.id)) as Binding<
      'envelope-budget',
      'leftover'
    >,
  );

  const numberStyle = {
    flex: 1,
    textAlign: 'right',
    fontFamily: monoFont,
  } as const;
  return (
    <View style={rowStyle}>
      <Text style={{ flex: 2 }}>{category.name}</Text>
      <FinancialText style={{ ...numberStyle, color: theme.pageTextLight }}>
        {money(budgeted)}
      </FinancialText>
      <FinancialText style={{ ...numberStyle, color: theme.pageTextLight }}>
        {money(spent)}
      </FinancialText>
      <FinancialText
        style={{
          ...numberStyle,
          fontWeight: 500,
          color: balance != null && balance < 0 ? theme.errorText : undefined,
        }}
      >
        {money(balance)}
      </FinancialText>
    </View>
  );
}
