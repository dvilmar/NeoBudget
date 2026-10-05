import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';

import { useAccounts } from '#hooks/useAccounts';

import { toErrorMessage } from './format';
import { FormField } from './FormField';

type ImportPanelProps = {
  defaultCurrency: string;
  onImported: () => void;
};

type Summary = {
  imported: number;
  duplicates: number;
  assetsCreated: number;
  rejected: { line: number; reason: string }[];
};

export function ImportPanel({ defaultCurrency, onImported }: ImportPanelProps) {
  const { t } = useTranslation();
  const { data: accounts = [] } = useAccounts();
  const [accountId, setAccountId] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setError(null);
    setSummary(null);
    try {
      const result = await send('investment-import-csv', {
        text: await file.text(),
        accountId: accountId || null,
        defaultCurrency,
      });
      setSummary(result);
      onImported();
    } catch (failure) {
      setError(toErrorMessage(failure));
    }
  }

  return (
    <View style={{ gap: 12, flexShrink: 0 }}>
      <Text style={{ color: theme.pageTextSubdued }}>
        <Trans>
          Import the trades of a CSV file. It needs the columns date, type (buy,
          sell, dividend, fee), symbol, quantity and price; fee, currency, name
          and isin are optional. Importing the same file twice adds nothing.
        </Trans>
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          gap: 12,
        }}
      >
        <FormField label={t('Account')} width={220}>
          <Select
            value={accountId}
            onChange={setAccountId}
            options={[
              ['', t('No account')],
              ...accounts
                .filter(account => !account.closed)
                .map(account => [account.id, account.name] as [string, string]),
            ]}
          />
        </FormField>
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          aria-label={t('CSV file')}
          onChange={onFile}
        />
      </View>
      {error && <Text style={{ color: theme.errorText }}>{error}</Text>}
      {summary && (
        <View style={{ gap: 4 }}>
          <Text>
            <Trans>
              Imported {{ imported: summary.imported }} trades (
              {{ duplicates: summary.duplicates }} were already there,{' '}
              {{ assets: summary.assetsCreated }} new assets).
            </Trans>
          </Text>
          {summary.rejected.slice(0, 5).map(row => (
            <Text
              key={`${row.line}-${row.reason}`}
              style={{ color: theme.errorText }}
            >
              {t('Line {{line}}: {{reason}}', {
                line: row.line,
                reason: row.reason,
              })}
            </Text>
          ))}
          {summary.rejected.length > 5 && (
            <Text style={{ color: theme.errorText }}>
              {t('{{count}} more rows were left out', {
                count: summary.rejected.length - 5,
              })}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
