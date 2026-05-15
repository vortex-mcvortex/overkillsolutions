import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  Edit,
  Eye,
  PackagePlus,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import {
  MATERIAL_CATALOG,
  MATERIAL_PRICE_MODES,
  createInventoryItemFromCatalog,
  getMaterialCatalogCategories,
  getMaterialDisplayLabel,
  getMaterialPrice,
  getOwnedQuantityForCatalog,
  matchCatalogFromInventoryText,
  searchMaterialCatalog,
} from "../data/materialCatalog";

const RAW_STARTER_INVENTORY = `Yc002 20mm stainless steel tag x4
Yd006 rectangular pu iron on patch rustic to gold x5
Ye004 pearlescent white greeting card x5
Yc001 Black aluminum office card x8
Ye002 a4 250g white cardstock x
Ya001 3mm basswood plywood x6
Yl001 2mm cork sheet x7
Ya004 3mm sapele plywood x5.5
Yb002 3mm red opaque glossy acrylic x3
Yd001 black pebbled pu leatherette fabric
Yg015 green matte removable vinyl
Yz002 light gray reflective decal sheet
Yg018 carbon fiber textured removable
Yd002 white pebbled pu leatherette
Yg002 red matte heat transfer vinyl
Yc003 30mm stainless steel tags
Glow
Tan
Pla basic Green (10501) full
Pla basic Green (10501)
Pla matte Ice blue (11601) full
Pla metal Iron grey metallic (13100) full
Petg hf green (33500) full
Pla basic blue grey (10602) full
Pla basic indigo purple (10701) full
Pla basic silver (10102) full
Abs black (40101) full
Pla sparkle slate grey sparkle (13102) full
Light blue
Galaxy purple
Blue and green shift
Black cf
Pink and orange shift
Blue
Turquoise/teal
Galaxy silver
Grey
Gold sparkle
Matte white
Translucent
Purple and red shift
Pink and blue shift
Red
White
Purple
Black
Orange
Hot pink
Sparkle crimson
Matte black sparkle
Yellow`;

const CATEGORIES = [
  "Filament",
  "Resin",
  "Engraving Blank",
  "Vinyl",
  "HTV",
  "Acrylic",
  "Wood",
  "Leatherette",
  "Cork",
  "Paper / Cardstock",
  "Hardware",
  "Packaging",
  "Other",
];

const UNITS = [
  "g",
  "kg",
  "rolls",
  "sheets",
  "cards",
  "pieces",
  "oz",
  "mL",
  "ft",
  "in",
];

const ADJUSTMENT_TYPES = [
  "Manual Adjustment",
  "Stock Added",
  "Stock Used",
  "Estimated Job Usage",
  "Waste / Failed Print",
  "Correction",
];

const EMPTY_ITEM = {
  name: "",
  category: "Filament",
  material: "",
  color: "",
  brand: "",
  location: "",
  unit: "g",
  quantityOnHand: 0,
  reorderThreshold: 0,
  unitCost: 0,
  vendor: "",
  sku: "",
  bambuCode: "",
  hexCode: "",
  catalogId: "",
  msrp: 0,
  bulkPrice: 0,
  spoolWeightGrams: 0,
  notes: "",
  active: true,
};

const EMPTY_ADJUSTMENT = {
  itemId: "",
  type: "Manual Adjustment",
  quantityChange: "",
  jobNumber: "",
  notes: "",
};

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTime(value) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString();
}

function clean(value) {
  return String(value || "").trim();
}

function isLowStock(item) {
  return (
    item.active !== false &&
    num(item.quantityOnHand) <= num(item.reorderThreshold)
  );
}

function getInventoryValue(item) {
  return num(item.quantityOnHand) * num(item.unitCost);
}

function matchesItem(item, searchTerm, categoryFilter, stockFilter) {
  const search = searchTerm.trim().toLowerCase();

  const searchMatches =
    !search ||
    [
      item.name,
      item.category,
      item.material,
      item.color,
      item.brand,
      item.location,
      item.vendor,
      item.sku,
      item.bambuCode,
      item.catalogId,
      item.hexCode,
      item.notes,
    ]
      .filter(Boolean)
      .some((value) =>
        String(value).toLowerCase().includes(search)
      );

  const categoryMatches =
    categoryFilter === "All" || item.category === categoryFilter;

  const stockMatches =
    stockFilter === "All" ||
    (stockFilter === "Low Stock" && isLowStock(item)) ||
    (stockFilter === "In Stock" && num(item.quantityOnHand) > 0) ||
    (stockFilter === "Out of Stock" &&
      num(item.quantityOnHand) <= 0) ||
    (stockFilter === "Inactive" && item.active === false) ||
    (stockFilter === "Active" && item.active !== false);

  return searchMatches && categoryMatches && stockMatches;
}

function matchesLog(log, searchTerm) {
  const search = searchTerm.trim().toLowerCase();

  if (!search) return true;

  return [
    log.itemName,
    log.type,
    log.jobNumber,
    log.notes,
    log.unit,
  ]
    .filter(Boolean)
    .some((value) =>
      String(value).toLowerCase().includes(search)
    );
}

function parseQuantity(line) {
  const quantityMatch = line.match(/\sx\s*([\d.]+)?\s*$/i);
  const fullMatch = /\bfull\b/i.test(line);

  if (quantityMatch) {
    const rawValue = quantityMatch[1];

    return {
      quantity: rawValue ? Number(rawValue) : 1,
      unit: "pieces",
      statusNote: rawValue
        ? ""
        : "Quantity marker x was present with no number, defaulted to 1.",
      cleanedLine: line.replace(/\sx\s*([\d.]+)?\s*$/i, "").trim(),
    };
  }

  if (fullMatch) {
    return {
      quantity: 1,
      unit: "rolls",
      statusNote: "Marked as full roll.",
      cleanedLine: line.replace(/\bfull\b/gi, "").trim(),
    };
  }

  return {
    quantity: 1,
    unit: "rolls",
    statusNote: "No quantity provided. Defaulted to 1 roll/item for now.",
    cleanedLine: line.trim(),
  };
}

function inferFallbackInventoryItem(rawLine) {
  const line = clean(rawLine);

  if (!line) return null;

  const quantityInfo = parseQuantity(line);
  const text = quantityInfo.cleanedLine;
  const lower = text.toLowerCase();

  const skuMatch = text.match(/^([A-Za-z]{1,3}\d{3})\s+/);
  const sku = skuMatch ? skuMatch[1] : "";
  const nameWithoutSku = sku ? text.replace(sku, "").trim() : text;

  let category = "Filament";
  let material = "PLA Basic";
  let color = nameWithoutSku;
  let unit = quantityInfo.unit;
  let brand = "";
  let reorderThreshold = 0;
  let notes = quantityInfo.statusNote;

  if (sku) {
    brand = "Bambu Lab";
  }

  if (lower.includes("stainless steel")) {
    category = "Engraving Blank";
    material = "Stainless Steel";
    color = "";
    unit = "pieces";
  } else if (lower.includes("aluminum")) {
    category = "Engraving Blank";
    material = "Aluminum";
    color = "";
    unit = lower.includes("card") ? "cards" : "pieces";
  } else if (lower.includes("greeting card")) {
    category = "Paper / Cardstock";
    material = "Greeting Card";
    color = "Pearlescent White";
    unit = "cards";
  } else if (lower.includes("cardstock")) {
    category = "Paper / Cardstock";
    material = "Cardstock";
    color = "";
    unit = "sheets";
  } else if (lower.includes("basswood")) {
    category = "Wood";
    material = "Basswood Plywood";
    color = "";
    unit = "sheets";
  } else if (lower.includes("sapele")) {
    category = "Wood";
    material = "Sapele Plywood";
    color = "";
    unit = "sheets";
  } else if (lower.includes("cork")) {
    category = "Cork";
    material = "Cork Sheet";
    color = "";
    unit = "sheets";
  } else if (lower.includes("acrylic")) {
    category = "Acrylic";
    material = "Acrylic";
    color = nameWithoutSku.replace(/acrylic/gi, "").trim();
    unit = "sheets";
  } else if (lower.includes("pu leatherette") || lower.includes("leatherette")) {
    category = "Leatherette";
    material = "PU Leatherette";
    color = nameWithoutSku
      .replace(/pu leatherette/gi, "")
      .replace(/leatherette/gi, "")
      .replace(/fabric/gi, "")
      .trim();
    unit = "sheets";
  } else if (lower.includes("heat transfer vinyl")) {
    category = "HTV";
    material = "Heat Transfer Vinyl";
    color = nameWithoutSku.replace(/heat transfer vinyl/gi, "").trim();
    unit = "sheets";
  } else if (lower.includes("vinyl") || lower.includes("decal sheet")) {
    category = "Vinyl";
    material = lower.includes("reflective")
      ? "Reflective Decal Sheet"
      : "Removable Vinyl";
    color = nameWithoutSku
      .replace(/removable vinyl/gi, "")
      .replace(/decal sheet/gi, "")
      .trim();
    unit = "sheets";
  } else if (lower.includes("patch")) {
    category = "Other";
    material = "PU Iron-On Patch";
    color = nameWithoutSku
      .replace(/rectangular pu iron on patch/gi, "")
      .trim();
    unit = "pieces";
  } else if (lower.includes("petg")) {
    category = "Filament";
    material = lower.includes("hf") ? "PETG HF" : "PETG";
    color = nameWithoutSku
      .replace(/petg/gi, "")
      .replace(/\bhf\b/gi, "")
      .replace(/\([\d]+\)/g, "")
      .trim();
    unit = "rolls";
    brand = "Bambu Lab";
  } else if (lower.includes("abs")) {
    category = "Filament";
    material = "ABS";
    color = nameWithoutSku
      .replace(/abs/gi, "")
      .replace(/\([\d]+\)/g, "")
      .trim();
    unit = "rolls";
    brand = "Bambu Lab";
  } else if (lower.includes("pla")) {
    category = "Filament";

    if (lower.includes("matte")) material = "PLA Matte";
    else if (lower.includes("metal")) material = "PLA Metal";
    else if (lower.includes("sparkle")) material = "PLA Sparkle";
    else material = "PLA Basic";

    color = nameWithoutSku
      .replace(/pla/gi, "")
      .replace(/basic/gi, "")
      .replace(/matte/gi, "")
      .replace(/metal/gi, "")
      .replace(/sparkle/gi, "")
      .replace(/\([\d]+\)/g, "")
      .trim();

    unit = "rolls";
    brand = "Bambu Lab";
  } else {
    category = "Filament";
    material = "PLA Basic";
    color = nameWithoutSku;
    unit = "rolls";
  }

  const displayName =
    category === "Filament"
      ? `${material} — ${color || "Unknown Color"}`
      : sku
        ? `${sku} — ${nameWithoutSku}`
        : nameWithoutSku;

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: displayName,
    category,
    material,
    color,
    brand,
    location: "",
    unit,
    quantityOnHand: Number.isFinite(quantityInfo.quantity)
      ? quantityInfo.quantity
      : 1,
    reorderThreshold,
    unitCost: 0,
    vendor: "",
    sku,
    bambuCode: sku,
    hexCode: "",
    catalogId: "",
    msrp: 0,
    bulkPrice: 0,
    spoolWeightGrams: 0,
    notes,
    active: true,
  };
}

function inferInventoryItem(rawLine, priceMode) {
  const line = clean(rawLine);

  if (!line) return null;

  const quantityInfo = parseQuantity(line);
  const catalogMatch = matchCatalogFromInventoryText(line);

  if (catalogMatch) {
    return createInventoryItemFromCatalog(catalogMatch, {
      quantityOnHand: quantityInfo.quantity,
      unit: quantityInfo.unit || catalogMatch.unit,
      priceMode,
      notes:
        quantityInfo.statusNote ||
        "Imported from raw starter inventory list and matched to material catalog.",
    });
  }

  return inferFallbackInventoryItem(line);
}

function parseBulkInventory(rawText, priceMode) {
  return rawText
    .split("\n")
    .map((line) => inferInventoryItem(line, priceMode))
    .filter(Boolean);
}

function swatchStyle(hexCode) {
  return {
    background: hexCode || "transparent",
    border:
      hexCode && hexCode.toLowerCase() === "#ffffff"
        ? "1px solid #bbb"
        : undefined,
  };
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  step = "0.01",
}) {
  return (
    <label className="field">
      <span>{label}</span>

      <input
        type={type}
        value={value}
        step={type === "number" ? step : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
export default function InventoryPage({
  inventoryItems = [],
  inventoryLogs = [],
  jobs = [],
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onAdjustItem,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [logSearchTerm, setLogSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");

  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState("All");
  const [priceMode, setPriceMode] = useState(
    localStorage.getItem("overkill_material_price_mode") || "msrp"
  );

  const [showAddItem, setShowAddItem] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(true);
  const [showCatalog, setShowCatalog] = useState(true);
  const [bulkText, setBulkText] = useState(RAW_STARTER_INVENTORY);

  const [itemDraft, setItemDraft] = useState(EMPTY_ITEM);

  const [editingItemId, setEditingItemId] = useState("");
  const [editingDraft, setEditingDraft] = useState(null);

  const [adjustmentDraft, setAdjustmentDraft] =
    useState(EMPTY_ADJUSTMENT);

  const catalogCategories = useMemo(() => {
    return getMaterialCatalogCategories();
  }, []);

  const parsedBulkItems = useMemo(() => {
    return parseBulkInventory(bulkText, priceMode);
  }, [bulkText, priceMode]);

  const filteredCatalogItems = useMemo(() => {
    return searchMaterialCatalog(
      catalogSearch,
      catalogCategoryFilter
    ).slice(0, 200);
  }, [catalogSearch, catalogCategoryFilter]);

  const filteredItems = useMemo(() => {
    return inventoryItems
      .filter((item) =>
        matchesItem(
          item,
          searchTerm,
          categoryFilter,
          stockFilter
        )
      )
      .sort((a, b) => {
        if (isLowStock(a) !== isLowStock(b)) {
          return isLowStock(a) ? -1 : 1;
        }

        return (
          String(a.category || "").localeCompare(
            String(b.category || "")
          ) ||
          String(a.name || "").localeCompare(
            String(b.name || "")
          )
        );
      });
  }, [
    inventoryItems,
    searchTerm,
    categoryFilter,
    stockFilter,
  ]);

  const filteredLogs = useMemo(() => {
    return inventoryLogs
      .filter((log) =>
        matchesLog(log, logSearchTerm)
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0)
      )
      .slice(0, 100);
  }, [inventoryLogs, logSearchTerm]);

  const stats = useMemo(() => {
    return inventoryItems.reduce(
      (summary, item) => {
        const value = getInventoryValue(item);

        summary.totalItems += 1;
        summary.totalValue += value;

        if (item.active === false) summary.inactive += 1;
        else summary.active += 1;

        if (isLowStock(item)) summary.lowStock += 1;

        if (num(item.quantityOnHand) <= 0) {
          summary.outOfStock += 1;
        }

        if (item.catalogId || item.bambuCode || item.hexCode) {
          summary.catalogLinked += 1;
        }

        return summary;
      },
      {
        totalItems: 0,
        active: 0,
        inactive: 0,
        lowStock: 0,
        outOfStock: 0,
        totalValue: 0,
        catalogLinked: 0,
      }
    );
  }, [inventoryItems]);

  function updatePriceMode(nextMode) {
    setPriceMode(nextMode);
    localStorage.setItem("overkill_material_price_mode", nextMode);
  }

  function updateItemDraft(key, value) {
    setItemDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateEditingDraft(key, value) {
    setEditingDraft((current) => ({
      ...(current || {}),
      [key]: value,
    }));
  }

  function updateAdjustmentDraft(key, value) {
    setAdjustmentDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function saveNewItem() {
    if (!itemDraft.name.trim()) {
      window.alert("Inventory item name is required.");
      return;
    }

    onAddItem(itemDraft);

    setItemDraft(EMPTY_ITEM);
    setShowAddItem(false);
  }

  function addCatalogItemToInventory(catalogItem) {
    const quantity = window.prompt(
      `How many ${catalogItem.unit || "units"} of ${getMaterialDisplayLabel(
        catalogItem
      )} do you currently have?`,
      catalogItem.category === "Filament" ? "1" : "0"
    );

    if (quantity === null) return;

    const parsedQuantity = Number(quantity || 0);

    if (Number.isNaN(parsedQuantity)) {
      window.alert("Enter a valid quantity.");
      return;
    }

    onAddItem(
      createInventoryItemFromCatalog(catalogItem, {
        quantityOnHand: parsedQuantity,
        priceMode,
        notes: `Added from material catalog using ${priceMode.toUpperCase()} pricing.`,
      })
    );
  }

  function importBulkInventory() {
    if (parsedBulkItems.length === 0) {
      window.alert("No inventory items were detected.");
      return;
    }

    const confirmed = window.confirm(
      `Import ${parsedBulkItems.length} inventory items?\n\nThis adds them to your existing inventory and reloads the app so they appear immediately.`
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const currentItems = JSON.parse(
      localStorage.getItem("overkill_inventory_items") || "[]"
    );

    const currentLogs = JSON.parse(
      localStorage.getItem("overkill_inventory_logs") || "[]"
    );

    const importLogs = parsedBulkItems.map((item) => ({
      id: crypto.randomUUID(),
      itemId: item.id,
      itemName: item.name,
      type: "Bulk Imported",
      quantityChange: Number(item.quantityOnHand || 0),
      quantityAfter: Number(item.quantityOnHand || 0),
      unit: item.unit,
      jobNumber: "",
      notes: item.catalogId
        ? "Imported from raw starter inventory list and matched to material catalog."
        : "Imported from raw starter inventory list.",
      createdAt: now,
    }));

    localStorage.setItem(
      "overkill_inventory_items",
      JSON.stringify([...parsedBulkItems, ...currentItems])
    );

    localStorage.setItem(
      "overkill_inventory_logs",
      JSON.stringify([...importLogs, ...currentLogs])
    );

    window.location.reload();
  }

  function startEditing(item) {
    setEditingItemId(item.id);
    setEditingDraft({ ...item });
  }

  function cancelEditing() {
    setEditingItemId("");
    setEditingDraft(null);
  }

  function saveEditing(itemId) {
    if (!editingDraft?.name?.trim()) {
      window.alert("Inventory item name is required.");
      return;
    }

    onUpdateItem(itemId, editingDraft);

    cancelEditing();
  }

  function runAdjustment() {
    if (!adjustmentDraft.itemId) {
      window.alert("Select an inventory item.");
      return;
    }

    if (
      adjustmentDraft.quantityChange === "" ||
      Number.isNaN(
        Number(adjustmentDraft.quantityChange)
      )
    ) {
      window.alert(
        "Enter a valid quantity change."
      );
      return;
    }

    onAdjustItem(
      adjustmentDraft.itemId,
      adjustmentDraft
    );

    setAdjustmentDraft(EMPTY_ADJUSTMENT);
  }

  function quickUseItem(item) {
    const quantity = window.prompt(
      `How many ${item.unit} were used?`
    );

    if (
      quantity === null ||
      quantity === "" ||
      Number.isNaN(Number(quantity))
    ) {
      return;
    }

    const jobNumber = window.prompt(
      "Related job number? (Optional)"
    );

    const notes = window.prompt(
      "Usage notes? (Optional)"
    );

    onAdjustItem(item.id, {
      type: "Stock Used",
      quantityChange: -Math.abs(num(quantity)),
      jobNumber: jobNumber || "",
      notes: notes || "Quick usage adjustment.",
    });
  }

  function exportInventoryCsv() {
    const headers = [
      "Name",
      "Category",
      "Material",
      "Color",
      "Brand",
      "Location",
      "Quantity",
      "Unit",
      "Reorder Threshold",
      "Unit Cost",
      "Stock Value",
      "Vendor",
      "SKU",
      "Bambu Code",
      "Hex Code",
      "Catalog ID",
      "MSRP",
      "Bulk Price",
      "Active",
      "Notes",
    ];

    const rows = inventoryItems.map((item) => [
      item.name,
      item.category,
      item.material,
      item.color,
      item.brand,
      item.location,
      item.quantityOnHand,
      item.unit,
      item.reorderThreshold,
      item.unitCost,
      getInventoryValue(item),
      item.vendor,
      item.sku,
      item.bambuCode,
      item.hexCode,
      item.catalogId,
      item.msrp,
      item.bulkPrice,
      item.active !== false ? "Yes" : "No",
      item.notes,
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((value) =>
            `"${String(value ?? "").replaceAll(
              `"`,
              `""`
            )}"`
          )
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = `overkill-inventory-${
      new Date().toISOString().split("T")[0]
    }.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function renderColorSwatch(hexCode) {
    if (!hexCode) return null;

    return (
      <span
        className="material-color-swatch"
        style={swatchStyle(hexCode)}
        title={hexCode}
      />
    );
  }
    function renderItemForm(draft, updateFn) {
    return (
      <>
        <div className="form-grid">
          <Field
            label="Item Name"
            value={draft.name}
            onChange={(value) =>
              updateFn("name", value)
            }
          />

          <label className="field">
            <span>Category</span>

            <select
              value={draft.category}
              onChange={(event) =>
                updateFn(
                  "category",
                  event.target.value
                )
              }
            >
              {CATEGORIES.map((category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              ))}
            </select>
          </label>

          <Field
            label="Material"
            value={draft.material}
            onChange={(value) =>
              updateFn("material", value)
            }
          />

          <Field
            label="Color / Finish"
            value={draft.color}
            onChange={(value) =>
              updateFn("color", value)
            }
          />

          <Field
            label="Brand"
            value={draft.brand}
            onChange={(value) =>
              updateFn("brand", value)
            }
          />

          <Field
            label="Location"
            value={draft.location}
            onChange={(value) =>
              updateFn("location", value)
            }
          />

          <label className="field">
            <span>Unit</span>

            <select
              value={draft.unit}
              onChange={(event) =>
                updateFn(
                  "unit",
                  event.target.value
                )
              }
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>

          <Field
            label="Quantity On Hand"
            type="number"
            value={draft.quantityOnHand}
            onChange={(value) =>
              updateFn(
                "quantityOnHand",
                value
              )
            }
          />

          <Field
            label="Reorder Threshold"
            type="number"
            value={draft.reorderThreshold}
            onChange={(value) =>
              updateFn(
                "reorderThreshold",
                value
              )
            }
          />

          <Field
            label="Unit Cost"
            type="number"
            value={draft.unitCost}
            onChange={(value) =>
              updateFn("unitCost", value)
            }
          />

          <Field
            label="Vendor"
            value={draft.vendor}
            onChange={(value) =>
              updateFn("vendor", value)
            }
          />

          <Field
            label="SKU / Part Number"
            value={draft.sku}
            onChange={(value) =>
              updateFn("sku", value)
            }
          />

          <Field
            label="Bambu Code"
            value={draft.bambuCode || ""}
            onChange={(value) =>
              updateFn("bambuCode", value)
            }
          />

          <Field
            label="Hex Code"
            value={draft.hexCode || ""}
            onChange={(value) =>
              updateFn("hexCode", value)
            }
          />

          <Field
            label="Catalog ID"
            value={draft.catalogId || ""}
            onChange={(value) =>
              updateFn("catalogId", value)
            }
          />

          <Field
            label="MSRP"
            type="number"
            value={draft.msrp || 0}
            onChange={(value) =>
              updateFn("msrp", value)
            }
          />

          <Field
            label="Bulk Price"
            type="number"
            value={draft.bulkPrice || 0}
            onChange={(value) =>
              updateFn("bulkPrice", value)
            }
          />

          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={draft.active !== false}
              onChange={(event) =>
                updateFn(
                  "active",
                  event.target.checked
                )
              }
            />

            <span>Active Item</span>
          </label>
        </div>

        <label className="field single-row-gap">
          <span>Notes</span>

          <textarea
            value={draft.notes}
            onChange={(event) =>
              updateFn(
                "notes",
                event.target.value
              )
            }
          />
        </label>
      </>
    );
  }

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">
            Inventory
          </h2>

          <p className="muted-text">
            Track owned stock separately from the material catalog. Catalog is what
            you can get; inventory is what you actually have.
          </p>
        </div>

        <div className="record-button-row">
          <button
            className="secondary-button"
            type="button"
            onClick={exportInventoryCsv}
          >
            <Download size={18} />
            Export CSV
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              setShowCatalog(!showCatalog)
            }
          >
            <Eye size={18} />
            {showCatalog
              ? "Hide Catalog"
              : "Show Catalog"}
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              setShowBulkImport(!showBulkImport)
            }
          >
            <Upload size={18} />
            {showBulkImport
              ? "Hide Bulk Import"
              : "Bulk Import"}
          </button>

          <button
            className="primary-button customer-new-button"
            type="button"
            onClick={() =>
              setShowAddItem(!showAddItem)
            }
          >
            <PackagePlus size={18} />

            {showAddItem
              ? "Hide New Item"
              : "New Inventory Item"}
          </button>
        </div>
      </div>

      <div className="job-queue-summary">
        <div>
          <span>Owned Items</span>
          <strong>{stats.totalItems}</strong>
        </div>

        <div>
          <span>Catalog Items</span>
          <strong>{MATERIAL_CATALOG.length}</strong>
        </div>

        <div>
          <span>Catalog Linked</span>
          <strong>{stats.catalogLinked}</strong>
        </div>

        <div>
          <span>Active Items</span>
          <strong>{stats.active}</strong>
        </div>

        <div>
          <span>Low Stock</span>
          <strong>{stats.lowStock}</strong>
        </div>

        <div>
          <span>Out of Stock</span>
          <strong>{stats.outOfStock}</strong>
        </div>

        <div>
          <span>Inventory Value</span>
          <strong>
            {money(stats.totalValue)}
          </strong>
        </div>

        <div>
          <span>Pricing Mode</span>
          <strong>{priceMode.toUpperCase()}</strong>
        </div>

        <div>
          <span>Logs</span>
          <strong>
            {inventoryLogs.length}
          </strong>
        </div>
      </div>

      <div className="form-card">
        <div className="page-heading-row">
          <div>
            <h3 className="card-title">
              Material Pricing Mode
            </h3>

            <p className="muted-text">
              Used when adding catalog materials to inventory or bulk importing
              matched items.
            </p>
          </div>

          <label className="filter-select-field">
            <span>Price Mode</span>

            <select
              value={priceMode}
              onChange={(event) =>
                updatePriceMode(event.target.value)
              }
            >
              {MATERIAL_PRICE_MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {showCatalog && (
        <div className="form-card">
          <div className="page-heading-row">
            <div>
              <h3 className="card-title">
                Material Catalog — Can Get
              </h3>

              <p className="muted-text">
                Search Bambu filament, engraving blanks, cutting materials,
                vinyl, acrylic, wood, leatherette, paper, and cork.
              </p>
            </div>
          </div>

          <div className="filter-toolbar">
            <label className="search-field">
              <Search size={18} />

              <input
                type="search"
                value={catalogSearch}
                placeholder="Search catalog by material, color, code, hex, category..."
                onChange={(event) =>
                  setCatalogSearch(event.target.value)
                }
              />
            </label>

            <label className="filter-select-field">
              <span>Category</span>

              <select
                value={catalogCategoryFilter}
                onChange={(event) =>
                  setCatalogCategoryFilter(
                    event.target.value
                  )
                }
              >
                <option value="All">
                  All Categories
                </option>

                {catalogCategories.map((category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <div className="filter-count-pill">
              Showing {filteredCatalogItems.length} of{" "}
              {MATERIAL_CATALOG.length}
            </div>
          </div>

          <div className="dashboard-list single-row-gap">
            {filteredCatalogItems.map((catalogItem) => {
              const ownedQuantity =
                getOwnedQuantityForCatalog(
                  inventoryItems,
                  catalogItem
                );

              const price = getMaterialPrice(
                catalogItem,
                priceMode
              );

              return (
                <div
                  className="dashboard-list-row"
                  key={catalogItem.id}
                >
                  <div>
                    <strong>
                      {renderColorSwatch(
                        catalogItem.hexCode
                      )}

                      {getMaterialDisplayLabel(
                        catalogItem
                      )}
                    </strong>

                    <span>
                      {catalogItem.category} •{" "}
                      {catalogItem.materialType} •{" "}
                      {catalogItem.hexCode || "No hex"} •{" "}
                      {money(price)}
                    </span>

                    <small>
                      Owned: {ownedQuantity}{" "}
                      {catalogItem.unit || "units"} • MSRP{" "}
                      {money(catalogItem.msrp)} • Bulk{" "}
                      {money(catalogItem.bulkPrice)}
                    </small>
                  </div>

                  <div className="dashboard-status-stack">
                    {ownedQuantity > 0 ? (
                      <span className="status-pill">
                        Owned
                      </span>
                    ) : (
                      <span className="status-pill">
                        Can Get
                      </span>
                    )}

                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        addCatalogItemToInventory(catalogItem)
                      }
                    >
                      <Plus size={14} />
                      Add to Inventory
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
            {showBulkImport && (
        <div className="form-card customer-create-card">
          <div className="page-heading-row">
            <div>
              <h3 className="card-title">
                Bulk Import Starter Inventory
              </h3>

              <p className="muted-text">
                Paste raw inventory lines here. Codes like (10501) auto-match
                the catalog and pull color, hex, price, and Bambu code.
              </p>
            </div>

            <button
              className="primary-button"
              type="button"
              onClick={importBulkInventory}
            >
              <Upload size={18} />
              Import {parsedBulkItems.length} Items
            </button>
          </div>

          <label className="field single-row-gap">
            <span>Raw Inventory Text</span>

            <textarea
              value={bulkText}
              onChange={(event) =>
                setBulkText(event.target.value)
              }
              rows={14}
            />
          </label>

          <div className="form-card single-row-gap">
            <h3 className="card-title">
              Import Preview
            </h3>

            {parsedBulkItems.length === 0 ? (
              <p className="muted-text">
                No parsed items yet.
              </p>
            ) : (
              <div className="dashboard-list">
                {parsedBulkItems.slice(0, 30).map((item) => (
                  <div
                    className="dashboard-list-row"
                    key={item.id}
                  >
                    <div>
                      <strong>
                        {renderColorSwatch(item.hexCode)}
                        {item.name}
                      </strong>

                      <span>
                        {item.category}
                        {item.material
                          ? ` • ${item.material}`
                          : ""}
                        {item.color
                          ? ` • ${item.color}`
                          : ""}
                        {item.bambuCode || item.sku
                          ? ` • ${item.bambuCode || item.sku}`
                          : ""}
                      </span>

                      {item.notes && (
                        <small>{item.notes}</small>
                      )}
                    </div>

                    <span className="status-pill">
                      {item.quantityOnHand} {item.unit} •{" "}
                      {money(item.unitCost)}
                    </span>
                  </div>
                ))}

                {parsedBulkItems.length > 30 && (
                  <p className="helper-note">
                    Showing first 30 of {parsedBulkItems.length} parsed items.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showAddItem && (
        <div className="form-card customer-create-card">
          <div className="page-heading-row">
            <div>
              <h3 className="card-title">
                Create Inventory Item
              </h3>
            </div>

            <div className="record-button-row">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setShowAddItem(false);
                  setItemDraft(EMPTY_ITEM);
                }}
              >
                <XCircle size={18} />
                Cancel
              </button>

              <button
                className="primary-button"
                type="button"
                onClick={saveNewItem}
              >
                <Save size={18} />
                Save Item
              </button>
            </div>
          </div>

          {renderItemForm(
            itemDraft,
            updateItemDraft
          )}
        </div>
      )}

      <div className="filter-toolbar">
        <label className="search-field">
          <Search size={18} />

          <input
            type="search"
            value={searchTerm}
            placeholder="Search owned inventory..."
            onChange={(event) =>
              setSearchTerm(
                event.target.value
              )
            }
          />
        </label>

        <label className="filter-select-field">
          <span>Category</span>

          <select
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(
                event.target.value
              )
            }
          >
            <option value="All">
              All Categories
            </option>

            {CATEGORIES.map((category) => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-select-field">
          <span>Stock</span>

          <select
            value={stockFilter}
            onChange={(event) =>
              setStockFilter(
                event.target.value
              )
            }
          >
            <option value="All">
              All Stock
            </option>

            <option value="Active">
              Active
            </option>

            <option value="Inactive">
              Inactive
            </option>

            <option value="Low Stock">
              Low Stock
            </option>

            <option value="In Stock">
              In Stock
            </option>

            <option value="Out of Stock">
              Out of Stock
            </option>
          </select>
        </label>

        <div className="filter-count-pill">
          Showing {filteredItems.length} of{" "}
          {inventoryItems.length}
        </div>
      </div>

      <div className="form-card">
        <h3 className="card-title">
          Inventory Adjustment / Usage
        </h3>

        <div className="form-grid">
          <label className="field">
            <span>Inventory Item</span>

            <select
              value={adjustmentDraft.itemId}
              onChange={(event) =>
                updateAdjustmentDraft(
                  "itemId",
                  event.target.value
                )
              }
            >
              <option value="">
                Select item...
              </option>

              {inventoryItems.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name} —{" "}
                  {item.quantityOnHand}{" "}
                  {item.unit}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Adjustment Type</span>

            <select
              value={adjustmentDraft.type}
              onChange={(event) =>
                updateAdjustmentDraft(
                  "type",
                  event.target.value
                )
              }
            >
              {ADJUSTMENT_TYPES.map(
                (type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {type}
                  </option>
                )
              )}
            </select>
          </label>

          <Field
            label="Quantity Change"
            type="number"
            value={
              adjustmentDraft.quantityChange
            }
            onChange={(value) =>
              updateAdjustmentDraft(
                "quantityChange",
                value
              )
            }
          />

          <label className="field">
            <span>Related Job</span>

            <select
              value={adjustmentDraft.jobNumber}
              onChange={(event) =>
                updateAdjustmentDraft(
                  "jobNumber",
                  event.target.value
                )
              }
            >
              <option value="">
                No Job
              </option>

              {jobs.map((job) => (
                <option
                  key={job.id}
                  value={job.jobNumber}
                >
                  {job.jobNumber} —{" "}
                  {job.customerName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field single-row-gap">
          <span>Notes</span>

          <textarea
            value={adjustmentDraft.notes}
            onChange={(event) =>
              updateAdjustmentDraft(
                "notes",
                event.target.value
              )
            }
          />
        </label>

        <button
          className="primary-button single-row-gap"
          type="button"
          onClick={runAdjustment}
        >
          <Plus size={18} />
          Apply Adjustment
        </button>
      </div>

      <div className="inventory-grid single-row-gap">
        {filteredItems.map((item) => {
          const lowStock =
            isLowStock(item);

          const isEditing =
            editingItemId === item.id;

          return (
            <article
              key={item.id}
              className={`inventory-card ${
                lowStock
                  ? "inventory-low-stock"
                  : ""
              }`}
            >
              {isEditing ? (
                <>
                  <div className="page-heading-row">
                    <h3 className="card-title">
                      Edit Item
                    </h3>

                    <div className="record-button-row">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={
                          cancelEditing
                        }
                      >
                        <XCircle size={18} />
                        Cancel
                      </button>

                      <button
                        className="primary-button"
                        type="button"
                        onClick={() =>
                          saveEditing(
                            item.id
                          )
                        }
                      >
                        <Save size={18} />
                        Save
                      </button>
                    </div>
                  </div>

                  {renderItemForm(
                    editingDraft || item,
                    updateEditingDraft
                  )}
                </>
              ) : (
                <>
                  <div className="record-card-top">
                    <div>
                      <h3>
                        {renderColorSwatch(item.hexCode)}
                        {item.name}
                      </h3>

                      <p>
                        {item.category}
                        {item.material
                          ? ` • ${item.material}`
                          : ""}
                        {item.color
                          ? ` • ${item.color}`
                          : ""}
                        {item.bambuCode || item.sku
                          ? ` • ${item.bambuCode || item.sku}`
                          : ""}
                      </p>
                    </div>

                    <div className="dashboard-status-stack">
                      {item.catalogId && (
                        <span className="status-pill">
                          Catalog Linked
                        </span>
                      )}

                      {lowStock && (
                        <span className="status-pill">
                          <AlertTriangle
                            size={14}
                          />
                          Low Stock
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="inventory-stock-display">
                    <strong>
                      {item.quantityOnHand}{" "}
                      {item.unit}
                    </strong>

                    <span>
                      Reorder at{" "}
                      {
                        item.reorderThreshold
                      }{" "}
                      {item.unit}
                    </span>
                  </div>

                  <div className="record-details">
                    <div>
                      <span>Brand</span>

                      <strong>
                        {item.brand ||
                          "Not Set"}
                      </strong>
                    </div>

                    <div>
                      <span>Location</span>

                      <strong>
                        {item.location ||
                          "Not Set"}
                      </strong>
                    </div>

                    <div>
                      <span>Unit Cost</span>

                      <strong>
                        {money(
                          item.unitCost
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Stock Value</span>

                      <strong>
                        {money(
                          getInventoryValue(
                            item
                          )
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>MSRP</span>

                      <strong>
                        {money(item.msrp || 0)}
                      </strong>
                    </div>

                    <div>
                      <span>Bulk</span>

                      <strong>
                        {money(item.bulkPrice || 0)}
                      </strong>
                    </div>
                  </div>

                  {item.notes && (
                    <p className="helper-note">
                      {item.notes}
                    </p>
                  )}

                  <div className="record-button-row quote-button-row">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        startEditing(item)
                      }
                    >
                      <Edit size={18} />
                      Edit
                    </button>

                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        quickUseItem(item)
                      }
                    >
                      <Plus size={18} />
                      Quick Use
                    </button>

                    <button
                      className="secondary-button danger-button"
                      type="button"
                      onClick={() =>
                        onDeleteItem(
                          item.id
                        )
                      }
                    >
                      <Trash2 size={18} />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      <div className="form-card single-row-gap">
        <h3 className="card-title">
          Inventory Logs
        </h3>

        <label className="search-field single-row-gap">
          <Search size={18} />

          <input
            type="search"
            value={logSearchTerm}
            placeholder="Search logs..."
            onChange={(event) =>
              setLogSearchTerm(
                event.target.value
              )
            }
          />
        </label>

        <div className="dashboard-list">
          {filteredLogs.map((log) => (
            <div
              className="dashboard-list-row"
              key={log.id}
            >
              <div>
                <strong>
                  {log.itemName}
                </strong>

                <span>
                  {log.type} •{" "}
                  {log.quantityChange >
                  0
                    ? "+"
                    : ""}
                  {log.quantityChange}{" "}
                  {log.unit} →{" "}
                  {
                    log.quantityAfter
                  }{" "}
                  {log.unit}
                </span>

                {log.notes && (
                  <small>
                    {log.notes}
                  </small>
                )}
              </div>

              <div className="dashboard-status-stack">
                {log.jobNumber && (
                  <span className="status-pill">
                    {log.jobNumber}
                  </span>
                )}

                <span>
                  {formatDateTime(
                    log.createdAt
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}