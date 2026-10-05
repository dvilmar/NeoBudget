function escapeCell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value);
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  header: string[],
  rows: (string | number | null | undefined)[][],
): string {
  return [header, ...rows].map(row => row.map(escapeCell).join(',')).join('\n');
}

// Pasted list or CSV; a header such as "symbol"/"ticker" selects the column.
export function parseSymbols(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const split = (line: string) =>
    line
      .split(/[,;\t]/)
      .map(cell => cell.trim().replace(/^"|"$/g, ''))
      .filter(cell => cell !== '');

  const header = lines[0]
    .split(/[,;\t]/)
    .map(cell => cell.trim().toLowerCase());
  const column = header.findIndex(cell =>
    ['symbol', 'ticker', 'simbolo', 'símbolo'].includes(cell),
  );

  const symbols =
    column >= 0
      ? lines.slice(1).map(line => line.split(/[,;\t]/)[column]?.trim() ?? '')
      : lines.flatMap(line => split(line).flatMap(cell => cell.split(/\s+/)));

  const seen = new Set<string>();
  const result: string[] = [];
  for (const symbol of symbols.map(value => value.replace(/^"|"$/g, ''))) {
    const key = symbol.toUpperCase();
    if (/^[A-Z0-9.\-=^]{1,20}$/.test(key) && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}
