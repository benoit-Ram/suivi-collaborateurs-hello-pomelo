// src/utils/export.js
// Export CSV et impression PDF

/**
 * Télécharge un fichier CSV avec BOM UTF-8 (compatible Excel français)
 * @param {string} filename — nom du fichier (avec .csv)
 * @param {string[]} headers — en-têtes des colonnes
 * @param {(string | number | null)[][]} rows — lignes de données
 */
export function exportCSV(filename, headers, rows) {
  const BOM = '\uFEFF';
  const csv = BOM + [
    headers.join(';'),
    ...rows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(';')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Ouvre une fenêtre d'impression avec le contenu HTML fourni
 * @param {string} title — titre de la page
 * @param {string} contentHTML — contenu HTML du document
 */
export function exportPrintHTML(title, contentHTML) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="fr"><head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <style>
      body { font-family: 'Quicksand', Arial, sans-serif; padding: 32px; color: #05056D; max-width: 800px; margin: 0 auto; }
      h1 { font-size: 1.3rem; color: #05056D; margin-bottom: 4px; }
      h2 { font-size: 1rem; color: #FF3285; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.05em; }
      .field { margin-bottom: 12px; }
      .field-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #6B6B9A; margin-bottom: 2px; }
      .field-value { font-size: 0.9rem; line-height: 1.5; padding: 8px 0; border-bottom: 1px solid #CFD0E5; }
      .meta { font-size: 0.8rem; color: #6B6B9A; margin-bottom: 20px; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; }
      @media print { body { padding: 16px; } button { display: none; } }
    </style>
  </head><body>${contentHTML}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 300);
}
