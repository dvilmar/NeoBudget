import type { ReactNode } from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { FinancialText } from '#components/FinancialText';

import { border } from './border';
import { monoFont } from './monoFont';

export function Stat({
  label,
  value,
  note,
  noteColor,
  children,
  first,
}: {
  label: string;
  value: string;
  note?: string;
  noteColor?: string;
  children?: ReactNode;
  first?: boolean;
}) {
  return (
    <View
      style={{
        flex: '1 1 0',
        minWidth: 200,
        padding: '18px 20px',
        gap: 6,
        borderLeft: first ? undefined : border,
      }}
    >
      <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
        {label}
      </Text>
      <FinancialText
        style={{ fontSize: 24, fontWeight: 500, fontFamily: monoFont }}
      >
        {value}
      </FinancialText>
      {children}
      {note && (
        <Text
          style={{ fontSize: 13, color: noteColor ?? theme.pageTextSubdued }}
        >
          {note}
        </Text>
      )}
    </View>
  );
}
