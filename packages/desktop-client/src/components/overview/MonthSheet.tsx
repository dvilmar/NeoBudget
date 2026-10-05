import type { ReactNode } from 'react';

import * as monthUtils from '@actual-app/core/shared/months';

import { SheetNameProvider } from '#hooks/useSheetName';

export function MonthSheet({
  month,
  ready,
  children,
}: {
  month: string;
  ready: boolean;
  children: ReactNode;
}) {
  if (!ready) {
    return null;
  }
  return (
    <SheetNameProvider name={monthUtils.sheetForMonth(month)}>
      {children}
    </SheetNameProvider>
  );
}
