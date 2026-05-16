const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const INPUT_FILE = path.join(__dirname, "Bambu_On_Hand_Inventory.xlsx");
const OUTPUT_FILE = path.join(__dirname, "on-hand-import.txt");

function safe(value) {
  return String(value ?? "").trim();
}

function code(value) {
  const raw = safe(value);
  if (!raw) return "";
  return raw.endsWith(".0") ? raw.slice(0, -2) : raw;
}

function normalizeAmount(value) {
  const raw = safe(value);

  if (!raw) return "1000g";
  if (/^full$/i.test(raw)) return "1000g";
  if (/^\d+(\.\d+)?g$/i.test(raw)) return raw.toLowerCase();
  if (/^\d+(\.\d+)?\s*g$/i.test(raw)) return raw.replace(/\s+/g, "").toLowerCase();

  return raw;
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Missing ${INPUT_FILE}`);
    console.error("Rename your on-hand spreadsheet to Bambu_On_Hand_Inventory.xlsx and put it in the project root.");
    process.exit(1);
  }

  const workbook = XLSX.readFile(INPUT_FILE);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const lines = rows
    .map((row) => {
      const materialType = safe(row["Material Type"]);
      const colorName = safe(row["Color Name"]);
      const bambuCode = code(row["Bambu Code"]);
      const amount = normalizeAmount(row["Amount Remaining"]);

      if (!materialType || !colorName || !bambuCode) return "";

      return `${materialType} ${colorName} (${bambuCode}) ${amount}`;
    })
    .filter(Boolean);

  fs.writeFileSync(OUTPUT_FILE, lines.join("\n"), "utf8");

  console.log(`Generated ${lines.length} on-hand import lines.`);
  console.log(`Output written to: ${OUTPUT_FILE}`);
}

main();