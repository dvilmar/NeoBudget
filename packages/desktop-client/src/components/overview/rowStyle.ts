import { theme } from '@actual-app/components/theme';

export const rowStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  padding: '16px 25px',
  borderBottom: `1px solid ${theme.tableBorder}`,
  fontSize: 14,
} as const;
