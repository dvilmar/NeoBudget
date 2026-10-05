import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAccounts } from '#hooks/useAccounts';

import { toErrorMessage } from './format';
import { FormField } from './FormField';
import { TradeRepublicPanel } from './TradeRepublicPanel';

const brokersQueryKey = ['investment-brokers'] as const;

type BrokersPanelProps = {
  onImported: () => void;
};

export function BrokersPanel({ onImported }: BrokersPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useAccounts();
  const { data: status } = useQuery({
    queryKey: brokersQueryKey,
    queryFn: () => send('investment-brokers-status'),
  });

  const [token, setToken] = useState('');
  const [queryId, setQueryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const isConfigured = status?.ibkr.configured ?? false;

  function report(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  async function onSaveCredentials() {
    setIsBusy(true);
    try {
      for (const [name, value] of [
        ['ibkr_flexToken', token.trim()],
        ['ibkr_flexQueryId', queryId.trim()],
      ]) {
        const answer = await send('secret-set', { name, value });
        if (answer && 'error' in answer && answer.error) {
          report(String(answer.error), true);
          return;
        }
      }
      setToken('');
      setQueryId('');
      report(t('Credentials saved on the server.'));
      void queryClient.invalidateQueries({ queryKey: brokersQueryKey });
    } catch (error) {
      report(toErrorMessage(error), true);
    } finally {
      setIsBusy(false);
    }
  }

  async function onImport() {
    setIsBusy(true);
    setMessage(null);
    try {
      const result = await send('investment-broker-sync', {
        broker: 'ibkr',
        accountId: accountId || null,
      });
      if (result.error) {
        report(result.error, true);
        return;
      }

      const skipped = Object.entries(result.skipped)
        .map(([kind, count]) => `${kind}: ${count}`)
        .join(', ');
      report(
        t(
          'New trades: {{imported}}. Already imported: {{duplicates}}. New assets: {{assetsCreated}}.',
          result,
        ) + (skipped ? ' ' + t('Left out: {{skipped}}.', { skipped }) : ''),
      );
      onImported();
    } catch (error) {
      report(toErrorMessage(error), true);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 16, fontWeight: 600 }}>
        <Trans>Interactive Brokers</Trans>
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          gap: 12,
        }}
      >
        <FormField label={t('Flex Web Service token')} width={220}>
          <Input
            type="password"
            value={token}
            onChangeValue={setToken}
            placeholder={isConfigured ? t('Saved') : ''}
          />
        </FormField>
        <FormField label={t('Flex Query id')} width={130}>
          <Input
            value={queryId}
            onChangeValue={setQueryId}
            placeholder={isConfigured ? t('Saved') : ''}
          />
        </FormField>
        <Button
          isDisabled={isBusy || token.trim() === '' || queryId.trim() === ''}
          onPress={onSaveCredentials}
        >
          <Trans>Save credentials</Trans>
        </Button>
        <View style={{ flex: 1 }} />
        <FormField label={t('Import into account')} width={200}>
          <Select
            value={accountId}
            onChange={setAccountId}
            options={[
              ['', t('No account')] as const,
              ...accounts
                .filter(account => !account.closed)
                .map(account => [account.id, account.name] as const),
            ]}
          />
        </FormField>
        <Button
          variant="primary"
          isDisabled={isBusy || !isConfigured}
          onPress={onImport}
        >
          {isBusy ? <Trans>Working…</Trans> : <Trans>Import trades</Trans>}
        </Button>
      </View>
      {message && (
        <Text style={{ color: isError ? theme.errorText : theme.pageText }}>
          {message}
        </Text>
      )}
      <View
        style={{ borderTop: `1px solid ${theme.tableBorder}`, paddingTop: 12 }}
      >
        <TradeRepublicPanel
          isAvailable={status != null}
          onImported={onImported}
        />
      </View>
    </View>
  );
}
