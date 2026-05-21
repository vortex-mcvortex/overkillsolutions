import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Wand2,
  XCircle,
  UserCheck,
  Star,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  MATERIAL_CATALOG,
  MATERIAL_PRICE_MODES,
  getMaterialDisplayLabel,
  getMaterialPrice,
} from "../data/materialCatalog";

const DEFAULT_SETTINGS = {
  defaultTaxPercent: 7,
  defaultDepositPercent: 40,

  customerFields: {
    requireName: true,
    requirePhone: true,
    requireEmail: false,
    showAddress: true,
  },

  machineRates: {
    p1s: 3,
    x1c: 3,
    h2sPrint: 3,
    h2sLaser10w: 4,
    h2sLaser40w: 6,
    h2sCutter: 4,
  },

  machineModules: [
    { id: "p1s", label: "Bambu P1S", type: "printer", rateKey: "p1s", active: true },
    { id: "x1c", label: "Bambu X1C", type: "printer", rateKey: "x1c", active: true },
    { id: "h2s", label: "Bambu H2S", type: "printer", rateKey: "h2sPrint", active: true },
    { id: "h2s-laser-10w", label: "H2S Laser — 10W", type: "laser", rateKey: "h2sLaser10w", active: true },
    { id: "h2s-laser-40w", label: "H2S Laser — 40W", type: "laser", rateKey: "h2sLaser40w", active: true },
    { id: "h2s-cutter", label: "H2S Cutter", type: "cutter", rateKey: "h2sCutter", active: true },
  ],

  nozzles: [
    { id: "0.2", label: "0.2mm — Detail", diameter: 0.2, machineRateAdd: 1, marketMultiplier: 1.25, active: true },
    { id: "0.4", label: "0.4mm — Standard", diameter: 0.4, machineRateAdd: 0, marketMultiplier: 1, active: true },
    { id: "0.6", label: "0.6mm — Strong/Faster", diameter: 0.6, machineRateAdd: 0.25, marketMultiplier: 1.05, active: true },
    { id: "0.8", label: "0.8mm — Heavy Duty", diameter: 0.8, machineRateAdd: 0.5, marketMultiplier: 1.1, active: true },
  ],

  cadPresets: [
    { id: "basic", label: "Basic CAD", amount: 25, active: true },
    { id: "standard", label: "Standard CAD", amount: 45, active: true },
    { id: "advanced", label: "Advanced CAD", amount: 70, active: true },
    { id: "complex", label: "Complex CAD", amount: 110, active: true },
    { id: "engineering", label: "Engineering CAD", amount: 175, active: true },
    { id: "custom", label: "Custom Quote", amount: 0, active: true },
  ],

  setupFees: {
    basic: 5,
    moderate: 15,
    advanced: 30,
  },

  integrationCharges: {
    none: 0,
    simple: 15,
    moderate: 30,
    advanced: 50,
    complex: 75,
  },

  minimumCharges: {
    basicProjectMinimum: 25,
    printMinimum: 25,
    cadPrintMinimum: 60,
    engravingMinimum: 20,
    vinylMinimum: 20,
    customMinimum: 40,
  },

  bufferCurve: {
    under50: 20,
    under100: 15,
    under200: 12,
    under400: 10,
    over400: 8,
  },

  printMaterials: [
    { id: "pla", label: "PLA", costPerGram: 0.03, group: "standard", active: true },
    { id: "petg", label: "PETG", costPerGram: 0.03, group: "standard", active: true },
    { id: "abs", label: "ABS", costPerGram: 0.03, group: "standard", active: true },
  ],

  engravingMaterials: [
    { id: "none", label: "None / Customer Provided", packCost: 0, packCount: 1, colors: "N/A", materialType: "customer-provided", active: true },
    { id: "aluminum-card", label: "Aluminum Card", packCost: 3.89, packCount: 1, colors: "Black, Silver, Red, Blue, Gold, Rainbow", materialType: "metal", active: true },
    { id: "stainless-steel", label: "Stainless Steel", packCost: 0, packCount: 1, colors: "Raw Stainless", materialType: "metal", active: true },
    { id: "titanium", label: "Titanium", packCost: 0, packCount: 1, colors: "Raw Titanium", materialType: "metal", active: true },
  ],

  vinylMaterials: [
    { id: "none", label: "None / Customer Provided", packCost: 0, packCount: 1, colors: "N/A", active: true },
    { id: "matte-removable-vinyl", label: "Matte Removable Vinyl", packCost: 9.89, packCount: 10, colors: "Black, Red, Orange, Yellow, Green, Blue, Silver, White", active: true },
  ],
};

const COMPLEXITY_LEVELS = [
  { id: "none", label: "None", engraving: 0, vinyl: 0 },
  { id: "simple", label: "Simple", engraving: 10, vinyl: 8 },
  { id: "moderate", label: "Moderate", engraving: 20, vinyl: 18 },
  { id: "advanced", label: "Advanced", engraving: 35, vinyl: 30 },
  { id: "complex", label: "Complex", engraving: 50, vinyl: 45 },
];

const TEMPLATE_STORAGE_KEY = "overkill_quote_templates";

const DEFAULT_TEMPLATE_DRAFT = {
  name: "",
  tags: "",
  notes: "",
  favorite: false,
};

const DEFAULT_FORM = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  customerAddress: "",
  customerKey: "",
  customerNotes: "",
  customerTags: "",
  preferredContactMethod: "Not Set",
  preferredPaymentMethod: "Not Set",
  jobName: "",
  jobAspects: {
    cad: false,
    printing: true,
    engraving: false,
    vinyl: false,
    custom: false,
  },
  printRuns: [],
  printSetupOverride: "",
  quantity: 1,
  cadPresetId: "basic",
  customCadAmount: "",
  engravingModuleId: "h2s-laser-10w",
  engravingMaterialId: "none",
  engravingMaterialColor: "N/A",
  engravingMaterialUnits: 1,
  engravingComplexity: "simple",
  engravingFee: 0,
  vinylModuleId: "h2s-cutter",
  vinylMaterialLines: [],
  vinylComplexity: "simple",
  vinylFee: 0,
  integrationComplexity: "none",
  integrationFee: 0,
  customFee: 0,
  extraLaborHours: 0,
  extraLaborRate: 30,
  bufferOverridePercent: "",
  complexityFee: 0,
  finishingFee: 0,
  shippingFee: 0,
  discount: 0,
  depositPercent: 40,
  taxEnabled: false,
  taxPercent: 7,
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

function roundUpMoney(value) {
  return Math.ceil(value * 100) / 100;
}

function clean(value) {
  return String(value || "").trim();
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function splitTags(tags) {
  return String(tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function colorsToArray(colors) {
  if (Array.isArray(colors)) return colors;
  return String(colors || "N/A")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCadPresets(savedCadPresets) {
  if (Array.isArray(savedCadPresets)) return savedCadPresets;

  if (savedCadPresets && typeof savedCadPresets === "object") {
    return DEFAULT_SETTINGS.cadPresets.map((preset) => ({
      ...preset,
      amount: savedCadPresets[preset.id] ?? preset.amount,
    }));
  }

  return DEFAULT_SETTINGS.cadPresets;
}

function getSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("overkill_settings") || "{}");

    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      customerFields: { ...DEFAULT_SETTINGS.customerFields, ...(saved.customerFields || {}) },
      machineRates: { ...DEFAULT_SETTINGS.machineRates, ...(saved.machineRates || {}) },
      machineModules: saved.machineModules || DEFAULT_SETTINGS.machineModules,
      nozzles: saved.nozzles || DEFAULT_SETTINGS.nozzles,
      setupFees: { ...DEFAULT_SETTINGS.setupFees, ...(saved.setupFees || {}) },
      integrationCharges: { ...DEFAULT_SETTINGS.integrationCharges, ...(saved.integrationCharges || {}) },
      minimumCharges: { ...DEFAULT_SETTINGS.minimumCharges, ...(saved.minimumCharges || {}) },
      bufferCurve: { ...DEFAULT_SETTINGS.bufferCurve, ...(saved.bufferCurve || {}) },
      cadPresets: normalizeCadPresets(saved.cadPresets),
      printMaterials: saved.printMaterials || DEFAULT_SETTINGS.printMaterials,
      engravingMaterials: saved.engravingMaterials || DEFAULT_SETTINGS.engravingMaterials,
      vinylMaterials: saved.vinylMaterials || DEFAULT_SETTINGS.vinylMaterials,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
function getStoredTemplates() {
  try {
    const saved = JSON.parse(localStorage.getItem(TEMPLATE_STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveStoredTemplates(templates) {
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

function stripCustomerInfo(form) {
  return {
    ...form,
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    customerAddress: "",
    customerKey: "",
    customerNotes: "",
    customerTags: "",
    preferredContactMethod: "Not Set",
    preferredPaymentMethod: "Not Set",
    jobName: form.jobName || "",
  };
}

function regenerateFormIds(form) {
  return {
    ...form,
    printRuns: (form.printRuns || []).map((run) => ({
      ...run,
      id: crypto.randomUUID(),
    })),
    vinylMaterialLines: (form.vinylMaterialLines || []).map((line) => ({
      ...line,
      id: crypto.randomUUID(),
    })),
  };
}

function customerKey(record) {
  const email = clean(record.customerEmail || record.formData?.customerEmail).toLowerCase();
  const phone = digitsOnly(record.customerPhone || record.formData?.customerPhone);
  const name = clean(record.customerName || record.formData?.customerName).toLowerCase();

  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  if (name) return `name:${name}`;

  return `unknown:${record.id}`;
}

function getCustomerInfo(record) {
  return {
    key: customerKey(record),
    source: "generated",
    name: clean(record.customerName || record.formData?.customerName) || "Unknown Customer",
    phone: clean(record.customerPhone || record.formData?.customerPhone),
    email: clean(record.customerEmail || record.formData?.customerEmail),
    address: clean(record.customerAddress || record.formData?.customerAddress),
    notes: "",
    tags: "",
    preferredContactMethod: "Not Set",
    preferredPaymentMethod: "Not Set",
    totalQuotes: record.quoteNumber ? 1 : 0,
    totalJobs: record.jobNumber ? 1 : 0,
    totalValue: num(record.finalTotal),
    latestActivity: record.updatedAt || record.createdAt || record.approvedAt || "",
  };
}

function normalizeCustomerData(customer = {}) {
  return {
    ...customer,
    notes: customer.notes || "",
    tags: customer.tags || "",
    preferredContactMethod: customer.preferredContactMethod || "Not Set",
    preferredPaymentMethod: customer.preferredPaymentMethod || "Not Set",
  };
}

function buildCustomerList(quotes = [], jobs = [], manualCustomers = [], customerOverrides = {}) {
  const map = new Map();

  manualCustomers.forEach((manualCustomer) => {
    const customer = normalizeCustomerData(manualCustomer);

    map.set(customer.key, {
      key: customer.key,
      source: "manual",
      name: customer.name || "Manual Customer",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
      tags: customer.tags || "",
      preferredContactMethod: customer.preferredContactMethod || "Not Set",
      preferredPaymentMethod: customer.preferredPaymentMethod || "Not Set",
      totalQuotes: 0,
      totalJobs: 0,
      totalValue: 0,
      latestActivity: customer.updatedAt || customer.createdAt || "",
    });
  });

  [...quotes, ...jobs].forEach((record) => {
    const info = getCustomerInfo(record);
    const override = normalizeCustomerData(customerOverrides[info.key] || {});

    if (!map.has(info.key)) {
      map.set(info.key, {
        ...info,
        ...override,
        name: override.name || info.name,
        phone: override.phone || info.phone,
        email: override.email || info.email,
        address: override.address || info.address,
        notes: override.notes || info.notes,
        tags: override.tags || info.tags,
        preferredContactMethod: override.preferredContactMethod || info.preferredContactMethod,
        preferredPaymentMethod: override.preferredPaymentMethod || info.preferredPaymentMethod,
      });
    } else {
      const existing = map.get(info.key);
      const existingDate = existing.latestActivity ? new Date(existing.latestActivity) : new Date(0);
      const infoDate = info.latestActivity ? new Date(info.latestActivity) : new Date(0);

      map.set(info.key, {
        ...existing,
        name: override.name || existing.name || info.name,
        phone: override.phone || existing.phone || info.phone,
        email: override.email || existing.email || info.email,
        address: override.address || existing.address || info.address,
        notes: override.notes || existing.notes || "",
        tags: override.tags || existing.tags || "",
        preferredContactMethod:
          override.preferredContactMethod ||
          existing.preferredContactMethod ||
          "Not Set",
        preferredPaymentMethod:
          override.preferredPaymentMethod ||
          existing.preferredPaymentMethod ||
          "Not Set",
        totalQuotes: existing.totalQuotes + info.totalQuotes,
        totalJobs: existing.totalJobs + info.totalJobs,
        totalValue: existing.totalValue + info.totalValue,
        latestActivity: infoDate > existingDate ? info.latestActivity : existing.latestActivity,
      });
    }
  });

  return [...map.values()].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );
}

function findCustomerMatches(form, customers) {
  const typedName = clean(form.customerName).toLowerCase();
  const typedPhone = digitsOnly(form.customerPhone);
  const typedEmail = clean(form.customerEmail).toLowerCase();

  if (!typedName && !typedPhone && !typedEmail) return [];

  return customers
    .map((customer) => {
      let score = 0;

      const customerName = clean(customer.name).toLowerCase();
      const customerPhone = digitsOnly(customer.phone);
      const customerEmail = clean(customer.email).toLowerCase();

      if (typedEmail && customerEmail && typedEmail === customerEmail) score += 100;
      if (typedPhone && customerPhone && typedPhone === customerPhone) score += 95;
      if (typedPhone.length >= 4 && customerPhone.includes(typedPhone)) score += 45;
      if (typedName.length >= 3 && customerName === typedName) score += 75;
      if (typedName.length >= 3 && customerName.includes(typedName)) score += 35;
      if (typedName.length >= 3 && typedName.includes(customerName)) score += 25;

      return {
        ...customer,
        matchScore: score,
      };
    })
    .filter((customer) => customer.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);
}

function searchCustomerMatches(searchTerm, customers) {
  const search = clean(searchTerm).toLowerCase();

  if (!search) return [];

  return customers
    .filter((customer) => {
      return [
        customer.name,
        customer.phone,
        customer.email,
        customer.address,
        customer.notes,
        customer.tags,
        customer.preferredContactMethod,
        customer.preferredPaymentMethod,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    })
    .slice(0, 8);
}

function materialUnitCost(material) {
  if (!material || !material.packCount) return 0;
  return num(material.packCost) / Math.max(1, num(material.packCount));
}

function getActiveItems(items) {
  return (items || []).filter((item) => item.active !== false);
}

function getById(items, id, fallbackIndex = 0) {
  return items.find((item) => item.id === id) || items[fallbackIndex] || {};
}

function getActiveModules(settings, type) {
  return getActiveItems(settings.machineModules).filter((module) => module.type === type);
}

function getActiveNozzles(settings) {
  return getActiveItems(settings.nozzles);
}

function getPrinterModule(settings, id) {
  const printers = getActiveModules(settings, "printer");
  return getById(printers, id, 0);
}

function getLaserModule(settings, id) {
  const lasers = getActiveModules(settings, "laser");
  return getById(lasers, id, 0);
}

function getCutterModule(settings, id) {
  const cutters = getActiveModules(settings, "cutter");
  return getById(cutters, id, 0);
}

function getNozzle(settings, id) {
  const nozzles = getActiveNozzles(settings);
  return getById(nozzles, id, 0);
}
function getMaterialPriceMode() {
  return localStorage.getItem("overkill_material_price_mode") || "msrp";
}

function isCatalogFilament(item) {
  return item?.category === "Filament";
}

function getCatalogPrintMaterials() {
  return MATERIAL_CATALOG.filter(isCatalogFilament).map((item) => {
    const priceMode = getMaterialPriceMode();
    const spoolWeight = Math.max(1, num(item.spoolWeightGrams || 1000));
    const spoolPrice = getMaterialPrice(item, priceMode);
    const costPerGram = spoolPrice / spoolWeight;

    return {
      id: item.id,
      catalogId: item.id,
      label: getMaterialDisplayLabel(item),
      materialType: item.materialType,
      colorName: item.colorName,
      bambuCode: item.bambuCode,
      hexCode: item.hexCode,
      brand: item.brand,
      costPerGram,
      spoolPrice,
      spoolWeightGrams: spoolWeight,
      group:
        /sparkle|metal|cf|carbon|tpu|asa|abs|paht|nylon|support/i.test(
          `${item.materialType} ${item.colorName}`
        )
          ? "specialty"
          : "standard",
      active: item.active !== false,
    };
  });
}

function getAllPrintMaterials(settings) {
  const catalogMaterials = getCatalogPrintMaterials();

  const legacyMaterials = getActiveItems(settings.printMaterials).map((item) => ({
    ...item,
    catalogId: item.catalogId || "",
    materialType: item.materialType || item.label,
    colorName: item.colorName || "",
    bambuCode: item.bambuCode || "",
    hexCode: item.hexCode || "",
    spoolPrice: item.spoolPrice || item.costPerGram * 1000,
    spoolWeightGrams: item.spoolWeightGrams || 1000,
  }));

  const catalogIds = new Set(catalogMaterials.map((item) => item.id));
  const uniqueLegacyMaterials = legacyMaterials.filter((item) => !catalogIds.has(item.id));

  return [...catalogMaterials, ...uniqueLegacyMaterials];
}

function getPrintMaterialById(settings, materialId) {
  const materials = getAllPrintMaterials(settings);
  return getById(materials, materialId, 0);
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

function getInventoryMatchesForMaterial(inventoryItems = [], material = {}) {
  if (!material) return [];

  const materialCatalogId = String(material.catalogId || material.id || "").toLowerCase();
  const materialCode = String(material.bambuCode || "").toLowerCase();
  const materialType = String(material.materialType || "").toLowerCase();
  const colorName = String(material.colorName || "").toLowerCase();

  return inventoryItems.filter((item) => {
    if (item.active === false) return false;

    const itemCatalogId = String(item.catalogId || "").toLowerCase();
    const itemCode = String(item.bambuCode || item.sku || "").toLowerCase();
    const itemMaterial = String(item.material || "").toLowerCase();
    const itemColor = String(item.color || "").toLowerCase();

    if (materialCatalogId && itemCatalogId && itemCatalogId === materialCatalogId) {
      return true;
    }

    if (materialCode && itemCode && itemCode === materialCode) {
      return true;
    }

    return (
      materialType &&
      colorName &&
      itemMaterial === materialType &&
      itemColor === colorName
    );
  });
}

function getStockInfoForMaterial(inventoryItems = [], material = {}, requestedAmount = 0) {
  const matches = getInventoryMatchesForMaterial(inventoryItems, material);

  const totalOnHand = matches.reduce((sum, item) => {
    return sum + Number(item.quantityOnHand || 0);
  }, 0);

  const reorderThreshold = matches.reduce((sum, item) => {
    return sum + Number(item.reorderThreshold || 0);
  }, 0);

  const requested = Number(requestedAmount || 0);
  const remainingAfterJob = totalOnHand - requested;

  let status = "not-owned";
  let label = "Not in inventory";

  if (matches.length > 0 && totalOnHand <= 0) {
    status = "out";
    label = "Out of stock";
  } else if (matches.length > 0 && remainingAfterJob < 0) {
    status = "short";
    label = "Not enough stock";
  } else if (matches.length > 0 && remainingAfterJob <= reorderThreshold) {
    status = "low-after";
    label = "Low after job";
  } else if (matches.length > 0) {
    status = "in-stock";
    label = "In stock";
  }

  return {
    matches,
    totalOnHand,
    requestedAmount: requested,
    remainingAfterJob,
    reorderThreshold,
    status,
    label,
  };
}

function suggestedMachineRate(settings, printerId, material, nozzle) {
  const printer = getPrinterModule(settings, printerId);
  const baseRate = num(settings.machineRates[printer.rateKey]);
  const specialtyAdd = material?.group === "specialty" ? 1.5 : 0;

  return roundUpMoney(baseRate + specialtyAdd + num(nozzle.machineRateAdd));
}

function suggestedSetupTier(material, nozzle) {
  const diameter = num(nozzle.diameter || nozzle.id);

  if (material?.group === "specialty") return "advanced";
  if (diameter <= 0.25) return "moderate";
  if (diameter >= 0.8) return "moderate";
  return "basic";
}

function setupReason(material, nozzle) {
  const diameter = num(nozzle.diameter || nozzle.id);

  if (material?.group === "specialty") {
    return "Specialty filament is harder to tune, load, and recover from failed attempts.";
  }

  if (diameter <= 0.25) {
    return "Small nozzles print slower and need more detail-focused setup.";
  }

  if (diameter >= 0.8) {
    return "Large nozzles usually need strength-focused setup and heavier extrusion tuning.";
  }

  return "Standard material with a standard nozzle is the easiest normal setup.";
}

function curvedBufferPercent(subtotal, settings) {
  if (subtotal <= 50) return num(settings.bufferCurve.under50);
  if (subtotal <= 100) return num(settings.bufferCurve.under100);
  if (subtotal <= 200) return num(settings.bufferCurve.under200);
  if (subtotal <= 400) return num(settings.bufferCurve.under400);
  return num(settings.bufferCurve.over400);
}
function createPrintRun(settings) {
  const activeMaterials = getAllPrintMaterials(settings);
  const activePrinters = getActiveModules(settings, "printer");
  const activeNozzles = getActiveNozzles(settings);

  const material = activeMaterials[0] || DEFAULT_SETTINGS.printMaterials[0];
  const printer = activePrinters[0] || DEFAULT_SETTINGS.machineModules[0];
  const nozzle =
    activeNozzles.find((item) => String(item.diameter) === "0.4") ||
    activeNozzles[0] ||
    DEFAULT_SETTINGS.nozzles[1];

  return {
    id: crypto.randomUUID(),
    printerId: printer.id,
    materialId: material.id,
    materialCatalogId: material.catalogId || "",
    materialLabel: material.label || "",
    materialType: material.materialType || "",
    materialColorName: material.colorName || "",
    materialBambuCode: material.bambuCode || "",
    materialHexCode: material.hexCode || "",
    materialCostPerGram: num(material.costPerGram),
    nozzleSize: nozzle.id,
    materialGrams: 0,
    machineHours: 1,
    machineRate: suggestedMachineRate(settings, printer.id, material, nozzle),
  };
}

function createVinylLine(settings) {
  const activeMaterials = getActiveItems(settings.vinylMaterials);
  const material =
    activeMaterials.find((item) => item.id !== "none") ||
    activeMaterials[0] ||
    DEFAULT_SETTINGS.vinylMaterials[0];

  return {
    id: crypto.randomUUID(),
    materialId: material.id,
    color: colorsToArray(material.colors)[0] || "N/A",
    units: 1,
  };
}

function calculatePrintSetup(settings, printRuns) {
  if (!printRuns.length) {
    return {
      primarySetup: 0,
      additionalSetup: 0,
      totalSetup: 0,
      explanation: "No 3D print runs selected.",
    };
  }

  const printMaterials = getAllPrintMaterials(settings);

  const rankedRuns = printRuns
    .map((run) => {
      const material = getById(printMaterials, run.materialId);
      const nozzle = getNozzle(settings, run.nozzleSize);
      const tierId = suggestedSetupTier(material, nozzle);
      const tierAmounts = settings.setupFees;

      const tier = {
        id: tierId,
        label: `${tierId.charAt(0).toUpperCase()}${tierId.slice(1)} Setup`,
        amount: num(tierAmounts[tierId]),
        rank: tierId === "advanced" ? 3 : tierId === "moderate" ? 2 : 1,
      };

      return { run, tier };
    })
    .sort((a, b) => b.tier.rank - a.tier.rank);

  const primary = rankedRuns[0];
  const primarySetup = primary.tier.amount;

  const additionalSetup = rankedRuns.slice(1).reduce((sum, item) => {
    const material = getById(printMaterials, item.run.materialId);
    const nozzle = getNozzle(settings, item.run.nozzleSize);
    const primaryMaterial = getById(printMaterials, primary.run.materialId);
    const primaryNozzle = getNozzle(settings, primary.run.nozzleSize);
    const primaryPrinter = getPrinterModule(settings, primary.run.printerId);
    const printer = getPrinterModule(settings, item.run.printerId);

    if (material.group === "specialty") return sum + 10;

    const differentNozzle = nozzle.id !== primaryNozzle.id;
    const differentPrinter = printer.id !== primaryPrinter.id;
    const differentMaterial = material.id !== primaryMaterial.id;

    if (differentNozzle || differentPrinter || differentMaterial) return sum + 7.5;

    return sum + 5;
  }, 0);

  return {
    primarySetup,
    additionalSetup,
    totalSetup: roundUpMoney(primarySetup + additionalSetup),
    explanation:
      rankedRuns.length === 1
        ? `${primary.tier.label} applied from the selected print run.`
        : `${primary.tier.label} applied once, then smaller additional setup charges added for extra print runs.`,
  };
}

function activeProcessCount(jobAspects) {
  return Object.values(jobAspects).filter(Boolean).length;
}

function serviceStackDiscount(jobAspects) {
  const count = activeProcessCount(jobAspects);
  if (count >= 4) return 0.7;
  if (count === 3) return 0.8;
  if (count === 2) return 0.9;
  return 1;
}

function getComplexity(id) {
  return COMPLEXITY_LEVELS.find((item) => item.id === id) || COMPLEXITY_LEVELS[0];
}

function suggestEngravingService(form, settings) {
  const complexity = getComplexity(form.engravingComplexity);
  const units = Math.max(1, num(form.engravingMaterialUnits));
  const stackFactor = serviceStackDiscount(form.jobAspects);
  const unitAdd = Math.max(0, units - 1) * 3;
  const module = getLaserModule(settings, form.engravingModuleId);
  const moduleRate = num(settings.machineRates[module.rateKey]);
  const moduleAdjustment = moduleRate > 4 ? moduleRate - 4 : 0;

  return roundUpMoney((complexity.engraving + unitAdd + moduleAdjustment) * stackFactor);
}

function suggestVinylService(form) {
  const complexity = getComplexity(form.vinylComplexity);
  const materialLines = form.vinylMaterialLines || [];
  const layerCount = Math.max(1, materialLines.length);
  const totalUnits = materialLines.reduce((sum, line) => sum + num(line.units), 0);
  const stackFactor = serviceStackDiscount(form.jobAspects);
  const layerAdd = Math.max(0, layerCount - 1) * 5;
  const unitAdd = Math.max(0, totalUnits - layerCount) * 2;

  return roundUpMoney((complexity.vinyl + layerAdd + unitAdd) * stackFactor);
}

function suggestIntegrationComplexity(jobAspects) {
  const count = activeProcessCount(jobAspects);
  if (count >= 4) return "advanced";
  if (count === 3) return "moderate";
  if (count === 2) return "simple";
  return "none";
}

function suggestIntegrationFee(settings, form) {
  const count = activeProcessCount(form.jobAspects);
  if (count <= 1 || form.integrationComplexity === "none") return 0;
  return roundUpMoney(settings.integrationCharges[form.integrationComplexity] || 0);
}

function normalizePrintRunForCatalog(settings, run) {
  const material = getPrintMaterialById(settings, run.materialId);

  return {
    ...run,
    materialCatalogId: run.materialCatalogId || material.catalogId || "",
    materialLabel: material.label || run.materialLabel || "",
    materialType: material.materialType || run.materialType || "",
    materialColorName: material.colorName || run.materialColorName || "",
    materialBambuCode: material.bambuCode || run.materialBambuCode || "",
    materialHexCode: material.hexCode || run.materialHexCode || "",
    materialCostPerGram: num(material.costPerGram || run.materialCostPerGram),
  };
}

function buildInitialForm(settings, quote = null) {
  const sourceForm = quote?.formData || {};
  const activeCadPresets = getActiveItems(settings.cadPresets);
  const defaultCadId = activeCadPresets[0]?.id || "basic";
  const activeLasers = getActiveModules(settings, "laser");
  const activeCutters = getActiveModules(settings, "cutter");

  const seededForm = {
    ...DEFAULT_FORM,
    depositPercent: settings.defaultDepositPercent,
    taxPercent: settings.defaultTaxPercent,
    cadPresetId: defaultCadId,
    engravingModuleId: activeLasers[0]?.id || DEFAULT_FORM.engravingModuleId,
    vinylModuleId: activeCutters[0]?.id || DEFAULT_FORM.vinylModuleId,
    ...sourceForm,
    customerNotes: sourceForm.customerNotes || "",
    customerTags: sourceForm.customerTags || "",
    preferredContactMethod: sourceForm.preferredContactMethod || "Not Set",
    preferredPaymentMethod: sourceForm.preferredPaymentMethod || "Not Set",
    printRuns:
      sourceForm.printRuns?.length > 0
        ? sourceForm.printRuns.map((run) => normalizePrintRunForCatalog(settings, run))
        : [createPrintRun(settings)],
    vinylMaterialLines:
      sourceForm.vinylMaterialLines?.length > 0
        ? sourceForm.vinylMaterialLines
        : [createVinylLine(settings)],
  };

  return seededForm;
}

function Field({
  label,
  value,
  onChange,
  type = "number",
  step = "0.01",
  min = "0",
  placeholder = "",
  required = false,
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value}
        step={type === "number" ? step : undefined}
        min={type === "number" ? min : undefined}
        placeholder={placeholder}
        required={required}
        onChange={(event) => {
          let nextValue = event.target.value;

          if (type === "tel") {
            const digits = nextValue.replace(/\D/g, "").slice(0, 10);

            if (digits.length <= 3) nextValue = digits;
            else if (digits.length <= 6) nextValue = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
            else nextValue = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
          }

          onChange(nextValue);
        }}
      />
    </label>
  );
}
function buildCustomerFacingLines(totals, form) {
  const serviceLines = [];

  if (form.jobAspects.cad) {
    serviceLines.push(["Design / CAD Work", totals.customerCadCost]);
  }

  if (form.jobAspects.printing) {
    serviceLines.push(["3D Printing", totals.customerPrintingCost]);
  }

  if (form.jobAspects.engraving) {
    serviceLines.push(["Laser Engraving", totals.customerEngravingCost]);
  }

  if (form.jobAspects.vinyl) {
    serviceLines.push(["Vinyl / Cutting Work", totals.customerVinylCost]);
  }

  if (form.jobAspects.custom) {
    serviceLines.push(["Custom Work", totals.customerCustomCost]);
  }

  if (totals.customerIntegrationCost > 0) {
    serviceLines.push(["Project Setup / Integration", totals.customerIntegrationCost]);
  }

  if (totals.customerFinishingCost > 0) {
    serviceLines.push(["Finishing / Cleanup", totals.customerFinishingCost]);
  }

  if (totals.customerShippingCost > 0) {
    serviceLines.push(["Shipping / Delivery", totals.customerShippingCost]);
  }

  if (totals.minimumAdjustment > 0 && serviceLines.length === 0) {
    serviceLines.push(["Project Minimum", totals.minimumAdjustment]);
  }

  return serviceLines.filter(([, value]) => num(value) > 0);
}

function renderMaterialSwatch(hexCode) {
  if (!hexCode) return null;

  return (
    <span
      className="material-color-swatch"
      style={swatchStyle(hexCode)}
      title={hexCode}
    />
  );
}

function renderStockNotice(stockInfo, requestedUnit = "g") {
  return (
    <div className={`customer-warning-box material-stock-box material-stock-${stockInfo.status}`}>
      <strong>{stockInfo.label}</strong>

      <p>
        On hand: {stockInfo.totalOnHand}
        {requestedUnit} • This quote uses: {stockInfo.requestedAmount}
        {requestedUnit} • After job: {stockInfo.remainingAfterJob}
        {requestedUnit}
      </p>

      {stockInfo.status === "not-owned" && (
        <small>
          This material exists in the catalog, but no matching owned inventory item was found.
        </small>
      )}

      {stockInfo.status === "short" && (
        <small>
          You need {Math.abs(stockInfo.remainingAfterJob)}
          {requestedUnit} more before quoting this as in-stock.
        </small>
      )}

      {stockInfo.status === "low-after" && (
        <small>
          This job will leave the material at or below reorder threshold.
        </small>
      )}

      {stockInfo.status === "in-stock" && (
        <small>
          Inventory match found across {stockInfo.matches.length} owned stock entr
          {stockInfo.matches.length === 1 ? "y" : "ies"}.
        </small>
      )}
    </div>
  );
}

export default function CalculatorPage({
  onSaveQuote,
  editingQuote,
  onCancelEdit,
  quotes = [],
  jobs = [],
  manualCustomers = [],
  customerOverrides = {},
  inventoryItems = [],
}) {
  const [settings, setSettings] = useState(getSettings);
  const [form, setForm] = useState(() => buildInitialForm(settings, editingQuote));
  const [dismissedCustomerKeys, setDismissedCustomerKeys] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [templates, setTemplates] = useState(getStoredTemplates);
  const [templateDraft, setTemplateDraft] = useState(DEFAULT_TEMPLATE_DRAFT);
  const [templateSearch, setTemplateSearch] = useState("");
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [summaryMode, setSummaryMode] = useState("customer");
  const [materialPriceMode, setMaterialPriceMode] = useState(getMaterialPriceMode);

  useEffect(() => {
    const freshSettings = getSettings();
    setSettings(freshSettings);
    setMaterialPriceMode(getMaterialPriceMode());
    setForm(buildInitialForm(freshSettings, editingQuote));
    setDismissedCustomerKeys([]);
    setCustomerSearch("");
  }, [editingQuote]);

  const customers = useMemo(
    () => buildCustomerList(quotes, jobs, manualCustomers, customerOverrides),
    [quotes, jobs, manualCustomers, customerOverrides]
  );

  const filteredTemplates = useMemo(() => {
    const search = templateSearch.trim().toLowerCase();

    return [...templates]
      .filter((template) => {
        if (!search) return true;

        return [
          template.name,
          template.tags,
          template.notes,
          template.form?.jobName,
          template.form?.notes,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      })
      .sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
      });
  }, [templates, templateSearch]);

  const activePrintMaterials = getAllPrintMaterials(settings);
  const activeEngravingMaterials = getActiveItems(settings.engravingMaterials);
  const activeVinylMaterials = getActiveItems(settings.vinylMaterials);
  const activeCadPresets = getActiveItems(settings.cadPresets);
  const activePrinters = getActiveModules(settings, "printer");
  const activeLasers = getActiveModules(settings, "laser");
  const activeCutters = getActiveModules(settings, "cutter");
  const activeNozzles = getActiveNozzles(settings);

  const selectedCadPreset =
    activeCadPresets.find((item) => item.id === form.cadPresetId) ||
    activeCadPresets[0] ||
    { id: "custom", label: "Custom Quote", amount: 0 };

  const selectedEngravingMaterial = getById(activeEngravingMaterials, form.engravingMaterialId);
  const selectedEngravingModule = getLaserModule(settings, form.engravingModuleId);
  const selectedVinylModule = getCutterModule(settings, form.vinylModuleId);

  const customerMatches = useMemo(() => {
    return findCustomerMatches(form, customers).filter(
      (customer) =>
        customer.key !== form.customerKey &&
        !dismissedCustomerKeys.includes(customer.key)
    );
  }, [form, customers, dismissedCustomerKeys]);

  const searchedCustomerMatches = useMemo(() => {
    return searchCustomerMatches(customerSearch, customers);
  }, [customerSearch, customers]);

  const bestCustomerMatch = customerMatches[0];
  const usesQuantity = form.jobAspects.printing || form.jobAspects.engraving || form.jobAspects.vinyl;
  const printSetup = calculatePrintSetup(settings, form.printRuns);
  const printSetupFee = form.printSetupOverride === "" ? printSetup.totalSetup : num(form.printSetupOverride);
  const suggestedEngravingFee = suggestEngravingService(form, settings);
  const suggestedVinylFee = suggestVinylService(form);
  const suggestedIntegrationLevel = suggestIntegrationComplexity(form.jobAspects);
  const suggestedIntegration = suggestIntegrationFee(settings, form);
  const totals = useMemo(() => {
    const quantity = usesQuantity ? Math.max(1, num(form.quantity)) : 1;

    const printMaterialCost = form.jobAspects.printing
      ? roundUpMoney(
          form.printRuns.reduce((sum, run) => {
            const material = getPrintMaterialById(settings, run.materialId);
            const costPerGram =
              run.materialCostPerGram !== undefined && run.materialCostPerGram !== ""
                ? num(run.materialCostPerGram)
                : num(material.costPerGram);

            return sum + num(run.materialGrams) * costPerGram;
          }, 0)
        )
      : 0;

    const machineCost = form.jobAspects.printing
      ? roundUpMoney(
          form.printRuns.reduce((sum, run) => {
            return sum + num(run.machineHours) * num(run.machineRate);
          }, 0)
        )
      : 0;

    const engravingMaterialCost = form.jobAspects.engraving
      ? roundUpMoney(materialUnitCost(selectedEngravingMaterial) * num(form.engravingMaterialUnits))
      : 0;

    const vinylMaterialCost = form.jobAspects.vinyl
      ? roundUpMoney(
          form.vinylMaterialLines.reduce((sum, line) => {
            const material = getById(activeVinylMaterials, line.materialId);
            return sum + materialUnitCost(material) * num(line.units);
          }, 0)
        )
      : 0;

    const materialCost = printMaterialCost + engravingMaterialCost + vinylMaterialCost;

    const cadCost = form.jobAspects.cad
      ? selectedCadPreset.id === "custom"
        ? num(form.customCadAmount)
        : num(selectedCadPreset.amount)
      : 0;

    const engravingCost = form.jobAspects.engraving ? num(form.engravingFee) : 0;
    const vinylCost = form.jobAspects.vinyl ? num(form.vinylFee) : 0;
    const integrationCost = activeProcessCount(form.jobAspects) > 1 ? num(form.integrationFee) : 0;
    const customCost = form.jobAspects.custom ? num(form.customFee) : 0;
    const extraLaborCost = roundUpMoney(num(form.extraLaborHours) * num(form.extraLaborRate));

    const setupFee = form.jobAspects.printing ? printSetupFee : 0;
    const complexityFee = num(form.complexityFee);
    const finishingFee = num(form.finishingFee);
    const shippingFee = num(form.shippingFee);

    const directSubtotal =
      materialCost +
      machineCost +
      cadCost +
      engravingCost +
      vinylCost +
      integrationCost +
      customCost +
      extraLaborCost +
      setupFee +
      complexityFee +
      finishingFee +
      shippingFee;

    const autoBufferPercent = curvedBufferPercent(directSubtotal, settings);
    const appliedBufferPercent =
      form.bufferOverridePercent === "" ? autoBufferPercent : num(form.bufferOverridePercent);

    const quoteBuffer = roundUpMoney(directSubtotal * (appliedBufferPercent / 100));
    const subtotalBeforeMinimum = directSubtotal + quoteBuffer;

    let minimumFloor = num(settings.minimumCharges.basicProjectMinimum);
    let minimumReason = `Basic project minimum applied if needed: ${money(minimumFloor)}.`;

    if (form.jobAspects.printing) {
      minimumFloor = Math.max(minimumFloor, num(settings.minimumCharges.printMinimum));
      minimumReason = `Print minimum applied if needed: ${money(settings.minimumCharges.printMinimum)}.`;
    }

    if (form.jobAspects.printing && form.jobAspects.cad) {
      minimumFloor = Math.max(minimumFloor, num(settings.minimumCharges.cadPrintMinimum));
      minimumReason = `CAD + print minimum applied if needed: ${money(settings.minimumCharges.cadPrintMinimum)}.`;
    }

    if (form.jobAspects.engraving) {
      minimumFloor = Math.max(minimumFloor, num(settings.minimumCharges.engravingMinimum));
    }

    if (form.jobAspects.vinyl) {
      minimumFloor = Math.max(minimumFloor, num(settings.minimumCharges.vinylMinimum));
    }

    if (form.jobAspects.custom) {
      minimumFloor = Math.max(minimumFloor, num(settings.minimumCharges.customMinimum));
    }

    const minimumAdjustment = Math.max(0, minimumFloor - subtotalBeforeMinimum);
    const subtotalBeforeDiscount = subtotalBeforeMinimum + minimumAdjustment;
    const subtotal = Math.max(0, subtotalBeforeDiscount - num(form.discount));
    const tax = form.taxEnabled ? roundUpMoney(subtotal * (num(form.taxPercent) / 100)) : 0;
    const finalTotal = roundUpMoney(subtotal + tax);
    const suggestedDeposit = roundUpMoney(finalTotal * (num(form.depositPercent) / 100));
    const remainingBalance = roundUpMoney(finalTotal - suggestedDeposit);
    const perUnit = usesQuantity ? roundUpMoney(finalTotal / quantity) : finalTotal;

    const customerSubtotalBase = Math.max(1, directSubtotal);
    const markupPool = quoteBuffer + minimumAdjustment;

    const applyMarkup = (value) => {
      if (value <= 0) return 0;
      return roundUpMoney(value + markupPool * (value / customerSubtotalBase));
    };

    const printBase = printMaterialCost + machineCost + setupFee;
    const engravingBase = engravingMaterialCost + engravingCost;
    const vinylBase = vinylMaterialCost + vinylCost;
    const finishingBase = extraLaborCost + complexityFee + finishingFee;

    const customerCadCost = applyMarkup(cadCost);
    const customerPrintingCost = applyMarkup(printBase);
    const customerEngravingCost = applyMarkup(engravingBase);
    const customerVinylCost = applyMarkup(vinylBase);
    const customerIntegrationCost = applyMarkup(integrationCost);
    const customerCustomCost = applyMarkup(customCost);
    const customerFinishingCost = applyMarkup(finishingBase);
    const customerShippingCost = shippingFee;

    const customerLinesTotal =
      customerCadCost +
      customerPrintingCost +
      customerEngravingCost +
      customerVinylCost +
      customerIntegrationCost +
      customerCustomCost +
      customerFinishingCost +
      customerShippingCost;

    const strongestNozzleMultiplier = form.printRuns.reduce((highest, run) => {
      const nozzle = getNozzle(settings, run.nozzleSize);
      return Math.max(highest, num(nozzle.marketMultiplier || 1));
    }, 1);

    const marketBase = Math.max(finalTotal, materialCost + machineCost + cadCost);
    const marketMultiplier =
      (form.jobAspects.printing ? strongestNozzleMultiplier : 1) *
      (form.jobAspects.cad ? 1.15 : 1) *
      (form.jobAspects.vinyl ? 1.1 : 1) *
      (form.jobAspects.engraving ? 1.1 : 1) *
      (activeProcessCount(form.jobAspects) > 1 ? 1.1 : 1);

    return {
      quantity,
      printMaterialCost,
      engravingMaterialCost,
      vinylMaterialCost,
      materialCost,
      machineCost,
      cadCost,
      engravingCost,
      vinylCost,
      integrationCost,
      customCost,
      extraLaborCost,
      setupFee,
      directSubtotal,
      autoBufferPercent,
      appliedBufferPercent,
      quoteBuffer,
      minimumFloor,
      minimumAdjustment,
      minimumReason,
      subtotalBeforeDiscount,
      subtotal,
      tax,
      finalTotal,
      suggestedDeposit,
      remainingBalance,
      perUnit,
      customerCadCost,
      customerPrintingCost,
      customerEngravingCost,
      customerVinylCost,
      customerIntegrationCost,
      customerCustomCost,
      customerFinishingCost,
      customerShippingCost,
      customerLinesTotal,
      market: {
        budgetLow: roundUpMoney(marketBase * 0.85),
        budgetHigh: roundUpMoney(marketBase * 1.05),
        averageLow: roundUpMoney(marketBase * 1.05 * marketMultiplier),
        averageHigh: roundUpMoney(marketBase * 1.45 * marketMultiplier),
        premiumLow: roundUpMoney(marketBase * 1.5 * marketMultiplier),
        premiumHigh: roundUpMoney(marketBase * 2.25 * marketMultiplier),
      },
    };
  }, [
    form,
    usesQuantity,
    selectedCadPreset,
    selectedEngravingMaterial,
    activeVinylMaterials,
    printSetupFee,
    settings,
    materialPriceMode,
  ]);

  const customerFacingLines = useMemo(() => {
    return buildCustomerFacingLines(totals, form);
  }, [totals, form]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateTemplateDraft(key, value) {
    setTemplateDraft((current) => ({ ...current, [key]: value }));
  }

  function saveTemplates(nextTemplates) {
    setTemplates(nextTemplates);
    saveStoredTemplates(nextTemplates);
  }

  function saveCurrentAsTemplate() {
    const templateName = clean(templateDraft.name || form.jobName);

    if (!templateName) {
      window.alert("Template name is required.");
      return;
    }

    const now = new Date().toISOString();

    const newTemplate = {
      id: crypto.randomUUID(),
      name: templateName,
      tags: templateDraft.tags || "",
      notes: templateDraft.notes || "",
      favorite: Boolean(templateDraft.favorite),
      createdAt: now,
      updatedAt: now,
      form: stripCustomerInfo(form),
    };

    saveTemplates([newTemplate, ...templates]);
    setTemplateDraft(DEFAULT_TEMPLATE_DRAFT);
    setShowTemplatePanel(true);
  }

  function loadTemplate(template) {
    const confirmed = window.confirm(
      `Load template "${template.name}"? This will replace the current calculator setup, but customer info will stay blank.`
    );

    if (!confirmed) return;

    const loadedForm = regenerateFormIds({
      ...buildInitialForm(settings, null),
      ...(template.form || {}),
    });

    setForm(stripCustomerInfo(loadedForm));
    setCustomerSearch("");
    setDismissedCustomerKeys([]);
  }
      function duplicateTemplate(template) {
    const now = new Date().toISOString();

    const nextTemplate = {
      ...template,
      id: crypto.randomUUID(),
      name: `${template.name} Copy`,
      createdAt: now,
      updatedAt: now,
    };

    saveTemplates([nextTemplate, ...templates]);
  }

  function toggleTemplateFavorite(templateId) {
    saveTemplates(
      templates.map((template) =>
        template.id === templateId
          ? { ...template, favorite: !template.favorite, updatedAt: new Date().toISOString() }
          : template
      )
    );
  }

  function deleteTemplate(templateId) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;

    const confirmed = window.confirm(`Delete template "${template.name}"?`);
    if (!confirmed) return;

    saveTemplates(templates.filter((item) => item.id !== templateId));
  }

  function applyCustomer(customer) {
    setForm((current) => ({
      ...current,
      customerKey: customer.key,
      customerName: customer.name || current.customerName,
      customerPhone: customer.phone || current.customerPhone,
      customerEmail: customer.email || current.customerEmail,
      customerAddress: customer.address || current.customerAddress,
      customerNotes: customer.notes || "",
      customerTags: customer.tags || "",
      preferredContactMethod: customer.preferredContactMethod || "Not Set",
      preferredPaymentMethod: customer.preferredPaymentMethod || "Not Set",
    }));

    setCustomerSearch(customer.name || "");
    setDismissedCustomerKeys((current) => current.filter((key) => key !== customer.key));
  }

  function dismissCustomerMatch(customerKey) {
    setDismissedCustomerKeys((current) =>
      current.includes(customerKey) ? current : [...current, customerKey]
    );
  }

  function addPrintRun() {
    setForm((current) => ({
      ...current,
      printRuns: [...current.printRuns, createPrintRun(settings)],
    }));
  }

  function updatePrintRun(runId, key, value) {
    setForm((current) => ({
      ...current,
      printRuns: current.printRuns.map((run) => {
        if (run.id !== runId) return run;

        const updatedRun = { ...run, [key]: value };

        if (key === "materialId" || key === "nozzleSize" || key === "printerId") {
          const material = getPrintMaterialById(settings, updatedRun.materialId);
          const nozzle = getNozzle(settings, updatedRun.nozzleSize);

          return {
            ...updatedRun,
            materialCatalogId: material.catalogId || "",
            materialLabel: material.label || "",
            materialType: material.materialType || "",
            materialColorName: material.colorName || "",
            materialBambuCode: material.bambuCode || "",
            materialHexCode: material.hexCode || "",
            materialCostPerGram: num(material.costPerGram),
            machineRate: suggestedMachineRate(settings, updatedRun.printerId, material, nozzle),
          };
        }

        return updatedRun;
      }),
    }));
  }

  function removePrintRun(runId) {
    setForm((current) => ({
      ...current,
      printRuns:
        current.printRuns.length > 1
          ? current.printRuns.filter((run) => run.id !== runId)
          : current.printRuns,
    }));
  }

  function refreshCatalogPricing() {
    const confirmed = window.confirm(
      `Refresh all print run material prices using ${materialPriceMode.toUpperCase()} catalog pricing?`
    );

    if (!confirmed) return;

    setMaterialPriceMode(getMaterialPriceMode());

    setForm((current) => ({
      ...current,
      printRuns: current.printRuns.map((run) => {
        const material = getPrintMaterialById(settings, run.materialId);
        const nozzle = getNozzle(settings, run.nozzleSize);

        return {
          ...run,
          materialCatalogId: material.catalogId || "",
          materialLabel: material.label || "",
          materialType: material.materialType || "",
          materialColorName: material.colorName || "",
          materialBambuCode: material.bambuCode || "",
          materialHexCode: material.hexCode || "",
          materialCostPerGram: num(material.costPerGram),
          machineRate: suggestedMachineRate(settings, run.printerId, material, nozzle),
        };
      }),
    }));
  }

  function updateEngravingMaterial(value) {
    const material = getById(activeEngravingMaterials, value);
    const firstColor = colorsToArray(material.colors)[0] || "N/A";

    setForm((current) => ({
      ...current,
      engravingMaterialId: material.id,
      engravingMaterialColor: firstColor,
    }));
  }

  function addVinylLine() {
    setForm((current) => ({
      ...current,
      vinylMaterialLines: [...current.vinylMaterialLines, createVinylLine(settings)],
    }));
  }

  function updateVinylLine(lineId, key, value) {
    setForm((current) => ({
      ...current,
      vinylMaterialLines: current.vinylMaterialLines.map((line) => {
        if (line.id !== lineId) return line;

        if (key === "materialId") {
          const material = getById(activeVinylMaterials, value);

          return {
            ...line,
            materialId: material.id,
            color: colorsToArray(material.colors)[0] || "N/A",
          };
        }

        return { ...line, [key]: value };
      }),
    }));
  }

  function removeVinylLine(lineId) {
    setForm((current) => ({
      ...current,
      vinylMaterialLines:
        current.vinylMaterialLines.length > 1
          ? current.vinylMaterialLines.filter((line) => line.id !== lineId)
          : current.vinylMaterialLines,
    }));
  }

  function toggleAspect(key) {
    setForm((current) => {
      const nextAspects = {
        ...current.jobAspects,
        [key]: !current.jobAspects[key],
      };

      const suggestedLevel = suggestIntegrationComplexity(nextAspects);

      return {
        ...current,
        jobAspects: nextAspects,
        integrationComplexity:
          current.integrationComplexity === "none" ||
          activeProcessCount(current.jobAspects) <= 1
            ? suggestedLevel
            : current.integrationComplexity,
      };
    });
  }

  function applySuggestedEngraving() {
    setForm((current) => ({
      ...current,
      engravingFee: suggestEngravingService(current, settings),
    }));
  }

  function applySuggestedVinyl() {
    setForm((current) => ({
      ...current,
      vinylFee: suggestVinylService(current),
    }));
  }

  function applySuggestedIntegration() {
    setForm((current) => ({
      ...current,
      integrationFee: suggestIntegrationFee(settings, current),
    }));
  }

  function resetCalculator() {
    setForm(buildInitialForm(settings, null));
    setDismissedCustomerKeys([]);
    setCustomerSearch("");
  }

  function validateCustomerInfo() {
    if (settings.customerFields.requireName && !form.customerName.trim()) {
      window.alert("Customer name is required.");
      return false;
    }

    if (settings.customerFields.requirePhone && !form.customerPhone.trim()) {
      window.alert("Customer phone number is required.");
      return false;
    }

    if (settings.customerFields.requireEmail && !form.customerEmail.trim()) {
      window.alert("Customer email is required.");
      return false;
    }

    return true;
  }

  function saveQuote() {
    if (!validateCustomerInfo()) return;

    onSaveQuote(
      {
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail,
        customerAddress: form.customerAddress,
        customerKey: form.customerKey,
        customerNotes: form.customerNotes,
        customerTags: form.customerTags,
        preferredContactMethod: form.preferredContactMethod,
        preferredPaymentMethod: form.preferredPaymentMethod,
        jobName: form.jobName,
        jobAspects: form.jobAspects,
        finalTotal: totals.finalTotal,
        depositAmount: totals.suggestedDeposit,
        remainingBalance: totals.remainingBalance,
        formData: form,
        totals: {
          ...totals,
          customerFacingLines,
        },
      },
      editingQuote?.id || null
    );
  }
      return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">
            {editingQuote ? `Editing ${editingQuote.quoteNumber}` : "Calculator"}
          </h2>

          <p className="muted-text">
            Quote builder with customer-facing pricing, internal pricing, templates,
            catalog materials, inventory awareness, machine time, deposits, tax,
            and markup protection.
          </p>

          {editingQuote && (
            <p className="helper-note">
              Saving will update this quote instead of creating a new quote number.
            </p>
          )}
        </div>

        <div className="record-button-row">
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              setSummaryMode(summaryMode === "customer" ? "internal" : "customer")
            }
          >
            {summaryMode === "customer" ? <Eye size={18} /> : <EyeOff size={18} />}
            {summaryMode === "customer" ? "Customer View" : "Internal View"}
          </button>

          <button className="secondary-button" type="button" onClick={resetCalculator}>
            <RotateCcw size={18} />
            Reset
          </button>
        </div>
      </div>

      <div className="calculator-grid">
        <div className="form-card full-span">
          <div className="page-heading-row">
            <div>
              <h3 className="card-title">Quote Templates</h3>
              <p className="muted-text">Save repeatable setups for common work.</p>
            </div>

            <button
              className="secondary-button"
              type="button"
              onClick={() => setShowTemplatePanel(!showTemplatePanel)}
            >
              <Star size={18} />
              {showTemplatePanel ? "Hide Templates" : "Show Templates"}
            </button>
          </div>

          <div className="form-grid">
            <Field
              label="Template Name"
              type="text"
              value={templateDraft.name}
              placeholder={form.jobName || "Example: Basic PETG prototype"}
              onChange={(value) => updateTemplateDraft("name", value)}
            />

            <Field
              label="Template Tags"
              type="text"
              value={templateDraft.tags}
              placeholder="print, prototype, engraving, friend price"
              onChange={(value) => updateTemplateDraft("tags", value)}
            />

            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={templateDraft.favorite}
                onChange={(event) =>
                  updateTemplateDraft("favorite", event.target.checked)
                }
              />
              <span>Favorite Template</span>
            </label>
          </div>

          <label className="field single-row-gap">
            <span>Template Notes</span>
            <textarea
              value={templateDraft.notes}
              placeholder="What this template is for, when to use it, pricing notes, etc."
              onChange={(event) => updateTemplateDraft("notes", event.target.value)}
            />
          </label>

          <button className="primary-button single-row-gap" onClick={saveCurrentAsTemplate}>
            <Save size={18} />
            Save Current Setup as Template
          </button>

          {showTemplatePanel && (
            <div className="form-card single-row-gap">
              <h3 className="card-title">Saved Templates</h3>

              <label className="search-field single-row-gap">
                <input
                  type="search"
                  value={templateSearch}
                  placeholder="Search templates..."
                  onChange={(event) => setTemplateSearch(event.target.value)}
                />
              </label>

              {filteredTemplates.length === 0 ? (
                <div className="empty-state single-row-gap">
                  <h3>No templates found.</h3>
                  <p>Save your current setup as a reusable template.</p>
                </div>
              ) : (
                <div className="template-grid single-row-gap">
                  {filteredTemplates.map((template) => (
                    <article className="template-card" key={template.id}>
                      <div className="record-card-top">
                        <div>
                          <h3>{template.name}</h3>
                          <p>{template.form?.jobName || "Reusable quote setup"}</p>
                        </div>

                        {template.favorite && <span className="status-pill">Favorite</span>}
                      </div>

                      <div className="record-tags">
                        {splitTags(template.tags).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>

                      {template.notes && <p className="helper-note">{template.notes}</p>}

                      <div className="record-button-row quote-button-row single-row-gap">
                        <button
                          className="primary-button"
                          type="button"
                          onClick={() => loadTemplate(template)}
                        >
                          <Copy size={18} />
                          Load
                        </button>

                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => toggleTemplateFavorite(template.id)}
                        >
                          <Star size={18} />
                          {template.favorite ? "Unfavorite" : "Favorite"}
                        </button>

                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => duplicateTemplate(template)}
                        >
                          <Copy size={18} />
                          Duplicate
                        </button>

                        <button
                          className="secondary-button danger-button"
                          type="button"
                          onClick={() => deleteTemplate(template.id)}
                        >
                          <Trash2 size={18} />
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
                <div className="form-card full-span">
          <h3 className="card-title">Customer Info</h3>

          <label className="field single-row-gap">
            <span>Search Existing Customers</span>
            <input
              type="text"
              value={customerSearch}
              placeholder="Search by name, phone, email, tag, or customer notes..."
              onChange={(event) => setCustomerSearch(event.target.value)}
            />
          </label>

          {customerSearch.trim() && (
            <div className="customer-match-dropdown">
              {searchedCustomerMatches.length === 0 ? (
                <div className="customer-match-empty">No customer matches found.</div>
              ) : (
                searchedCustomerMatches.map((customer) => (
                  <button
                    key={customer.key}
                    type="button"
                    className="customer-match-card"
                    onClick={() => applyCustomer(customer)}
                  >
                    <div className="customer-match-main">
                      <strong>{customer.name}</strong>
                      <span>
                        {customer.phone || "No phone"} •{" "}
                        {customer.email || "No email"}
                      </span>
                      <small>
                        {customer.totalQuotes || 0} quote(s) •{" "}
                        {customer.totalJobs || 0} job(s) •{" "}
                        {money(customer.totalValue || 0)}
                      </small>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {bestCustomerMatch && (
            <div className="customer-match-popover">
              <div>
                <strong>Possible repeat customer: {bestCustomerMatch.name}</strong>
                <span>
                  {bestCustomerMatch.phone || "No phone"} •{" "}
                  {bestCustomerMatch.email || "No email"}
                </span>
              </div>

              <div className="customer-match-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => dismissCustomerMatch(bestCustomerMatch.key)}
                >
                  <XCircle size={18} />
                  Ignore
                </button>

                <button
                  className="primary-button"
                  type="button"
                  onClick={() => applyCustomer(bestCustomerMatch)}
                >
                  <UserCheck size={18} />
                  Autofill
                </button>
              </div>
            </div>
          )}

          <div className="form-grid">
            <Field
              label="Customer Name"
              type="text"
              value={form.customerName}
              required={settings.customerFields.requireName}
              onChange={(value) => update("customerName", value)}
            />

            <Field
              label="Phone"
              type="tel"
              value={form.customerPhone}
              required={settings.customerFields.requirePhone}
              onChange={(value) => update("customerPhone", value)}
            />

            <Field
              label="Email"
              type="email"
              value={form.customerEmail}
              required={settings.customerFields.requireEmail}
              onChange={(value) => update("customerEmail", value)}
            />

            <label className="field">
              <span>Preferred Contact</span>
              <select
                value={form.preferredContactMethod}
                onChange={(event) => update("preferredContactMethod", event.target.value)}
              >
                <option value="Not Set">Not Set</option>
                <option value="Phone">Phone</option>
                <option value="Text">Text</option>
                <option value="Email">Email</option>
                <option value="Facebook">Facebook</option>
                <option value="In Person">In Person</option>
              </select>
            </label>

            <label className="field">
              <span>Preferred Payment</span>
              <select
                value={form.preferredPaymentMethod}
                onChange={(event) => update("preferredPaymentMethod", event.target.value)}
              >
                <option value="Not Set">Not Set</option>
                <option value="Venmo">Venmo</option>
                <option value="Cash">Cash</option>
                <option value="Cash App">Cash App</option>
                <option value="PayPal">PayPal</option>
                <option value="Zelle">Zelle</option>
                <option value="Card">Card</option>
                <option value="Check">Check</option>
              </select>
            </label>

            <Field
              label="Customer Tags"
              type="text"
              value={form.customerTags}
              placeholder="repeat customer, local pickup, business client"
              onChange={(value) => update("customerTags", value)}
            />

            {settings.customerFields.showAddress && (
              <label className="field full-span">
                <span>Address / Shipping Info</span>
                <textarea
                  value={form.customerAddress}
                  onChange={(event) => update("customerAddress", event.target.value)}
                />
              </label>
            )}
          </div>

          {form.customerNotes && (
            <div className="customer-warning-box">
              <strong>Customer Notes / Warnings</strong>
              <p>{form.customerNotes}</p>
            </div>
          )}
        </div>

        <div className="form-card full-span">
          <h3 className="card-title">Project Basics</h3>

          <Field
            label="Project / Job Name"
            type="text"
            value={form.jobName}
            onChange={(value) => update("jobName", value)}
            placeholder="Example: custom dash bracket, engraved card, decal set..."
          />

          <div className="aspect-grid">
            {[
              ["cad", "CAD Modeling"],
              ["printing", "3D Printing"],
              ["engraving", "Laser Engraving"],
              ["vinyl", "Vinyl Cutting"],
              ["custom", "Custom Fabrication"],
            ].map(([key, label]) => (
              <label className="aspect-option" key={key}>
                <input
                  type="checkbox"
                  checked={Boolean(form.jobAspects[key])}
                  onChange={() => toggleAspect(key)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {form.jobAspects.cad && (
          <div className="form-card">
            <h3 className="card-title">CAD / Design</h3>

            <div className="form-grid">
              <label className="field">
                <span>CAD Tier</span>
                <select
                  value={form.cadPresetId}
                  onChange={(event) => update("cadPresetId", event.target.value)}
                >
                  {activeCadPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label} — {money(preset.amount)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedCadPreset.id === "custom" && (
                <Field
                  label="Custom CAD Amount"
                  value={form.customCadAmount}
                  onChange={(value) => update("customCadAmount", value)}
                />
              )}
            </div>
          </div>
        )}
                  {form.jobAspects.printing && (
          <div className="form-card full-span">
            <div className="page-heading-row">
              <div>
                <h3 className="card-title">3D Printing</h3>

                <p className="muted-text">
                  Add one print run for each unique machine/material/nozzle combo.
                  Material prices come from the catalog using{" "}
                  {materialPriceMode.toUpperCase()} pricing, and stock warnings
                  come from your owned inventory.
                </p>
              </div>

              <div className="record-button-row">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={refreshCatalogPricing}
                >
                  <Wand2 size={18} />
                  Refresh Catalog Pricing
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={addPrintRun}
                >
                  <Plus size={18} />
                  Add Print Run
                </button>
              </div>
            </div>

            <div className="vinyl-lines">
              {form.printRuns.map((run, index) => {
                const material = getPrintMaterialById(settings, run.materialId);
                const nozzle = getNozzle(settings, run.nozzleSize);

                const costPerGram =
                  run.materialCostPerGram !== undefined &&
                  run.materialCostPerGram !== ""
                    ? num(run.materialCostPerGram)
                    : num(material.costPerGram);

                const stockInfo = getStockInfoForMaterial(
                  inventoryItems,
                  material,
                  run.materialGrams
                );

                return (
                  <div className="vinyl-line" key={run.id}>
                    <div className="vinyl-line-header">
                      <strong>
                        {renderMaterialSwatch(
                          run.materialHexCode || material.hexCode
                        )}
                        Print Run {index + 1}
                      </strong>

                      <span>
                        {money(
                          num(run.materialGrams) * costPerGram +
                            num(run.machineHours) * num(run.machineRate)
                        )}
                      </span>
                    </div>

                    <div className="form-grid">
                      <label className="field">
                        <span>Printer</span>

                        <select
                          value={run.printerId}
                          onChange={(event) =>
                            updatePrintRun(
                              run.id,
                              "printerId",
                              event.target.value
                            )
                          }
                        >
                          {activePrinters.map((printer) => (
                            <option key={printer.id} value={printer.id}>
                              {printer.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Catalog Material</span>

                        <select
                          value={run.materialId}
                          onChange={(event) =>
                            updatePrintRun(
                              run.id,
                              "materialId",
                              event.target.value
                            )
                          }
                        >
                          {activePrintMaterials.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label} — {money(item.costPerGram)}/g
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Nozzle</span>

                        <select
                          value={run.nozzleSize}
                          onChange={(event) =>
                            updatePrintRun(
                              run.id,
                              "nozzleSize",
                              event.target.value
                            )
                          }
                        >
                          {activeNozzles.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <Field
                        label="Material Grams"
                        value={run.materialGrams}
                        onChange={(value) =>
                          updatePrintRun(run.id, "materialGrams", value)
                        }
                      />

                      <Field
                        label="Machine Hours"
                        value={run.machineHours}
                        onChange={(value) =>
                          updatePrintRun(run.id, "machineHours", value)
                        }
                      />

                      <Field
                        label="Machine Rate"
                        value={run.machineRate}
                        onChange={(value) =>
                          updatePrintRun(run.id, "machineRate", value)
                        }
                      />

                      <Field
                        label="Material Cost / Gram"
                        value={costPerGram}
                        onChange={(value) =>
                          updatePrintRun(
                            run.id,
                            "materialCostPerGram",
                            value
                          )
                        }
                      />

                      <button
                        className="secondary-button danger-button"
                        type="button"
                        onClick={() => removePrintRun(run.id)}
                      >
                        <Trash2 size={18} />
                        Remove
                      </button>
                    </div>

                    <p className="helper-note">
                      {material.label || run.materialLabel || "Selected material"}{" "}
                      {material.bambuCode || run.materialBambuCode
                        ? `• Code ${material.bambuCode || run.materialBambuCode}`
                        : ""}
                      {material.hexCode || run.materialHexCode
                        ? ` • ${material.hexCode || run.materialHexCode}`
                        : ""}{" "}
                      • Setup suggestion: {suggestedSetupTier(material, nozzle)} —{" "}
                      {setupReason(material, nozzle)}
                    </p>

                    {renderStockNotice(stockInfo, "g")}
                  </div>
                );
              })}
            </div>

            <div className="form-card single-row-gap">
              <h3 className="card-title">Print Setup</h3>

              <div className="form-grid">
                <Field
                  label="Setup Override"
                  value={form.printSetupOverride}
                  onChange={(value) => update("printSetupOverride", value)}
                  placeholder={`${printSetup.totalSetup}`}
                />

                <div className="summary-grid">
                  <div>
                    <span>Suggested Setup</span>
                    <strong>{money(printSetup.totalSetup)}</strong>
                  </div>
                </div>
              </div>

              <p className="helper-note">{printSetup.explanation}</p>
            </div>
          </div>
        )}
                  {form.jobAspects.engraving && (
          <div className="form-card">
            <h3 className="card-title">Laser Engraving</h3>

            <div className="form-grid">
              <label className="field">
                <span>Laser Module</span>

                <select
                  value={form.engravingModuleId}
                  onChange={(event) =>
                    update("engravingModuleId", event.target.value)
                  }
                >
                  {activeLasers.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Material</span>

                <select
                  value={form.engravingMaterialId}
                  onChange={(event) => updateEngravingMaterial(event.target.value)}
                >
                  {activeEngravingMaterials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Color / Finish</span>

                <select
                  value={form.engravingMaterialColor}
                  onChange={(event) =>
                    update("engravingMaterialColor", event.target.value)
                  }
                >
                  {colorsToArray(selectedEngravingMaterial.colors).map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </label>

              <Field
                label="Units"
                value={form.engravingMaterialUnits}
                onChange={(value) => update("engravingMaterialUnits", value)}
              />

              <label className="field">
                <span>Complexity</span>

                <select
                  value={form.engravingComplexity}
                  onChange={(event) =>
                    update("engravingComplexity", event.target.value)
                  }
                >
                  {COMPLEXITY_LEVELS.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </label>

              <Field
                label="Engraving Fee"
                value={form.engravingFee}
                onChange={(value) => update("engravingFee", value)}
              />
            </div>

            <button
              className="secondary-button single-row-gap"
              type="button"
              onClick={applySuggestedEngraving}
            >
              <Wand2 size={18} />
              Use Suggested Engraving Fee ({money(suggestedEngravingFee)})
            </button>

            <p className="helper-note">
              Module: {selectedEngravingModule.label || "Laser"}.
            </p>
          </div>
        )}

        {form.jobAspects.vinyl && (
          <div className="form-card">
            <div className="page-heading-row">
              <div>
                <h3 className="card-title">Vinyl / Cutter</h3>
                <p className="muted-text">
                  Add one material line per color/layer/material.
                </p>
              </div>

              <button className="secondary-button" type="button" onClick={addVinylLine}>
                <Plus size={18} />
                Add Line
              </button>
            </div>

            <label className="field single-row-gap">
              <span>Cutter Module</span>

              <select
                value={form.vinylModuleId}
                onChange={(event) => update("vinylModuleId", event.target.value)}
              >
                {activeCutters.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="vinyl-lines single-row-gap">
              {form.vinylMaterialLines.map((line, index) => {
                const material = getById(activeVinylMaterials, line.materialId);

                return (
                  <div className="vinyl-line" key={line.id}>
                    <div className="vinyl-line-header">
                      <strong>Vinyl Line {index + 1}</strong>
                      <span>{money(materialUnitCost(material) * num(line.units))}</span>
                    </div>

                    <div className="form-grid">
                      <label className="field">
                        <span>Material</span>

                        <select
                          value={line.materialId}
                          onChange={(event) =>
                            updateVinylLine(line.id, "materialId", event.target.value)
                          }
                        >
                          {activeVinylMaterials.map((materialOption) => (
                            <option key={materialOption.id} value={materialOption.id}>
                              {materialOption.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Color</span>

                        <select
                          value={line.color}
                          onChange={(event) =>
                            updateVinylLine(line.id, "color", event.target.value)
                          }
                        >
                          {colorsToArray(material.colors).map((color) => (
                            <option key={color} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                      </label>

                      <Field
                        label="Units"
                        value={line.units}
                        onChange={(value) => updateVinylLine(line.id, "units", value)}
                      />

                      <button
                        className="secondary-button danger-button"
                        type="button"
                        onClick={() => removeVinylLine(line.id)}
                      >
                        <Trash2 size={18} />
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="form-grid single-row-gap">
              <label className="field">
                <span>Complexity</span>

                <select
                  value={form.vinylComplexity}
                  onChange={(event) => update("vinylComplexity", event.target.value)}
                >
                  {COMPLEXITY_LEVELS.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </label>

              <Field
                label="Vinyl Fee"
                value={form.vinylFee}
                onChange={(value) => update("vinylFee", value)}
              />
            </div>

            <button
              className="secondary-button single-row-gap"
              type="button"
              onClick={applySuggestedVinyl}
            >
              <Wand2 size={18} />
              Use Suggested Vinyl Fee ({money(suggestedVinylFee)})
            </button>

            <p className="helper-note">
              Module: {selectedVinylModule.label || "Cutter"}.
            </p>
          </div>
        )}
                  {activeProcessCount(form.jobAspects) > 1 && (
          <div className="form-card">
            <h3 className="card-title">Project Integration</h3>

            <div className="form-grid">
              <label className="field">
                <span>Integration Complexity</span>

                <select
                  value={form.integrationComplexity}
                  onChange={(event) =>
                    update("integrationComplexity", event.target.value)
                  }
                >
                  <option value="none">None</option>
                  <option value="simple">Simple</option>
                  <option value="moderate">Moderate</option>
                  <option value="advanced">Advanced</option>
                  <option value="complex">Complex</option>
                </select>
              </label>

              <Field
                label="Integration Fee"
                value={form.integrationFee}
                onChange={(value) => update("integrationFee", value)}
              />
            </div>

            <button
              className="secondary-button single-row-gap"
              type="button"
              onClick={applySuggestedIntegration}
            >
              <Wand2 size={18} />
              Use Suggested Integration Fee ({money(suggestedIntegration)})
            </button>

            <p className="helper-note">
              Suggested integration level: {suggestedIntegrationLevel}. This
              covers combining multiple services into one deliverable.
            </p>
          </div>
        )}

        {form.jobAspects.custom && (
          <div className="form-card">
            <h3 className="card-title">Custom Work</h3>

            <Field
              label="Custom Fee"
              value={form.customFee}
              onChange={(value) => update("customFee", value)}
            />
          </div>
        )}

        <div className="form-card">
          <h3 className="card-title">Finishing / Extra Labor</h3>

          <div className="form-grid">
            <Field
              label="Extra Labor Hours"
              value={form.extraLaborHours}
              onChange={(value) => update("extraLaborHours", value)}
            />

            <Field
              label="Extra Labor Rate"
              value={form.extraLaborRate}
              onChange={(value) => update("extraLaborRate", value)}
            />

            <Field
              label="Complexity Fee"
              value={form.complexityFee}
              onChange={(value) => update("complexityFee", value)}
            />

            <Field
              label="Finishing Fee"
              value={form.finishingFee}
              onChange={(value) => update("finishingFee", value)}
            />

            <Field
              label="Shipping / Delivery Fee"
              value={form.shippingFee}
              onChange={(value) => update("shippingFee", value)}
            />

            <Field
              label="Discount"
              value={form.discount}
              onChange={(value) => update("discount", value)}
            />
          </div>
        </div>

        <div className="form-card">
          <h3 className="card-title">Tax / Deposit / Buffer</h3>

          <div className="form-grid">
            <Field
              label="Deposit Percent"
              value={form.depositPercent}
              onChange={(value) => update("depositPercent", value)}
            />

            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={form.taxEnabled}
                onChange={(event) => update("taxEnabled", event.target.checked)}
              />
              <span>Charge Tax</span>
            </label>

            {form.taxEnabled && (
              <Field
                label="Tax Percent"
                value={form.taxPercent}
                onChange={(value) => update("taxPercent", value)}
              />
            )}

            <Field
              label="Buffer Override %"
              value={form.bufferOverridePercent}
              placeholder={`${totals.autoBufferPercent}`}
              onChange={(value) => update("bufferOverridePercent", value)}
            />
          </div>

          <p className="helper-note">
            Auto buffer: {totals.autoBufferPercent}% • Applied buffer:{" "}
            {totals.appliedBufferPercent}% • {totals.minimumReason}
          </p>
        </div>

        <div className="form-card full-span">
          <h3 className="card-title">Project Notes</h3>

          <label className="field">
            <span>Internal / Quote Notes</span>

            <textarea
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="Scope, materials, customer requests, fitment notes, approval notes, etc."
            />
          </label>
        </div>

        <div className="form-card full-span sticky-summary-card">
          <div className="page-heading-row">
            <div>
              <h3 className="card-title">
                {summaryMode === "customer" ? "Customer Summary" : "Internal Summary"}
              </h3>

              <p className="muted-text">
                {summaryMode === "customer"
                  ? "Customer view hides buffer/internal markup details."
                  : "Internal view shows cost buildup, buffer, and margin protection."}
              </p>
            </div>

            <button className="primary-button" type="button" onClick={saveQuote}>
              <Save size={18} />
              {editingQuote ? "Save Quote Changes" : "Save Quote"}
            </button>
          </div>
                    <div className="summary-grid single-row-gap">
            {summaryMode === "customer" ? (
              <>
                {customerFacingLines.map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{money(value)}</strong>
                  </div>
                ))}

                {totals.minimumAdjustment > 0 && (
                  <div>
                    <span>Minimum Adjustment</span>
                    <strong>{money(totals.minimumAdjustment)}</strong>
                  </div>
                )}

                {num(form.discount) > 0 && (
                  <div>
                    <span>Discount</span>
                    <strong>-{money(form.discount)}</strong>
                  </div>
                )}

                <div>
                  <span>Subtotal</span>
                  <strong>{money(totals.subtotal)}</strong>
                </div>

                {form.taxEnabled && (
                  <div>
                    <span>Tax</span>
                    <strong>{money(totals.tax)}</strong>
                  </div>
                )}

                <div>
                  <span>Total</span>
                  <strong>{money(totals.finalTotal)}</strong>
                </div>

                {usesQuantity && (
                  <div>
                    <span>Per Unit</span>
                    <strong>{money(totals.perUnit)}</strong>
                  </div>
                )}

                <div>
                  <span>Suggested Deposit</span>
                  <strong>{money(totals.suggestedDeposit)}</strong>
                </div>

                <div>
                  <span>Remaining Balance</span>
                  <strong>{money(totals.remainingBalance)}</strong>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span>Print Material Cost</span>
                  <strong>{money(totals.printMaterialCost)}</strong>
                </div>

                <div>
                  <span>Engraving Material Cost</span>
                  <strong>{money(totals.engravingMaterialCost)}</strong>
                </div>

                <div>
                  <span>Vinyl Material Cost</span>
                  <strong>{money(totals.vinylMaterialCost)}</strong>
                </div>

                <div>
                  <span>Total Material Cost</span>
                  <strong>{money(totals.materialCost)}</strong>
                </div>

                <div>
                  <span>Machine Cost</span>
                  <strong>{money(totals.machineCost)}</strong>
                </div>

                <div>
                  <span>CAD Cost</span>
                  <strong>{money(totals.cadCost)}</strong>
                </div>

                <div>
                  <span>Engraving Fee</span>
                  <strong>{money(totals.engravingCost)}</strong>
                </div>

                <div>
                  <span>Vinyl Fee</span>
                  <strong>{money(totals.vinylCost)}</strong>
                </div>

                <div>
                  <span>Integration Fee</span>
                  <strong>{money(totals.integrationCost)}</strong>
                </div>

                <div>
                  <span>Custom Work</span>
                  <strong>{money(totals.customCost)}</strong>
                </div>

                <div>
                  <span>Extra Labor</span>
                  <strong>{money(totals.extraLaborCost)}</strong>
                </div>

                <div>
                  <span>Print Setup</span>
                  <strong>{money(totals.setupFee)}</strong>
                </div>

                <div>
                  <span>Direct Subtotal</span>
                  <strong>{money(totals.directSubtotal)}</strong>
                </div>

                <div>
                  <span>Quote Buffer ({totals.appliedBufferPercent}%)</span>
                  <strong>{money(totals.quoteBuffer)}</strong>
                </div>

                {totals.minimumAdjustment > 0 && (
                  <div>
                    <span>Minimum Adjustment</span>
                    <strong>{money(totals.minimumAdjustment)}</strong>
                  </div>
                )}

                {num(form.discount) > 0 && (
                  <div>
                    <span>Discount</span>
                    <strong>-{money(form.discount)}</strong>
                  </div>
                )}

                <div>
                  <span>Subtotal</span>
                  <strong>{money(totals.subtotal)}</strong>
                </div>

                {form.taxEnabled && (
                  <div>
                    <span>Tax</span>
                    <strong>{money(totals.tax)}</strong>
                  </div>
                )}

                <div>
                  <span>Final Total</span>
                  <strong>{money(totals.finalTotal)}</strong>
                </div>

                <div>
                  <span>Deposit</span>
                  <strong>{money(totals.suggestedDeposit)}</strong>
                </div>

                <div>
                  <span>Remaining</span>
                  <strong>{money(totals.remainingBalance)}</strong>
                </div>
              </>
            )}
          </div>

          <div className="form-card single-row-gap">
            <h3 className="card-title">Market Positioning Estimate</h3>

            <div className="summary-grid">
              <div>
                <span>Budget Market</span>
                <strong>
                  {money(totals.market.budgetLow)} -{" "}
                  {money(totals.market.budgetHigh)}
                </strong>
              </div>

              <div>
                <span>Average Market</span>
                <strong>
                  {money(totals.market.averageLow)} -{" "}
                  {money(totals.market.averageHigh)}
                </strong>
              </div>

              <div>
                <span>Premium Market</span>
                <strong>
                  {money(totals.market.premiumLow)} -{" "}
                  {money(totals.market.premiumHigh)}
                </strong>
              </div>
            </div>

            <p className="helper-note">
              These ranges are informational only and are based on complexity,
              service stacking, nozzle choice, specialty materials, and market
              positioning.
            </p>
          </div>

          {form.notes && (
            <div className="customer-warning-box">
              <strong>Notes</strong>
              <p>{form.notes}</p>
            </div>
          )}

          <div className="record-button-row single-row-gap">
            <button className="primary-button" type="button" onClick={saveQuote}>
              <Save size={18} />
              {editingQuote ? "Save Quote Changes" : "Save Quote"}
            </button>

            {editingQuote && (
              <button
                className="secondary-button"
                type="button"
                onClick={onCancelEdit}
              >
                <XCircle size={18} />
                Cancel Edit
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}