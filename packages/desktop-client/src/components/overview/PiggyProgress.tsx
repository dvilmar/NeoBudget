import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { useQuery } from '@tanstack/react-query';

import { monoFont } from './monoFont';
import { rowStyle } from './rowStyle';
import { Section } from './Section';

export function PiggyProgress({ money }: { money: (cents: number) => string }) {
  const { t } = useTranslation();
  const { data: piggies = [] } = useQuery({
    queryKey: ['piggy-banks'],
    queryFn: () => send('piggy-banks-get'),
  });

  return (
    <Section title={t('Piggy banks')}>
      {piggies.length === 0 ? (
        <View style={rowStyle}>
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>No piggy banks yet.</Trans>
          </Text>
        </View>
      ) : (
        piggies.slice(0, 5).map(piggy => (
          <View
            key={piggy.id}
            style={{ ...rowStyle, gap: 8, display: 'block' }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <Text>{piggy.name}</Text>
              <Text style={{ fontFamily: monoFont, fontSize: 13 }}>
                {money(piggy.saved)} / {money(piggy.target_amount)}
              </Text>
            </View>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: theme.pillBackground,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: 6,
                  width: `${piggy.percent ?? 0}%`,
                  backgroundColor: theme.buttonPrimaryBackground,
                }}
              />
            </View>
          </View>
        ))
      )}
    </Section>
  );
}
