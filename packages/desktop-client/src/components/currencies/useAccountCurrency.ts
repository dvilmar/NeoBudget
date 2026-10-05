import { send } from '@actual-app/core/platform/client/connection';
import { useQuery } from '@tanstack/react-query';

export function useAccountCurrency(accountId: string | undefined) {
  const { data = {} } = useQuery({
    queryKey: ['currencies', 'accounts'],
    queryFn: () => send('account-currencies-get'),
  });
  return (accountId ? data[accountId] : null) ?? null;
}
