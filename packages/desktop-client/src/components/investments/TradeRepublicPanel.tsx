import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { TradeRepublicErrorCode } from '@actual-app/core/server/investments/brokers';

import { useAccounts } from '#hooks/useAccounts';

import { FormField } from './FormField';

type TradeRepublicPanelProps = {
  // False when there is no sync server to talk to
  isAvailable: boolean;
  onImported: () => void;
};

// The PIN lives in state only until the first request and is cleared before waiting for the answer.
export function TradeRepublicPanel({
  isAvailable,
  onImported,
}: TradeRepublicPanelProps) {
  const { t } = useTranslation();
  const { data: accounts = [] } = useAccounts();

  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [code, setCode] = useState('');
  const [processId, setProcessId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const normalizedPhone = phone.replace(/[\s-]/g, '');
  const isPhoneValid = /^\+[1-9]\d{6,14}$/.test(normalizedPhone);

  function report(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  function errorText(error: TradeRepublicErrorCode, step: 'login' | 'code') {
    switch (error) {
      case 'no-server':
        return t('A sync server is needed to connect a broker.');
      case 'invalid-input':
        return step === 'login'
          ? t(
              'Check the phone number (international format, such as +34…) and the 4-digit PIN.',
            )
          : t('Invalid code.');
      case 'login-failed':
        return t('Login failed.');
      case 'invalid-code':
        return t('Invalid code. Start again with your PIN.');
      case 'login-expired':
        return t('The code expired. Start again with your PIN.');
      case 'too-many-attempts':
        return t('Too many attempts. Try again in a few minutes.');
      default:
        return t('Trade Republic could not be reached. Try again later.');
    }
  }

  async function onSendCode() {
    // Take the PIN out of the state before anything else happens
    const sentPin = pin;
    setPin('');
    setIsBusy(true);
    setMessage(null);
    try {
      const result = await send('investment-traderepublic-login', {
        phone: normalizedPhone,
        pin: sentPin,
      });
      if ('processId' in result) {
        setProcessId(result.processId);
      } else {
        report(errorText(result.error, 'login'), true);
        return;
      }
      setCode('');
      report(t('Enter the code Trade Republic sent to your phone.'));
    } catch {
      report(errorText('unavailable', 'login'), true);
    } finally {
      setIsBusy(false);
    }
  }

  async function onImport() {
    if (!processId) {
      return;
    }
    const sentCode = code;
    setCode('');
    setIsBusy(true);
    setMessage(null);
    try {
      const result = await send('investment-traderepublic-import', {
        processId,
        code: sentCode,
        accountId: accountId || null,
      });
      if (result.error) {
        report(errorText(result.error, 'code'), true);
        return;
      }
      const skipped = Object.entries(result.skipped)
        .map(([kind, count]) => `${kind}: ${count}`)
        .join(', ');
      report(
        t('{{imported}} imported, {{duplicates}} duplicates.', result) +
          (skipped ? ' ' + t('Left out: {{skipped}}.', { skipped }) : ''),
      );
      onImported();
    } catch {
      report(errorText('unavailable', 'code'), true);
    } finally {
      // A login can only be verified once, right or wrong
      setProcessId(null);
      setIsBusy(false);
    }
  }

  function onCancel() {
    setProcessId(null);
    setCode('');
    setMessage(null);
  }

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 16, fontWeight: 600 }}>
        <Trans>Trade Republic</Trans>
      </Text>
      <Text style={{ color: theme.pageTextSubdued }}>
        <Trans>
          Unofficial connection. Your PIN is never stored; it is sent once to
          your own server over HTTPS.
        </Trans>
      </Text>
      {!isAvailable ? (
        <Text style={{ color: theme.pageTextSubdued }}>
          <Trans>A sync server is needed to connect a broker.</Trans>
        </Text>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 12,
          }}
        >
          {processId == null ? (
            <>
              <FormField label={t('Phone number')} width={180}>
                <Input
                  type="tel"
                  autoComplete="off"
                  value={phone}
                  onChangeValue={setPhone}
                  placeholder="+34600000000"
                  maxLength={24}
                />
              </FormField>
              <FormField label={t('PIN')} width={90}>
                <Input
                  type="password"
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChangeValue={value => setPin(value.replace(/\D/g, ''))}
                />
              </FormField>
              <Button
                isDisabled={isBusy || !isPhoneValid || !/^\d{4}$/.test(pin)}
                onPress={onSendCode}
              >
                {isBusy ? <Trans>Working…</Trans> : <Trans>Send code</Trans>}
              </Button>
            </>
          ) : (
            <>
              <FormField label={t('Code')} width={90}>
                <Input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={4}
                  value={code}
                  onChangeValue={value => setCode(value.replace(/\D/g, ''))}
                />
              </FormField>
              <Button variant="bare" isDisabled={isBusy} onPress={onCancel}>
                <Trans>Cancel</Trans>
              </Button>
            </>
          )}
          <View style={{ flex: 1 }} />
          <FormField label={t('Import into account')} width={200}>
            <Select
              value={accountId}
              onChange={setAccountId}
              options={[
                ['', t('No account')] as const,
                ...accounts
                  .filter(account => !account.closed)
                  .map(account => [account.id, account.name] as const),
              ]}
            />
          </FormField>
          <Button
            variant="primary"
            isDisabled={isBusy || processId == null || !/^\d{4}$/.test(code)}
            onPress={onImport}
          >
            {isBusy ? <Trans>Working…</Trans> : <Trans>Import</Trans>}
          </Button>
        </View>
      )}
      {message && (
        <Text style={{ color: isError ? theme.errorText : theme.pageText }}>
          {message}
        </Text>
      )}
    </View>
  );
}
