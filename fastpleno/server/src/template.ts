// Monta o arquivo .docx da prova no MODELO DO COLÉGIO a partir das questões organizadas pela IA.
// Para mudar o visual da prova (cabeçalho, fonte, margens...), edite SOMENTE este arquivo.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, Footer, PageNumber,
} from "docx";
import { ExamData, Question } from "./ai";

// ===== AJUSTES DO MODELO — edite aqui =====
const MODEL = {
  schoolName: "COLÉGIO PLENO",
  font: "Arial",
  fontSize: 22, // em meios-pontos: 22 = 11pt
  letters: ["a", "b", "c", "d", "e", "f"], // letras das alternativas
};
const PAGE_WIDTH = 9638; // largura útil de uma página A4 com margens de 2 cm (unidade DXA)

export interface ExamMeta {
  title: string;
  subject: string;
  className: string;
  teacherName: string;
}

/** Quadro do topo: escola, professor, disciplina, turma, data, aluno e nota. */
function headerTable(meta: ExamMeta) {
  const half = PAGE_WIDTH / 2;
  const cell = (text: string, opts: { span?: number; bold?: boolean; center?: boolean; size?: number } = {}) =>
    new TableCell({
      width: { size: opts.span === 2 ? PAGE_WIDTH : half, type: WidthType.DXA },
      columnSpan: opts.span,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [
        new Paragraph({
          alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [new TextRun({ text, bold: opts.bold, size: opts.size })],
        }),
      ],
    });

  return new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    columnWidths: [half, half],
    rows: [
      new TableRow({ children: [cell(MODEL.schoolName, { span: 2, bold: true, center: true, size: 30 })] }),
      new TableRow({ children: [cell(`Professor(a): ${meta.teacherName}`), cell(`Disciplina: ${meta.subject}`)] }),
      new TableRow({ children: [cell(`Turma: ${meta.className}`), cell("Data: ____/____/______")] }),
      new TableRow({ children: [cell("Aluno(a): ________________________"), cell("Nota: ________")] }),
    ],
  });
}

/** Uma questão: título, enunciado e alternativas (ou linhas para resposta). */
function questionBlock(q: Question): Paragraph[] {
  const points = q.points ? ` (${q.points} ${q.points === 1 ? "ponto" : "pontos"})` : "";
  const blocks: Paragraph[] = [
    new Paragraph({
      spacing: { before: 240, after: 80 },
      keepNext: true,
      children: [new TextRun({ text: `Questão ${q.number}`, bold: true }), new TextRun({ text: points })],
    }),
  ];

  // Cada linha do enunciado vira um parágrafo.
  for (const line of q.statement.split("\n").filter(Boolean)) {
    blocks.push(new Paragraph({ spacing: { after: 80 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun(line)] }));
  }

  if (q.type === "multipla_escolha") {
    (q.options ?? []).forEach((option, i) =>
      blocks.push(
        new Paragraph({ indent: { left: 360 }, spacing: { after: 40 }, children: [new TextRun(`${MODEL.letters[i] ?? "-"}) ${option}`)] })
      )
    );
  } else {
    // Linhas para o aluno responder (cada linha é um parágrafo de sublinhados).
    for (let i = 0; i < (q.answerLines ?? 5); i++) {
      blocks.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: "_".repeat(76), color: "999999" })] }));
    }
  }
  return blocks;
}

export async function buildExamDocx(data: ExamData, meta: ExamMeta): Promise<Buffer> {
  const title = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 160 },
    children: [new TextRun({ text: meta.title.toUpperCase(), bold: true, size: 26 })],
  });

  const instructions = data.instructions
    ? [new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: `Instruções: ${data.instructions}`, italics: true })] })]
    : [];

  const doc = new Document({
    styles: { default: { document: { run: { font: MODEL.font, size: MODEL.fontSize } } } },
    sections: [
      {
        properties: {
          page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], size: 18 })],
              }),
            ],
          }),
        },
        children: [headerTable(meta), title, ...instructions, ...data.questions.flatMap(questionBlock)],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
