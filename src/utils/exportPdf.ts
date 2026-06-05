export interface ExportSection {
  label: string;
  content: string;
}

export function exportPdf(title: string, sections: ExportSection[]): boolean {
  const sectionsHtml = sections
    .filter(s => s.content.trim())
    .map(s => `
      <h2>【${s.label}】</h2>
      ${s.content.split('\n\n').filter(p => p.trim()).map(p => `<p>${p.trim()}</p>`).join('')}
    `).join('');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${title} 특허명세서</title>
  <style>
    body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; font-size: 11pt; line-height: 1.9; margin: 0; color: #111; }
    .wrap { margin: 2.5cm; }
    h1 { font-size: 15pt; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 24px; }
    h2 { font-size: 12pt; margin-top: 28px; margin-bottom: 8px; border-left: 3px solid #555; padding-left: 8px; }
    p { text-align: justify; margin: 0 0 8px; }
    @page { margin: 2.5cm; size: A4; }
    @media print { .wrap { margin: 0; } }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>[특허명세서] ${title}</h1>
    ${sectionsHtml}
  </div>
</body>
</html>`;

  const pw = window.open('', '_blank');
  if (!pw) return false;
  pw.document.write(html);
  pw.document.close();
  pw.focus();
  setTimeout(() => { pw.print(); }, 600);
  return true;
}
