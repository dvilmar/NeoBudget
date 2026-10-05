import type { ReactNode } from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

type FormFieldProps = {
  label: string;
  width?: number;
  children: ReactNode;
};

export function FormField({ label, width = 140, children }: FormFieldProps) {
  return (
    <View style={{ width, gap: 4 }}>
      <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
        {label}
      </Text>
      {children}
    </View>
  );
}
