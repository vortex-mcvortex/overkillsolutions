import { useEffect, useMemo, useState } from "react";
import { Save, RotateCcw, Plus, Trash2, Wand2, XCircle, UserCheck } from "lucide-react";

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

const DEFAULT_FORM = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  customerAddress: "",
  customerKey: "",
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
  basicMinimum: 25,
  cadPrintMinimum: 60,
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
  };
}

function buildCustomerList(quotes = [], jobs = [], manualCustomers = [], customerOverrides = {}) {
  const map = new Map();

  manualCustomers.forEach((customer) => {
    map.set(customer.key, {
      key: customer.key,
      source: "manual",
      name: customer.name || "Manual Customer",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
    });
  });

  [...quotes, ...jobs].forEach((record) => {
    const info = getCustomerInfo(record);
    const override = customerOverrides[info.key] || {};

    if (!map.has(info.key)) {
      map.set(info.key, {
        ...info,
        ...override,
      });
    } else {
      const existing = map.get(info.key);

      map.set(info.key, {
        ...existing,
        name: override.name || existing.name || info.name,
        phone: override.phone || existing.phone || info.phone,
        email: override.email || existing.email || info.email,
        address: override.address || existing.address || info.address,
        notes: override.notes || existing.notes || "",
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
  const activeMaterials = getActiveItems(settings.printMaterials);
  const activePrinters = getActiveModules(settings, "printer");
  const activeNozzles = getActiveNozzles(settings);

  const material = activeMaterials[0] || DEFAULT_SETTINGS.printMaterials[0];
  const printer = activePrinters[0] || DEFAULT_SETTINGS.machineModules[0];
  const nozzle = activeNozzles.find((item) => String(item.diameter) === "0.4") || activeNozzles[0] || DEFAULT_SETTINGS.nozzles[1];

  return {
    id: crypto.randomUUID(),
    printerId: printer.id,
    materialId: material.id,
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

  const printMaterials = getActiveItems(settings.printMaterials);

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

function buildInitialForm(settings, quote = null) {
  const sourceForm = quote?.formData || {};
  const activeCadPresets = getActiveItems(settings.cadPresets);
  const defaultCadId = activeCadPresets[0]?.id || "basic";

  const activeLasers = getActiveModules(settings, "laser");
  const activeCutters = getActiveModules(settings, "cutter");

  return {
    ...DEFAULT_FORM,
    depositPercent: settings.defaultDepositPercent,
    taxPercent: settings.defaultTaxPercent,
    basicMinimum: settings.minimumCharges.printMinimum,
    cadPrintMinimum: settings.minimumCharges.cadPrintMinimum,
    cadPresetId: defaultCadId,
    engravingModuleId: activeLasers[0]?.id || DEFAULT_FORM.engravingModuleId,
    vinylModuleId: activeCutters[0]?.id || DEFAULT_FORM.vinylModuleId,
    ...sourceForm,
    printRuns:
      sourceForm.printRuns?.length > 0
        ? sourceForm.printRuns
        : [createPrintRun(settings)],
    vinylMaterialLines:
      sourceForm.vinylMaterialLines?.length > 0
        ? sourceForm.vinylMaterialLines
        : [createVinylLine(settings)],
  };
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
      <span>{label}{required ? " *" : ""}</span>
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

            if (digits.length <= 3) {
              nextValue = digits;
            } else if (digits.length <= 6) {
              nextValue = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
            } else {
              nextValue = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
            }
          }

          onChange(nextValue);
        }}
      />
    </label>
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
}) {
  const [settings, setSettings] = useState(getSettings);
  const [form, setForm] = useState(() => buildInitialForm(settings, editingQuote));
  const [dismissedCustomerKeys, setDismissedCustomerKeys] = useState([]);

  useEffect(() => {
    const freshSettings = getSettings();
    setSettings(freshSettings);
    setForm(buildInitialForm(freshSettings, editingQuote));
    setDismissedCustomerKeys([]);
  }, [editingQuote]);

  const customers = useMemo(
    () => buildCustomerList(quotes, jobs, manualCustomers, customerOverrides),
    [quotes, jobs, manualCustomers, customerOverrides]
  );

  const activePrintMaterials = getActiveItems(settings.printMaterials);
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

  const selectedEngravingMaterial =
    getById(activeEngravingMaterials, form.engravingMaterialId);

  const selectedEngravingModule = getLaserModule(settings, form.engravingModuleId);
  const selectedVinylModule = getCutterModule(settings, form.vinylModuleId);

  const customerMatches = useMemo(() => {
    return findCustomerMatches(form, customers).filter(
      (customer) =>
        customer.key !== form.customerKey &&
        !dismissedCustomerKeys.includes(customer.key)
    );
  }, [form, customers, dismissedCustomerKeys]);

  const bestCustomerMatch = customerMatches[0];

  const usesQuantity =
    form.jobAspects.printing || form.jobAspects.engraving || form.jobAspects.vinyl;

  const printSetup = calculatePrintSetup(settings, form.printRuns);

  const printSetupFee =
    form.printSetupOverride === ""
      ? printSetup.totalSetup
      : num(form.printSetupOverride);

  const suggestedEngravingFee = suggestEngravingService(form, settings);
  const suggestedVinylFee = suggestVinylService(form);
  const suggestedIntegrationLevel = suggestIntegrationComplexity(form.jobAspects);
  const suggestedIntegration = suggestIntegrationFee(settings, form);

  const totals = useMemo(() => {
    const quantity = usesQuantity ? Math.max(1, num(form.quantity)) : 1;

    const printMaterialCost = form.jobAspects.printing
      ? roundUpMoney(
          form.printRuns.reduce((sum, run) => {
            const material = getById(activePrintMaterials, run.materialId);
            return sum + num(run.materialGrams) * num(material.costPerGram);
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
      ? roundUpMoney(
          materialUnitCost(selectedEngravingMaterial) *
            num(form.engravingMaterialUnits)
        )
      : 0;

    const vinylMaterialCost = form.jobAspects.vinyl
      ? roundUpMoney(
          form.vinylMaterialLines.reduce((sum, line) => {
            const material = getById(activeVinylMaterials, line.materialId);
            return sum + materialUnitCost(material) * num(line.units);
          }, 0)
        )
      : 0;

    const materialCost =
      printMaterialCost + engravingMaterialCost + vinylMaterialCost;

    const cadCost = form.jobAspects.cad
      ? selectedCadPreset.id === "custom"
        ? num(form.customCadAmount)
        : num(selectedCadPreset.amount)
      : 0;

    const engravingCost = form.jobAspects.engraving ? num(form.engravingFee) : 0;
    const vinylCost = form.jobAspects.vinyl ? num(form.vinylFee) : 0;
    const integrationCost =
      activeProcessCount(form.jobAspects) > 1 ? num(form.integrationFee) : 0;
    const customCost = form.jobAspects.custom ? num(form.customFee) : 0;
    const extraLaborCost = roundUpMoney(
      num(form.extraLaborHours) * num(form.extraLaborRate)
    );

    const directSubtotal =
      materialCost +
      machineCost +
      cadCost +
      engravingCost +
      vinylCost +
      integrationCost +
      customCost +
      extraLaborCost +
      (form.jobAspects.printing ? printSetupFee : 0) +
      num(form.complexityFee) +
      num(form.finishingFee) +
      num(form.shippingFee);

    const autoBufferPercent = curvedBufferPercent(directSubtotal, settings);
    const appliedBufferPercent =
      form.bufferOverridePercent === ""
        ? autoBufferPercent
        : num(form.bufferOverridePercent);

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

    const tax = form.taxEnabled
      ? roundUpMoney(subtotal * (num(form.taxPercent) / 100))
      : 0;

    const finalTotal = roundUpMoney(subtotal + tax);
    const suggestedDeposit = roundUpMoney(finalTotal * (num(form.depositPercent) / 100));
    const remainingBalance = roundUpMoney(finalTotal - suggestedDeposit);
    const perUnit = usesQuantity ? roundUpMoney(finalTotal / quantity) : finalTotal;

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
      setupFee: form.jobAspects.printing ? printSetupFee : 0,
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
    activePrintMaterials,
    activeVinylMaterials,
    printSetupFee,
    settings,
  ]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyCustomer(customer) {
    setForm((current) => ({
      ...current,
      customerKey: customer.key,
      customerName: customer.name || current.customerName,
      customerPhone: customer.phone || current.customerPhone,
      customerEmail: customer.email || current.customerEmail,
      customerAddress: customer.address || current.customerAddress,
    }));

    setDismissedCustomerKeys((current) =>
      current.filter((key) => key !== customer.key)
    );
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
          const material = getById(activePrintMaterials, updatedRun.materialId);
          const nozzle = getNozzle(settings, updatedRun.nozzleSize);

          return {
            ...updatedRun,
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
        jobName: form.jobName,
        jobAspects: form.jobAspects,
        finalTotal: totals.finalTotal,
        depositAmount: totals.suggestedDeposit,
        remainingBalance: totals.remainingBalance,
        formData: form,
        totals,
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
            Settings-driven quote builder with active modules, nozzles, materials,
            customer recognition, minimums, and PDFs.
          </p>

          {editingQuote && (
            <p className="helper-note">
              Saving will update this quote instead of creating a new quote number.
            </p>
          )}
        </div>

        <button className="secondary-button" onClick={resetCalculator}>
          <RotateCcw size={18} />
          Reset
        </button>
      </div>

      <div className="calculator-grid">
        <div className="form-card full-span">
          <h3 className="card-title">Customer Info</h3>

          {customers.length > 0 && (
            <div className="form-grid">
              <label className="field">
                <span>Select Existing Customer</span>
                <select
                  value={form.customerKey}
                  onChange={(event) => {
                    const selected = customers.find((customer) => customer.key === event.target.value);
                    if (selected) applyCustomer(selected);
                    else update("customerKey", "");
                  }}
                >
                  <option value="">New / Unsaved Customer</option>
                  {customers.map((customer) => (
                    <option key={customer.key} value={customer.key}>
                      {customer.name} {customer.phone ? `— ${customer.phone}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {bestCustomerMatch && (
            <div className="customer-match-popover">
              <div>
                <strong>Possible existing customer found</strong>
                <span>
                  {bestCustomerMatch.name}
                  {bestCustomerMatch.phone ? ` • ${bestCustomerMatch.phone}` : ""}
                  {bestCustomerMatch.email ? ` • ${bestCustomerMatch.email}` : ""}
                </span>
              </div>

              <div className="customer-match-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => applyCustomer(bestCustomerMatch)}
                >
                  <UserCheck size={18} />
                  Autofill
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => dismissCustomerMatch(bestCustomerMatch.key)}
                >
                  Ignore
                </button>
              </div>
            </div>
          )}

          <div className="form-grid">
            <Field label="Customer Name" type="text" value={form.customerName} required={settings.customerFields.requireName} onChange={(value) => update("customerName", value)} />
            <Field label="Phone Number" type="tel" value={form.customerPhone} required={settings.customerFields.requirePhone} onChange={(value) => update("customerPhone", value)} />
            <Field label="Email" type="email" value={form.customerEmail} required={settings.customerFields.requireEmail} onChange={(value) => update("customerEmail", value)} />
            <Field label="Job Name" type="text" value={form.jobName} onChange={(value) => update("jobName", value)} />
          </div>

          {settings.customerFields.showAddress && (
            <label className="field single-row-gap">
              <span>Address / Shipping Address</span>
              <textarea
                value={form.customerAddress}
                onChange={(event) => update("customerAddress", event.target.value)}
                placeholder="Optional for local jobs, useful for delivery or future shipping estimates."
              />
            </label>
          )}
        </div>

        <div className="form-card">
          <h3 className="card-title">Job Type</h3>

          <div className="aspect-grid">
            {[
              ["cad", "CAD Modeling"],
              ["printing", "3D Printing"],
              ["engraving", "Laser Engraving"],
              ["vinyl", "Vinyl Cutting"],
              ["custom", "Custom Project"],
            ].map(([key, label]) => (
              <label className="aspect-option" key={key}>
                <input type="checkbox" checked={form.jobAspects[key]} onChange={() => toggleAspect(key)} />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {usesQuantity && (
            <div className="form-grid single-row-gap">
              <Field label="Quantity" value={form.quantity} step="1" onChange={(value) => update("quantity", value)} />
            </div>
          )}
        </div>

        {form.jobAspects.cad && (
          <div className="form-card">
            <h3 className="card-title">CAD Modeling</h3>

            <div className="form-grid">
              <label className="field">
                <span>CAD Quote Tier</span>
                <select value={form.cadPresetId} onChange={(event) => update("cadPresetId", event.target.value)}>
                  {activeCadPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.amount > 0 ? `${preset.label} — ${money(preset.amount)}` : preset.label}
                    </option>
                  ))}
                </select>
              </label>

              {selectedCadPreset.id === "custom" && (
                <Field label="Custom CAD Amount" value={form.customCadAmount} onChange={(value) => update("customCadAmount", value)} />
              )}
            </div>
          </div>
        )}

        {form.jobAspects.printing && (
          <div className="form-card full-span">
            <div className="page-heading-row">
              <div>
                <h3 className="card-title">3D Print Runs</h3>
                <p className="muted-text">
                  Printers and nozzles are controlled in Settings.
                </p>
              </div>

              <button className="secondary-button" onClick={addPrintRun}>
                <Plus size={18} />
                Add Print Run
              </button>
            </div>

            <div className="vinyl-lines">
              {form.printRuns.map((run, index) => {
                const material = getById(activePrintMaterials, run.materialId);
                const nozzle = getNozzle(settings, run.nozzleSize);
                const printer = getPrinterModule(settings, run.printerId);
                const runMaterialCost = roundUpMoney(num(run.materialGrams) * num(material.costPerGram));
                const runMachineCost = roundUpMoney(num(run.machineHours) * num(run.machineRate));
                const tierId = suggestedSetupTier(material, nozzle);
                const tierAmount = settings.setupFees[tierId];

                return (
                  <div className="vinyl-line" key={run.id}>
                    <div className="vinyl-line-header">
                      <strong>Print Run {index + 1}</strong>
                      <span>{money(runMaterialCost + runMachineCost)}</span>
                    </div>

                    <div className="form-grid">
                      <label className="field">
                        <span>Printer / Module</span>
                        <select value={run.printerId} onChange={(event) => updatePrintRun(run.id, "printerId", event.target.value)}>
                          {activePrinters.map((printerOption) => (
                            <option key={printerOption.id} value={printerOption.id}>
                              {printerOption.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Filament / Material</span>
                        <select value={run.materialId} onChange={(event) => updatePrintRun(run.id, "materialId", event.target.value)}>
                          {activePrintMaterials.map((printMaterial) => (
                            <option key={printMaterial.id} value={printMaterial.id}>
                              {printMaterial.label} — {money(printMaterial.costPerGram)}/g
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Nozzle / Quality</span>
                        <select value={run.nozzleSize} onChange={(event) => updatePrintRun(run.id, "nozzleSize", event.target.value)}>
                          {activeNozzles.map((nozzleOption) => (
                            <option key={nozzleOption.id} value={nozzleOption.id}>
                              {nozzleOption.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <Field label="Estimated Weight (grams)" value={run.materialGrams} onChange={(value) => updatePrintRun(run.id, "materialGrams", value)} />
                      <Field label="Estimated Machine Hours" value={run.machineHours} onChange={(value) => updatePrintRun(run.id, "machineHours", value)} />
                      <Field label="Machine Rate ($/hr)" value={run.machineRate} onChange={(value) => updatePrintRun(run.id, "machineRate", value)} />

                      <button className="secondary-button danger-button" onClick={() => removePrintRun(run.id)} type="button">
                        <Trash2 size={18} />
                        Remove
                      </button>
                    </div>

                    <p className="helper-note">
                      {printer.label} • {material.label} • {nozzle.label}. Suggested setup: {tierId} / {money(tierAmount)}. {setupReason(material, nozzle)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="form-grid single-row-gap">
              <Field
                label="Print Setup Override"
                value={form.printSetupOverride}
                placeholder={`${money(printSetup.totalSetup)} auto`}
                onChange={(value) => update("printSetupOverride", value)}
              />
            </div>
          </div>
        )}

        {form.jobAspects.engraving && (
          <div className="form-card">
            <h3 className="card-title">Laser Engraving</h3>

            <div className="form-grid">
              <label className="field">
                <span>Laser Module</span>
                <select value={form.engravingModuleId} onChange={(event) => update("engravingModuleId", event.target.value)}>
                  {activeLasers.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.label} — {money(settings.machineRates[module.rateKey])}/hr
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Engraving Material</span>
                <select value={form.engravingMaterialId} onChange={(event) => updateEngravingMaterial(event.target.value)}>
                  {activeEngravingMaterials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.label} — {money(materialUnitCost(material))}/unit
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Material Finish / Color</span>
                <select value={form.engravingMaterialColor} onChange={(event) => update("engravingMaterialColor", event.target.value)}>
                  {colorsToArray(selectedEngravingMaterial.colors).map((color) => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                </select>
              </label>

              <Field label="Material Units Used" value={form.engravingMaterialUnits} step="1" onChange={(value) => update("engravingMaterialUnits", value)} />

              <label className="field">
                <span>Engraving Complexity</span>
                <select value={form.engravingComplexity} onChange={(event) => update("engravingComplexity", event.target.value)}>
                  {COMPLEXITY_LEVELS.filter((level) => level.id !== "none").map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </label>

              <Field label="Engraving Service Estimate" value={form.engravingFee} onChange={(value) => update("engravingFee", value)} />

              <button className="secondary-button" onClick={applySuggestedEngraving} type="button">
                <Wand2 size={18} />
                Use Suggested {money(suggestedEngravingFee)}
              </button>
            </div>

            <p className="helper-note">
              Selected module: {selectedEngravingModule.label}. Metals like titanium and stainless steel can be added or edited in Settings.
            </p>
          </div>
        )}

        {form.jobAspects.vinyl && (
          <div className="form-card full-span">
            <div className="page-heading-row">
              <div>
                <h3 className="card-title">Vinyl Cutting Materials</h3>
                <p className="muted-text">
                  Cutter modules and vinyl materials are controlled in Settings.
                </p>
              </div>

              <button className="secondary-button" onClick={addVinylLine}>
                <Plus size={18} />
                Add Material
              </button>
            </div>

            <div className="form-grid single-row-gap">
              <label className="field">
                <span>Cutter Module</span>
                <select value={form.vinylModuleId} onChange={(event) => update("vinylModuleId", event.target.value)}>
                  {activeCutters.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.label} — {money(settings.machineRates[module.rateKey])}/hr
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="helper-note">Selected cutter: {selectedVinylModule.label}</p>

            <div className="vinyl-lines">
              {form.vinylMaterialLines.map((line, index) => {
                const material = getById(activeVinylMaterials, line.materialId);
                const lineCost = roundUpMoney(materialUnitCost(material) * num(line.units));

                return (
                  <div className="vinyl-line" key={line.id}>
                    <div className="vinyl-line-header">
                      <strong>Layer / Material {index + 1}</strong>
                      <span>{money(lineCost)}</span>
                    </div>

                    <div className="form-grid">
                      <label className="field">
                        <span>Vinyl Material</span>
                        <select value={line.materialId} onChange={(event) => updateVinylLine(line.id, "materialId", event.target.value)}>
                          {activeVinylMaterials.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label} — {money(materialUnitCost(item))}/unit
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Color</span>
                        <select value={line.color} onChange={(event) => updateVinylLine(line.id, "color", event.target.value)}>
                          {colorsToArray(material.colors).map((color) => (
                            <option key={color} value={color}>{color}</option>
                          ))}
                        </select>
                      </label>

                      <Field label="Units Used" value={line.units} step="1" onChange={(value) => updateVinylLine(line.id, "units", value)} />

                      <button className="secondary-button danger-button" onClick={() => removeVinylLine(line.id)} type="button">
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
                <span>Vinyl Complexity</span>
                <select value={form.vinylComplexity} onChange={(event) => update("vinylComplexity", event.target.value)}>
                  {COMPLEXITY_LEVELS.filter((level) => level.id !== "none").map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </label>

              <Field label="Vinyl Service Estimate" value={form.vinylFee} onChange={(value) => update("vinylFee", value)} />

              <button className="secondary-button" onClick={applySuggestedVinyl} type="button">
                <Wand2 size={18} />
                Use Suggested {money(suggestedVinylFee)}
              </button>
            </div>
          </div>
        )}

        {activeProcessCount(form.jobAspects) > 1 && (
          <div className="form-card">
            <h3 className="card-title">Project Integration</h3>

            <div className="form-grid">
              <label className="field">
                <span>Integration Complexity</span>
                <select value={form.integrationComplexity} onChange={(event) => update("integrationComplexity", event.target.value)}>
                  {Object.keys(settings.integrationCharges).map((key) => (
                    <option key={key} value={key}>
                      {key.charAt(0).toUpperCase() + key.slice(1)} — {money(settings.integrationCharges[key])}
                    </option>
                  ))}
                </select>
              </label>

              <Field label="Integration Fee" value={form.integrationFee} onChange={(value) => update("integrationFee", value)} />

              <button className="secondary-button" onClick={applySuggestedIntegration} type="button">
                <Wand2 size={18} />
                Use Suggested {money(suggestedIntegration)}
              </button>
            </div>

            <p className="helper-note">
              Suggested integration level based on active services: {suggestedIntegrationLevel}.
            </p>
          </div>
        )}

        {form.jobAspects.custom && (
          <div className="form-card">
            <h3 className="card-title">Custom Project</h3>

            <div className="form-grid">
              <Field label="Custom Project Estimate" value={form.customFee} onChange={(value) => update("customFee", value)} />
            </div>
          </div>
        )}

        <div className="form-card">
          <h3 className="card-title">Pricing Controls</h3>

          <div className="form-grid">
            <Field label="Buffer Override %" value={form.bufferOverridePercent} placeholder={`${totals.autoBufferPercent}% auto`} onChange={(value) => update("bufferOverridePercent", value)} />
            <Field label="Basic Print Minimum" value={form.basicMinimum} onChange={(value) => update("basicMinimum", value)} />
            <Field label="CAD + Print Minimum" value={form.cadPrintMinimum} onChange={(value) => update("cadPrintMinimum", value)} />
            <Field label="Suggested Deposit %" value={form.depositPercent} onChange={(value) => update("depositPercent", value)} />
          </div>
        </div>

        <div className="form-card">
          <h3 className="card-title">Labor & Adjustments</h3>

          <div className="form-grid">
            <Field label="Extra Labor Hours" value={form.extraLaborHours} onChange={(value) => update("extraLaborHours", value)} />
            <Field label="Extra Labor Rate ($/hr)" value={form.extraLaborRate} onChange={(value) => update("extraLaborRate", value)} />
            <Field label="Complexity Fee" value={form.complexityFee} onChange={(value) => update("complexityFee", value)} />
            <Field label="Finishing Fee" value={form.finishingFee} onChange={(value) => update("finishingFee", value)} />
            <Field label="Shipping / Delivery" value={form.shippingFee} onChange={(value) => update("shippingFee", value)} />
            <Field label="Discount" value={form.discount} onChange={(value) => update("discount", value)} />

            <label className="field checkbox-field">
              <input type="checkbox" checked={form.taxEnabled} onChange={(event) => update("taxEnabled", event.target.checked)} />
              <span>Include tax option</span>
            </label>

            {form.taxEnabled && <Field label="Tax %" value={form.taxPercent} onChange={(value) => update("taxPercent", value)} />}
          </div>
        </div>

        <div className="form-card full-span">
          <h3 className="card-title">Notes</h3>
          <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Material color, customer requests, deadline, revision notes, etc." />
        </div>
      </div>

      <aside className="quote-summary">
        <h3 className="card-title">
          {editingQuote ? `Update ${editingQuote.quoteNumber}` : "Quote Estimate"}
        </h3>

        <div className="summary-total">{money(totals.finalTotal)}</div>
        <div className="muted-text">Estimated final quote total</div>

        <div className="summary-grid">
          {usesQuantity && <div><span>Per Unit</span><strong>{money(totals.perUnit)}</strong></div>}
          <div><span>Suggested Deposit</span><strong>{money(totals.suggestedDeposit)}</strong></div>
          <div><span>Remaining</span><strong>{money(totals.remainingBalance)}</strong></div>
          <div><span>Direct Subtotal</span><strong>{money(totals.directSubtotal)}</strong></div>
          <div><span>Buffer ({totals.appliedBufferPercent}%)</span><strong>{money(totals.quoteBuffer)}</strong></div>
          <div><span>Minimum Adjustment</span><strong>{money(totals.minimumAdjustment)}</strong></div>
        </div>

        <p className="helper-note">{totals.minimumReason}</p>

        <div className="breakdown-list">
          <div><span>Print Material</span><strong>{money(totals.printMaterialCost)}</strong></div>
          <div><span>Engraving Material</span><strong>{money(totals.engravingMaterialCost)}</strong></div>
          <div><span>Vinyl Material</span><strong>{money(totals.vinylMaterialCost)}</strong></div>
          <div><span>Machine Time</span><strong>{money(totals.machineCost)}</strong></div>
          <div><span>CAD Estimate</span><strong>{money(totals.cadCost)}</strong></div>
          <div><span>Engraving Service</span><strong>{money(totals.engravingCost)}</strong></div>
          <div><span>Vinyl Service</span><strong>{money(totals.vinylCost)}</strong></div>
          <div><span>Integration</span><strong>{money(totals.integrationCost)}</strong></div>
          <div><span>Custom</span><strong>{money(totals.customCost)}</strong></div>
          <div><span>Extra Labor</span><strong>{money(totals.extraLaborCost)}</strong></div>
          <div><span>Print Setup</span><strong>{money(totals.setupFee)}</strong></div>
          <div><span>Complexity</span><strong>{money(form.complexityFee)}</strong></div>
          <div><span>Finishing</span><strong>{money(form.finishingFee)}</strong></div>
          <div><span>Shipping</span><strong>{money(form.shippingFee)}</strong></div>
          <div><span>Tax</span><strong>{money(totals.tax)}</strong></div>
          <div><span>Discount</span><strong>-{money(form.discount)}</strong></div>
        </div>

        <div className="market-box">
          <h3 className="card-title">Market Reality Check</h3>
          <div><span>Budget Range</span><strong>{money(totals.market.budgetLow)}–{money(totals.market.budgetHigh)}</strong></div>
          <div><span>Average Range</span><strong>{money(totals.market.averageLow)}–{money(totals.market.averageHigh)}</strong></div>
          <div><span>Premium Range</span><strong>{money(totals.market.premiumLow)}–{money(totals.market.premiumHigh)}</strong></div>
        </div>

        <div className={editingQuote ? "record-button-row" : ""}>
          {editingQuote && (
            <button className="secondary-button" type="button" onClick={onCancelEdit}>
              <XCircle size={18} />
              Cancel Edit
            </button>
          )}

          <button className="primary-button" onClick={saveQuote}>
            <Save size={18} />
            {editingQuote ? "Update Quote" : "Save as Quote"}
          </button>
        </div>
      </aside>
    </section>
  );
}