import type { ReactNode } from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { border } from './border';

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 10, flexShrink: 0 }}>
      <Text style={{ fontSize: 13, fontWeight: 600 }}>{title}</Text>
      <View
        style={{
          border,
          borderRadius: 8,
          backgroundColor: theme.cardBackground,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {children}
      </View>
    </View>
  );
}
