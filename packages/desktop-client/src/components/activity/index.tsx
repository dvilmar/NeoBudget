import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { useQuery } from '@tanstack/react-query';

import { monoFont } from '#components/overview/monoFont';
import { rowStyle } from '#components/overview/rowStyle';
import { Section } from '#components/overview/Section';
import { Page } from '#components/Page';

export function Activity() {
  const { t } = useTranslation();
  const { data: log = [] } = useQuery({
    queryKey: ['audit-log'],
    queryFn: () => send('audit-log-get', { limit: 200 }),
  });

  return (
    <Page header={t('Activity')}>
      <View style={{ gap: 28, paddingBottom: 40, maxWidth: 1100 }}>
        <Text style={{ color: theme.pageTextSubdued }}>
          <Trans>
            What changed in piggy banks, debts, currencies, subscriptions and in
            the extras of transactions.
          </Trans>
        </Text>
        <Section title={t('Latest changes')}>
          {log.length === 0 ? (
            <View style={rowStyle}>
              <Text style={{ color: theme.pageTextSubdued }}>
                <Trans>Nothing yet.</Trans>
              </Text>
            </View>
          ) : (
            log.map(entry => (
              <View key={entry.id} style={rowStyle}>
                <Text
                  style={{
                    width: 170,
                    fontFamily: monoFont,
                    fontSize: 12,
                    color: theme.pageTextSubdued,
                  }}
                >
                  {entry.at.slice(0, 16).replace('T', ' ')}
                </Text>
                <Text style={{ width: 110, color: theme.pageTextLight }}>
                  {entry.entity}
                </Text>
                <Text style={{ flex: 1 }}>{entry.summary}</Text>
              </View>
            ))
          )}
        </Section>
      </View>
    </Page>
  );
}
