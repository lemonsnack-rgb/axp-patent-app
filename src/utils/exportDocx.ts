import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } from 'docx';
import { saveAs } from 'file-saver';

export interface ExportSection {
  label: string;
  content: string;
}

export interface ExportDrawing {
  symbol: string | number;
  name?: string;
  dataUrl: string;
}

// data:image/...;base64,xxxx → Uint8Array + 타입
function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; type: 'png' | 'jpg' | 'gif' | 'bmp' } | null {
  const m = dataUrl.match(/^data:image\/(png|jpe?g|gif|bmp|svg\+xml);base64,(.*)$/);
  if (!m) return null;
  const raw = m[1] === 'jpeg' ? 'jpg' : m[1];
  const type = (raw === 'jpg' || raw === 'gif' || raw === 'bmp') ? raw : 'png';
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, type: type as 'png' | 'jpg' | 'gif' | 'bmp' };
  } catch { return null; }
}

export async function exportDocx(title: string, sections: ExportSection[], drawings: ExportDrawing[] = []): Promise<void> {
  const children = sections.flatMap(sec => [
    new Paragraph({
      text: `【${sec.label}】`,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 },
    }),
    ...sec.content.split('\n\n').filter(p => p.trim()).map(para =>
      new Paragraph({
        children: [new TextRun({ text: para.trim(), size: 24, font: 'Malgun Gothic' })],
        spacing: { after: 160 },
        alignment: AlignmentType.JUSTIFIED,
      })
    ),
  ]);

  // 도면 — SVG 외 래스터 이미지만 삽입(docx ImageRun 미지원 포맷 제외)
  const drawingChildren: Paragraph[] = [];
  if (drawings.length) {
    drawingChildren.push(new Paragraph({
      text: '【도면】', heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 },
    }));
    for (const d of drawings) {
      const dec = decodeDataUrl(d.dataUrl);
      if (dec) {
        drawingChildren.push(new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { after: 80 },
          children: [new ImageRun({ data: dec.bytes, type: dec.type, transformation: { width: 440, height: 330 } })],
        }));
      }
      drawingChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { after: 240 },
        children: [new TextRun({ text: `도 ${d.symbol}${d.name ? ` — ${d.name}` : ''}`, size: 20, font: 'Malgun Gothic', color: '333333' })],
      }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: `[특허명세서] ${title}`,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 400 },
        }),
        ...children,
        ...drawingChildren,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);
  saveAs(blob, `${safeName}_명세서.docx`);
}
