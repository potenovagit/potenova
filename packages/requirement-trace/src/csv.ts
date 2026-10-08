/**
 * Minimal RFC-4180-ish CSV parser (handles quoted fields, embedded commas,
 * escaped quotes, CRLF). Dependency-free so the trace tool can run in CI with
 * no network. Strips a UTF-8 BOM if present.
 */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      // swallow; handled by following \n
    } else {
      field += c;
    }
  }
  // flush last field/row if the file does not end with a newline
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

export function parseCsvRecords(input: string): Array<Record<string, string>> {
  const rows = parseCsv(input);
  if (rows.length === 0) return [];
  const header = rows[0] ?? [];
  return rows.slice(1).map((cells) => {
    const rec: Record<string, string> = {};
    header.forEach((h, idx) => {
      rec[h.trim()] = (cells[idx] ?? '').trim();
    });
    return rec;
  });
}
