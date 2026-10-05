import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { toErrorMessage } from '#components/investments/format';

type AttachmentsPanelProps = {
  transactionId: string;
};

// Reads a file as base64 without the "data:...;base64," prefix
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AttachmentsPanel({ transactionId }: AttachmentsPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['tx-attachments', transactionId];

  const { data: attachments = [] } = useQuery({
    queryKey,
    queryFn: () => send('tx-attachments-get', { transactionId }),
  });
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      await send('tx-attachment-add', {
        transactionId,
        name: file.name,
        mime: file.type || 'application/octet-stream',
        data: await readAsBase64(file),
      });
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['tx-extras-summary'] });
    } catch (failure) {
      setError(toErrorMessage(failure));
    } finally {
      setIsBusy(false);
    }
  }

  async function onDownload(id: string) {
    try {
      const file = await send('tx-attachment-read', { id });
      const link = document.createElement('a');
      link.href = `data:${file.mime ?? 'application/octet-stream'};base64,${file.data}`;
      link.download = file.name;
      link.click();
    } catch (failure) {
      setError(toErrorMessage(failure));
    }
  }

  async function onDelete(id: string) {
    await send('tx-attachment-delete', { id });
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({ queryKey: ['tx-extras-summary'] });
  }

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: theme.pageTextSubdued }}>
        <Trans>
          Files are kept in your sync server, up to 8 MB each. A sync server is
          needed.
        </Trans>
      </Text>
      <input
        type="file"
        aria-label={t('Attach a file')}
        disabled={isBusy}
        onChange={onFile}
      />
      {error && <Text style={{ color: theme.errorText }}>{error}</Text>}
      {attachments.map(attachment => (
        <View
          key={attachment.id}
          style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
        >
          <Text style={{ flex: 1 }}>
            {attachment.name}
            {attachment.size != null &&
              ` (${Math.max(Math.round(attachment.size / 1024), 1)} KB)`}
          </Text>
          <Button onPress={() => onDownload(attachment.id)}>
            <Trans>Download</Trans>
          </Button>
          <Button variant="bare" onPress={() => onDelete(attachment.id)}>
            <Trans>Delete</Trans>
          </Button>
        </View>
      ))}
    </View>
  );
}
