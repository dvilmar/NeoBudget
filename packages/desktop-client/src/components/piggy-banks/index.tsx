import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { formatMoney } from '#components/investments/format';
import { border } from '#components/overview/border';
import { Section } from '#components/overview/Section';
import { Stat } from '#components/overview/Stat';
import { Page } from '#components/Page';
import { useLanguage } from '#hooks/useLocale';
import { useSyncedPref } from '#hooks/useSyncedPref';

import { PiggyBankForm } from './PiggyBankForm';
import { PiggyBankRow } from './PiggyBankRow';

export const piggyBanksQueryKey = ['piggy-banks'] as const;

export function PiggyBanks() {
  const { t } = useTranslation();
  const language = useLanguage();
  const queryClient = useQueryClient();
  const [defaultCurrencyCode] = useSyncedPref('defaultCurrencyCode');
  const currency = defaultCurrencyCode || 'EUR';

  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data: piggies = [] } = useQuery({
    queryKey: piggyBanksQueryKey,
    queryFn: () => send('piggy-banks-get'),
  });

  const money = (cents: number) => formatMoney(cents / 100, currency, language);
  const saved = piggies.reduce((sum, piggy) => sum + piggy.saved, 0);
  const target = piggies.reduce((sum, piggy) => sum + piggy.target_amount, 0);

  function reload() {
    setMessage(null);
    void queryClient.invalidateQueries({ queryKey: piggyBanksQueryKey });
  }

  return (
    <Page header={t('Piggy banks')}>
      <View style={{ gap: 28, paddingBottom: 40, maxWidth: 1100 }}>
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
          <Stat first label={t('Saved')} value={money(saved)} />
          <Stat label={t('Target')} value={money(target)} />
          <Stat label={t('Piggy banks')} value={String(piggies.length)} />
        </View>

        <View style={{ flexDirection: 'row', flexShrink: 0 }}>
          <Button variant="primary" onPress={() => setIsAdding(!isAdding)}>
            <Trans>New piggy bank</Trans>
          </Button>
        </View>

        {message && <Text style={{ color: theme.errorText }}>{message}</Text>}
        {isAdding && (
          <PiggyBankForm
            onDone={() => {
              setIsAdding(false);
              reload();
            }}
            onError={setMessage}
          />
        )}

        {piggies.length === 0 ? (
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>
              No piggy banks yet. Create one for something you are saving for.
            </Trans>
          </Text>
        ) : (
          <>
            {[...new Set(piggies.map(piggy => piggy.group_name ?? ''))]
              .sort()
              .map(group => (
                <Section key={group} title={group || t('Piggy banks')}>
                  {piggies
                    .filter(piggy => (piggy.group_name ?? '') === group)
                    .map(piggy => (
                      <PiggyBankRow
                        key={piggy.id}
                        piggy={piggy}
                        money={money}
                        onChanged={reload}
                        onError={setMessage}
                      />
                    ))}
                </Section>
              ))}
          </>
        )}
      </View>
    </Page>
  );
}
