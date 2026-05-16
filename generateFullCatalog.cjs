const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const INPUT_FILE = path.join(__dirname, "Bambu_Material_Database_FULL_v2.xlsx");
const OUTPUT_FILE = path.join(__dirname, "src", "data", "materialCatalog.js");

function safe(value) {
  return String(value ?? "").trim();
}

function code(value) {
  const raw = safe(value);
  if (!raw) return "";
  return raw.endsWith(".0") ? raw.slice(0, -2) : raw;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function makeCatalogItem(row, index) {
  const materialType = safe(row["Material Type"]);
  const colorName = safe(row["Color Name"]);
  const bambuCode = code(row["Bambu Code"]);
  const hexCode = safe(row["Hex Code"]);
  const msrp = number(row["MSRP"], 19.99);
  const bulkPrice = number(row["Bulk Price"], msrp);

  return {
    id: `bambu-${bambuCode || index}`,
    category: "Filament",
    materialType,
    colorName,
    displayName: `${materialType} — ${colorName}`,
    bambuCode,
    hexCode,
    brand: "Bambu Lab",
    msrp,
    bulkPrice,
    spoolWeightGrams: 1000,
    unit: "g",
    active: true,
  };
}

function buildShopMaterials() {
  return [
    { id: "shop-yc002", category: "Engraving Blank", materialType: "Stainless Steel Tag", colorName: "20mm Silver", displayName: "20mm Stainless Steel Tag", bambuCode: "YC002", hexCode: "#BFC5CA", brand: "Bambu Lab", msrp: 8.99, bulkPrice: 8.99, spoolWeightGrams: 0, unit: "pieces", active: true },
    { id: "shop-yd006", category: "Leatherette", materialType: "PU Iron-On Patch", colorName: "Rustic Gold", displayName: "Rectangular PU Iron-On Patch Rustic Gold", bambuCode: "YD006", hexCode: "#B89B5E", brand: "Bambu Lab", msrp: 7.99, bulkPrice: 7.99, spoolWeightGrams: 0, unit: "pieces", active: true },
    { id: "shop-ye004", category: "Paper / Cardstock", materialType: "Greeting Card", colorName: "Pearlescent White", displayName: "Pearlescent White Greeting Card", bambuCode: "YE004", hexCode: "#F6F4EF", brand: "Bambu Lab", msrp: 8.99, bulkPrice: 8.99, spoolWeightGrams: 0, unit: "cards", active: true },
    { id: "shop-yc001", category: "Engraving Blank", materialType: "Aluminum Business Card", colorName: "Black", displayName: "Black Aluminum Business Card", bambuCode: "YC001", hexCode: "#1C1C1C", brand: "Bambu Lab", msrp: 12.99, bulkPrice: 12.99, spoolWeightGrams: 0, unit: "cards", active: true },
    { id: "shop-ye002", category: "Paper / Cardstock", materialType: "Cardstock", colorName: "White", displayName: "A4 250g White Cardstock", bambuCode: "YE002", hexCode: "#FFFFFF", brand: "Bambu Lab", msrp: 6.99, bulkPrice: 6.99, spoolWeightGrams: 0, unit: "sheets", active: true },
    { id: "shop-ya001", category: "Wood", materialType: "Basswood Plywood", colorName: "3mm Natural", displayName: "3mm Basswood Plywood", bambuCode: "YA001", hexCode: "#D5B48C", brand: "Bambu Lab", msrp: 9.99, bulkPrice: 9.99, spoolWeightGrams: 0, unit: "sheets", active: true },
    { id: "shop-yl001", category: "Cork", materialType: "Cork Sheet", colorName: "2mm Natural", displayName: "2mm Cork Sheet", bambuCode: "YL001", hexCode: "#B68B5A", brand: "Bambu Lab", msrp: 7.99, bulkPrice: 7.99, spoolWeightGrams: 0, unit: "sheets", active: true },
    { id: "shop-ya004", category: "Wood", materialType: "Sapele Plywood", colorName: "3mm Natural", displayName: "3mm Sapele Plywood", bambuCode: "YA004", hexCode: "#8B5A3C", brand: "Bambu Lab", msrp: 10.99, bulkPrice: 10.99, spoolWeightGrams: 0, unit: "sheets", active: true },
    { id: "shop-yb002", category: "Acrylic", materialType: "Gloss Acrylic", colorName: "3mm Red Opaque", displayName: "3mm Red Opaque Gloss Acrylic", bambuCode: "YB002", hexCode: "#C32026", brand: "Bambu Lab", msrp: 12.99, bulkPrice: 12.99, spoolWeightGrams: 0, unit: "sheets", active: true },
    { id: "shop-yd001", category: "Leatherette", materialType: "PU Leatherette", colorName: "Black Pebbled", displayName: "Black Pebbled PU Leatherette Fabric", bambuCode: "YD001", hexCode: "#1F1F1F", brand: "Bambu Lab", msrp: 9.99, bulkPrice: 9.99, spoolWeightGrams: 0, unit: "sheets", active: true },
    { id: "shop-yg015", category: "Vinyl", materialType: "Removable Vinyl", colorName: "Green Matte", displayName: "Green Matte Removable Vinyl", bambuCode: "YG015", hexCode: "#2F7D4D", brand: "Bambu Lab", msrp: 5.99, bulkPrice: 5.99, spoolWeightGrams: 0, unit: "sheets", active: true },
    { id: "shop-yz002", category: "Vinyl", materialType: "Reflective Decal Sheet", colorName: "Light Gray Reflective", displayName: "Light Gray Reflective Decal Sheet", bambuCode: "YZ002", hexCode: "#C7C7C7", brand: "Bambu Lab", msrp: 6.99, bulkPrice: 6.99, spoolWeightGrams: 0, unit: "sheets", active: true },
    { id: "shop-yg018", category: "Vinyl", materialType: "Carbon Fiber Vinyl", colorName: "Black Carbon Fiber", displayName: "Carbon Fiber Textured Removable Vinyl", bambuCode: "YG018", hexCode: "#2B2B2B", brand: "Bambu Lab", msrp: 6.99, bulkPrice: 6.99, spoolWeightGrams: 0, unit: "sheets", active: true },
    { id: "shop-yd002", category: "Leatherette", materialType: "PU Leatherette", colorName: "White Pebbled", displayName: "White Pebbled PU Leatherette", bambuCode: "YD002", hexCode: "#F5F5F5", brand: "Bambu Lab", msrp: 9.99, bulkPrice: 9.99, spoolWeightGrams: 0, unit: "sheets", active: true },
    { id: "shop-yg002", category: "HTV", materialType: "Heat Transfer Vinyl", colorName: "Red Matte", displayName: "Red Matte Heat Transfer Vinyl", bambuCode: "YG002", hexCode: "#C32026", brand: "Bambu Lab", msrp: 5.99, bulkPrice: 5.99, spoolWeightGrams: 0, unit: "sheets", active: true },
    { id: "shop-yc003", category: "Engraving Blank", materialType: "Stainless Steel Tag", colorName: "30mm Silver", displayName: "30mm Stainless Steel Tag", bambuCode: "YC003", hexCode: "#BFC5CA", brand: "Bambu Lab", msrp: 9.99, bulkPrice: 9.99, spoolWeightGrams: 0, unit: "pieces", active: true },
  ];
}

function buildOutput(catalog) {
  return `export const MATERIAL_CATALOG = ${JSON.stringify(catalog, null, 2)};

export const MATERIAL_PRICE_MODES = [
  { id: "msrp", label: "MSRP" },
  { id: "bulk", label: "Bulk / 10+ Roll Price" },
  { id: "custom", label: "Custom Inventory Cost" },
];

export function getMaterialPrice(catalogItem, mode = "msrp") {
  if (!catalogItem) return 0;
  if (mode === "bulk") return Number(catalogItem.bulkPrice || catalogItem.msrp || 0);
  return Number(catalogItem.msrp || catalogItem.bulkPrice || 0);
}

export function getMaterialByCatalogId(catalogId) {
  return MATERIAL_CATALOG.find((item) => item.id === catalogId) || null;
}

export function getMaterialByBambuCode(bambuCode) {
  return MATERIAL_CATALOG.find(
    (item) => String(item.bambuCode || "").toLowerCase() === String(bambuCode || "").toLowerCase()
  ) || null;
}

export function getMaterialDisplayLabel(item) {
  if (!item) return "";
  const code = item.bambuCode ? \` (\${item.bambuCode})\` : "";
  return \`\${item.displayName || \`\${item.materialType} — \${item.colorName}\`}\${code}\`;
}

export function normalizeMaterialSearch(value) {
  return String(value || "").trim().toLowerCase();
}

export function searchMaterialCatalog(searchTerm, categoryFilter = "All") {
  const search = normalizeMaterialSearch(searchTerm);
  return MATERIAL_CATALOG.filter((item) => {
    const categoryMatch = categoryFilter === "All" || item.category === categoryFilter;
    if (!categoryMatch) return false;
    if (!search) return true;

    return [
      item.id,
      item.category,
      item.materialType,
      item.colorName,
      item.displayName,
      item.bambuCode,
      item.hexCode,
      item.brand,
      item.unit,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });
}

export function getMaterialCatalogCategories() {
  return [...new Set(MATERIAL_CATALOG.map((item) => item.category))].sort();
}

export function createInventoryItemFromCatalog(catalogItem, options = {}) {
  const quantityOnHand =
    options.quantityOnHand !== undefined
      ? Number(options.quantityOnHand || 0)
      : catalogItem.category === "Filament"
        ? 1000
        : 0;

  const unit =
    options.unit ||
    catalogItem.unit ||
    (catalogItem.category === "Filament" ? "g" : "pieces");

  const unitCost =
    options.unitCost !== undefined
      ? Number(options.unitCost || 0)
      : catalogItem.category === "Filament"
        ? getMaterialPrice(catalogItem, options.priceMode || "msrp") / Math.max(1, Number(catalogItem.spoolWeightGrams || 1000))
        : getMaterialPrice(catalogItem, options.priceMode || "msrp");

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    catalogId: catalogItem.id,
    name: catalogItem.displayName,
    category: catalogItem.category,
    material: catalogItem.materialType,
    color: catalogItem.colorName,
    brand: catalogItem.brand || "Bambu Lab",
    location: options.location || "",
    unit,
    quantityOnHand,
    reorderThreshold: options.reorderThreshold !== undefined ? Number(options.reorderThreshold || 0) : 0,
    unitCost,
    vendor: options.vendor || catalogItem.brand || "Bambu Lab",
    sku: catalogItem.bambuCode || "",
    hexCode: catalogItem.hexCode || "",
    bambuCode: catalogItem.bambuCode || "",
    msrp: Number(catalogItem.msrp || 0),
    bulkPrice: Number(catalogItem.bulkPrice || 0),
    spoolWeightGrams: Number(catalogItem.spoolWeightGrams || 0),
    notes: options.notes || "Added from material catalog.",
    active: true,
  };
}

export function matchCatalogFromInventoryText(text) {
  const raw = String(text || "");
  const codeMatch = raw.match(/\\(([^)]+)\\)/);
  const possibleCode = codeMatch ? codeMatch[1].trim() : "";

  if (possibleCode) {
    const byCode = getMaterialByBambuCode(possibleCode);
    if (byCode) return byCode;
  }

  const normalized = normalizeMaterialSearch(raw);

  return MATERIAL_CATALOG.find((item) => {
    const code = normalizeMaterialSearch(item.bambuCode);
    const label = normalizeMaterialSearch(\`\${item.materialType} \${item.colorName} \${item.displayName}\`);
    return (code && normalized.includes(code)) || (label && normalized.includes(label));
  }) || null;
}

export function getOwnedInventoryForCatalog(inventoryItems = [], catalogItem) {
  if (!catalogItem) return [];
  return inventoryItems.filter((item) => {
    return (
      item.catalogId === catalogItem.id ||
      String(item.bambuCode || item.sku || "").toLowerCase() === String(catalogItem.bambuCode || "").toLowerCase()
    );
  });
}

export function getOwnedQuantityForCatalog(inventoryItems = [], catalogItem) {
  return getOwnedInventoryForCatalog(inventoryItems, catalogItem).reduce(
    (sum, item) => sum + Number(item.quantityOnHand || 0),
    0
  );
}
`;
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Missing ${INPUT_FILE}`);
    console.error("Rename your full catalog spreadsheet to Bambu_Material_Database_FULL_v2.xlsx and put it in the project root.");
    process.exit(1);
  }

  const workbook = XLSX.readFile(INPUT_FILE);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const filamentCatalog = rows
    .map(makeCatalogItem)
    .filter((item) => item.materialType && item.colorName);

  const fullCatalog = [...filamentCatalog, ...buildShopMaterials()];

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, buildOutput(fullCatalog), "utf8");

  console.log(`Generated ${fullCatalog.length} catalog items.`);
  console.log(`Filament/material rows: ${filamentCatalog.length}`);
  console.log(`Shop supply rows: ${buildShopMaterials().length}`);
}

main();