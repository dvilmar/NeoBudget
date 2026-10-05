import { useState } from 'react';

import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { useBudgetActions } from '#budget/mutations';
import { FinancialText } from '#components/FinancialText';
import { parseDecimal } from '#components/investments/format';
import { monoFont } from '#components/overview/monoFont';
import { rowStyle } from '#components/overview/rowStyle';
import { useSheetValue } from '#hooks/useSheetValue';
import type { Binding } from '#spreadsheet';
import { envelopeBudget } from '#spreadsheet/bindings';

type CategoryRowProps = {
  category: CategoryEntity;
  month: string;
  money: (cents: number) => string;
};

const numberStyle = {
  flex: 1,
  textAlign: 'right',
  fontFamily: monoFont,
} as const;

export function CategoryRow({ category, month, money }: CategoryRowProps) {
  const applyBudgetAction = useBudgetActions();
  const [draft, setDraft] = useState<string | null>(null);

  const budgeted =
    useSheetValue<'envelope-budget', 'budget'>(
      envelopeBudget.catBudgeted(category.id) as Binding<
        'envelope-budget',
        'budget'
      >,
    ) ?? 0;
  const spent =
    useSheetValue<'envelope-budget', 'sum-amount'>(
      envelopeBudget.catSumAmount(category.id) as Binding<
        'envelope-budget',
        'sum-amount'
      >,
    ) ?? 0;
  const balance =
    useSheetValue<'envelope-budget', 'leftover'>(
      envelopeBudget.catBalance(category.id) as Binding<
        'envelope-budget',
        'leftover'
      >,
    ) ?? 0;

  function commit(text: string) {
    setDraft(null);
    const value = parseDecimal(text);
    if (value == null) {
      return;
    }
    const amount = Math.round(value * 100);
    if (amount !== budgeted) {
      applyBudgetAction.mutate({
        month,
        type: 'budget-amount',
        args: { category: category.id, amount },
      });
    }
  }

  return (
    <View style={rowStyle}>
      <Text style={{ flex: 2 }}>{category.name}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Input
          value={draft ?? (budgeted / 100).toFixed(2)}
          onFocus={() => setDraft((budgeted / 100).toFixed(2))}
          onChangeValue={setDraft}
          onUpdate={commit}
          style={{
            ...numberStyle,
            width: 110,
            border: '1px solid transparent',
            backgroundColor: 'transparent',
            padding: '4px 6px',
          }}
        />
      </View>
      <FinancialText style={{ ...numberStyle, color: theme.pageTextLight }}>
        {money(spent)}
      </FinancialText>
      <FinancialText
        style={{
          ...numberStyle,
          fontWeight: 500,
          color: balance < 0 ? theme.errorText : undefined,
        }}
      >
        {money(balance)}
      </FinancialText>
    </View>
  );
}
