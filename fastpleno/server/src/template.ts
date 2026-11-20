import fs from "fs";
import path from "path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  SectionType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  VerticalMergeType,
  WidthType,
  convertInchesToTwip,
} from "docx";

interface Question {
  number: number;
  supportTitle?: string;
  supportText?: string;
  statement: string;
  imageIndex?: number | null;
  alternatives?: string[];
  linesForAnswer?: number;
}

interface ExtractedData {
  questions: Question[];
  images?: { buffer: Buffer; contentType?: string }[];
}

interface ExamMeta {
  title: string;
  subject: string;
  className: string;
  teacherName: string;
  applicationMonthYear?: string;
  neededByDate?: string;
}

const FONT_NAME = "Arial";
const HEAVY_BORDER = { style: BorderStyle.SINGLE, size: 18, color: "000000" };
const NORMAL_BORDER = { style: BorderStyle.SINGLE, size: 12, color: "000000" };

function loadLogoBuffer(): { buffer: Buffer; type: "png" | "jpg" } | null {
  const dirsToScan = [
    path.resolve(process.cwd(), "assets"),
    path.resolve(process.cwd(), "server", "assets"),
    path.resolve(__dirname, "..", "assets"),
    path.resolve(process.cwd(), "..", "client", "public"),
    path.resolve(process.cwd(), "client", "public"),
  ];

  const exactNames = ["logo-pleno.png", "logo-pleno.jpg", "logo-pleno.jpeg", "logo.png", "logo.jpg"];

  for (const dir of dirsToScan) {
    if (!fs.existsSync(dir)) continue;

    for (const fileName of exactNames) {
      const fullPath = path.join(dir, fileName);
      if (fs.existsSync(fullPath)) {
        return {
          buffer: fs.readFileSync(fullPath),
          type: fileName.endsWith(".png") ? "png" : "jpg",
        };
      }
    }

    // Fallback: qualquer imagem png/jpg na pasta assets
    const files = fs.readdirSync(dir);
    const anyImg = files.find((f) => /\.(png|jpe?g)$/i.test(f));
    if (anyImg) {
      return {
        buffer: fs.readFileSync(path.join(dir, anyImg)),
        type: anyImg.toLowerCase().endsWith(".png") ? "png" : "jpg",
      };
    }
  }

  console.warn("[Template] Logo não encontrada. Salve em server/assets/logo-pleno.png");
  return null;
}

/**
 * Estima se o conteúdo vai vazar por poucas linhas para uma página ímpar (ex.: 3ª ou 5ª página).
 * Em 2 colunas com Arial 10pt, cabem aproximadamente 95 linhas equivalentes na 1ª página (com cabeçalho)
 * e 115 linhas equivalentes nas páginas seguintes.
 */
function shouldShrinkTo9pt(questions: Question[]): boolean {
  let totalLines = 0;

  for (const q of questions) {
    const stmtLen = (q.supportText?.length || 0) + (q.statement?.length || 0);
    // Cada linha de coluna comporta ~46 caracteres em Arial 10pt
    totalLines += Math.max(2, Math.ceil(stmtLen / 46)) + 1;

    if (typeof q.imageIndex === "number") {
      totalLines += 10; // Altura equivalente da figura na coluna
    }

    if (q.alternatives && q.alternatives.length > 0) {
      for (const alt of q.alternatives) {
        totalLines += Math.max(1, Math.ceil(alt.length / 44));
      }
    } else if (q.linesForAnswer) {
      totalLines += q.linesForAnswer * 1.5;
    }
  }

  // Página 1 comporta ~90 linhas; páginas seguintes comportam ~112 linhas cada
  if (totalLines <= 90) return false;

  const remainingAfterPage1 = totalLines - 90;
  const extraPages = Math.ceil(remainingAfterPage1 / 112);
  const totalPages = 1 + extraPages;

  // Se o total de páginas estimado for ÍMPAR (3, 5, 7...) e a última página tiver poucas linhas (<= 38 linhas, ~33% da página)
  if (totalPages % 2 === 1) {
    const linesOnLastPage = remainingAfterPage1 % 112 || 112;
    if (linesOnLastPage <= 38) {
      console.log(
        `[Template] Estimativa de ${totalPages} páginas (ímpar) com apenas ~${Math.round(linesOnLastPage)} linhas na última página. Reduzindo fonte para 9pt.`
      );
      return true;
    }
  }

  return false;
}

function buildHeaderTable(meta: ExamMeta): Table {
  const logo = loadLogoBuffer();
  const yearSuffix = meta.applicationMonthYear?.split("/")[1]?.slice(-2) || "26";

  const logoChildren = logo
    ? [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 20, after: 20 },
          children: [
            new ImageRun({
              data: logo.buffer,
              transformation: { width: 78, height: 60 },
              type: logo.type,
            }),
          ],
        }),
      ]
    : [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Colégio Pleno", bold: true, font: FONT_NAME, size: 20 }),
          ],
        }),
      ];

  // Largura total = 10800 twips (7.5" = 8.5" largura Letter - 0.5" esq - 0.5" dir)
  return new Table({
    width: { size: 10800, type: WidthType.DXA },
    columnWidths: [1550, 1800, 2450, 950, 800, 1050, 2200],
    borders: {
      top: HEAVY_BORDER,
      bottom: HEAVY_BORDER,
      left: HEAVY_BORDER,
      right: HEAVY_BORDER,
      insideHorizontal: NORMAL_BORDER,
      insideVertical: NORMAL_BORDER,
    },
    rows: [
      // LINHA 1: Logo + Título
      new TableRow({
        children: [
          new TableCell({
            verticalMerge: VerticalMergeType.RESTART,
            verticalAlign: VerticalAlign.CENTER,
            children: logoChildren,
          }),
          new TableCell({
            columnSpan: 6,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
                children: [
                  new TextRun({
                    text: meta.title.toUpperCase(),
                    bold: true,
                    font: FONT_NAME,
                    size: 22, // 11pt no título
                  }),
                ],
              }),
            ],
          }),
        ],
      }),

      // LINHA 2: Continuação Logo | PROFESSOR (A) | Nome | SÉRIE | Turma | NOTA | [Célula da Nota]
      new TableRow({
        children: [
          new TableCell({
            verticalMerge: VerticalMergeType.CONTINUE,
            children: [new Paragraph("")],
          }),
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
                children: [
                  new TextRun({ text: "PROFESSOR (A)", bold: true, font: FONT_NAME, size: 20 }),
                ],
              }),
            ],
          }),
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
                children: [
                  new TextRun({
                    text: meta.teacherName,
                    bold: true,
                    underline: {},
                    font: FONT_NAME,
                    size: 20,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
                children: [
                  new TextRun({ text: "SÉRIE", bold: true, font: FONT_NAME, size: 20 }),
                ],
              }),
            ],
          }),
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
                children: [
                  new TextRun({ text: meta.className, bold: true, font: FONT_NAME, size: 20 }),
                ],
              }),
            ],
          }),
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
                children: [
                  new TextRun({ text: "NOTA", bold: true, font: FONT_NAME, size: 20 }),
                ],
              }),
            ],
          }),
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ text: "", spacing: { before: 60, after: 60 } })],
          }),
        ],
      }),

      // LINHA 3: NOME | Espaço aluno | Data (/  /26)
      new TableRow({
        children: [
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
                children: [
                  new TextRun({ text: "NOME", font: FONT_NAME, size: 20 }),
                ],
              }),
            ],
          }),
          new TableCell({
            columnSpan: 4,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ text: "", spacing: { before: 60, after: 60 } })],
          }),
          new TableCell({
            columnSpan: 2,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
                children: [
                  new TextRun({
                    text: `      /      /${yearSuffix}`,
                    font: FONT_NAME,
                    size: 20,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

export async function buildExamDocx(data: ExtractedData, meta: ExamMeta): Promise<Buffer> {
  const use9pt = shouldShrinkTo9pt(data.questions);
  const bodyFontSize = use9pt ? 18 : 20; // 18 = 9pt, 20 = 10pt
  const lineSpacing = use9pt ? 225 : 250;
  const questionBefore = use9pt ? 70 : 110;
  const questionAfter = use9pt ? 40 : 65;

  const questionParagraphs: Paragraph[] = [];

  for (const q of data.questions) {
    if (q.supportTitle) {
      questionParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: questionBefore, after: 30 },
          children: [
            new TextRun({
              text: q.supportTitle,
              bold: true,
              font: FONT_NAME,
              size: bodyFontSize,
            }),
          ],
        })
      );
    }

    if (q.supportText) {
      questionParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 20, after: 50, line: lineSpacing },
          children: [
            new TextRun({
              text: q.supportText,
              font: FONT_NAME,
              size: bodyFontSize,
            }),
          ],
        })
      );
    }

    // Enunciado da questão
    questionParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: questionBefore, after: questionAfter, line: lineSpacing },
        children: [
          new TextRun({
            text: `${q.number}. `,
            bold: true,
            font: FONT_NAME,
            size: bodyFontSize,
          }),
          new TextRun({
            text: q.statement,
            font: FONT_NAME,
            size: bodyFontSize,
          }),
        ],
      })
    );

    // Imagem da questão (dimensionada para caber dentro de 1 coluna sem estourar)
    if (
      typeof q.imageIndex === "number" &&
      data.images &&
      data.images[q.imageIndex]
    ) {
      const img = data.images[q.imageIndex];
      const imgType = img.contentType?.includes("png") ? "png" : "jpg";
      questionParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 50 },
          children: [
            new ImageRun({
              data: img.buffer,
              transformation: { width: 220, height: 145 },
              type: imgType,
            }),
          ],
        })
      );
    }

    // Alternativas
    if (q.alternatives && q.alternatives.length > 0) {
      for (const alt of q.alternatives) {
        questionParagraphs.push(
          new Paragraph({
            indent: { left: convertInchesToTwip(0.18) },
            spacing: { before: 15, after: 20, line: lineSpacing },
            children: [
              new TextRun({
                text: alt,
                font: FONT_NAME,
                size: bodyFontSize,
              }),
            ],
          })
        );
      }
    } else if (q.linesForAnswer && q.linesForAnswer > 0) {
      for (let i = 0; i < q.linesForAnswer; i++) {
        questionParagraphs.push(
          new Paragraph({
            spacing: { before: 60, after: 30 },
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: "666666" },
            },
            children: [new TextRun({ text: "", font: FONT_NAME, size: bodyFontSize })],
          })
        );
      }
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT_NAME,
            size: bodyFontSize,
          },
        },
      },
    },
    sections: [
      // SEÇÃO 1: Cabeçalho em 1 coluna com topo exatamente a 0.1" na 1ª página
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.1),
              bottom: convertInchesToTwip(0.5),
              left: convertInchesToTwip(0.5),
              right: convertInchesToTwip(0.5),
              header: convertInchesToTwip(0.05),
              footer: convertInchesToTwip(0.3),
            },
          },
        },
        children: [
          buildHeaderTable(meta),
          new Paragraph({ text: "", spacing: { before: 0, after: 80 } }),
        ],
      },

      // SEÇÃO 2 (Contínua na mesma página): Questões divididas ao meio em 2 colunas com linha divisória
      // Nas próximas páginas, o topo passa automaticamente a 0.5"
      {
        properties: {
          type: SectionType.CONTINUOUS,
          column: {
            count: 2,
            space: convertInchesToTwip(0.3),
            separate: true,
          },
          page: {
            margin: {
              top: convertInchesToTwip(0.5),
              bottom: convertInchesToTwip(0.5),
              left: convertInchesToTwip(0.5),
              right: convertInchesToTwip(0.5),
              header: convertInchesToTwip(0.3),
              footer: convertInchesToTwip(0.3),
            },
          },
        },
        children: questionParagraphs,
      },
    ],
  });

  return Packer.toBuffer(doc);
}