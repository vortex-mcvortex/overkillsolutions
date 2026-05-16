import { useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Calculator,
  FileText,
  Hammer,
  Settings,
  CreditCard,
  Users,
  Truck,
  Download,
  Upload,
  PackageSearch,
} from "lucide-react";

import CalculatorPage from "./components/CalculatorPage";
import QuotesPage from "./components/QuotesPage";
import JobsPage from "./components/JobsPage";
import PaymentsPage from "./components/PaymentsPage";
import DashboardPage from "./components/DashboardPage";
import SettingsPage from "./components/SettingsPage";
import CustomersPage from "./components/CustomersPage";
import ShippingPage from "./components/ShippingPage";
import InventoryPage from "./components/InventoryPage";
import { importOverkillPdf } from "./utils/pdfImport";

import overkillLogo from "./assets/logos/overkill_main.png";
import overkillMark from "./assets/logos/overkill_mark.png";

const APP_VERSION = "v0.1.0";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "calculator", label: "Calculator", icon: Calculator },
  { id: "quotes", label: "Quotes", icon: FileText },
  { id: "jobs", label: "Jobs", icon: Hammer },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "customers", label: "Customers", icon: Users },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "inventory", label: "Inventory", icon: PackageSearch },
  { id: "settings", label: "Settings", icon: Settings },
];

const BACKUP_KEYS = {
  quotes: "overkill_quotes",
  jobs: "overkill_jobs",
  shippingEstimates: "overkill_shipping_estimates",
  customerOverrides: "overkill_customer_overrides",
  manualCustomers: "overkill_manual_customers",
  inventoryItems: "overkill_inventory_items",
  inventoryLogs: "overkill_inventory_logs",
  usedRecordNumbers: "overkill_used_record_numbers",
  settings: "overkill_settings",
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

function getInitialState(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function getBackupValue(key, fallback) {
  return getInitialState(key, fallback);
}

function parseRecordNumber(value) {
  const match = String(value || "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function normalizeImportedAspects(record) {
  return {
    cad: Boolean(record?.jobAspects?.cad),
    printing: Boolean(record?.jobAspects?.printing),
    engraving: Boolean(record?.jobAspects?.engraving),
    vinyl: Boolean(record?.jobAspects?.vinyl),
    custom: Boolean(record?.jobAspects?.custom),
  };
}

function getDefaultExpirationDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function getNextRevisionNumber(quotes, sourceQuote) {
  const rootRecordNumber =
    sourceQuote.originalRecordNumber ||
    sourceQuote.sourceRecordNumber ||
    sourceQuote.recordNumber;

  const related = quotes.filter((quote) => {
    return (
      quote.recordNumber === rootRecordNumber ||
      quote.originalRecordNumber === rootRecordNumber ||
      quote.sourceRecordNumber === rootRecordNumber
    );
  });

  const highestRevision = related.reduce((highest, quote) => {
    return Math.max(highest, Number(quote.revisionNumber || 0));
  }, 0);

  return highestRevision + 1;
}

function applyShippingToRecord(record, shippingEstimate) {
  const oldShipping = num(record.shippingEstimate?.total || record.formData?.shippingFee);
  const newShipping = num(shippingEstimate.total);
  const delta = newShipping - oldShipping;

  const finalTotal = Math.max(0, num(record.finalTotal) + delta);
  const depositAmount = num(record.depositAmount);
  const remainingBalance = Math.max(0, finalTotal - depositAmount);

  return {
    ...record,
    finalTotal,
    remainingBalance,
    shippingEstimate,
    formData: {
      ...(record.formData || {}),
      shippingFee: newShipping,
      shippingEstimateId: shippingEstimate.id,
    },
    totals: {
      ...(record.totals || {}),
      shippingFee: newShipping,
      finalTotal,
      remainingBalance,
    },
    updatedAt: new Date().toISOString(),
  };
}

export default function App() {
  const backupInputRef = useRef(null);

  const [activePage, setActivePage] = useState("dashboard");
  const [quotes, setQuotes] = useState(() => getInitialState("overkill_quotes", []));
  const [jobs, setJobs] = useState(() => getInitialState("overkill_jobs", []));
  const [shippingEstimates, setShippingEstimates] = useState(() =>
    getInitialState("overkill_shipping_estimates", [])
  );
  const [customerOverrides, setCustomerOverrides] = useState(() =>
    getInitialState("overkill_customer_overrides", {})
  );
  const [manualCustomers, setManualCustomers] = useState(() =>
    getInitialState("overkill_manual_customers", [])
  );
  const [inventoryItems, setInventoryItems] = useState(() =>
    getInitialState("overkill_inventory_items", [])
  );
  const [inventoryLogs, setInventoryLogs] = useState(() =>
    getInitialState("overkill_inventory_logs", [])
  );
  const [usedRecordNumbers, setUsedRecordNumbers] = useState(() =>
    getInitialState("overkill_used_record_numbers", [])
  );
  const [selectedPaymentJobId, setSelectedPaymentJobId] = useState("");
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const [importMessage, setImportMessage] = useState("");
  const [backupMessage, setBackupMessage] = useState("");

  const editingQuote = quotes.find((quote) => quote.id === editingQuoteId) || null;

  function saveToStorage(nextQuotes, nextJobs, nextUsedNumbers) {
    localStorage.setItem("overkill_quotes", JSON.stringify(nextQuotes));
    localStorage.setItem("overkill_jobs", JSON.stringify(nextJobs));
    localStorage.setItem("overkill_used_record_numbers", JSON.stringify(nextUsedNumbers));
  }

  function saveInventory(nextItems, nextLogs = inventoryLogs) {
    setInventoryItems(nextItems);
    setInventoryLogs(nextLogs);
    localStorage.setItem("overkill_inventory_items", JSON.stringify(nextItems));
    localStorage.setItem("overkill_inventory_logs", JSON.stringify(nextLogs));
  }

  function addInventoryItem(itemData) {
  const now = new Date().toISOString();

  const newItem = {
    id: itemData.id || crypto.randomUUID(),
    createdAt: itemData.createdAt || now,
    updatedAt: now,

    name: itemData.name || "New Inventory Item",
    category: itemData.category || "Filament",
    material: itemData.material || "",
    color: itemData.color || "",
    brand: itemData.brand || "",
    location: itemData.location || "",

    unit: itemData.unit || "g",
    quantityOnHand: Number(itemData.quantityOnHand || 0),
    reorderThreshold: Number(itemData.reorderThreshold || 0),
    unitCost: Number(itemData.unitCost || 0),

    vendor: itemData.vendor || "",
    sku: itemData.sku || "",

    catalogId: itemData.catalogId || "",
    bambuCode: itemData.bambuCode || itemData.sku || "",
    hexCode: itemData.hexCode || "",
    msrp: Number(itemData.msrp || 0),
    bulkPrice: Number(itemData.bulkPrice || 0),
    spoolWeightGrams: Number(itemData.spoolWeightGrams || 0),

    notes: itemData.notes || "",
    active: itemData.active !== false,
  };

  const log = {
    id: crypto.randomUUID(),
    itemId: newItem.id,
    itemName: newItem.name,
    type: "Created",
    quantityChange: Number(newItem.quantityOnHand || 0),
    quantityAfter: Number(newItem.quantityOnHand || 0),
    unit: newItem.unit,
    jobNumber: "",
    notes: "Inventory item created.",
    createdAt: now,
  };

  saveInventory([newItem, ...inventoryItems], [log, ...inventoryLogs]);
}

  function updateInventoryItem(itemId, updates) {
    const nextItems = inventoryItems.map((item) =>
      item.id === itemId
        ? {
            ...item,
            ...updates,
            quantityOnHand:
              updates.quantityOnHand !== undefined
                ? Number(updates.quantityOnHand || 0)
                : item.quantityOnHand,
            reorderThreshold:
              updates.reorderThreshold !== undefined
                ? Number(updates.reorderThreshold || 0)
                : item.reorderThreshold,
            unitCost:
              updates.unitCost !== undefined
                ? Number(updates.unitCost || 0)
                : item.unitCost,
            updatedAt: new Date().toISOString(),
          }
        : item
    );

    saveInventory(nextItems);
  }

  function deleteInventoryItem(itemId) {
    const item = inventoryItems.find((entry) => entry.id === itemId);
    if (!item) return;

    const confirmed = window.confirm(
      `Delete "${item.name}" from inventory? Logs will be kept for history.`
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const log = {
      id: crypto.randomUUID(),
      itemId,
      itemName: item.name,
      type: "Deleted",
      quantityChange: 0,
      quantityAfter: Number(item.quantityOnHand || 0),
      unit: item.unit,
      jobNumber: "",
      notes: "Inventory item deleted.",
      createdAt: now,
    };

    saveInventory(
      inventoryItems.filter((entry) => entry.id !== itemId),
      [log, ...inventoryLogs]
    );
  }

  function adjustInventoryItem(itemId, adjustmentData) {
    const item = inventoryItems.find((entry) => entry.id === itemId);
    if (!item) return;

    const quantityChange = Number(adjustmentData.quantityChange || 0);
    const quantityAfter = Number(item.quantityOnHand || 0) + quantityChange;
    const now = new Date().toISOString();

    const nextItems = inventoryItems.map((entry) =>
      entry.id === itemId
        ? {
            ...entry,
            quantityOnHand: quantityAfter,
            updatedAt: now,
          }
        : entry
    );

    const log = {
      id: crypto.randomUUID(),
      itemId,
      itemName: item.name,
      type: adjustmentData.type || "Manual Adjustment",
      quantityChange,
      quantityAfter,
      unit: item.unit,
      jobNumber: adjustmentData.jobNumber || "",
      notes: adjustmentData.notes || "",
      createdAt: now,
    };

    saveInventory(nextItems, [log, ...inventoryLogs]);
  }

  function exportBackup() {
    const backup = {
      app: "overkill-solutions-app",
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        quotes: getBackupValue(BACKUP_KEYS.quotes, []),
        jobs: getBackupValue(BACKUP_KEYS.jobs, []),
        shippingEstimates: getBackupValue(BACKUP_KEYS.shippingEstimates, []),
        customerOverrides: getBackupValue(BACKUP_KEYS.customerOverrides, {}),
        manualCustomers: getBackupValue(BACKUP_KEYS.manualCustomers, []),
        inventoryItems: getBackupValue(BACKUP_KEYS.inventoryItems, []),
        inventoryLogs: getBackupValue(BACKUP_KEYS.inventoryLogs, []),
        usedRecordNumbers: getBackupValue(BACKUP_KEYS.usedRecordNumbers, []),
        settings: getBackupValue(BACKUP_KEYS.settings, null),
      },
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });

    const dateStamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `overkill-solutions-backup-${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    setBackupMessage("Backup exported.");
  }

  async function importBackupFile(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (parsed.app !== "overkill-solutions-app" || !parsed.data) {
        window.alert("This does not look like a valid Overkill Solutions backup file.");
        return;
      }

      const confirmed = window.confirm(
        "Restore this backup? This will replace current local app data on this device."
      );

      if (!confirmed) return;

      const data = parsed.data;

      const nextQuotes = Array.isArray(data.quotes) ? data.quotes : [];
      const nextJobs = Array.isArray(data.jobs) ? data.jobs : [];
      const nextShippingEstimates = Array.isArray(data.shippingEstimates)
        ? data.shippingEstimates
        : [];
      const nextCustomerOverrides =
        data.customerOverrides && typeof data.customerOverrides === "object"
          ? data.customerOverrides
          : {};
      const nextManualCustomers = Array.isArray(data.manualCustomers)
        ? data.manualCustomers
        : [];
      const nextInventoryItems = Array.isArray(data.inventoryItems)
        ? data.inventoryItems
        : [];
      const nextInventoryLogs = Array.isArray(data.inventoryLogs)
        ? data.inventoryLogs
        : [];
      const nextUsedRecordNumbers = Array.isArray(data.usedRecordNumbers)
        ? data.usedRecordNumbers
        : [];

      localStorage.setItem(BACKUP_KEYS.quotes, JSON.stringify(nextQuotes));
      localStorage.setItem(BACKUP_KEYS.jobs, JSON.stringify(nextJobs));
      localStorage.setItem(
        BACKUP_KEYS.shippingEstimates,
        JSON.stringify(nextShippingEstimates)
      );
      localStorage.setItem(
        BACKUP_KEYS.customerOverrides,
        JSON.stringify(nextCustomerOverrides)
      );
      localStorage.setItem(
        BACKUP_KEYS.manualCustomers,
        JSON.stringify(nextManualCustomers)
      );
      localStorage.setItem(
        BACKUP_KEYS.inventoryItems,
        JSON.stringify(nextInventoryItems)
      );
      localStorage.setItem(
        BACKUP_KEYS.inventoryLogs,
        JSON.stringify(nextInventoryLogs)
      );
      localStorage.setItem(
        BACKUP_KEYS.usedRecordNumbers,
        JSON.stringify(nextUsedRecordNumbers)
      );

      if (data.settings) {
        localStorage.setItem(BACKUP_KEYS.settings, JSON.stringify(data.settings));
      }

      setQuotes(nextQuotes);
      setJobs(nextJobs);
      setShippingEstimates(nextShippingEstimates);
      setCustomerOverrides(nextCustomerOverrides);
      setManualCustomers(nextManualCustomers);
      setInventoryItems(nextInventoryItems);
      setInventoryLogs(nextInventoryLogs);
      setUsedRecordNumbers(nextUsedRecordNumbers);
      setSelectedPaymentJobId("");
      setEditingQuoteId(null);
      setImportMessage("");
      setBackupMessage("Backup restored. Reloading app data...");

      window.location.reload();
    } catch (error) {
      console.error(error);
      window.alert("Backup restore failed. The file may be damaged or not valid JSON.");
    }
  }

  function handleBackupImportChange(event) {
    const file = event.target.files?.[0];

    if (file) {
      importBackupFile(file);
    }

    event.target.value = "";
  }

  function saveShippingEstimates(nextEstimates) {
    setShippingEstimates(nextEstimates);
    localStorage.setItem("overkill_shipping_estimates", JSON.stringify(nextEstimates));
  }

  function addShippingEstimate(estimateData) {
    const newEstimate = {
      id: crypto.randomUUID(),
      estimateNumber: `SHIP-${String(shippingEstimates.length + 1).padStart(4, "0")}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: estimateData.shipmentStatus || "Estimate",
      ...estimateData,
    };

    saveShippingEstimates([newEstimate, ...shippingEstimates]);
  }

  function updateShippingEstimate(estimateId, estimateData) {
    const nextEstimates = shippingEstimates.map((estimate) =>
      estimate.id === estimateId
        ? {
            ...estimate,
            ...estimateData,
            status: estimateData.shipmentStatus || estimateData.status || estimate.status,
            updatedAt: new Date().toISOString(),
          }
        : estimate
    );

    saveShippingEstimates(nextEstimates);
  }

  function deleteShippingEstimate(estimateId) {
    const estimate = shippingEstimates.find((item) => item.id === estimateId);
    if (!estimate) return;

    const confirmed = window.confirm(
      `Delete ${estimate.estimateNumber || "this shipping estimate"}?`
    );

    if (!confirmed) return;

    saveShippingEstimates(shippingEstimates.filter((item) => item.id !== estimateId));
  }

  function attachShippingToQuote(estimateId, quoteId) {
    const estimate = shippingEstimates.find((item) => item.id === estimateId);
    if (!estimate) return;

    const nextQuotes = quotes.map((quote) =>
      quote.id === quoteId ? applyShippingToRecord(quote, estimate) : quote
    );

    const nextEstimates = shippingEstimates.map((item) =>
      item.id === estimateId
        ? {
            ...item,
            attachedType: "quote",
            attachedId: quoteId,
            attachedAt: new Date().toISOString(),
            status: "Attached",
            shipmentStatus: item.shipmentStatus || "Attached",
          }
        : item
    );

    setQuotes(nextQuotes);
    saveShippingEstimates(nextEstimates);
    saveToStorage(nextQuotes, jobs, usedRecordNumbers);
  }

  function attachShippingToJob(estimateId, jobId) {
    const estimate = shippingEstimates.find((item) => item.id === estimateId);
    if (!estimate) return;

    const nextJobs = jobs.map((job) =>
      job.id === jobId ? applyShippingToRecord(job, estimate) : job
    );

    const nextEstimates = shippingEstimates.map((item) =>
      item.id === estimateId
        ? {
            ...item,
            attachedType: "job",
            attachedId: jobId,
            attachedAt: new Date().toISOString(),
            status: "Attached",
            shipmentStatus: item.shipmentStatus || "Attached",
          }
        : item
    );

    setJobs(nextJobs);
    saveShippingEstimates(nextEstimates);
    saveToStorage(quotes, nextJobs, usedRecordNumbers);
  }

  function saveCustomerOverrides(nextOverrides) {
    setCustomerOverrides(nextOverrides);
    localStorage.setItem("overkill_customer_overrides", JSON.stringify(nextOverrides));
  }

  function saveManualCustomers(nextCustomers) {
    setManualCustomers(nextCustomers);
    localStorage.setItem("overkill_manual_customers", JSON.stringify(nextCustomers));
  }

  function updateCustomerOverride(customerKey, customerData) {
    const nextOverrides = {
      ...customerOverrides,
      [customerKey]: {
        ...(customerOverrides[customerKey] || {}),
        ...customerData,
        updatedAt: new Date().toISOString(),
      },
    };

    saveCustomerOverrides(nextOverrides);
  }

  function addManualCustomer(customerData) {
    const newCustomer = {
      id: crypto.randomUUID(),
      key: `manual:${crypto.randomUUID()}`,
      source: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: customerData.name || "New Customer",
      phone: customerData.phone || "",
      email: customerData.email || "",
      address: customerData.address || "",
      notes: customerData.notes || "",
      tags: customerData.tags || "",
      preferredContactMethod: customerData.preferredContactMethod || "Not Set",
      preferredPaymentMethod: customerData.preferredPaymentMethod || "Not Set",
    };

    saveManualCustomers([newCustomer, ...manualCustomers]);
  }

  function updateManualCustomer(customerKey, customerData) {
    const nextManualCustomers = manualCustomers.map((customer) => {
      if (customer.key !== customerKey) return customer;

      return {
        ...customer,
        ...customerData,
        updatedAt: new Date().toISOString(),
      };
    });

    saveManualCustomers(nextManualCustomers);
  }

  function deleteManualCustomer(customerKey) {
    const confirmed = window.confirm(
      "Delete this manually created customer? This will not delete quotes or jobs."
    );

    if (!confirmed) return;

    saveManualCustomers(
      manualCustomers.filter((customer) => customer.key !== customerKey)
    );
  }

  function generateNextRecordNumber(numberList = usedRecordNumbers) {
    let nextNumber = 1001;

    while (numberList.includes(nextNumber)) {
      nextNumber += 1;
    }

    return nextNumber;
  }

  function resolveImportedRecordNumber(record, currentUsedNumbers) {
    const originalNumber =
      Number(record?.recordNumber) ||
      parseRecordNumber(record?.quoteNumber) ||
      parseRecordNumber(record?.jobNumber) ||
      parseRecordNumber(record?.invoiceNumber);

    if (originalNumber && !currentUsedNumbers.includes(originalNumber)) {
      return originalNumber;
    }

    return generateNextRecordNumber(currentUsedNumbers);
  }

  function saveQuote(quoteData, editingId = null) {
    if (editingId) {
      const nextQuotes = quotes.map((quote) => {
        if (quote.id !== editingId) return quote;

        return {
          ...quote,
          ...quoteData,
          updatedAt: new Date().toISOString(),
        };
      });

      setQuotes(nextQuotes);
      saveToStorage(nextQuotes, jobs, usedRecordNumbers);
      setEditingQuoteId(null);
      setActivePage("quotes");
      return;
    }

    const recordNumber = generateNextRecordNumber();

    const newQuote = {
      id: crypto.randomUUID(),
      recordNumber,
      quoteNumber: `Q-${recordNumber}`,
      jobNumber: null,
      invoiceNumber: null,
      status: "Draft Quote",
      quoteStatus: "Draft Quote",
      revisionNumber: 0,
      originalRecordNumber: recordNumber,
      sourceRecordNumber: null,
      sourceQuoteNumber: null,
      revisionOfQuoteId: null,
      sentAt: null,
      approvedAt: null,
      declinedAt: null,
      expiredAt: null,
      expiresAt: getDefaultExpirationDate(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...quoteData,
    };

    const nextQuotes = [newQuote, ...quotes];
    const nextUsedNumbers = [...usedRecordNumbers, recordNumber];

    setQuotes(nextQuotes);
    setUsedRecordNumbers(nextUsedNumbers);
    saveToStorage(nextQuotes, jobs, nextUsedNumbers);
    setEditingQuoteId(null);
    setActivePage("quotes");
  }

  function updateQuoteWorkflow(quoteId, updates) {
    const nextQuotes = quotes.map((quote) => {
      if (quote.id !== quoteId) return quote;

      return {
        ...quote,
        ...updates,
        status: updates.quoteStatus || updates.status || quote.quoteStatus || quote.status || "Draft Quote",
        quoteStatus: updates.quoteStatus || updates.status || quote.quoteStatus || quote.status || "Draft Quote",
        updatedAt: new Date().toISOString(),
      };
    });

    setQuotes(nextQuotes);
    saveToStorage(nextQuotes, jobs, usedRecordNumbers);
  }

  function markQuoteSent(quoteId) {
    updateQuoteWorkflow(quoteId, {
      status: "Sent",
      quoteStatus: "Sent",
      sentAt: new Date().toISOString(),
    });
  }

  function markQuoteApproved(quoteId) {
    updateQuoteWorkflow(quoteId, {
      status: "Approved",
      quoteStatus: "Approved",
      approvedAt: new Date().toISOString(),
    });
  }

  function markQuoteDeclined(quoteId) {
    updateQuoteWorkflow(quoteId, {
      status: "Declined",
      quoteStatus: "Declined",
      declinedAt: new Date().toISOString(),
    });
  }

  function markQuoteExpired(quoteId) {
    updateQuoteWorkflow(quoteId, {
      status: "Expired",
      quoteStatus: "Expired",
      expiredAt: new Date().toISOString(),
    });
  }

  function updateQuoteExpiration(quoteId, expiresAt) {
    updateQuoteWorkflow(quoteId, { expiresAt });
  }

  function deleteQuote(quoteId) {
    const quote = quotes.find((item) => item.id === quoteId);
    if (!quote) return;

    const confirmed = window.confirm(
      `Delete ${quote.quoteNumber || "this quote"}? This cannot be undone.`
    );

    if (!confirmed) return;

    const shouldReuseNumber = window.confirm(
      `Do you want to reuse ${quote.quoteNumber || "this quote number"} later?\n\nOK = release/reuse the number\nCancel = keep the number reserved`
    );

    const nextQuotes = quotes.filter((item) => item.id !== quoteId);
    let nextUsedNumbers = usedRecordNumbers;

    if (shouldReuseNumber && quote.recordNumber) {
      nextUsedNumbers = usedRecordNumbers.filter(
        (number) => number !== quote.recordNumber
      );
    }

    setQuotes(nextQuotes);
    setUsedRecordNumbers(nextUsedNumbers);

    if (editingQuoteId === quoteId) {
      setEditingQuoteId(null);
    }

    saveToStorage(nextQuotes, jobs, nextUsedNumbers);
  }

  function startEditQuote(quoteId) {
    setEditingQuoteId(quoteId);
    setActivePage("calculator");
  }

  function cancelEditQuote() {
    setEditingQuoteId(null);
    setActivePage("quotes");
  }

  function duplicateQuote(quoteId) {
    const quote = quotes.find((item) => item.id === quoteId);
    if (!quote) return;

    const confirmed = window.confirm(
      `Duplicate ${quote.quoteNumber || "this quote"} into a new draft quote?`
    );

    if (!confirmed) return;

    const recordNumber = generateNextRecordNumber();
    const now = new Date().toISOString();

    const duplicatedQuote = {
      ...quote,
      id: crypto.randomUUID(),
      recordNumber,
      quoteNumber: `Q-${recordNumber}`,
      jobNumber: null,
      invoiceNumber: null,
      status: "Draft Quote",
      quoteStatus: "Draft Quote",
      revisionNumber: 0,
      originalRecordNumber: recordNumber,
      sourceRecordNumber: quote.recordNumber,
      sourceQuoteNumber: quote.quoteNumber,
      revisionOfQuoteId: null,
      createdAt: now,
      updatedAt: now,
      sentAt: null,
      approvedAt: null,
      declinedAt: null,
      expiredAt: null,
      expiresAt: getDefaultExpirationDate(),
      importedAt: null,
      importedFromPdf: false,
      jobName: `${quote.jobName || "Untitled Job"} Copy`,
      formData: {
        ...(quote.formData || {}),
        jobName: `${quote.jobName || "Untitled Job"} Copy`,
      },
    };

    const nextQuotes = [duplicatedQuote, ...quotes];
    const nextUsedNumbers = [...usedRecordNumbers, recordNumber];

    setQuotes(nextQuotes);
    setUsedRecordNumbers(nextUsedNumbers);
    saveToStorage(nextQuotes, jobs, nextUsedNumbers);
    setActivePage("quotes");
  }

  function reviseQuote(quoteId) {
    const quote = quotes.find((item) => item.id === quoteId);
    if (!quote) return;

    const confirmed = window.confirm(
      `Create a revised version of ${quote.quoteNumber || "this quote"}?`
    );

    if (!confirmed) return;

    const recordNumber = generateNextRecordNumber();
    const now = new Date().toISOString();
    const revisionNumber = getNextRevisionNumber(quotes, quote);
    const rootRecordNumber =
      quote.originalRecordNumber ||
      quote.sourceRecordNumber ||
      quote.recordNumber;

    const revisedQuote = {
      ...quote,
      id: crypto.randomUUID(),
      recordNumber,
      quoteNumber: `Q-${recordNumber}`,
      jobNumber: null,
      invoiceNumber: null,
      status: "Draft Quote",
      quoteStatus: "Draft Quote",
      revisionNumber,
      originalRecordNumber: rootRecordNumber,
      sourceRecordNumber: quote.recordNumber,
      sourceQuoteNumber: quote.quoteNumber,
      revisionOfQuoteId: quote.id,
      createdAt: now,
      updatedAt: now,
      sentAt: null,
      approvedAt: null,
      declinedAt: null,
      expiredAt: null,
      expiresAt: getDefaultExpirationDate(),
      importedAt: null,
      importedFromPdf: false,
      quoteSnapshot: null,
      jobName: `${quote.jobName || "Untitled Job"} Rev ${revisionNumber}`,
      formData: {
        ...(quote.formData || {}),
        jobName: `${quote.jobName || "Untitled Job"} Rev ${revisionNumber}`,
      },
    };

    const nextQuotes = [revisedQuote, ...quotes];
    const nextUsedNumbers = [...usedRecordNumbers, recordNumber];

    setQuotes(nextQuotes);
    setUsedRecordNumbers(nextUsedNumbers);
    saveToStorage(nextQuotes, jobs, nextUsedNumbers);
    setEditingQuoteId(revisedQuote.id);
    setActivePage("calculator");
  }

  function convertQuoteToJob(quoteId) {
    const quote = quotes.find((item) => item.id === quoteId);
    if (!quote) return;

    const now = new Date().toISOString();

    const newJob = {
      ...quote,
      id: crypto.randomUUID(),
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      jobNumber: `J-${quote.recordNumber}`,
      invoiceNumber: null,
      status: "Approved",
      quoteStatus: quote.quoteStatus || quote.status || "Approved",
      archived: false,
      approvedAt: quote.approvedAt || now,
      convertedAt: now,
      updatedAt: now,
      quoteSnapshot: { ...quote },
      actuals: {
        materialCost: 0,
        failedPrintCost: 0,
        extraCost: 0,
        notes: "",
      },
      timeEvents: [],
      paymentEvents: [],
      materialUsageEvents: [],
    };

    const nextQuotes = quotes.filter((item) => item.id !== quoteId);
    const nextJobs = [newJob, ...jobs];

    setQuotes(nextQuotes);
    setJobs(nextJobs);
    setEditingQuoteId(null);
    setSelectedPaymentJobId(newJob.id);
    saveToStorage(nextQuotes, nextJobs, usedRecordNumbers);
    setActivePage("jobs");
  }

  function updateJob(jobId, updates) {
    const nextJobs = jobs.map((job) => {
      if (job.id !== jobId) return job;

      return {
        ...job,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    });

    setJobs(nextJobs);
    saveToStorage(quotes, nextJobs, usedRecordNumbers);
  }

  function archiveJob(jobId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    const confirmed = window.confirm(
      `Archive ${job.jobNumber || "this job"}? It will move out of Active Jobs but keep all history.`
    );

    if (!confirmed) return;

    updateJob(jobId, {
      archived: true,
      archivedAt: new Date().toISOString(),
      status: job.status === "Completed" || job.status === "Cancelled" ? job.status : "Completed",
    });
  }

  function restoreJob(jobId) {
    updateJob(jobId, {
      archived: false,
      archivedAt: null,
      status: "In Production",
    });
  }

  function duplicateJob(jobId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    const confirmed = window.confirm(
      `Duplicate ${job.jobNumber || "this job"} into a new active job?`
    );

    if (!confirmed) return;

    const recordNumber = generateNextRecordNumber();
    const now = new Date().toISOString();

    const duplicatedJob = {
      ...job,
      id: crypto.randomUUID(),
      recordNumber,
      quoteId: null,
      quoteNumber: job.quoteNumber ? `${job.quoteNumber}-COPY` : null,
      jobNumber: `J-${recordNumber}`,
      invoiceNumber: null,
      status: "Approved",
      archived: false,
      archivedAt: null,
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
      importedAt: null,
      importedFromPdf: false,
      lastSavedAt: null,
      shippingEstimate: null,
      actuals: {
        materialCost: 0,
        failedPrintCost: 0,
        extraCost: 0,
        notes: "",
      },
      timeEvents: [],
      paymentEvents: [],
      materialUsageEvents: [],
      payments: {
        depositPaid: 0,
        additionalPaid: 0,
        paymentMethod: "Venmo",
        paymentNotes: "",
      },
      jobName: `${job.jobName || "Untitled Job"} Copy`,
      quoteSnapshot: {
        ...(job.quoteSnapshot || {}),
        recordNumber,
        jobName: `${job.jobName || "Untitled Job"} Copy`,
      },
    };

    const nextJobs = [duplicatedJob, ...jobs];
    const nextUsedNumbers = [...usedRecordNumbers, recordNumber];

    setJobs(nextJobs);
    setUsedRecordNumbers(nextUsedNumbers);
    setSelectedPaymentJobId(duplicatedJob.id);
    saveToStorage(quotes, nextJobs, nextUsedNumbers);
    setActivePage("jobs");
  }

  function deleteJob(jobId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    const confirmed = window.confirm(
      `Permanently delete ${job.jobNumber || "this job"}? This cannot be undone.`
    );

    if (!confirmed) return;

    const nextJobs = jobs.filter((item) => item.id !== jobId);

    setJobs(nextJobs);

    if (selectedPaymentJobId === jobId) {
      setSelectedPaymentJobId("");
    }

    saveToStorage(quotes, nextJobs, usedRecordNumbers);
  }

  async function importPdfFile(file, preferredKind = "auto") {
    if (!file) return;

    try {
      setImportMessage("Importing PDF...");

      const imported = await importOverkillPdf(file);
      const record = imported.record || {};
      const kind = preferredKind === "auto" ? imported.kind : preferredKind;

      const recordNumber = resolveImportedRecordNumber(record, usedRecordNumbers);
      const nextUsedNumbers = [...usedRecordNumbers, recordNumber];
      const now = new Date().toISOString();

      if (kind === "job") {
        const quoteNumber = record.quoteNumber || `Q-${recordNumber}`;
        const jobNumber = `J-${recordNumber}`;

        const importedJob = {
          ...record,
          id: crypto.randomUUID(),
          recordNumber,
          quoteNumber,
          jobNumber,
          invoiceNumber: record.invoiceNumber || `INV-${recordNumber}`,
          status: record.status || "Approved",
          quoteStatus: record.quoteStatus || record.status || "Approved",
          archived: Boolean(record.archived),
          archivedAt: record.archivedAt || null,
          customerName: record.customerName || "Imported Customer",
          jobName: record.jobName || "Imported PDF Job",
          jobAspects: normalizeImportedAspects(record),
          finalTotal: Number(record.finalTotal || 0),
          depositAmount: Number(record.depositAmount || 0),
          remainingBalance: Number(record.remainingBalance || record.finalTotal || 0),
          formData: record.formData || {},
          totals: record.totals || {},
          quoteSnapshot: record.quoteSnapshot || {
            ...record,
            quoteNumber,
            recordNumber,
          },
          actuals: record.actuals || {
            materialCost: 0,
            failedPrintCost: 0,
            extraCost: 0,
            notes: "",
          },
          timeEvents: record.timeEvents || [],
          paymentEvents: record.paymentEvents || [],
          materialUsageEvents: record.materialUsageEvents || [],
          importedAt: now,
          importedFromPdf: true,
          updatedAt: now,
          approvedAt: record.approvedAt || now,
        };

        const nextJobs = [importedJob, ...jobs];

        setJobs(nextJobs);
        setUsedRecordNumbers(nextUsedNumbers);
        setSelectedPaymentJobId(importedJob.id);
        saveToStorage(quotes, nextJobs, nextUsedNumbers);
        setActivePage("jobs");
        setImportMessage(
          imported.source === "embedded-overkill-data"
            ? `Imported ${importedJob.jobNumber} from embedded PDF data.`
            : `Imported a limited fallback job from PDF text as ${importedJob.jobNumber}.`
        );

        return;
      }

      const importedQuote = {
        ...record,
        id: crypto.randomUUID(),
        recordNumber,
        quoteNumber: `Q-${recordNumber}`,
        jobNumber: null,
        invoiceNumber: null,
        status: record.status || record.quoteStatus || "Draft Quote",
        quoteStatus: record.quoteStatus || record.status || "Draft Quote",
        revisionNumber: Number(record.revisionNumber || 0),
        originalRecordNumber: record.originalRecordNumber || recordNumber,
        sourceRecordNumber: record.sourceRecordNumber || null,
        sourceQuoteNumber: record.sourceQuoteNumber || null,
        revisionOfQuoteId: null,
        sentAt: record.sentAt || null,
        approvedAt: record.approvedAt || null,
        declinedAt: record.declinedAt || null,
        expiredAt: record.expiredAt || null,
        expiresAt: record.expiresAt || getDefaultExpirationDate(),
        customerName: record.customerName || "Imported Customer",
        jobName: record.jobName || "Imported PDF Quote",
        jobAspects: normalizeImportedAspects(record),
        finalTotal: Number(record.finalTotal || 0),
        depositAmount: Number(record.depositAmount || 0),
        remainingBalance: Number(record.remainingBalance || record.finalTotal || 0),
        formData: record.formData || {},
        totals: record.totals || {},
        importedAt: now,
        importedFromPdf: true,
        createdAt: record.createdAt || now,
        updatedAt: now,
      };

      const nextQuotes = [importedQuote, ...quotes];

      setQuotes(nextQuotes);
      setUsedRecordNumbers(nextUsedNumbers);
      saveToStorage(nextQuotes, jobs, nextUsedNumbers);
      setActivePage("quotes");
      setImportMessage(
        imported.source === "embedded-overkill-data"
          ? `Imported ${importedQuote.quoteNumber} from embedded PDF data.`
          : `Imported a limited fallback quote from PDF text as ${importedQuote.quoteNumber}.`
      );
    } catch (error) {
      console.error(error);
      setImportMessage("PDF import failed. This PDF may not contain readable Overkill data.");
    }
  }

  const sidebarStats = useMemo(() => {
    const activeJobs = jobs.filter((job) => !job.archived);

    const totalQuoted = quotes.reduce(
      (sum, quote) => sum + Number(quote.finalTotal || 0),
      0
    );

    const totalJobsValue = activeJobs.reduce(
      (sum, job) => sum + Number(job.finalTotal || 0),
      0
    );

    const lowStockCount = inventoryItems.filter(
      (item) =>
        item.active !== false &&
        Number(item.quantityOnHand || 0) <= Number(item.reorderThreshold || 0)
    ).length;

    return {
      totalQuotes: quotes.length,
      totalJobs: activeJobs.length,
      totalQuoted,
      totalJobsValue,
      lowStockCount,
    };
  }, [quotes, jobs, inventoryItems]);

  const pageContent = {
    dashboard: (
      <DashboardPage
        quotes={quotes}
        jobs={jobs}
        inventoryItems={inventoryItems}
        inventoryLogs={inventoryLogs}
      />
    ),

    calculator: (
      <CalculatorPage
        onSaveQuote={saveQuote}
        editingQuote={editingQuote}
        onCancelEdit={cancelEditQuote}
        quotes={quotes}
        jobs={jobs}
        manualCustomers={manualCustomers}
        customerOverrides={customerOverrides}
      />
    ),

    quotes: (
      <QuotesPage
        quotes={quotes}
        onEditQuote={startEditQuote}
        onDuplicateQuote={duplicateQuote}
        onReviseQuote={reviseQuote}
        onUpdateQuoteWorkflow={updateQuoteWorkflow}
        onMarkQuoteSent={markQuoteSent}
        onMarkQuoteApproved={markQuoteApproved}
        onMarkQuoteDeclined={markQuoteDeclined}
        onMarkQuoteExpired={markQuoteExpired}
        onUpdateQuoteExpiration={updateQuoteExpiration}
        onConvertToJob={convertQuoteToJob}
        onDeleteQuote={deleteQuote}
        onImportPdf={(file) => importPdfFile(file, "quote")}
        importMessage={importMessage}
      />
    ),

    jobs: (
      <JobsPage
        jobs={jobs}
        inventoryItems={inventoryItems}
        onUpdateJob={updateJob}
        onArchiveJob={archiveJob}
        onRestoreJob={restoreJob}
        onDeleteJob={deleteJob}
        onDuplicateJob={duplicateJob}
        onAdjustInventoryItem={adjustInventoryItem}
        onImportPdf={(file) => importPdfFile(file, "job")}
        importMessage={importMessage}
      />
    ),

    payments: (
      <PaymentsPage
        jobs={jobs.filter((job) => !job.archived)}
        selectedJobId={selectedPaymentJobId}
        onSelectJob={setSelectedPaymentJobId}
        onUpdateJob={updateJob}
      />
    ),

    customers: (
      <CustomersPage
        quotes={quotes}
        jobs={jobs}
        customerOverrides={customerOverrides}
        manualCustomers={manualCustomers}
        onUpdateCustomer={updateCustomerOverride}
        onAddManualCustomer={addManualCustomer}
        onUpdateManualCustomer={updateManualCustomer}
        onDeleteManualCustomer={deleteManualCustomer}
      />
    ),

    shipping: (
      <ShippingPage
        quotes={quotes}
        jobs={jobs}
        shippingEstimates={shippingEstimates}
        onAddEstimate={addShippingEstimate}
        onUpdateEstimate={updateShippingEstimate}
        onDeleteEstimate={deleteShippingEstimate}
        onAttachToQuote={attachShippingToQuote}
        onAttachToJob={attachShippingToJob}
      />
    ),

    inventory: (
      <InventoryPage
        inventoryItems={inventoryItems}
        inventoryLogs={inventoryLogs}
        jobs={jobs}
        onAddItem={addInventoryItem}
        onUpdateItem={updateInventoryItem}
        onDeleteItem={deleteInventoryItem}
        onAdjustItem={adjustInventoryItem}
      />
    ),

    settings: <SettingsPage />,
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={overkillMark} alt="Overkill icon" className="sidebar-mark" />

          <div>
            <div className="brand-font sidebar-title">OVERKILL</div>
            <div className="sidebar-subtitle">SOLUTIONS</div>
            <div className="helper-note">{APP_VERSION}</div>
          </div>
        </div>

        <nav className="nav-list">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                className={`nav-button ${isActive ? "active" : ""}`}
                onClick={() => {
                  if (item.id !== "calculator") setEditingQuoteId(null);
                  setActivePage(item.id);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-mini-stats">
          <div>
            <span>Quotes</span>
            <strong>{sidebarStats.totalQuotes}</strong>
          </div>

          <div>
            <span>Active Jobs</span>
            <strong>{sidebarStats.totalJobs}</strong>
          </div>

          <div>
            <span>Low Stock</span>
            <strong>{sidebarStats.lowStockCount}</strong>
          </div>

          <div>
            <span>Quoted</span>
            <strong>{money(sidebarStats.totalQuoted)}</strong>
          </div>

          <div>
            <span>Active Value</span>
            <strong>{money(sidebarStats.totalJobsValue)}</strong>
          </div>
        </div>

        <input
          ref={backupInputRef}
          className="hidden-file-input"
          type="file"
          accept="application/json,.json"
          onChange={handleBackupImportChange}
        />

        <div className="sidebar-mini-stats">
          <button className="secondary-button" type="button" onClick={exportBackup}>
            <Download size={18} />
            Export Backup
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={() => backupInputRef.current?.click()}
          >
            <Upload size={18} />
            Restore Backup
          </button>
        </div>

        {backupMessage && <p className="helper-note">{backupMessage}</p>}
      </aside>

      <main className="main-area">
        <header className="top-header">
          <img src={overkillLogo} alt="Overkill Solutions" className="top-logo" />

          <div>
            <h1 className="brand-font app-title">INTERNAL PRODUCTION SYSTEM</h1>
            <p className="muted-text">
              Quotes, jobs, time tracking, invoices, shipping, inventory, and profitability.
            </p>
          </div>
        </header>

        {pageContent[activePage]}
      </main>
    </div>
  );
}