import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { TransactionLinkType } from '@actual-app/core/types/models';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { toErrorMessage } from '#components/investments/format';

type LinksPanelProps = {
  // The first one is linked to each of the others
  transactionIds: string[];
};

export function LinksPanel({ transactionIds }: LinksPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [first, ...others] = transactionIds;
  const queryKey = ['tx-links', first];

  const { data: links = [] } = useQuery({
    queryKey,
    queryFn: () => send('tx-links-get', { transactionId: first }),
  });
  const [type, setType] = useState<TransactionLinkType>('relates');
  const [error, setError] = useState<string | null>(null);

  async function onLink() {
    try {
      for (const other of others) {
        await send('tx-link-create', { a: first, b: other, type });
      }
      setError(null);
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['tx-extras-summary'] });
    } catch (failure) {
      setError(toErrorMessage(failure));
    }
  }

  async function onUnlink(id: string) {
    await send('tx-link-delete', { id });
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({ queryKey: ['tx-extras-summary'] });
  }

  return (
    <View style={{ gap: 12 }}>
      {others.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Select
            value={type}
            onChange={setType}
            options={[
              ['relates', t('Relates to')],
              ['refund', t('Is a refund of')],
              ['paid_by', t('Was paid by')],
              ['reimbursed', t('Was reimbursed by')],
            ]}
          />
          <Button variant="primary" onPress={onLink}>
            <Trans>Link {{ count: others.length }} to the first</Trans>
          </Button>
        </View>
      )}
      {error && <Text style={{ color: theme.errorText }}>{error}</Text>}
      {links.length === 0 ? (
        <Text style={{ color: theme.pageTextSubdued }}>
          <Trans>This transaction has no links yet.</Trans>
        </Text>
      ) : (
        links.map(link => (
          <View
            key={link.id}
            style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
          >
            <Text style={{ flex: 1 }}>
              {link.link_type} · {link.other?.date ?? '?'} ·{' '}
              {link.other ? (link.other.amount / 100).toFixed(2) : '?'}{' '}
              {link.other?.notes ?? ''}
            </Text>
            <Button variant="bare" onPress={() => onUnlink(link.id)}>
              <Trans>Unlink</Trans>
            </Button>
          </View>
        ))
      )}
    </View>
  );
}
