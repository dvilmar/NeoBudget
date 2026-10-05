import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { prewarmMonth } from '#components/budget/util';
import { formatMoney } from '#components/investments/format';
import { border } from '#components/overview/border';
import { MonthSwitcher } from '#components/overview/MonthSwitcher';
import { rowStyle } from '#components/overview/rowStyle';
import { Page } from '#components/Page';
import { useCategories } from '#hooks/useCategories';
import { useLanguage } from '#hooks/useLocale';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useSpreadsheet } from '#hooks/useSpreadsheet';
import { useSyncedPref } from '#hooks/useSyncedPref';

import { GroupRows } from './GroupRows';
import { MonthStat } from './MonthStat';

export function NeoBudget() {
  const { t } = useTranslation();
  const language = useLanguage();
  const spreadsheet = useSpreadsheet();
  const [defaultCurrencyCode] = useSyncedPref('defaultCurrencyCode');
  const currency = defaultCurrencyCode || 'EUR';

  const [month, setMonth] = useState(monthUtils.currentMonth());
  const [readyMonth, setReadyMonth] = useState<string | null>(null);
  const { data: { grouped: groups } = { grouped: [] } } = useCategories();

  // The month has to be in the spreadsheet before its cells can be read
  useEffect(() => {
    let isCurrent = true;
    void prewarmMonth('envelope', spreadsheet, month).then(() => {
      if (isCurrent) {
        setReadyMonth(month);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [month, spreadsheet]);

  const money = (cents: number) => formatMoney(cents / 100, currency, language);
  const title = new Intl.DateTimeFormat(language, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${month}-01T12:00:00`));

  const headerStyle = { flex: 1, textAlign: 'right' } as const;

  return (
    <Page header={title}>
      <View style={{ gap: 28, paddingBottom: 40, maxWidth: 1100 }}>
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'flex-end',
            flexShrink: 0,
          }}
        >
          <MonthSwitcher month={month} onChange={setMonth} />
        </View>

        {readyMonth === month && (
          <SheetNameProvider name={monthUtils.sheetForMonth(month)}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                flexShrink: 0,
                border,
                borderRadius: 8,
                backgroundColor: theme.cardBackground,
              }}
            >
              <MonthStat
                label={t('To budget')}
                field="to-budget"
                money={money}
              />
              <MonthStat
                label={t('Budgeted')}
                field="total-budgeted"
                money={money}
              />
              <MonthStat label={t('Spent')} field="total-spent" money={money} />
            </View>

            <View
              style={{
                border,
                borderRadius: 8,
                backgroundColor: theme.cardBackground,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <View
                style={{
                  ...rowStyle,
                  color: theme.pageTextSubdued,
                  fontSize: 12,
                }}
              >
                <Text style={{ flex: 2 }}>
                  <Trans>Category</Trans>
                </Text>
                <Text style={headerStyle}>
                  <Trans>Budgeted</Trans>
                </Text>
                <Text style={headerStyle}>
                  <Trans>Spent</Trans>
                </Text>
                <Text style={headerStyle}>
                  <Trans>Available</Trans>
                </Text>
              </View>
              {groups
                .filter(group => !group.is_income && !group.hidden)
                .map(group => (
                  <GroupRows
                    key={group.id}
                    group={group}
                    month={month}
                    money={money}
                  />
                ))}
            </View>
          </SheetNameProvider>
        )}
      </View>
    </Page>
  );
}
