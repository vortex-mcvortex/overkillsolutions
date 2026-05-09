import { useEffect, useMemo, useState } from "react";
import { Save, RotateCcw, Plus, Trash2, Wand2, XCircle } from "lucide-react";

const PRINTERS = [
  { id: "p1s", label: "Bambu P1S" },
  { id: "x1c", label: "Bambu X1C" },
  { id: "h2s", label: "Bambu H2S" },
  { id: "other", label: "Other Printer" },
];

const PRINT_MATERIALS = [
  { id: "pla", label: "PLA", rate: 0.03, group: "standard" },
  { id: "petg", label: "PETG", rate: 0.03, group: "standard" },
  { id: "abs", label: "ABS", rate: 0.03, group: "standard" },
  { id: "asa", label: "ASA", rate: 0.05, group: "specialty" },
  { id: "tpu", label: "TPU", rate: 0.05, group: "specialty" },
  { id: "pc", label: "PC", rate: 0.06, group: "specialty" },
  { id: "carbon-fiber", label: "Carbon Fiber", rate: 0.07, group: "specialty" },
];

const NOZZLES = [
  { id: "0.2", label: "0.2mm — Detail", note: "Highest detail, slower, more brittle", machineRateAdd: 1, marketMultiplier: 1.25 },
  { id: "0.4", label: "0.4mm — Standard", note: "Default balanced option", machineRateAdd: 0, marketMultiplier: 1 },
  { id: "0.6", label: "0.6mm — Strong/Faster", note: "Stronger and faster, less detail", machineRateAdd: 0.25, marketMultiplier: 1.05 },
  { id: "0.8", label: "0.8mm — Heavy Duty", note: "Strong and fast, low detail", machineRateAdd: 0.5, marketMultiplier: 1.1 },
];

const SETUP_TIERS = [
  { id: "basic", label: "Basic Setup", amount: 5, rank: 1 },
  { id: "moderate", label: "Moderate Setup", amount: 15, rank: 2 },
  { id: "advanced", label: "Advanced Setup", amount: 30, rank: 3 },
];

const CAD_PRESETS = [
  { id: "none", label: "None", amount: 0 },
  { id: "simple", label: "Simple Design", amount: 30 },
  { id: "moderate", label: "Moderate Design", amount: 80 },
  { id: "complex", label: "Complex Design", amount: 150 },
];

const COMPLEXITY_LEVELS = [
  { id: "none", label: "None", engraving: 0, vinyl: 0, integration: 0 },
  { id: "simple", label: "Simple", engraving: 10, vinyl: 8, integration: 15 },
  { id: "moderate", label: "Moderate", engraving: 20, vinyl: 18, integration: 30 },
  { id: "advanced", label: "Advanced", engraving: 35, vinyl: 30, integration: 50 },
];

const ENGRAVING_MATERIALS = [
  { id: "none", label: "None / Customer Provided", packCost: 0, packCount: 1, colors: ["N/A"] },
  { id: "aluminum-card", label: "Aluminum Card", packCost: 3.89, packCount: 1, colors: ["Black", "Silver", "Red", "Blue", "Gold", "Rainbow"] },
  { id: "stainless-round-tag", label: "Round Stainless Steel Tag", packCost: 6.89, packCount: 5, colors: ["Stainless"] },
  { id: "basswood-2mm", label: "2mm Basswood Plywood", packCost: 13.89, packCount: 6, colors: ["Natural"] },
  { id: "basswood-3mm", label: "3mm Basswood Plywood", packCost: 14.89, packCount: 6, colors: ["Natural"] },
  { id: "bamboo-3mm", label: "3mm Bamboo Board", packCost: 28.89, packCount: 6, colors: ["Natural Bamboo"] },
  { id: "birch-3mm", label: "3mm Birch Plywood", packCost: 31.89, packCount: 6, colors: ["Natural Birch"] },
  { id: "sapele-3mm", label: "3mm Sapele Plywood", packCost: 33.89, packCount: 6, colors: ["Sapele"] },
  { id: "black-walnut-3mm", label: "3mm Black Walnut Plywood", packCost: 30.89, packCount: 6, colors: ["Black Walnut"] },
  { id: "cork-2mm", label: "2mm Cork Sheet", packCost: 8.89, packCount: 4, colors: ["Natural Cork"] },
  { id: "acrylic-opaque-glossy", label: "3mm Opaque Glossy Acrylic", packCost: 17.89, packCount: 3, colors: ["Black", "Red", "Orange", "Yellow", "Green"] },
  { id: "pu-leatherette", label: "Pebbled PU Leatherette Fabric", packCost: 14.89, packCount: 5, colors: ["Black", "White", "Brown", "Gray"] },
  { id: "pu-iron-on-patch", label: "Rectangular PU Iron-on Patch", packCost: 12.89, packCount: 10, colors: ["Black"] },
  { id: "cardstock-250g", label: "250g Cardstock", packCost: 6.89, packCount: 25, colors: ["Black"] },
  { id: "kraft-paper-a4", label: "A4 200g Kraft Paper", packCost: 4.89, packCount: 25, colors: ["Kraft Brown"] },
  { id: "greeting-card", label: "Pearlescent White Greeting Card Set", packCost: 5.89, packCount: 2, colors: ["Pearlescent White"] },
];

const VINYL_MATERIALS = [
  { id: "none", label: "None / Customer Provided", packCost: 0, packCount: 1, colors: ["N/A"] },
  { id: "matte-removable-vinyl", label: "Matte Removable Vinyl", packCost: 9.89, packCount: 10, colors: ["Black", "Red", "Orange", "Yellow", "Green", "Blue", "Silver", "White"] },
  { id: "carbon-fiber-removable-vinyl", label: "Carbon Fiber Textured Removable Vinyl", packCost: 9.89, packCount: 10, colors: ["Black Carbon Fiber"] },
  { id: "printable-vinyl-paper", label: "White Matte Printable Vinyl Sticker Paper", packCost: 8.89, packCount: 25, colors: ["White"] },
  { id: "reflective-decal-sheet", label: "Light Gray Reflective Decal Sheet", packCost: 9.89, packCount: 5, colors: ["Light Gray Reflective"] },
  { id: "transfer-tape", label: "Transfer Tape", packCost: 7.89, packCount: 10, colors: ["Clear Grid"] },
  { id: "matte-heat-transfer-vinyl", label: "Matte Heat Transfer Vinyl", packCost: 10.89, packCount: 10, colors: ["Black", "Red", "Pink", "Orange", "Yellow", "Cream", "Green", "Blue", "Gray", "White"] },
  { id: "chrome-heat-transfer-vinyl", label: "Chrome Foil Heat Transfer Vinyl", packCost: 16.89, packCount: 10, colors: ["Chrome Silver"] },
];

const DEFAULT_FORM = {
  customerName: "",
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
  cadPresetId: "none",
  engravingMaterialId: "none",
  engravingMaterialColor: "N/A",
  engravingMaterialUnits: 1,
  engravingComplexity: "simple",
  engravingFee: 0,
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

function materialUnitCost(material) {
  if (!material || !material.packCount) return 0;
  return material.packCost / material.packCount;
}

function getPrintMaterial(id) {
  return PRINT_MATERIALS.find((item) => item.id === id) || PRINT_MATERIALS[0];
}

function getNozzle(id) {
  return NOZZLES.find((item) => item.id === id) || NOZZLES[1];
}

function getPrinter(id) {
  return PRINTERS.find((item) => item.id === id) || PRINTERS[0];
}

function getSetupTier(id) {
  return SETUP_TIERS.find((item) => item.id === id) || SETUP_TIERS[0];
}

function getVinylMaterial(id) {
  return VINYL_MATERIALS.find((item) => item.id === id) || VINYL_MATERIALS[0];
}

function getComplexity(id) {
  return COMPLEXITY_LEVELS.find((item) => item.id === id) || COMPLEXITY_LEVELS[0];
}

function suggestedMachineRate(material, nozzle) {
  const baseRate = material.group === "standard" ? 3 : 5;
  return roundUpMoney(baseRate + nozzle.machineRateAdd);
}

function suggestedSetupTier(material, nozzle) {
  if (material.group === "specialty") return "advanced";
  if (nozzle.id === "0.2") return "moderate";
  if (nozzle.id === "0.8") return "moderate";
  return "basic";
}

function setupReason(material, nozzle) {
  if (material.group === "specialty") {
    return "Specialty filament is harder to tune, load, and recover from failed attempts.";
  }

  if (nozzle.id === "0.2") {
    return "0.2mm nozzle prints slower and needs more detail-focused setup.";
  }

  if (nozzle.id === "0.8") {
    return "0.8mm nozzle usually needs strength-focused setup and heavier extrusion tuning.";
  }

  return "Standard material with a 0.4mm nozzle is the easiest normal setup.";
}

function curvedBufferPercent(subtotal) {
  if (subtotal <= 50) return 20;
  if (subtotal <= 100) return 15;
  if (subtotal <= 200) return 12;
  if (subtotal <= 400) return 10;
  return 8;
}

function createPrintRun() {
  const material = getPrintMaterial("pla");
  const nozzle = getNozzle("0.4");

  return {
    id: crypto.randomUUID(),
    printerId: "p1s",
    materialId: material.id,
    nozzleSize: nozzle.id,
    materialGrams: 0,
    machineHours: 1,
    machineRate: suggestedMachineRate(material, nozzle),
  };
}

function createVinylLine() {
  const material = getVinylMaterial("matte-removable-vinyl");

  return {
    id: crypto.randomUUID(),
    materialId: material.id,
    color: material.colors[0],
    units: 1,
  };
}

function getPrintRunSetupTier(run) {
  const material = getPrintMaterial(run.materialId);
  const nozzle = getNozzle(run.nozzleSize);
  return getSetupTier(suggestedSetupTier(material, nozzle));
}

function calculatePrintSetup(printRuns) {
  if (!printRuns.length) {
    return {
      primarySetup: 0,
      additionalSetup: 0,
      totalSetup: 0,
      explanation: "No 3D print runs selected.",
    };
  }

  const rankedRuns = printRuns
    .map((run) => ({ run, tier: getPrintRunSetupTier(run) }))
    .sort((a, b) => b.tier.rank - a.tier.rank);

  const primary = rankedRuns[0];
  const primarySetup = primary.tier.amount;

  const additionalSetup = rankedRuns.slice(1).reduce((sum, item) => {
    const material = getPrintMaterial(item.run.materialId);
    const nozzle = getNozzle(item.run.nozzleSize);
    const primaryMaterial = getPrintMaterial(primary.run.materialId);
    const primaryNozzle = getNozzle(primary.run.nozzleSize);
    const primaryPrinter = getPrinter(primary.run.printerId);
    const printer = getPrinter(item.run.printerId);

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

function suggestEngravingService(form) {
  const complexity = getComplexity(form.engravingComplexity);
  const units = Math.max(1, num(form.engravingMaterialUnits));
  const stackFactor = serviceStackDiscount(form.jobAspects);
  const unitAdd = Math.max(0, units - 1) * 3;

  return roundUpMoney((complexity.engraving + unitAdd) * stackFactor);
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

function suggestIntegrationFee(form) {
  const complexity = getComplexity(form.integrationComplexity);
  const count = activeProcessCount(form.jobAspects);

  if (count <= 1 || form.integrationComplexity === "none") return 0;
  return roundUpMoney(complexity.integration);
}

function buildInitialForm(quote = null) {
  const sourceForm = quote?.formData || {};

  return {
    ...DEFAULT_FORM,
    ...sourceForm,
    printRuns:
      sourceForm.printRuns?.length > 0
        ? sourceForm.printRuns
        : [createPrintRun()],
    vinylMaterialLines:
      sourceForm.vinylMaterialLines?.length > 0
        ? sourceForm.vinylMaterialLines
        : [createVinylLine()],
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
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        step={type === "number" ? step : undefined}
        min={type === "number" ? min : undefined}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export default function CalculatorPage({ onSaveQuote, editingQuote, onCancelEdit }) {
  const [form, setForm] = useState(() => buildInitialForm(editingQuote));

  useEffect(() => {
    setForm(buildInitialForm(editingQuote));
  }, [editingQuote]);

  const selectedCadPreset =
    CAD_PRESETS.find((item) => item.id === form.cadPresetId) || CAD_PRESETS[0];

  const selectedEngravingMaterial =
    ENGRAVING_MATERIALS.find((item) => item.id === form.engravingMaterialId) ||
    ENGRAVING_MATERIALS[0];

  const usesQuantity =
    form.jobAspects.printing || form.jobAspects.engraving || form.jobAspects.vinyl;

  const printSetup = calculatePrintSetup(form.printRuns);

  const printSetupFee =
    form.printSetupOverride === ""
      ? printSetup.totalSetup
      : num(form.printSetupOverride);

  const suggestedEngravingFee = suggestEngravingService(form);
  const suggestedVinylFee = suggestVinylService(form);
  const suggestedIntegrationLevel = suggestIntegrationComplexity(form.jobAspects);
  const suggestedIntegration = suggestIntegrationFee(form);

  const totals = useMemo(() => {
    const quantity = usesQuantity ? Math.max(1, num(form.quantity)) : 1;

    const printMaterialCost = form.jobAspects.printing
      ? roundUpMoney(
          form.printRuns.reduce((sum, run) => {
            const material = getPrintMaterial(run.materialId);
            return sum + num(run.materialGrams) * material.rate;
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
            const material = getVinylMaterial(line.materialId);
            return sum + materialUnitCost(material) * num(line.units);
          }, 0)
        )
      : 0;

    const materialCost =
      printMaterialCost + engravingMaterialCost + vinylMaterialCost;

    const cadCost = form.jobAspects.cad ? num(selectedCadPreset.amount) : 0;
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

    const autoBufferPercent = curvedBufferPercent(directSubtotal);
    const appliedBufferPercent =
      form.bufferOverridePercent === ""
        ? autoBufferPercent
        : num(form.bufferOverridePercent);

    const quoteBuffer = roundUpMoney(directSubtotal * (appliedBufferPercent / 100));
    const subtotalBeforeMinimum = directSubtotal + quoteBuffer;

    let minimumFloor = 0;
    let minimumReason = "No minimum applied.";

    if (form.jobAspects.printing) {
      minimumFloor = Math.max(minimumFloor, num(form.basicMinimum));
      minimumReason = `Basic 3D print minimum applied if needed: ${money(form.basicMinimum)}.`;
    }

    if (form.jobAspects.printing && form.jobAspects.cad) {
      minimumFloor = Math.max(minimumFloor, num(form.cadPrintMinimum));
      minimumReason = `CAD + print minimum applied if needed: ${money(form.cadPrintMinimum)}.`;
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
      const nozzle = getNozzle(run.nozzleSize);
      return Math.max(highest, nozzle.marketMultiplier);
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
    printSetupFee,
  ]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addPrintRun() {
    setForm((current) => ({
      ...current,
      printRuns: [...current.printRuns, createPrintRun()],
    }));
  }

  function updatePrintRun(runId, key, value) {
    setForm((current) => ({
      ...current,
      printRuns: current.printRuns.map((run) => {
        if (run.id !== runId) return run;

        const updatedRun = { ...run, [key]: value };

        if (key === "materialId" || key === "nozzleSize") {
          const material = getPrintMaterial(updatedRun.materialId);
          const nozzle = getNozzle(updatedRun.nozzleSize);

          return {
            ...updatedRun,
            machineRate: suggestedMachineRate(material, nozzle),
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
    const material =
      ENGRAVING_MATERIALS.find((item) => item.id === value) ||
      ENGRAVING_MATERIALS[0];

    setForm((current) => ({
      ...current,
      engravingMaterialId: material.id,
      engravingMaterialColor: material.colors[0],
    }));
  }

  function addVinylLine() {
    setForm((current) => ({
      ...current,
      vinylMaterialLines: [...current.vinylMaterialLines, createVinylLine()],
    }));
  }

  function updateVinylLine(lineId, key, value) {
    setForm((current) => ({
      ...current,
      vinylMaterialLines: current.vinylMaterialLines.map((line) => {
        if (line.id !== lineId) return line;

        if (key === "materialId") {
          const material = getVinylMaterial(value);
          return {
            ...line,
            materialId: material.id,
            color: material.colors[0],
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
      engravingFee: suggestEngravingService(current),
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
      integrationFee: suggestIntegrationFee(current),
    }));
  }

  function resetCalculator() {
    setForm(buildInitialForm(null));
  }

  function saveQuote() {
    onSaveQuote(
      {
        customerName: form.customerName,
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
            Competitive high-side estimates with stackable print runs, service estimators,
            integration pricing, curved buffer, and market-value sanity checks.
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
        <div className="form-card">
          <h3 className="card-title">Job Info</h3>

          <div className="form-grid">
            <Field label="Customer Name" type="text" value={form.customerName} onChange={(value) => update("customerName", value)} />
            <Field label="Job Name" type="text" value={form.jobName} onChange={(value) => update("jobName", value)} />
          </div>

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

        {form.jobAspects.printing && (
          <div className="form-card full-span">
            <div className="page-heading-row">
              <div>
                <h3 className="card-title">3D Print Runs</h3>
                <p className="muted-text">
                  Add each printer/nozzle/material combo separately. Setup is charged once at the hardest tier, with smaller add-on setup charges for extra runs.
                </p>
              </div>

              <button className="secondary-button" onClick={addPrintRun}>
                <Plus size={18} />
                Add Print Run
              </button>
            </div>

            <div className="vinyl-lines">
              {form.printRuns.map((run, index) => {
                const material = getPrintMaterial(run.materialId);
                const nozzle = getNozzle(run.nozzleSize);
                const printer = getPrinter(run.printerId);
                const runMaterialCost = roundUpMoney(num(run.materialGrams) * material.rate);
                const runMachineCost = roundUpMoney(num(run.machineHours) * num(run.machineRate));
                const tier = getPrintRunSetupTier(run);

                return (
                  <div className="vinyl-line" key={run.id}>
                    <div className="vinyl-line-header">
                      <strong>Print Run {index + 1}</strong>
                      <span>{money(runMaterialCost + runMachineCost)}</span>
                    </div>

                    <div className="form-grid">
                      <label className="field">
                        <span>Printer</span>
                        <select value={run.printerId} onChange={(event) => updatePrintRun(run.id, "printerId", event.target.value)}>
                          {PRINTERS.map((printerOption) => (
                            <option key={printerOption.id} value={printerOption.id}>
                              {printerOption.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Filament / Material</span>
                        <select value={run.materialId} onChange={(event) => updatePrintRun(run.id, "materialId", event.target.value)}>
                          {PRINT_MATERIALS.map((printMaterial) => (
                            <option key={printMaterial.id} value={printMaterial.id}>
                              {printMaterial.label} — {money(printMaterial.rate)}/g
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Nozzle / Quality</span>
                        <select value={run.nozzleSize} onChange={(event) => updatePrintRun(run.id, "nozzleSize", event.target.value)}>
                          {NOZZLES.map((nozzleOption) => (
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
                      {printer.label} • {material.label} • {nozzle.label}. Suggested setup tier: {tier.label}. {setupReason(material, nozzle)}
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

            <p className="helper-note">
              Auto print setup: {money(printSetup.primarySetup)} primary + {money(printSetup.additionalSetup)} additional = {money(printSetup.totalSetup)}. {printSetup.explanation}
            </p>
          </div>
        )}

        {form.jobAspects.cad && (
          <div className="form-card">
            <h3 className="card-title">CAD Modeling</h3>

            <div className="form-grid">
              <label className="field">
                <span>CAD Quote Estimate</span>
                <select value={form.cadPresetId} onChange={(event) => update("cadPresetId", event.target.value)}>
                  {CAD_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label} — {money(preset.amount)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="helper-note">
              This is the quoted design estimate. Actual CAD time will be tracked later on the job timesheet.
            </p>
          </div>
        )}

        {form.jobAspects.engraving && (
          <div className="form-card">
            <h3 className="card-title">Laser Engraving</h3>

            <div className="form-grid">
              <label className="field">
                <span>Engraving Material</span>
                <select value={form.engravingMaterialId} onChange={(event) => updateEngravingMaterial(event.target.value)}>
                  {ENGRAVING_MATERIALS.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.label} — {money(materialUnitCost(material))}/unit
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Material Color</span>
                <select value={form.engravingMaterialColor} onChange={(event) => update("engravingMaterialColor", event.target.value)}>
                  {selectedEngravingMaterial.colors.map((color) => (
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
              Suggested engraving service includes complexity and quantity, then reduces stacking when multiple services are already active.
            </p>
          </div>
        )}

        {form.jobAspects.vinyl && (
          <div className="form-card full-span">
            <div className="page-heading-row">
              <div>
                <h3 className="card-title">Vinyl Cutting Materials</h3>
                <p className="muted-text">
                  Add each vinyl layer, color, transfer tape, or specialty sheet used.
                </p>
              </div>

              <button className="secondary-button" onClick={addVinylLine}>
                <Plus size={18} />
                Add Material
              </button>
            </div>

            <div className="vinyl-lines">
              {form.vinylMaterialLines.map((line, index) => {
                const material = getVinylMaterial(line.materialId);
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
                          {VINYL_MATERIALS.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label} — {money(materialUnitCost(item))}/unit
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Color</span>
                        <select value={line.color} onChange={(event) => updateVinylLine(line.id, "color", event.target.value)}>
                          {material.colors.map((color) => (
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

            <p className="helper-note">
              Suggested vinyl service includes complexity, extra layers, extra units, and stacking reduction when multiple services are active.
            </p>
          </div>
        )}

        {activeProcessCount(form.jobAspects) > 1 && (
          <div className="form-card">
            <h3 className="card-title">Project Integration</h3>

            <div className="form-grid">
              <label className="field">
                <span>Integration Complexity</span>
                <select value={form.integrationComplexity} onChange={(event) => update("integrationComplexity", event.target.value)}>
                  {COMPLEXITY_LEVELS.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.label}
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
              Suggested integration level based on active services: {getComplexity(suggestedIntegrationLevel).label}.
              This covers aligning multiple processes without stacking every service to full price.
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

          <p className="helper-note">
            Auto buffer curve: $0–50 = 20%, $50–100 = 15%, $100–200 = 12%, $200–400 = 10%, $400+ = 8%.
            Currently applied: {totals.appliedBufferPercent}%.
          </p>
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