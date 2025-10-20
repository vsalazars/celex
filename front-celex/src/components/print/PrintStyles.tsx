"use client";

export default function PrintStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
@media print {
  @page { size: Letter; margin: 14mm 12mm; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-size: 11px; line-height: 1.28; }

  .no-print { display: none !important; }

  .pdf-header { padding: 0 0 4px 0 !important; }
  .pdf-title { font-size: 14px !important; margin: 0 !important; }
  .pdf-subtitle { font-size: 10px !important; color: #475569 !important; }

  .pdf-meta-grid {
    display: grid !important;
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    column-gap: 10px !important;
    row-gap: 4px !important;
    margin-top: 6px !important;
    margin-bottom: 4px !important;
  }
  .pdf-meta-label { color: #475569; }
  .pdf-meta-value { font-weight: 600; }
  .pdf-meta-grid .col-span-2 { grid-column: span 4 / span 4; }

  .pdf-chips-wrap { display: flex; flex-wrap: wrap; gap: 4px 6px; }
  .pdf-chip {
    display: inline-block;
    border: 1px solid #e5e7eb;
    background: #f8fafc;
    padding: 2px 6px;
    border-radius: 9999px;
    font-size: 10.5px;
  }

  table.pdf-table { width: 100%; border-collapse: collapse; }
  table.pdf-table th, table.pdf-table td {
    border-bottom: 1px solid #e5e7eb;
    padding: 5px 6px;
    vertical-align: middle;
    font-size: 10.8px;
  }
  table.pdf-table th {
    text-align: left;
    font-weight: 700;
    background: #f8fafc;
  }
  .text-right { text-align: right; }
  .nowrap { white-space: nowrap; }

  .avoid-break { break-inside: avoid; page-break-inside: avoid; }
  .page-break { page-break-before: always; break-before: page; }
}

@media screen {
  .pdf-header { padding: 12px 16px 8px 16px; }
  .pdf-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 14px;
    row-gap: 6px;
  }
  .pdf-chip { padding: 3px 8px; font-size: 11px; }
}
        `,
      }}
    />
  );
}
