import { useState } from 'react';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { CategoryGroupEntity } from '@actual-app/core/types/models';

import { rowStyle } from '#components/overview/rowStyle';

import { CategoryRow } from './CategoryRow';

type GroupRowsProps = {
  group: CategoryGroupEntity;
  month: string;
  money: (cents: number) => string;
};

export function GroupRows({ group, month, money }: GroupRowsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const categories = (group.categories ?? []).filter(
    category => !category.hidden,
  );

  if (categories.length === 0) {
    return null;
  }

  return (
    <View>
      <View
        style={{
          ...rowStyle,
          backgroundColor: theme.tableRowHeaderBackground,
          padding: '8px 25px',
        }}
      >
        <Button
          variant="bare"
          aria-label={group.name}
          onPress={() => setIsOpen(!isOpen)}
          style={{ fontWeight: 600, padding: 0 }}
        >
          <Text>
            {isOpen ? '▾' : '▸'} {group.name}
          </Text>
        </Button>
      </View>
      {isOpen &&
        categories.map(category => (
          <CategoryRow
            key={category.id}
            category={category}
            month={month}
            money={money}
          />
        ))}
    </View>
  );
}
