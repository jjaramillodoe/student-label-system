export function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(current.trim());
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some(cell => cell !== '')) rows.push(row);
  return rows;
}

export function parseCsvToObjects(text: string) {
  const rows = parseCsv(text);
  const headers = rows[0] || [];

  return rows.slice(1).map(row => headers.reduce((record, header, index) => {
    record[header] = row[index] || '';
    return record;
  }, {} as Record<string, string>));
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function objectsToCsv(records: Record<string, unknown>[], preferredHeaders?: string[]) {
  const headers = preferredHeaders || Array.from(new Set(records.flatMap(record => Object.keys(record))));
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...records.map(record => headers.map(header => escapeCsvCell(record[header])).join(',')),
  ];

  return lines.join('\n');
}

export function downloadCsvFile(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}
