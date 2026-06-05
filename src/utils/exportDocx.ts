import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

export interface ExportSection {
  label: string;
  content: string;
}

export async function exportDocx(title: string, sections: ExportSection[]): Promise<void> {
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
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);
  saveAs(blob, `${safeName}_명세서.docx`);
}
