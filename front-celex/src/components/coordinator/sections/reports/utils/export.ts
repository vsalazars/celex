export function downloadCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(",")]
    .concat(rows.map((row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportNodeToPDF(node: HTMLElement | null, title = "Reporte") {
  if (!node) return;
  const content = node.innerHTML;
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.open();
  win.document.write(`
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #111; }
          h1, h2, h3 { margin: 0 0 8px; }
          .meta { margin: 4px 0 16px; color: #444; font-size: 12px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
          th { background: #f3f4f6; text-align: left; }
          tr:nth-child(even) { background: #fafafa; }
          .totals { margin-top: 10px; font-weight: 600; }
          @page { size: A4; margin: 14mm; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        ${content}
        <script>
          window.onload = function() { window.print(); setTimeout(() => window.close(), 300); };
        </script>
      </body>
    </html>
  `);
  win.document.close();
}
