import { xray } from './xray';

const h = (name: string, value: number, type = 'etf', currency = 'EUR') => ({
  name,
  value,
  type,
  currency,
});

describe('xray', () => {
  it('passes a spread portfolio', () => {
    const findings = xray([
      h('A', 20, 'etf', 'EUR'),
      h('B', 20, 'etf', 'USD'),
      h('C', 20, 'stock', 'USD'),
      h('D', 20, 'bond', 'EUR'),
      h('E', 20, 'fund', 'EUR'),
    ]);
    expect(findings.every(finding => finding.ok)).toBe(true);
  });

  it('flags concentration, currency and crypto', () => {
    const findings = xray([h('BTC', 90, 'crypto'), h('A', 10)]);
    const by = Object.fromEntries(findings.map(f => [f.rule, f]));
    expect(by['top-holding']).toMatchObject({ ok: false, subject: 'BTC' });
    expect(by.currency.ok).toBe(false);
    expect(by.crypto.ok).toBe(false);
    expect(by.diversification).toMatchObject({ ok: false, value: 2 });
  });

  it('returns nothing without value', () => {
    expect(xray([h('A', 0)])).toEqual([]);
  });
});
