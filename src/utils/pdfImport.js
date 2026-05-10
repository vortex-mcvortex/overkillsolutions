import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const START_MARKER = "OVERKILL_DATA_START";
const END_MARKER = "OVERKILL_DATA_END";

function decodeBase64Unicode(base64) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, "");
}

function parseEmbeddedData(text) {
  const compact = normalizeText(text);
  const startIndex = compact.indexOf(START_MARKER);
  const endIndex = compact.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  const payloadStart = startIndex + START_MARKER.length;
  const base64Payload = compact.slice(payloadStart, endIndex);

  const decoded = decodeBase64Unicode(base64Payload);
  return JSON.parse(decoded);
}

async function extractPdfText(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str || "").join(""));
  }

  return pages.join("\n");
}

function fallbackRecordFromText(text) {
  const quoteMatch = text.match(/Q-\d+/i);
  const jobMatch = text.match(/J-\d+/i);
  const invoiceMatch = text.match(/INV-\d+/i);

  const totalMatch =
    text.match(/Final Total\s*\$?([\d,]+\.\d{2})/i) ||
    text.match(/Final Job Total\s*\$?([\d,]+\.\d{2})/i) ||
    text.match(/Total\s*\$?([\d,]+\.\d{2})/i);

  const finalTotal = totalMatch
    ? Number(totalMatch[1].replace(/,/g, ""))
    : 0;

  return {
    source: "fallback-text",
    importedAt: new Date().toISOString(),
    kind: invoiceMatch || jobMatch ? "job" : "quote",
    record: {
      quoteNumber: quoteMatch?.[0]?.toUpperCase() || null,
      jobNumber: jobMatch?.[0]?.toUpperCase() || null,
      invoiceNumber: invoiceMatch?.[0]?.toUpperCase() || null,
      customerName: "Imported Customer",
      jobName: "Imported PDF Record",
      finalTotal,
      depositAmount: 0,
      remainingBalance: finalTotal,
      jobAspects: {
        cad: false,
        printing: false,
        engraving: false,
        vinyl: false,
        custom: true,
      },
      formData: {
        customerName: "Imported Customer",
        jobName: "Imported PDF Record",
        jobAspects: {
          cad: false,
          printing: false,
          engraving: false,
          vinyl: false,
          custom: true,
        },
        customFee: finalTotal,
        notes:
          "This PDF did not contain embedded Overkill app data, so only limited visible PDF text could be imported.",
      },
      totals: {
        finalTotal,
        suggestedDeposit: 0,
        remainingBalance: finalTotal,
      },
    },
  };
}

export async function importOverkillPdf(file) {
  const text = await extractPdfText(file);
  const embedded = parseEmbeddedData(text);

  if (embedded) {
    return {
      ...embedded,
      source: "embedded-overkill-data",
      importedAt: new Date().toISOString(),
    };
  }

  return fallbackRecordFromText(text);
}