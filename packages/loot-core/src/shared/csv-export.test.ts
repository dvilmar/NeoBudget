import { parseSymbols, toCsv } from './csv-export';

describe('toCsv', () => {
  it('quotes cells that need it', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          ['x,y', 'say "hi"'],
          [1, null],
        ],
      ),
    ).toBe('a,b\n"x,y","say ""hi"""\n1,');
  });
});

describe('parseSymbols', () => {
  it('reads a pasted list', () => {
    expect(parseSymbols('aapl, msft\nvwce.de\nAAPL')).toEqual([
      'AAPL',
      'MSFT',
      'VWCE.DE',
    ]);
  });

  it('uses the symbol column of a CSV', () => {
    expect(parseSymbols('Name,Ticker\nApple,AAPL\nTesla,TSLA')).toEqual([
      'AAPL',
      'TSLA',
    ]);
  });

  it('ignores junk and empty input', () => {
    expect(parseSymbols('')).toEqual([]);
    expect(parseSymbols('hello world!!')).toEqual(['HELLO']);
  });
});
