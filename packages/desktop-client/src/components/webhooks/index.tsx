import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { toErrorMessage } from '#components/investments/format';
import { rowStyle } from '#components/overview/rowStyle';
import { Section } from '#components/overview/Section';
import { Page } from '#components/Page';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';

const queryKey = ['webhooks'] as const;

export function Webhooks() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const hasServer = useSyncServerStatus() !== 'no-server';

  const [url, setUrl] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const { data: webhooks = [] } = useQuery({
    queryKey,
    queryFn: () => send('webhooks-list'),
    enabled: hasServer,
    retry: false,
  });

  async function run(action: () => Promise<unknown>) {
    try {
      setMessage(null);
      await action();
    } catch (error) {
      setMessage(toErrorMessage(error));
    }
    await queryClient.invalidateQueries({ queryKey });
  }

  async function onTest() {
    await run(async () => {
      const results = await send('webhooks-fire', { event: 'test' });
      const failed = results.filter(result => !result.ok);
      setMessage(
        failed.length === 0
          ? t('Sent to {{count}} webhooks.', { count: results.length })
          : t('{{count}} webhooks failed.', { count: failed.length }),
      );
    });
  }

  return (
    <Page header={t('Webhooks')}>
      <View style={{ gap: 28, paddingBottom: 40, maxWidth: 1100 }}>
        <Text style={{ color: theme.pageTextSubdued }}>
          <Trans>
            A webhook is an address that receives a message when your
            transactions change, for example to trigger an automation. The
            message is sent by your sync server while the app is open.
          </Trans>
        </Text>

        {!hasServer ? (
          <Text style={{ color: theme.errorText }}>
            <Trans>Webhooks need a sync server.</Trans>
          </Text>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 8, flexShrink: 0 }}>
              <Input
                value={url}
                onChangeValue={setUrl}
                placeholder="https://example.com/hook"
                style={{ flex: 1 }}
              />
              <Button
                variant="primary"
                isDisabled={url.trim() === ''}
                onPress={() =>
                  run(async () => {
                    await send('webhook-create', { url: url.trim() });
                    setUrl('');
                  })
                }
              >
                <Trans>Add webhook</Trans>
              </Button>
              <Button isDisabled={webhooks.length === 0} onPress={onTest}>
                <Trans>Send a test</Trans>
              </Button>
            </View>
            {message && <Text>{message}</Text>}
            <Section title={t('Webhooks')}>
              {webhooks.length === 0 ? (
                <View style={rowStyle}>
                  <Text style={{ color: theme.pageTextSubdued }}>
                    <Trans>No webhooks yet.</Trans>
                  </Text>
                </View>
              ) : (
                webhooks.map(webhook => (
                  <View key={webhook.id} style={rowStyle}>
                    <Text style={{ flex: 1, wordBreak: 'break-all' }}>
                      {webhook.url}
                    </Text>
                    <Button
                      variant="bare"
                      onPress={() =>
                        run(() => send('webhook-delete', { id: webhook.id }))
                      }
                    >
                      <Trans>Delete</Trans>
                    </Button>
                  </View>
                ))
              )}
            </Section>
          </>
        )}
      </View>
    </Page>
  );
}
