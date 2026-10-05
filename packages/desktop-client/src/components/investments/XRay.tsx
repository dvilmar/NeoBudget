import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { xray } from '@actual-app/core/shared/xray';
import type { XRayFinding } from '@actual-app/core/shared/xray';
import type { InvestmentPositionEntity } from '@actual-app/core/types/models';

import { monoFont } from '#components/overview/monoFont';
import { rowStyle } from '#components/overview/rowStyle';
import { Section } from '#components/overview/Section';

export function XRay({ positions }: { positions: InvestmentPositionEntity[] }) {
  const { t } = useTranslation();
  const findings = xray(
    positions.map(position => ({
      name: position.asset.name,
      type: position.asset.type,
      currency: position.asset.currency,
      value: position.base?.marketValue ?? 0,
    })),
  );

  if (findings.length === 0) {
    return null;
  }

  const label = (finding: XRayFinding) => {
    const value = finding.value.toFixed(
      finding.rule === 'diversification' ? 0 : 1,
    );
    switch (finding.rule) {
      case 'top-holding':
        return t(
          'Biggest holding ({{name}}): {{value}} %, keep it under 25 %',
          {
            name: finding.subject,
            value,
          },
        );
      case 'currency':
        return t('Main currency ({{name}}): {{value}} %, keep it under 80 %', {
          name: finding.subject,
          value,
        });
      case 'crypto':
        return t('Crypto: {{value}} %, keep it under 20 %', { value });
      default:
        return t('{{value}} holdings, at least 3 recommended', { value });
    }
  };

  return (
    <Section title={t('Risk check')}>
      {findings.map(finding => (
        <View key={finding.rule} style={rowStyle}>
          <Text style={{ flex: 1 }}>{label(finding)}</Text>
          <Text
            style={{
              fontFamily: monoFont,
              color: finding.ok ? theme.noticeTextLight : theme.errorText,
            }}
          >
            {finding.ok ? <Trans>OK</Trans> : <Trans>Review</Trans>}
          </Text>
        </View>
      ))}
    </Section>
  );
}
