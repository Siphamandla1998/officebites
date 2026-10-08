export function csvCell(value) {
  let text = value == null ? '' : String(value);
  // Treat every value as untrusted, including names, notes and payment references.
  const leadingTrimmed = [...text].slice([...text].findIndex(c => c.charCodeAt(0) > 32 && !/\s/.test(c))).join('');
  if (/^[=+@-]/.test(leadingTrimmed) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers, rows) {
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadCsv(filename, headers, rows) {
  const url = URL.createObjectURL(new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
