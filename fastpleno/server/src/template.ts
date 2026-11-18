import fs from "fs";
import path from "path";
import { imageSize } from "image-size";
import {
  AlignmentType,
  BorderStyle,
  ColumnBreak,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  SectionType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from "docx";
import { ExtractedExamData } from "./ai";

export interface ExamHeaderMeta {
  title: string;
  subject: string;
  className: string;
  teacherName: string;
  applicationMonthYear?: string; // Ex.: "11/2026"
  neededByDate?: string;         // Ex.: "2026-11-25"
}

function getDocxImageType(type: string | undefined): "jpg" | "png" | "gif" | "bmp" {
  switch (type?.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "jpg";
    case "png":
      return "png";
    case "gif":
      return "gif";
    case "bmp":
      return "bmp";
    default:
      throw new Error(`Formato de imagem não suportado no documento: ${type ?? "desconhecido"}.`);
  }
}

/** Calcula o tamanho de fonte (em half-points: 20 = 10pt) para evitar 1 linha sobrando em página extra */
function computeOptimalTypography(data: ExtractedExamData) {
  let totalChars = 0;
  for (const q of data.questions) {
    totalChars += (q.supportTitle?.length || 0) + (q.supportText?.length || 0) + q.statement.length;
    if (q.options) {
      for (const opt of q.options) totalChars += opt.text.length + 6;
    }
  }
  const imageWeight = data.images.length * 650;
  const load = totalChars + imageWeight;

  // Capacidade aproximada de 1 página A4 em 2 colunas com cabeçalho (~3.400 caracteres)
  // Se estiver na faixa de "transbordo curto" (poucas linhas sobrando na página 2 ou 3), ajusta a escala:
  if ((load > 3250 && load <= 3850) || (load > 7100 && load <= 7900)) {
    return { fontSize: 18, lineSpacing: 215, afterSpacing: 60 }; // 9pt compacto (puxa as linhas soltas de volta)
  }
  if ((load > 3000 && load <= 3250) || (load > 6700 && load <= 7100)) {
    return { fontSize: 19, lineSpacing: 225, afterSpacing: 75 }; // 9.5pt
  }
  return { fontSize: 20, lineSpacing: 240, afterSpacing: 95 }; // 10pt padrão oficial
}

function extractYearSuffix(meta: ExamHeaderMeta): string {
  if (meta.neededByDate && meta.neededByDate.length >= 4) {
    return meta.neededByDate.slice(2, 4);
  }
  if (meta.applicationMonthYear && meta.applicationMonthYear.includes("/")) {
    const year = meta.applicationMonthYear.split("/")[1]?.trim();
    if (year && year.length >= 2) return year.slice(-2);
  }
  return String(new Date().getFullYear()).slice(-2);
}

export async function buildExamDocx(data: ExtractedExamData, meta: ExamHeaderMeta): Promise<Buffer> {
  const typo = computeOptimalTypography(data);
  const yearSuffix = extractYearSuffix(meta);

  // Borda preta espessa no padrão do cabeçalho do Colégio Pleno
  const thickBorder = { style: BorderStyle.SINGLE, size: 18, color: "000000" };
  const cellBorders = {
    top: thickBorder,
    bottom: thickBorder,
    left: thickBorder,
    right: thickBorder,
  };

  // Carrega a logo do Colégio Pleno se existir em server/assets/logo-pleno.png
  const logoPath = path.resolve(__dirname, "../assets/logo-pleno.png");
  const logoChildren: Paragraph[] = fs.existsSync(logoPath)
    ? [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              type: "png",
              data: fs.readFileSync(logoPath),
              transformation: { width: 72, height: 54 },
            }),
          ],
        }),
      ]
    : [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Colégio PLENO", bold: true, size: 22, font: "Arial" })],
        }),
      ];

  // Cabeçalho oficial em grade idêntico à foto de referência
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      // Linha 1: Logo (rowSpan 2) + Título da Avaliação
      new TableRow({
        children: [
          new TableCell({
            rowSpan: 2,
            width: { size: 16, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: cellBorders,
            children: logoChildren,
          }),
          new TableCell({
            columnSpan: 5,
            width: { size: 84, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: cellBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: meta.title.toUpperCase(),
                    bold: true,
                    size: 24, // 12pt
                    font: "Arial",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      // Linha 2: PROFESSOR (A) | Nome Sublinhado | SÉRIE | Turma | NOTA | Espaço
      new TableRow({
        children: [
          new TableCell({
            width: { size: 22, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: cellBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
                children: [new TextRun({ text: "PROFESSOR (A)", bold: true, size: 20, font: "Arial" })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: cellBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
                children: [
                  new TextRun({
                    text: meta.teacherName,
                    bold: true,
                    underline: { type: UnderlineType.SINGLE },
                    size: 20,
                    font: "Arial",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: cellBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "SÉRIE", bold: true, size: 20, font: "Arial" })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 7, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: cellBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: meta.className, bold: true, size: 20, font: "Arial" })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: cellBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                indent: { left: 100 },
                children: [new TextRun({ text: "NOTA:", bold: true, size: 20, font: "Arial" })],
              }),
            ],
          }),
        ],
      }),
      // Linha 3: NOME | Espaço em branco | Data (  /  /26)
      new TableRow({
        children: [
          new TableCell({
            width: { size: 16, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: cellBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
                children: [new TextRun({ text: "NOME", size: 20, font: "Arial" })],
              }),
            ],
          }),
          new TableCell({
            columnSpan: 4,
            width: { size: 64, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: cellBorders,
            children: [new Paragraph({ children: [] })],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: cellBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
                children: [
                  new TextRun({
                    text: `     /     /${yearSuffix}`,
                    size: 20,
                    font: "Arial",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Monta os parágrafos das questões (fonte 10pt ou ajustada, sem marca-texto)
  const questionParagraphs: Paragraph[] = [];

  for (const q of data.questions) {
    // Número da questão + Texto de apoio (se houver)
    if (q.supportTitle || q.supportText) {
      questionParagraphs.push(
        new Paragraph({
          spacing: { before: 120, after: 40 },
          keepNext: true,
          children: [new TextRun({ text: `${q.number}.`, bold: true, size: typo.fontSize, font: "Times New Roman" })],
        })
      );

      if (q.supportTitle) {
        questionParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            keepNext: true,
            children: [
              new TextRun({
                text: q.supportTitle.toUpperCase(),
                bold: true,
                size: typo.fontSize,
                font: "Times New Roman",
              }),
            ],
          })
        );
      }

      if (q.supportText) {
        questionParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: typo.lineSpacing, after: typo.afterSpacing },
            widowControl: true,
            children: [new TextRun({ text: q.supportText, size: typo.fontSize, font: "Times New Roman" })],
          })
        );
      }

      // Enunciado após texto de apoio
      questionParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: typo.lineSpacing, after: typo.afterSpacing },
          keepNext: !!(q.options && q.options.length > 0),
          widowControl: true,
          children: [new TextRun({ text: q.statement, bold: true, size: typo.fontSize, font: "Times New Roman" })],
        })
      );
    } else {
      // Questão direta: "2. ENUNCIADO..."
      questionParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 110, line: typo.lineSpacing, after: typo.afterSpacing },
          keepNext: !!(q.options && q.options.length > 0),
          widowControl: true,
          children: [
            new TextRun({ text: `${q.number}. `, bold: true, size: typo.fontSize, font: "Times New Roman" }),
            new TextRun({ text: q.statement, bold: true, size: typo.fontSize, font: "Times New Roman" }),
          ],
        })
      );
    }

    // Imagem proporcional (limitada à largura da coluna: max 225px de largura e 170px de altura)
    if (typeof q.imageIndex === "number" && data.images[q.imageIndex]) {
      const imgBuffer = data.images[q.imageIndex].buffer;
      const dimensions = imageSize(imgBuffer);
      const origW = dimensions.width || 220;
      const origH = dimensions.height || 150;

      const maxW = 225;
      const maxH = 170;
      const ratio = Math.min(maxW / origW, maxH / origH, 1);

      questionParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 80 },
          keepNext: true,
          children: [
            new ImageRun({
              type: getDocxImageType(dimensions.type),
              data: imgBuffer,
              transformation: {
                width: Math.round(origW * ratio),
                height: Math.round(origH * ratio),
              },
            }),
          ],
        })
      );
    }

    // Alternativas A a E (100% limpas, sem highlight/marca-texto)
    if (q.options && q.options.length > 0) {
      q.options.forEach((opt, idx) => {
        const isLastOption = idx === q.options!.length - 1;
        questionParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: typo.lineSpacing, after: isLastOption ? 110 : 35 },
            keepLines: true,
            widowControl: true,
            children: [
              new TextRun({
                text: `${opt.letter.toUpperCase()}) `,
                size: typo.fontSize,
                font: "Times New Roman",
              }),
              new TextRun({
                text: opt.text,
                size: typo.fontSize,
                font: "Times New Roman",
                // Sem highlight, sem shading e sem bold para nunca vazar gabarito
              }),
            ],
          })
        );
      });
    }
  }

  // Margens seguras (680 twips ≈ 1.2 cm em todos os lados, sem colar na borda)
  const pageMargins = { top: 680, bottom: 680, left: 680, right: 680 };

  const doc = new Document({
    sections: [
      // Seção 1: Cabeçalho em largura total (1 coluna)
      {
        properties: {
          page: { margin: pageMargins },
        },
        children: [
          headerTable,
          new Paragraph({ spacing: { after: 120 }, children: [] }),
        ],
      },
      // Seção 2: Corpo da prova dividido ao meio em 2 colunas com linha divisória central
      {
        properties: {
          type: SectionType.CONTINUOUS,
          page: { margin: pageMargins },
          column: {
            count: 2,
            space: 420, // Espaço entre as colunas (~0.75 cm)
            separate: true, // Linha vertical divisória no meio da folha!
          },
        },
        children: questionParagraphs,
      },
    ],
  });

  return Packer.toBuffer(doc);
}