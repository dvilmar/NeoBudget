import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { send } from '@actual-app/core/platform/client/connection';
import { useQuery } from '@tanstack/react-query';

import { Cell } from '#components/table';

export const extrasSummaryKey = ['tx-extras-summary'] as const;

type ExtrasCellProps = {
  // Null for rows that cannot have extras, such as new or split rows
  transactionId: string | null;
};

export function ExtrasCell({ transactionId }: ExtrasCellProps) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: extrasSummaryKey,
    queryFn: () => send('tx-extras-summary'),
    staleTime: 30000,
  });

  const parts: string[] = [];
  if (transactionId && data) {
    const fx = data.fx[transactionId];
    if (fx) {
      parts.push(`${(Math.abs(fx.amount) / 100).toFixed(2)} ${fx.currency}`);
    }
    const links = data.links[transactionId];
    if (links) {
      parts.push(t('{{count}} links', { count: links }));
    }
    const files = data.attachments[transactionId];
    if (files) {
      parts.push(t('{{count}} files', { count: files }));
    }
  }

  return (
    <Cell
      name="extras"
      width={130}
      value={parts.join(' · ')}
      valueStyle={{ fontSize: 12, color: theme.pageTextLight }}
    />
  );
}
