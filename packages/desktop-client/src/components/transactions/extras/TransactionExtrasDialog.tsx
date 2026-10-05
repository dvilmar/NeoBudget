import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { AttachmentsPanel } from './AttachmentsPanel';
import { ForeignAmountPanel } from './ForeignAmountPanel';
import { LinksPanel } from './LinksPanel';

export type ExtrasKind = 'foreign' | 'links' | 'attachments';

type TransactionExtrasDialogProps = {
  kind: ExtrasKind;
  transactionIds: string[];
  // Sign of the first selected transaction
  sign: 1 | -1;
  onClose: () => void;
};

export function TransactionExtrasDialog({
  kind,
  transactionIds,
  sign,
  onClose,
}: TransactionExtrasDialogProps) {
  const { t } = useTranslation();
  const [first] = transactionIds;

  return (
    <View
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: theme.overlayBackground,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <View
        style={{
          width: 560,
          maxWidth: '92vw',
          maxHeight: '85vh',
          overflow: 'auto',
          gap: 16,
          padding: 24,
          borderRadius: 12,
          backgroundColor: theme.modalBackground,
          border: `1px solid ${theme.menuBorder}`,
        }}
        onClick={event => event.stopPropagation()}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: 600 }}>
            {kind === 'foreign' && <Trans>Foreign amount</Trans>}
            {kind === 'links' && <Trans>Linked transactions</Trans>}
            {kind === 'attachments' && <Trans>Attachments</Trans>}
          </Text>
          <Button variant="bare" aria-label={t('Close')} onPress={onClose}>
            ✕
          </Button>
        </View>
        {kind === 'foreign' && (
          <ForeignAmountPanel transactionId={first} sign={sign} />
        )}
        {kind === 'links' && <LinksPanel transactionIds={transactionIds} />}
        {kind === 'attachments' && <AttachmentsPanel transactionId={first} />}
      </View>
    </View>
  );
}
