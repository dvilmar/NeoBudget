import { assertWebhookAllowed, isValidWebhookUrl } from './app-webhooks';

describe('isValidWebhookUrl', () => {
  it('accepts http and https addresses', () => {
    expect(isValidWebhookUrl('https://example.com/hook')).toBe(true);
    expect(isValidWebhookUrl('http://localhost:8080/x')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidWebhookUrl('ftp://example.com')).toBe(false);
    expect(isValidWebhookUrl('file:///etc/passwd')).toBe(false);
    expect(isValidWebhookUrl('not a url')).toBe(false);
    expect(isValidWebhookUrl('')).toBe(false);
    expect(isValidWebhookUrl(42)).toBe(false);
    expect(isValidWebhookUrl(`https://example.com/${'a'.repeat(2100)}`)).toBe(
      false,
    );
  });
});

describe('assertWebhookAllowed', () => {
  afterEach(() => {
    delete process.env.ACTUAL_WEBHOOKS_ALLOW_PRIVATE_NETWORK;
  });

  it('blocks loopback, private and metadata addresses', async () => {
    for (const url of [
      'http://127.0.0.1:8080/x',
      'http://localhost/x',
      'http://192.168.1.5/hook',
      'http://10.0.0.1/hook',
      'http://[::1]/hook',
      'http://169.254.169.254/latest/meta-data',
    ]) {
      await expect(assertWebhookAllowed(url)).rejects.toThrow();
    }
  });

  it('lets private networks through only when the variable allows it', async () => {
    process.env.ACTUAL_WEBHOOKS_ALLOW_PRIVATE_NETWORK = 'true';
    await expect(
      assertWebhookAllowed('http://192.168.1.5/hook'),
    ).resolves.toBeUndefined();
    // The cloud metadata address stays blocked either way
    await expect(
      assertWebhookAllowed('http://169.254.169.254/'),
    ).rejects.toThrow();
  });

  it('allows a public address', async () => {
    await expect(
      assertWebhookAllowed('https://93.184.216.34/hook'),
    ).resolves.toBeUndefined();
  });
});
