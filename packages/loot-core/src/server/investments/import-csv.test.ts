import { parseDate, parseNumber, parseTradesCsv } from './import-csv';

describe('csv number and date parsing', () => {
  it('reads European and English numbers', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56);
    expect(parseNumber('1,234.56')).toBe(1234.56);
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('1,234')).toBe(1234);
    expect(parseNumber('-7.25')).toBe(-7.25);
    expect(parseNumber('€ 10')).toBe(10);
    expect(parseNumber('abc')).toBeNull();
  });

  it('reads the usual date formats', () => {
    expect(parseDate('2026-03-05')).toBe('2026-03-05');
    expect(parseDate('2026-03-05T10:20:30Z')).toBe('2026-03-05');
    expect(parseDate('05/03/2026')).toBe('2026-03-05');
    expect(parseDate('5.3.2026')).toBe('2026-03-05');
    expect(parseDate('20260305')).toBe('2026-03-05');
    expect(parseDate('March')).toBeNull();
  });
});

describe('parseTradesCsv', () => {
  it('reads an English file', () => {
    const { trades, rejected } = parseTradesCsv(
      [
        'Date,Type,Symbol,Quantity,Price,Fee,Currency',
        '2026-01-10,Buy,VWCE.DE,2,100.5,1,EUR',
        '2026-02-10,Sell,VWCE.DE,1,110,0.5,EUR',
      ].join('\n'),
      'EUR',
    );

    expect(rejected).toEqual([]);
    expect(trades).toHaveLength(2);
    expect(trades[0]).toMatchObject({
      date: '2026-01-10',
      type: 'buy',
      symbol: 'VWCE.DE',
      quantity: 2,
      price: 100.5,
      fee: 1,
      currency: 'EUR',
    });
    expect(trades[1].type).toBe('sell');
  });

  it('reads a Spanish file with semicolons and European numbers', () => {
    const { trades, rejected } = parseTradesCsv(
      [
        'Fecha;Tipo;Símbolo;Cantidad;Precio;Comisión',
        '10/01/2026;Compra;IWDA;1,5;1.234,56;1,00',
      ].join('\n'),
      'USD',
    );

    expect(rejected).toEqual([]);
    expect(trades[0]).toMatchObject({
      date: '2026-01-10',
      type: 'buy',
      symbol: 'IWDA',
      quantity: 1.5,
      price: 1234.56,
      fee: 1,
      currency: 'USD',
    });
  });

  it('keeps identical rows apart but gives them stable ids', () => {
    const csv = [
      'date,type,symbol,quantity,price',
      '2026-01-10,buy,AAPL,1,100',
      '2026-01-10,buy,AAPL,1,100',
    ].join('\n');

    const first = parseTradesCsv(csv, 'USD').trades.map(t => t.importedId);
    const second = parseTradesCsv(csv, 'USD').trades.map(t => t.importedId);
    expect(new Set(first).size).toBe(2);
    expect(second).toEqual(first);
  });

  it('rejects bad rows with their line number and bad files as a whole', () => {
    const rows = parseTradesCsv(
      [
        'date,type,symbol,quantity,price',
        'nope,buy,AAPL,1,100',
        '2026-01-10,gift,AAPL,1,100',
        '2026-01-10,buy,AAPL,x,100',
        '2026-01-10,buy,AAPL,1,100',
      ].join('\n'),
      'USD',
    );
    expect(rows.trades).toHaveLength(1);
    expect(rows.rejected.map(r => r.line)).toEqual([2, 3, 4]);

    const file = parseTradesCsv('foo,bar\n1,2', 'USD');
    expect(file.trades).toEqual([]);
    expect(file.rejected.length).toBeGreaterThan(0);
  });
});
