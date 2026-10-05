import { Stat } from '#components/overview/Stat';
import { useSheetValue } from '#hooks/useSheetValue';
import type { Binding } from '#spreadsheet';

type Field = 'to-budget' | 'total-budgeted' | 'total-spent';

export function MonthStat({
  label,
  field,
  money,
  note,
}: {
  label: string;
  field: Field;
  money: (cents: number) => string;
  note?: string;
}) {
  const value = useSheetValue<'envelope-budget', Field>(
    field as Binding<'envelope-budget', Field>,
  );

  return (
    <Stat
      label={label}
      value={money(
        field === 'total-budgeted' ? Math.abs(value ?? 0) : (value ?? 0),
      )}
      note={note}
    />
  );
}
