import { useEffect, useMemo, useRef, useState } from "react";
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
  Search,
  XCircle,
  DollarSign,
  CalendarDays,
  Bot,
  Database,
  ShieldCheck,
  ClipboardList,
  BarChart3,
  Menu,
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
import ExpensesPage from "./components/ExpensesPage";
import SchedulePage from "./components/SchedulePage";
import AutomationPage from "./components/AutomationPage";
import BackendReadinessPage from "./components/BackendReadinessPage";
import AdminPage from "./components/AdminPage";
import TemplateManagerPage from "./components/TemplateManagerPage";
import ReportsPage from "./components/ReportsPage";
import { importOverkillPdf } from "./utils/pdfImport";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import {
  CLOUD_TABLES,
  pullAllCloudData,
  pullCollectionFromCloud,
  pushAllLocalDataToCloud,
  pushCollectionToCloud,
} from "./lib/syncService";

import overkillLogo from "./assets/logos/overkill_main.png";
import overkillMark from "./assets/logos/overkill_mark.png";

const APP_VERSION = "v1.0.0";

const NAV_GROUPS = [
  {
    id: "main",
    label: "Main",
    items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "reports", label: "Reports", icon: BarChart3 }],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      { id: "calculator", label: "Calculator", icon: Calculator },
      { id: "quotes", label: "Quotes", icon: FileText },
      { id: "customers", label: "Customers", icon: Users },
      { id: "payments", label: "Payments", icon: CreditCard },
      { id: "templates", label: "Templates", icon: ClipboardList },
    ],
  },
  {
    id: "production",
    label: "Production",
    items: [
      { id: "jobs", label: "Jobs", icon: Hammer },
      { id: "schedule", label: "Schedule", icon: CalendarDays },
      { id: "automation", label: "Automation", icon: Bot },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { id: "inventory", label: "Inventory", icon: PackageSearch },
      { id: "expenses", label: "Expenses", icon: DollarSign },
      { id: "shipping", label: "Shipping", icon: Truck },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { id: "settings", label: "Settings", icon: Settings },
      { id: "admin", label: "Admin Tools", icon: ShieldCheck },
      { id: "backend", label: "Backend Prep", icon: Database },
    ],
  },
];

const BACKUP_KEYS = {
  quotes: "overkill_quotes",
  jobs: "overkill_jobs",
  shippingEstimates: "overkill_shipping_estimates",
  customerOverrides: "overkill_customer_overrides",
  manualCustomers: "overkill_manual_customers",
  inventoryItems: "overkill_inventory_items",
  inventoryLogs: "overkill_inventory_logs",
  expenses: "overkill_expenses",
  suppliers: "overkill_suppliers",
  scheduleItems: "overkill_schedule_items",
  automationRules: "overkill_automation_rules",
  templates: "overkill_templates",
  usedRecordNumbers: "overkill_used_record_numbers",
  settings: "overkill_settings",
  cloudSyncEnabled: "overkill_cloud_sync_enabled",
  snapshots: "overkill_cloud_snapshots",
  trash: "overkill_trash_records",
  recordHistory: "overkill_record_history",
};

const SEARCH_GROUPS = {
  quotes: "Quotes",
  jobs: "Jobs",
  payments: "Payments",
  customers: "Customers",
  shipping: "Shipping",
  inventory: "Inventory",
  expenses: "Expenses",
  suppliers: "Suppliers",
  automation: "Automation",
  backend: "Backend Prep",
  admin: "Admin",
  templates: "Templates",
  reports: "Reports",
};


const CLOUD_MISC_SETTINGS_ID = "misc";
const CLOUD_SYNC_DEBOUNCE_MS = 700;
const CLOUD_POLL_INTERVAL_MS = 30000;
const CLOUD_RECENT_LOCAL_PUSH_GRACE_MS = 2500;

const LOCAL_TO_CLOUD_TABLES = {
  quotes: CLOUD_TABLES.quotes,
  jobs: CLOUD_TABLES.jobs,
  inventoryItems: CLOUD_TABLES.inventoryItems,
  inventoryLogs: CLOUD_TABLES.inventoryLogs,
  manualCustomers: CLOUD_TABLES.customers,
  expenses: CLOUD_TABLES.expenses,
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


function makeSearchText(parts) {
  return parts
    .filter(Boolean)
    .map((part) => String(part).toLowerCase())
    .join(" ");
}

function getCustomerKey(record) {
  const email = String(record.customerEmail || "").trim().toLowerCase();
  const phone = String(record.customerPhone || "").trim().toLowerCase();
  const name = String(record.customerName || "").trim().toLowerCase();

  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  if (name) return `name:${name}`;

  return "";
}

function getPaymentStatus(job) {
  const total = num(job.finalTotal);

  const paid = (job.paymentEvents || []).reduce((sum, payment) => {
    if (payment.type === "Refund") return sum - num(payment.amount);
    return sum + num(payment.amount);
  }, 0);

  if (paid <= 0) return "Unpaid";
  if (paid >= total) return paid > total ? "Overpaid" : "Paid";

  return "Partially Paid";
}

function buildCustomerSearchRecords(quotes, jobs, manualCustomers, customerOverrides) {
  const customerMap = new Map();

  manualCustomers.forEach((customer) => {
    const key = customer.key || `manual:${customer.id}`;

    customerMap.set(key, {
      key,
      name: customer.name || "Manual Customer",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
      tags: customer.tags || "",
      source: "Manual",
      quoteCount: 0,
      jobCount: 0,
      totalValue: 0,
    });
  });

  [...quotes, ...jobs].forEach((record) => {
    const key = getCustomerKey(record);
    if (!key) return;

    const existing = customerMap.get(key) || {
      key,
      name: record.customerName || "Customer",
      phone: record.customerPhone || "",
      email: record.customerEmail || "",
      address: record.customerAddress || "",
      notes: "",
      tags: "",
      source: "Records",
      quoteCount: 0,
      jobCount: 0,
      totalValue: 0,
    };

    existing.name = existing.name || record.customerName || "Customer";
    existing.phone = existing.phone || record.customerPhone || "";
    existing.email = existing.email || record.customerEmail || "";
    existing.address = existing.address || record.customerAddress || "";

    if (record.jobNumber) {
      existing.jobCount += 1;
    } else if (record.quoteNumber) {
      existing.quoteCount += 1;
    }

    existing.totalValue += num(record.finalTotal);

    customerMap.set(key, existing);
  });

  Object.entries(customerOverrides || {}).forEach(([key, override]) => {
    const existing = customerMap.get(key) || {
      key,
      name: "Customer",
      phone: "",
      email: "",
      address: "",
      notes: "",
      tags: "",
      source: "Override",
      quoteCount: 0,
      jobCount: 0,
      totalValue: 0,
    };

    customerMap.set(key, {
      ...existing,
      ...override,
      key,
    });
  });

  return [...customerMap.values()];
}

function buildGlobalSearchIndex({
  quotes,
  jobs,
  shippingEstimates,
  inventoryItems,
  inventoryLogs,
  expenses = [],
  suppliers = [],
  manualCustomers,
  customerOverrides,
}) {
  const results = [];
  const customers = buildCustomerSearchRecords(
    quotes,
    jobs,
    manualCustomers,
    customerOverrides
  );

  quotes.forEach((quote) => {
    results.push({
      id: `quote-${quote.id}`,
      group: "quotes",
      page: "quotes",
      title: `${quote.quoteNumber || "Quote"} — ${quote.customerName || "No Customer"}`,
      detail: `${quote.jobName || "Untitled Quote"} • ${quote.quoteStatus || quote.status || "Draft Quote"} • ${money(quote.finalTotal)}`,
      status: quote.quoteStatus || quote.status || "Draft Quote",
      searchText: makeSearchText([
        quote.quoteNumber,
        quote.customerName,
        quote.customerPhone,
        quote.customerEmail,
        quote.customerAddress,
        quote.jobName,
        quote.quoteStatus,
        quote.status,
        quote.finalTotal,
        quote.formData?.notes,
        quote.notes,
      ]),
    });
  });

  jobs.forEach((job) => {
    results.push({
      id: `job-${job.id}`,
      group: "jobs",
      page: "jobs",
      title: `${job.jobNumber || "Job"} — ${job.customerName || "No Customer"}`,
      detail: `${job.jobName || "Untitled Job"} • ${job.status || "Approved"} • ${money(job.finalTotal)}`,
      status: job.status || "Approved",
      searchText: makeSearchText([
        job.jobNumber,
        job.quoteNumber,
        job.invoiceNumber,
        job.customerName,
        job.customerPhone,
        job.customerEmail,
        job.customerAddress,
        job.jobName,
        job.status,
        job.queueNotes,
        job.scheduleStart,
        job.scheduleEnd,
        job.scheduleMachine,
        job.scheduleOperator,
        job.scheduleStatus,
        job.scheduleNotes,
        job.estimatedScheduleHours,
        job.finalTotal,
        ...(job.attachments || []).flatMap((attachment) => [
          attachment.name,
          attachment.type,
          attachment.url,
          attachment.notes,
        ]),
        ...(job.materialUsageEvents || []).flatMap((usage) => [
          usage.itemName,
          usage.material,
          usage.color,
          usage.usageType,
          usage.notes,
        ]),
      ]),
    });

    (job.paymentEvents || []).forEach((payment) => {
      results.push({
        id: `payment-${job.id}-${payment.id}`,
        group: "payments",
        page: "payments",
        selectedPaymentJobId: job.id,
        title: `${payment.type || "Payment"} — ${job.jobNumber || "Job"}`,
        detail: `${money(payment.amount)} via ${payment.method || "Unknown"} • ${job.customerName || "No Customer"} • ${getPaymentStatus(job)}`,
        status: getPaymentStatus(job),
        searchText: makeSearchText([
          job.jobNumber,
          job.customerName,
          payment.type,
          payment.method,
          payment.amount,
          payment.date,
          payment.time,
          payment.notes,
        ]),
      });
    });
  });

  customers.forEach((customer) => {
    results.push({
      id: `customer-${customer.key}`,
      group: "customers",
      page: "customers",
      title: customer.name || "Customer",
      detail: `${customer.phone || "No phone"} • ${customer.email || "No email"} • ${customer.quoteCount} quotes • ${customer.jobCount} jobs`,
      status: customer.source || "Customer",
      searchText: makeSearchText([
        customer.name,
        customer.phone,
        customer.email,
        customer.address,
        customer.notes,
        customer.tags,
        customer.quoteCount,
        customer.jobCount,
        customer.totalValue,
      ]),
    });
  });

  shippingEstimates.forEach((estimate) => {
    results.push({
      id: `shipping-${estimate.id}`,
      group: "shipping",
      page: "shipping",
      title: `${estimate.estimateNumber || "Shipping"} — ${estimate.customerName || "No Customer"}`,
      detail: `${estimate.carrier || "Carrier"} • ${estimate.service || "Service"} • ${money(estimate.total)}`,
      status: estimate.status || estimate.shipmentStatus || "Estimate",
      searchText: makeSearchText([
        estimate.estimateNumber,
        estimate.customerName,
        estimate.customerPhone,
        estimate.customerEmail,
        estimate.carrier,
        estimate.service,
        estimate.trackingNumber,
        estimate.destinationState,
        estimate.notes,
        estimate.total,
      ]),
    });
  });

  inventoryItems.forEach((item) => {
    const quantity = num(item.quantityOnHand);
    const threshold = num(item.reorderThreshold);

    let status = "In Stock";
    if (quantity <= 0) status = "Out of Stock";
    else if (threshold > 0 && quantity <= threshold) status = "Low Stock";

    results.push({
      id: `inventory-${item.id}`,
      group: "inventory",
      page: "inventory",
      title: item.name || "Inventory Item",
      detail: `${item.category || "Inventory"} • ${item.material || "No material"} • ${item.color || "No color"} • ${quantity} ${item.unit || ""}`,
      status,
      searchText: makeSearchText([
        item.name,
        item.category,
        item.material,
        item.color,
        item.brand,
        item.location,
        item.vendor,
        item.sku,
        item.bambuCode,
        item.hexCode,
        item.notes,
      ]),
    });
  });

  inventoryLogs.forEach((log) => {
    results.push({
      id: `inventory-log-${log.id}`,
      group: "inventory",
      page: "inventory",
      title: `${log.type || "Inventory"} — ${log.itemName || "Item"}`,
      detail: `${num(log.quantityChange) > 0 ? "+" : ""}${log.quantityChange} ${log.unit || ""} → ${log.quantityAfter} ${log.unit || ""}${log.jobNumber ? ` • ${log.jobNumber}` : ""}`,
      status: log.jobNumber || "Inventory",
      searchText: makeSearchText([
        log.itemName,
        log.type,
        log.jobNumber,
        log.notes,
        log.quantityChange,
        log.quantityAfter,
      ]),
    });
  });


  expenses.forEach((expense) => {
    results.push({
      id: `expense-${expense.id}`,
      group: "expenses",
      page: "expenses",
      title: `${expense.expenseNumber || "EXP"} — ${expense.vendor || expense.name || "Expense"}`,
      detail: `${expense.category || "Expense"} • ${money(expense.amount)} • ${expense.status || "Logged"}`,
      status: expense.status || "Logged",
      searchText: makeSearchText([
        expense.expenseNumber,
        expense.name,
        expense.vendor,
        expense.category,
        expense.subcategory,
        expense.paymentMethod,
        expense.status,
        expense.relatedJobNumber,
        expense.notes,
        expense.amount,
        expense.date,
      ]),
    });
  });

  suppliers.forEach((supplier) => {
    results.push({
      id: `supplier-${supplier.id}`,
      group: "suppliers",
      page: "expenses",
      title: supplier.name || "Supplier",
      detail: `${supplier.category || "Supplier"} • ${supplier.website || "No website"} • ${supplier.preferred ? "Preferred" : "Standard"}`,
      status: supplier.preferred ? "Preferred" : "Supplier",
      searchText: makeSearchText([
        supplier.name,
        supplier.category,
        supplier.contactName,
        supplier.email,
        supplier.phone,
        supplier.website,
        supplier.notes,
      ]),
    });
  });

  return results;
}

function groupSearchResults(results) {
  return results.reduce((groups, result) => {
    if (!groups[result.group]) groups[result.group] = [];
    groups[result.group].push(result);
    return groups;
  }, {});
}


function getAppEventDateTime(event) {
  if (!event?.date || !event?.time) return null;
  const value = new Date(`${event.date}T${event.time}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function getAppOpenTimers(events = []) {
  const sorted = [...events].sort((a, b) => {
    const aDate = getAppEventDateTime(a);
    const bDate = getAppEventDateTime(b);
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate - bDate;
  });

  const openStarts = {};

  sorted.forEach((event) => {
    if (event.action === "Note") return;
    const key = `${event.type || "Other"}__${event.label || "General"}`;
    if (event.action === "Started") openStarts[key] = event;
    if (event.action === "Stopped" && openStarts[key]) delete openStarts[key];
  });

  return Object.entries(openStarts).map(([key, event]) => ({
    key,
    event,
    type: event.type || "Other",
    label: event.label || "General",
  }));
}

function getAppTimerElapsedHours(event) {
  const startedAt = getAppEventDateTime(event);
  if (!startedAt) return 0;
  const diffMs = Date.now() - startedAt.getTime();
  if (diffMs <= 0) return 0;
  return diffMs / 1000 / 60 / 60;
}

function formatAppDuration(hoursValue) {
  const totalMinutes = Math.max(0, Math.round(num(hoursValue) * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function createAppStopEvent(timer, job) {
  return {
    id: crypto.randomUUID(),
    type: timer.event.type,
    action: "Stopped",
    label: timer.event.label || "",
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    rate: timer.event.rate || 0,
    notes: `Timer stopped from global dock for ${timer.event.type}${timer.event.label ? ` — ${timer.event.label}` : ""}.`,
    operator: timer.event.operator || job.operator || "",
    createdByTimer: true,
    timerSessionId: timer.event.timerSessionId || crypto.randomUUID(),
  };
}

function getCloudSyncStateFromMessage(message, isOnline = true) {
  const text = String(message || "").toLowerCase();

  if (!isOnline) return "offline";
  if (text.includes("failed") || text.includes("error") || text.includes("not configured") || text.includes("not set")) return "error";
  if (text.includes("paused")) return "paused";
  if (text.includes("syncing") || text.includes("started") || text.includes("pulling") || text.includes("pushing")) return "syncing";
  if (text.includes("complete") || text.includes("synced") || text.includes("connected") || text.includes("ready") || text.includes("refreshed")) return "synced";

  return "ready";
}

function getCloudSyncLabel(syncState, cloudSyncEnabled, isConfigured, isOnline) {
  if (!isOnline) return "Offline";
  if (!isConfigured) return "Cloud Not Set";
  if (!cloudSyncEnabled) return "Sync Paused";
  if (syncState === "syncing") return "Syncing";
  if (syncState === "error") return "Sync Error";
  if (syncState === "paused") return "Sync Paused";
  if (syncState === "synced") return "Synced";

  return "Cloud Ready";
}

function shouldToastCloudMessage(message) {
  const text = String(message || "").toLowerCase();

  if (!text) return false;
  if (text.includes("polling sync")) return false;
  if (text.includes("reactive sync")) return false;
  if (text.includes("realtime update received")) return false;
  if (text.includes("auto-save") && (text.includes("synced") || text.includes("syncing"))) return false;

  return (
    text.includes("failed") ||
    text.includes("error") ||
    text.includes("not configured") ||
    text.includes("manual") ||
    text.includes("paused") ||
    text.includes("enabled") ||
    text.includes("connected")
  );
}

export default function App() {
  const backupInputRef = useRef(null);
  const cloudPushTimersRef = useRef({});
  const applyingRemoteUpdateRef = useRef(false);
  const cloudPollingInFlightRef = useRef(false);
  const lastLocalCloudPushAtRef = useRef(0);
  const toastTimersRef = useRef({});

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
  const [expenses, setExpenses] = useState(() =>
    getInitialState("overkill_expenses", [])
  );
  const [suppliers, setSuppliers] = useState(() =>
    getInitialState("overkill_suppliers", [])
  );
  const [usedRecordNumbers, setUsedRecordNumbers] = useState(() =>
    getInitialState("overkill_used_record_numbers", [])
  );
  const [selectedPaymentJobId, setSelectedPaymentJobId] = useState("");
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const [importMessage, setImportMessage] = useState("");
  const [backupMessage, setBackupMessage] = useState("");
  const [timerTick, setTimerTick] = useState(0);
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [cloudSyncEnabled, setCloudSyncEnabledState] = useState(() =>
    getInitialState(BACKUP_KEYS.cloudSyncEnabled, true)
  );
  const [cloudSyncMessage, setCloudSyncMessage] = useState(
    isSupabaseConfigured ? "Cloud sync ready." : "Supabase not configured."
  );
  const [cloudSyncLastAt, setCloudSyncLastAt] = useState("");
  const [snapshots, setSnapshots] = useState(() =>
    getInitialState(BACKUP_KEYS.snapshots, [])
  );
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [trashRecords, setTrashRecords] = useState(() =>
    getInitialState(BACKUP_KEYS.trash, [])
  );
  const [trashMessage, setTrashMessage] = useState("");
  const [recordHistory, setRecordHistory] = useState(() =>
    getInitialState(BACKUP_KEYS.recordHistory, [])
  );
  const [conflictWarnings, setConflictWarnings] = useState([]);
  const [cloudSyncState, setCloudSyncState] = useState(() =>
    isSupabaseConfigured ? "ready" : "error"
  );
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [toasts, setToasts] = useState([]);

  const editingQuote = quotes.find((quote) => quote.id === editingQuoteId) || null;

  const globalOpenTimers = useMemo(() => {
    return jobs
      .filter((job) => !job.archived)
      .flatMap((job) =>
        getAppOpenTimers(job.timeEvents || []).map((timer) => ({
          ...timer,
          job,
          elapsedHours: getAppTimerElapsedHours(timer.event),
          liveCost: getAppTimerElapsedHours(timer.event) * num(timer.event.rate),
        }))
      );
  }, [jobs, timerTick]);

  const globalTimerTotals = useMemo(() => {
    return globalOpenTimers.reduce(
      (summary, timer) => {
        summary.hours += timer.elapsedHours;
        summary.cost += timer.liveCost;
        return summary;
      },
      { hours: 0, cost: 0 }
    );
  }, [globalOpenTimers]);

  useEffect(() => {
    if (globalOpenTimers.length === 0) return undefined;

    const intervalId = window.setInterval(() => {
      setTimerTick((current) => current + 1);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [globalOpenTimers.length]);

  function addToast(message, type = "info", duration = 4200) {
    const id = crypto.randomUUID();

    setToasts((current) => [
      { id, message, type, createdAt: new Date().toISOString() },
      ...current,
    ].slice(0, 4));

    window.clearTimeout(toastTimersRef.current[id]);
    toastTimersRef.current[id] = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      delete toastTimersRef.current[id];
    }, duration);
  }

  function removeToast(toastId) {
    window.clearTimeout(toastTimersRef.current[toastId]);
    delete toastTimersRef.current[toastId];
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }

  function markCloudSync(message, forcedType = null) {
    const nextState = forcedType || getCloudSyncStateFromMessage(message, isOnline);

    setCloudSyncMessage(message);
    setCloudSyncLastAt(new Date().toLocaleTimeString());
    setCloudSyncState(nextState);

    if (shouldToastCloudMessage(message)) {
      const toastType = nextState === "error" || nextState === "offline" ? "error" : nextState === "syncing" ? "info" : "success";
      addToast(message, toastType);
    }
  }

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      setCloudSyncState(isSupabaseConfigured && cloudSyncEnabled ? "syncing" : "ready");
      addToast("Back online. Cloud sync will resume automatically.", "success");
      if (isSupabaseConfigured && cloudSyncEnabled) {
        window.setTimeout(() => forceCloudSync("Back online sync"), 250);
      }
    }

    function handleOffline() {
      setIsOnline(false);
      setCloudSyncState("offline");
      addToast("Offline mode. Changes will stay local until connection returns.", "error", 6500);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      Object.values(toastTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [cloudSyncEnabled]);

  function setCloudSyncEnabled(enabled) {
    setCloudSyncEnabledState(enabled);
    localStorage.setItem(BACKUP_KEYS.cloudSyncEnabled, JSON.stringify(enabled));

    if (!enabled) {
      markCloudSync("Auto cloud sync paused.");
      return;
    }

    markCloudSync(
      isSupabaseConfigured
        ? "Auto cloud sync enabled."
        : "Auto sync enabled, but Supabase is not configured."
    );
  }

  async function pushMiscDataToCloud(reason = "Auto-sync", force = false) {
    if (!isSupabaseConfigured || !supabase) return;
    if (!cloudSyncEnabled && !force) return;
    if (applyingRemoteUpdateRef.current && !force) return;

    const payload = {
      shippingEstimates,
      customerOverrides,
      suppliers,
      usedRecordNumbers,
      updatedAt: new Date().toISOString(),
    };

    const { error } = await supabase.from(CLOUD_TABLES.settings).upsert(
      {
        id: CLOUD_MISC_SETTINGS_ID,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) throw error;

    markCloudSync(`${reason}: misc data synced.`);
  }

  async function pullMiscDataFromCloud() {
    if (!isSupabaseConfigured || !supabase) return {};

    const { data, error } = await supabase
      .from(CLOUD_TABLES.settings)
      .select("payload,updated_at")
      .eq("id", CLOUD_MISC_SETTINGS_ID)
      .maybeSingle();

    if (error) throw error;

    return data?.payload || {};
  }

  function queueCloudCollectionPush(collectionKey, tableName, records, reason = "Auto-sync") {
    if (!isOnline) {
      setCloudSyncState("offline");
      setCloudSyncMessage("Offline mode. Local changes are waiting to sync.");
      return;
    }

    if (!isSupabaseConfigured || !cloudSyncEnabled) return;
    if (applyingRemoteUpdateRef.current) return;

    window.clearTimeout(cloudPushTimersRef.current[collectionKey]);

    cloudPushTimersRef.current[collectionKey] = window.setTimeout(async () => {
      try {
        markCloudSync(`${reason}: syncing ${collectionKey}...`);
        await pushCollectionToCloud(tableName, records || []);
        markCloudSync(`${reason}: ${collectionKey} synced.`);
      } catch (error) {
        console.error(error);
        markCloudSync(`${reason}: ${collectionKey} sync failed — ${error?.message || "unknown error"}.`);
      }
    }, CLOUD_SYNC_DEBOUNCE_MS);
  }

  function queueCloudMiscPush(reason = "Auto-sync") {
    if (!isOnline) {
      setCloudSyncState("offline");
      setCloudSyncMessage("Offline mode. Local changes are waiting to sync.");
      return;
    }

    if (!isSupabaseConfigured || !cloudSyncEnabled) return;
    if (applyingRemoteUpdateRef.current) return;

    window.clearTimeout(cloudPushTimersRef.current.misc);

    cloudPushTimersRef.current.misc = window.setTimeout(async () => {
      try {
        markCloudSync(`${reason}: syncing misc data...`);
        await pushMiscDataToCloud(reason);
      } catch (error) {
        console.error(error);
        markCloudSync(`${reason}: misc sync failed — ${error?.message || "unknown error"}.`);
      }
    }, CLOUD_SYNC_DEBOUNCE_MS);
  }

  async function refreshCloudCollection(collectionKey, tableName) {
    if (!isSupabaseConfigured || !cloudSyncEnabled) return;

    try {
      applyingRemoteUpdateRef.current = true;
      const cloudRecords = await pullCollectionFromCloud(tableName);

      if (collectionKey === "quotes" && cloudRecords.some((record) => quotes.some((local) => local.id === record.id && local.updatedAt && record.updatedAt && local.updatedAt !== record.updatedAt))) {
        addConflictWarning("quotes", "Quote record", "multiple");
      }

      if (collectionKey === "jobs" && cloudRecords.some((record) => jobs.some((local) => local.id === record.id && local.updatedAt && record.updatedAt && local.updatedAt !== record.updatedAt))) {
        addConflictWarning("jobs", "Job record", "multiple");
      }

      if (collectionKey === "quotes") {
        setQuotes(cloudRecords);
        localStorage.setItem(BACKUP_KEYS.quotes, JSON.stringify(cloudRecords));
      }

      if (collectionKey === "jobs") {
        setJobs(cloudRecords);
        localStorage.setItem(BACKUP_KEYS.jobs, JSON.stringify(cloudRecords));
      }

      if (collectionKey === "inventoryItems") {
        setInventoryItems(cloudRecords);
        localStorage.setItem(BACKUP_KEYS.inventoryItems, JSON.stringify(cloudRecords));
      }

      if (collectionKey === "inventoryLogs") {
        setInventoryLogs(cloudRecords);
        localStorage.setItem(BACKUP_KEYS.inventoryLogs, JSON.stringify(cloudRecords));
      }

      if (collectionKey === "manualCustomers") {
        setManualCustomers(cloudRecords);
        localStorage.setItem(BACKUP_KEYS.manualCustomers, JSON.stringify(cloudRecords));
      }

      if (collectionKey === "expenses") {
        setExpenses(cloudRecords);
        localStorage.setItem(BACKUP_KEYS.expenses, JSON.stringify(cloudRecords));
      }

      markCloudSync(`Realtime update received: ${collectionKey}.`);
    } catch (error) {
      console.error(error);
      markCloudSync(`Realtime refresh failed: ${error?.message || "unknown error"}.`);
    } finally {
      window.setTimeout(() => {
        applyingRemoteUpdateRef.current = false;
      }, 300);
    }
  }

  async function refreshCloudMiscData() {
    if (!isSupabaseConfigured || !cloudSyncEnabled) return;

    try {
      applyingRemoteUpdateRef.current = true;
      const misc = await pullMiscDataFromCloud();

      const nextShippingEstimates = Array.isArray(misc.shippingEstimates)
        ? misc.shippingEstimates
        : shippingEstimates;
      const nextCustomerOverrides =
        misc.customerOverrides && typeof misc.customerOverrides === "object"
          ? misc.customerOverrides
          : customerOverrides;
      const nextSuppliers = Array.isArray(misc.suppliers) ? misc.suppliers : suppliers;
      const nextUsedRecordNumbers = Array.isArray(misc.usedRecordNumbers)
        ? misc.usedRecordNumbers
        : usedRecordNumbers;

      setShippingEstimates(nextShippingEstimates);
      setCustomerOverrides(nextCustomerOverrides);
      setSuppliers(nextSuppliers);
      setUsedRecordNumbers(nextUsedRecordNumbers);

      localStorage.setItem(BACKUP_KEYS.shippingEstimates, JSON.stringify(nextShippingEstimates));
      localStorage.setItem(BACKUP_KEYS.customerOverrides, JSON.stringify(nextCustomerOverrides));
      localStorage.setItem(BACKUP_KEYS.suppliers, JSON.stringify(nextSuppliers));
      localStorage.setItem(BACKUP_KEYS.usedRecordNumbers, JSON.stringify(nextUsedRecordNumbers));

      markCloudSync("Realtime update received: misc data.");
    } catch (error) {
      console.error(error);
      markCloudSync(`Realtime misc refresh failed: ${error?.message || "unknown error"}.`);
    } finally {
      window.setTimeout(() => {
        applyingRemoteUpdateRef.current = false;
      }, 300);
    }
  }

  async function pushLocalDataToCloud() {
    if (!isSupabaseConfigured) {
      markCloudSync("Supabase is not configured.");
      return;
    }

    try {
      markCloudSync("Manual push started...");

      const results = await pushAllLocalDataToCloud({
        quotes,
        jobs,
        inventoryItems,
        inventoryLogs,
        manualCustomers,
        expenses,
        settings: getBackupValue(BACKUP_KEYS.settings, null),
      trashRecords: getBackupValue(BACKUP_KEYS.trash, []),
      recordHistory: getBackupValue(BACKUP_KEYS.recordHistory, []),
      });

      await pushMiscDataToCloud("Manual push", true);

      const pushedCount = results.reduce((sum, result) => sum + Number(result.pushed || 0), 0);
      markCloudSync(`Manual push complete: ${pushedCount} records synced.`);
    } catch (error) {
      console.error(error);
      markCloudSync(`Manual push failed: ${error?.message || "unknown error"}.`);
    }
  }

  function forceCloudSync(reason = "Reactive sync") {
    if (!isSupabaseConfigured || !cloudSyncEnabled) return;
    if (applyingRemoteUpdateRef.current) return;

    lastLocalCloudPushAtRef.current = Date.now();

    queueCloudCollectionPush("quotes", CLOUD_TABLES.quotes, quotes, reason);
    queueCloudCollectionPush("jobs", CLOUD_TABLES.jobs, jobs, reason);
    queueCloudCollectionPush(
      "inventoryItems",
      CLOUD_TABLES.inventoryItems,
      inventoryItems,
      reason
    );
    queueCloudCollectionPush(
      "inventoryLogs",
      CLOUD_TABLES.inventoryLogs,
      inventoryLogs,
      reason
    );
    queueCloudCollectionPush(
      "manualCustomers",
      CLOUD_TABLES.customers,
      manualCustomers,
      reason
    );
    queueCloudCollectionPush("expenses", CLOUD_TABLES.expenses, expenses, reason);
    queueCloudMiscPush(reason);
  }

  async function pullCloudDataSilently(reason = "Polling sync") {
    if (!isSupabaseConfigured || !supabase || !cloudSyncEnabled) return;
    if (cloudPollingInFlightRef.current) return;
    if (applyingRemoteUpdateRef.current) return;

    const recentlyPushed = Date.now() - lastLocalCloudPushAtRef.current;
    if (recentlyPushed >= 0 && recentlyPushed < CLOUD_RECENT_LOCAL_PUSH_GRACE_MS) {
      return;
    }

    try {
      cloudPollingInFlightRef.current = true;
      applyingRemoteUpdateRef.current = true;

      const cloudData = await pullAllCloudData();
      const misc = await pullMiscDataFromCloud();

      const nextQuotes = Array.isArray(cloudData.quotes) ? cloudData.quotes : [];
      const nextJobs = Array.isArray(cloudData.jobs) ? cloudData.jobs : [];
      const nextInventoryItems = Array.isArray(cloudData.inventoryItems)
        ? cloudData.inventoryItems
        : [];
      const nextInventoryLogs = Array.isArray(cloudData.inventoryLogs)
        ? cloudData.inventoryLogs
        : [];
      const nextManualCustomers = Array.isArray(cloudData.manualCustomers)
        ? cloudData.manualCustomers
        : [];
      const nextExpenses = Array.isArray(cloudData.expenses) ? cloudData.expenses : [];

      const nextShippingEstimates = Array.isArray(misc.shippingEstimates)
        ? misc.shippingEstimates
        : shippingEstimates;
      const nextCustomerOverrides =
        misc.customerOverrides && typeof misc.customerOverrides === "object"
          ? misc.customerOverrides
          : customerOverrides;
      const nextSuppliers = Array.isArray(misc.suppliers) ? misc.suppliers : suppliers;
      const nextUsedRecordNumbers = Array.isArray(misc.usedRecordNumbers)
        ? misc.usedRecordNumbers
        : usedRecordNumbers;

      setQuotes(nextQuotes);
      setJobs(nextJobs);
      setInventoryItems(nextInventoryItems);
      setInventoryLogs(nextInventoryLogs);
      setManualCustomers(nextManualCustomers);
      setExpenses(nextExpenses);
      setShippingEstimates(nextShippingEstimates);
      setCustomerOverrides(nextCustomerOverrides);
      setSuppliers(nextSuppliers);
      setUsedRecordNumbers(nextUsedRecordNumbers);

      localStorage.setItem(BACKUP_KEYS.quotes, JSON.stringify(nextQuotes));
      localStorage.setItem(BACKUP_KEYS.jobs, JSON.stringify(nextJobs));
      localStorage.setItem(BACKUP_KEYS.inventoryItems, JSON.stringify(nextInventoryItems));
      localStorage.setItem(BACKUP_KEYS.inventoryLogs, JSON.stringify(nextInventoryLogs));
      localStorage.setItem(BACKUP_KEYS.manualCustomers, JSON.stringify(nextManualCustomers));
      localStorage.setItem(BACKUP_KEYS.expenses, JSON.stringify(nextExpenses));
      localStorage.setItem(BACKUP_KEYS.shippingEstimates, JSON.stringify(nextShippingEstimates));
      localStorage.setItem(BACKUP_KEYS.customerOverrides, JSON.stringify(nextCustomerOverrides));
      localStorage.setItem(BACKUP_KEYS.suppliers, JSON.stringify(nextSuppliers));
      localStorage.setItem(BACKUP_KEYS.usedRecordNumbers, JSON.stringify(nextUsedRecordNumbers));

      markCloudSync(`${reason}: cloud data refreshed.`);
    } catch (error) {
      console.error(error);
      markCloudSync(`${reason} failed: ${error?.message || "unknown error"}.`);
    } finally {
      window.setTimeout(() => {
        applyingRemoteUpdateRef.current = false;
        cloudPollingInFlightRef.current = false;
      }, 800);
    }
  }

  async function pullCloudDataToLocal() {
    if (!isSupabaseConfigured) {
      markCloudSync("Supabase is not configured.");
      return;
    }

    const confirmed = window.confirm(
      "Pull cloud data to this device? This will replace local app data in this browser."
    );

    if (!confirmed) return;

    try {
      markCloudSync("Manual pull started...");
      applyingRemoteUpdateRef.current = true;

      const cloudData = await pullAllCloudData();
      const misc = await pullMiscDataFromCloud();

      const nextQuotes = Array.isArray(cloudData.quotes) ? cloudData.quotes : [];
      const nextJobs = Array.isArray(cloudData.jobs) ? cloudData.jobs : [];
      const nextInventoryItems = Array.isArray(cloudData.inventoryItems)
        ? cloudData.inventoryItems
        : [];
      const nextInventoryLogs = Array.isArray(cloudData.inventoryLogs)
        ? cloudData.inventoryLogs
        : [];
      const nextManualCustomers = Array.isArray(cloudData.manualCustomers)
        ? cloudData.manualCustomers
        : [];
      const nextExpenses = Array.isArray(cloudData.expenses) ? cloudData.expenses : [];

      const nextShippingEstimates = Array.isArray(misc.shippingEstimates)
        ? misc.shippingEstimates
        : [];
      const nextCustomerOverrides =
        misc.customerOverrides && typeof misc.customerOverrides === "object"
          ? misc.customerOverrides
          : {};
      const nextSuppliers = Array.isArray(misc.suppliers) ? misc.suppliers : [];
      const nextUsedRecordNumbers = Array.isArray(misc.usedRecordNumbers)
        ? misc.usedRecordNumbers
        : [];

      setQuotes(nextQuotes);
      setJobs(nextJobs);
      setInventoryItems(nextInventoryItems);
      setInventoryLogs(nextInventoryLogs);
      setManualCustomers(nextManualCustomers);
      setExpenses(nextExpenses);
      setShippingEstimates(nextShippingEstimates);
      setCustomerOverrides(nextCustomerOverrides);
      setSuppliers(nextSuppliers);
      setUsedRecordNumbers(nextUsedRecordNumbers);

      localStorage.setItem(BACKUP_KEYS.quotes, JSON.stringify(nextQuotes));
      localStorage.setItem(BACKUP_KEYS.jobs, JSON.stringify(nextJobs));
      localStorage.setItem(BACKUP_KEYS.inventoryItems, JSON.stringify(nextInventoryItems));
      localStorage.setItem(BACKUP_KEYS.inventoryLogs, JSON.stringify(nextInventoryLogs));
      localStorage.setItem(BACKUP_KEYS.manualCustomers, JSON.stringify(nextManualCustomers));
      localStorage.setItem(BACKUP_KEYS.expenses, JSON.stringify(nextExpenses));
      localStorage.setItem(BACKUP_KEYS.shippingEstimates, JSON.stringify(nextShippingEstimates));
      localStorage.setItem(BACKUP_KEYS.customerOverrides, JSON.stringify(nextCustomerOverrides));
      localStorage.setItem(BACKUP_KEYS.suppliers, JSON.stringify(nextSuppliers));
      localStorage.setItem(BACKUP_KEYS.usedRecordNumbers, JSON.stringify(nextUsedRecordNumbers));

      markCloudSync("Manual pull complete.");
    } catch (error) {
      console.error(error);
      markCloudSync(`Manual pull failed: ${error?.message || "unknown error"}.`);
    } finally {
      window.setTimeout(() => {
        applyingRemoteUpdateRef.current = false;
      }, 500);
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !cloudSyncEnabled) {
      markCloudSync(
        isSupabaseConfigured
          ? "Auto cloud sync paused."
          : "Supabase not configured."
      );
      return undefined;
    }

    markCloudSync("Realtime cloud sync connected.");

    const channel = supabase
      .channel("overkill-phase-2-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: CLOUD_TABLES.quotes },
        () => refreshCloudCollection("quotes", CLOUD_TABLES.quotes)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: CLOUD_TABLES.jobs },
        () => refreshCloudCollection("jobs", CLOUD_TABLES.jobs)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: CLOUD_TABLES.inventoryItems },
        () => refreshCloudCollection("inventoryItems", CLOUD_TABLES.inventoryItems)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: CLOUD_TABLES.inventoryLogs },
        () => refreshCloudCollection("inventoryLogs", CLOUD_TABLES.inventoryLogs)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: CLOUD_TABLES.customers },
        () => refreshCloudCollection("manualCustomers", CLOUD_TABLES.customers)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: CLOUD_TABLES.expenses },
        () => refreshCloudCollection("expenses", CLOUD_TABLES.expenses)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: CLOUD_TABLES.settings },
        () => refreshCloudMiscData()
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") markCloudSync("Realtime cloud sync connected.");
        if (status === "CHANNEL_ERROR") markCloudSync("Realtime cloud sync error.");
        if (status === "TIMED_OUT") markCloudSync("Realtime cloud sync timed out.");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cloudSyncEnabled]);

  useEffect(() => {
  if (!cloudSyncEnabled || !isSupabaseConfigured) return;
  if (applyingRemoteUpdateRef.current) return;

  const timeout = window.setTimeout(() => {
    forceCloudSync("Reactive sync");
  }, 2500);

  return () => window.clearTimeout(timeout);
}, [
  quotes.length,
  jobs.length,
  inventoryItems.length,
  inventoryLogs.length,
  manualCustomers.length,
  expenses.length,
  shippingEstimates.length,
  suppliers.length,
  cloudSyncEnabled,
]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !cloudSyncEnabled) return undefined;

    const intervalId = window.setInterval(() => {
      pullCloudDataSilently("Polling sync");
    }, CLOUD_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [cloudSyncEnabled]);

  function stopGlobalTimer(jobId, timerKey) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    const timer = getAppOpenTimers(job.timeEvents || []).find((item) => item.key === timerKey);
    if (!timer) return;

    const stopEvent = createAppStopEvent(timer, job);
    const nextJobs = jobs.map((item) =>
      item.id === jobId
        ? {
            ...item,
            timeEvents: [...(item.timeEvents || []), stopEvent],
            updatedAt: new Date().toISOString(),
          }
        : item
    );

    setJobs(nextJobs);
    saveToStorage(quotes, nextJobs, usedRecordNumbers);
  }

  function stopAllGlobalTimers() {
    if (globalOpenTimers.length === 0) return;

    const confirmed = window.confirm(`Stop all ${globalOpenTimers.length} active production timer(s)?`);
    if (!confirmed) return;

    const now = new Date().toISOString();
    const nextJobs = jobs.map((job) => {
      const timers = getAppOpenTimers(job.timeEvents || []);
      if (timers.length === 0) return job;

      return {
        ...job,
        timeEvents: [
          ...(job.timeEvents || []),
          ...timers.map((timer) => createAppStopEvent(timer, job)),
        ],
        updatedAt: now,
      };
    });

    setJobs(nextJobs);
    saveToStorage(quotes, nextJobs, usedRecordNumbers);
  }

  function saveToStorage(nextQuotes, nextJobs, nextUsedNumbers) {
    localStorage.setItem("overkill_quotes", JSON.stringify(nextQuotes));
    localStorage.setItem("overkill_jobs", JSON.stringify(nextJobs));
    localStorage.setItem("overkill_used_record_numbers", JSON.stringify(nextUsedNumbers));

    queueCloudCollectionPush("quotes", CLOUD_TABLES.quotes, nextQuotes, "Auto-save");
    queueCloudCollectionPush("jobs", CLOUD_TABLES.jobs, nextJobs, "Auto-save");
    queueCloudMiscPush("Auto-save");
  }

  function saveInventory(nextItems, nextLogs = inventoryLogs) {
    setInventoryItems(nextItems);
    setInventoryLogs(nextLogs);
    localStorage.setItem("overkill_inventory_items", JSON.stringify(nextItems));
    localStorage.setItem("overkill_inventory_logs", JSON.stringify(nextLogs));

    queueCloudCollectionPush("inventoryItems", CLOUD_TABLES.inventoryItems, nextItems, "Auto-save");
    queueCloudCollectionPush("inventoryLogs", CLOUD_TABLES.inventoryLogs, nextLogs, "Auto-save");
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

  async function exportBackup() {
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
      expenses: getBackupValue(BACKUP_KEYS.expenses, []),
      scheduleItems: getBackupValue(BACKUP_KEYS.scheduleItems, []),
      automationRules: getBackupValue(BACKUP_KEYS.automationRules, []),
      templates: getBackupValue(BACKUP_KEYS.templates, []),
      usedRecordNumbers: getBackupValue(BACKUP_KEYS.usedRecordNumbers, []),
      settings: getBackupValue(BACKUP_KEYS.settings, null),
      trashRecords: getBackupValue(BACKUP_KEYS.trash, []),
      recordHistory: getBackupValue(BACKUP_KEYS.recordHistory, []),
    },
  };

  const backupText = JSON.stringify(backup, null, 2);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `overkill-solutions-backup-${dateStamp}.json`;

  try {
    if ("showSaveFilePicker" in window) {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "JSON Backup File",
            accept: { "application/json": [".json"] },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(backupText);
      await writable.close();

      setBackupMessage(`Backup saved as ${fileName}.`);
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      setBackupMessage("Backup save cancelled.");
      return;
    }

    console.error(error);
  }

  try {
    const blob = new Blob([backupText], {
      type: "application/json;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 5000);

    setBackupMessage(`Backup download started as ${fileName}.`);
    return;
  } catch (error) {
    console.error(error);
  }

  try {
    await navigator.clipboard.writeText(backupText);
    setBackupMessage(`Download failed, but backup was copied. Paste into Notepad and save as ${fileName}.`);
  } catch (error) {
    console.error(error);
    window.alert("Backup export failed. Open the browser console for details.");
  }
}

  async function importBackupFile(file) {
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    const data =
      parsed?.app === "overkill-solutions-app" && parsed?.data
        ? parsed.data
        : parsed?.data && typeof parsed.data === "object"
          ? parsed.data
          : parsed;

    if (!data || typeof data !== "object") {
      window.alert("This backup file does not contain usable app data.");
      return;
    }

    const confirmed = window.confirm(
      "Restore this backup? This will replace current local app data on this device."
    );

    if (!confirmed) return;

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
    const nextExpenses = Array.isArray(data.expenses) ? data.expenses : [];
    const nextScheduleItems = Array.isArray(data.scheduleItems)
      ? data.scheduleItems
      : [];
    const nextAutomationRules = Array.isArray(data.automationRules)
      ? data.automationRules
      : [];
    const nextTemplates = Array.isArray(data.templates) ? data.templates : [];
    const nextUsedRecordNumbers = Array.isArray(data.usedRecordNumbers)
      ? data.usedRecordNumbers
      : [];
    const nextTrashRecords = Array.isArray(data.trashRecords)
      ? data.trashRecords
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

    if (BACKUP_KEYS.expenses) {
      localStorage.setItem(BACKUP_KEYS.expenses, JSON.stringify(nextExpenses));
    }

    if (BACKUP_KEYS.scheduleItems) {
      localStorage.setItem(
        BACKUP_KEYS.scheduleItems,
        JSON.stringify(nextScheduleItems)
      );
    }

    if (BACKUP_KEYS.automationRules) {
      localStorage.setItem(
        BACKUP_KEYS.automationRules,
        JSON.stringify(nextAutomationRules)
      );
    }

    if (BACKUP_KEYS.templates) {
      localStorage.setItem(BACKUP_KEYS.templates, JSON.stringify(nextTemplates));
    }

    localStorage.setItem(
      BACKUP_KEYS.usedRecordNumbers,
      JSON.stringify(nextUsedRecordNumbers)
    );
    localStorage.setItem(BACKUP_KEYS.trash, JSON.stringify(nextTrashRecords));

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

    if (typeof setExpenses === "function") setExpenses(nextExpenses);
    if (typeof setScheduleItems === "function") setScheduleItems(nextScheduleItems);
    if (typeof setAutomationRules === "function") setAutomationRules(nextAutomationRules);
    if (typeof setTemplates === "function") setTemplates(nextTemplates);

    setUsedRecordNumbers(nextUsedRecordNumbers);
    setSelectedPaymentJobId("");
    setEditingQuoteId(null);
    setImportMessage("");
    setBackupMessage("Backup restored. Reloading app data...");
    window.setTimeout(() => {
      if (cloudSyncEnabled && isSupabaseConfigured) {
        pushLocalDataToCloud();
      }
    }, 300);

    setTimeout(() => {
      window.location.reload();
    }, 700);
  } catch (error) {
    console.error(error);
    window.alert(
      `Backup restore failed: ${error?.message || "Unknown error"}`
    );
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
    queueCloudMiscPush("Auto-save");
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
    queueCloudMiscPush("Auto-save");
  }

  function saveManualCustomers(nextCustomers) {
    setManualCustomers(nextCustomers);
    localStorage.setItem("overkill_manual_customers", JSON.stringify(nextCustomers));
    queueCloudCollectionPush("manualCustomers", CLOUD_TABLES.customers, nextCustomers, "Auto-save");
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

        const updatedQuote = {
          ...quote,
          ...quoteData,
          updatedAt: new Date().toISOString(),
        };

        addRecordHistoryEntry({
          recordType: "quote",
          recordId: quote.id,
          displayNumber: quote.quoteNumber,
          action: "Edited quote",
          before: quote,
          after: updatedQuote,
          summary: "Quote edited from calculator.",
        });

        return updatedQuote;
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

      const updatedQuote = {
        ...quote,
        ...updates,
        status: updates.quoteStatus || updates.status || quote.quoteStatus || quote.status || "Draft Quote",
        quoteStatus: updates.quoteStatus || updates.status || quote.quoteStatus || quote.status || "Draft Quote",
        updatedAt: new Date().toISOString(),
      };

      addRecordHistoryEntry({
        recordType: "quote",
        recordId: quote.id,
        displayNumber: quote.quoteNumber,
        action: "Updated quote workflow",
        before: quote,
        after: updatedQuote,
        summary: `Quote status updated to ${updatedQuote.quoteStatus || updatedQuote.status}.`,
      });

      return updatedQuote;
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

    moveRecordToTrash("quote", quote);

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

      const updatedJob = {
        ...job,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      addRecordHistoryEntry({
        recordType: "job",
        recordId: job.id,
        displayNumber: job.jobNumber,
        action: "Updated job",
        before: job,
        after: updatedJob,
        summary: "Job record updated.",
      });

      return updatedJob;
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

    moveRecordToTrash("job", job);

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


  const globalSearchIndex = useMemo(() => {
    return buildGlobalSearchIndex({
      quotes,
      jobs,
      shippingEstimates,
      inventoryItems,
      inventoryLogs,
      expenses,
      suppliers,
      manualCustomers,
      customerOverrides,
    });
  }, [
    quotes,
    jobs,
    shippingEstimates,
    inventoryItems,
    inventoryLogs,
    expenses,
    suppliers,
    manualCustomers,
    customerOverrides,
  ]);

  const filteredGlobalSearchResults = useMemo(() => {
    const search = globalSearch.trim().toLowerCase();

    if (!search) return [];

    return globalSearchIndex
      .filter((result) => result.searchText.includes(search))
      .slice(0, 40);
  }, [globalSearch, globalSearchIndex]);

  const groupedGlobalSearchResults = useMemo(() => {
    return groupSearchResults(filteredGlobalSearchResults);
  }, [filteredGlobalSearchResults]);

  function handleGlobalSearchSelect(result) {
    if (result.page === "calculator") {
      setEditingQuoteId(null);
    }

    if (result.page === "payments" && result.selectedPaymentJobId) {
      setSelectedPaymentJobId(result.selectedPaymentJobId);
    }

    setActivePage(result.page);
    setGlobalSearch("");
    setGlobalSearchOpen(false);
    setMobileSidebarOpen(false);
  }


  function saveExpenses(nextExpenses) {
    setExpenses(nextExpenses);
    localStorage.setItem(BACKUP_KEYS.expenses, JSON.stringify(nextExpenses));
    queueCloudCollectionPush("expenses", CLOUD_TABLES.expenses, nextExpenses, "Auto-save");
  }

  function saveSuppliers(nextSuppliers) {
    setSuppliers(nextSuppliers);
    localStorage.setItem(BACKUP_KEYS.suppliers, JSON.stringify(nextSuppliers));
    queueCloudMiscPush("Auto-save");
  }

  function addExpense(expenseData) {
    const now = new Date().toISOString();
    const nextNumber = expenses.length + 1;
    const newExpense = {
      id: crypto.randomUUID(),
      expenseNumber: `EXP-${String(nextNumber).padStart(4, "0")}`,
      createdAt: now,
      updatedAt: now,
      date: expenseData.date || new Date().toISOString().slice(0, 10),
      status: expenseData.status || "Logged",
      recurring: false,
      ...expenseData,
      amount: Number(expenseData.amount || 0),
    };

    saveExpenses([newExpense, ...expenses]);
  }

  function updateExpense(expenseId, updates) {
    const nextExpenses = expenses.map((expense) =>
      expense.id === expenseId
        ? {
            ...expense,
            ...updates,
            amount:
              updates.amount !== undefined
                ? Number(updates.amount || 0)
                : expense.amount,
            updatedAt: new Date().toISOString(),
          }
        : expense
    );

    saveExpenses(nextExpenses);
  }

  function deleteExpense(expenseId) {
    const expense = expenses.find((item) => item.id === expenseId);
    if (!expense) return;

    const confirmed = window.confirm(
      `Delete ${expense.expenseNumber || "this expense"}? This cannot be undone.`
    );

    if (!confirmed) return;

    saveExpenses(expenses.filter((item) => item.id !== expenseId));
  }

  function addSupplier(supplierData) {
    const now = new Date().toISOString();
    const newSupplier = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      name: supplierData.name || "New Supplier",
      category: supplierData.category || "General",
      preferred: Boolean(supplierData.preferred),
      ...supplierData,
    };

    saveSuppliers([newSupplier, ...suppliers]);
  }

  function updateSupplier(supplierId, updates) {
    const nextSuppliers = suppliers.map((supplier) =>
      supplier.id === supplierId
        ? {
            ...supplier,
            ...updates,
            updatedAt: new Date().toISOString(),
          }
        : supplier
    );

    saveSuppliers(nextSuppliers);
  }

  function deleteSupplier(supplierId) {
    const supplier = suppliers.find((item) => item.id === supplierId);
    if (!supplier) return;

    const confirmed = window.confirm(
      `Delete ${supplier.name || "this supplier"}? Existing expenses will stay saved.`
    );

    if (!confirmed) return;

    saveSuppliers(suppliers.filter((item) => item.id !== supplierId));
  }




  function saveRecordHistory(nextHistory) {
    const trimmed = nextHistory.slice(0, 500);
    setRecordHistory(trimmed);
    localStorage.setItem(BACKUP_KEYS.recordHistory, JSON.stringify(trimmed));
  }

  function addRecordHistoryEntry({
    recordType,
    recordId,
    displayNumber,
    action,
    before = null,
    after = null,
    summary = "",
  }) {
    if (!recordType || !recordId || !action) return;

    const entry = {
      id: crypto.randomUUID(),
      recordType,
      recordId,
      displayNumber: displayNumber || "Record",
      action,
      summary,
      createdAt: new Date().toISOString(),
      before,
      after,
    };

    saveRecordHistory([entry, ...recordHistory]);

    if (typeof addToast === "function") {
      addToast("info", "Version saved", `${entry.displayNumber}: ${action}`);
    }
  }

  function restoreRecordHistoryEntry(historyId) {
    const entry = recordHistory.find((item) => item.id === historyId);
    if (!entry?.before) return;

    const confirmed = window.confirm(
      `Restore ${entry.displayNumber} to the version before "${entry.action}"?`
    );

    if (!confirmed) return;

    const restored = {
      ...entry.before,
      restoredFromHistoryId: entry.id,
      updatedAt: new Date().toISOString(),
    };

    if (entry.recordType === "quote") {
      const nextQuotes = quotes.map((quote) =>
        quote.id === entry.recordId ? restored : quote
      );
      setQuotes(nextQuotes);
      saveToStorage(nextQuotes, jobs, usedRecordNumbers);
    }

    if (entry.recordType === "job") {
      const nextJobs = jobs.map((job) =>
        job.id === entry.recordId ? restored : job
      );
      setJobs(nextJobs);
      saveToStorage(quotes, nextJobs, usedRecordNumbers);
    }

    if (entry.recordType === "inventoryItem") {
      const nextItems = inventoryItems.map((item) =>
        item.id === entry.recordId ? restored : item
      );
      saveInventory(nextItems);
    }

    if (entry.recordType === "manualCustomer") {
      const nextCustomers = manualCustomers.map((customer) =>
        customer.id === entry.recordId || customer.key === entry.recordId
          ? restored
          : customer
      );
      saveManualCustomers(nextCustomers);
    }

    if (entry.recordType === "expense") {
      const nextExpenses = expenses.map((expense) =>
        expense.id === entry.recordId ? restored : expense
      );
      saveExpenses(nextExpenses);
    }

    if (typeof addToast === "function") {
      addToast("success", "Version restored", entry.displayNumber);
    }
  }

  function clearRecordHistory() {
    if (recordHistory.length === 0) return;

    const confirmed = window.confirm(
      `Clear all ${recordHistory.length} version history record(s)?`
    );

    if (!confirmed) return;

    saveRecordHistory([]);
  }

  function addConflictWarning(collectionKey, title, recordId) {
    const warning = {
      id: crypto.randomUUID(),
      collectionKey,
      title: title || "Record",
      recordId,
      detectedAt: new Date().toISOString(),
      message: "Cloud and local versions changed close together. Review this record if something looks off.",
    };

    setConflictWarnings((current) => [warning, ...current].slice(0, 20));
  }

  function dismissConflictWarning(warningId) {
    setConflictWarnings((current) =>
      current.filter((warning) => warning.id !== warningId)
    );
  }

  function clearConflictWarnings() {
    setConflictWarnings([]);
  }


  function saveTrashRecords(nextTrashRecords) {
    setTrashRecords(nextTrashRecords);
    localStorage.setItem(BACKUP_KEYS.trash, JSON.stringify(nextTrashRecords));

    if (typeof addToast === "function") {
      addToast("info", "Trash updated", `${nextTrashRecords.length} recoverable record(s).`);
    }
  }

  function moveRecordToTrash(recordType, record) {
    if (!record?.id) return;

    const trashRecord = {
      id: crypto.randomUUID(),
      recordType,
      recordId: record.id,
      recordNumber: record.recordNumber || null,
      displayNumber:
        record.quoteNumber ||
        record.jobNumber ||
        record.invoiceNumber ||
        record.expenseNumber ||
        record.name ||
        "Deleted Record",
      title: record.jobName || record.customerName || record.name || "Deleted Record",
      deletedAt: new Date().toISOString(),
      restoreHint:
        recordType === "quote"
          ? "Restores to Quotes."
          : recordType === "job"
            ? "Restores to Jobs."
            : "Restores to original area.",
      payload: record,
    };

    saveTrashRecords([trashRecord, ...trashRecords].slice(0, 100));
    setTrashMessage(`${trashRecord.displayNumber} moved to trash.`);
  }

  function restoreTrashRecord(trashId) {
    const trashRecord = trashRecords.find((item) => item.id === trashId);
    if (!trashRecord?.payload) return;

    const now = new Date().toISOString();

    if (trashRecord.recordType === "quote") {
      const restoredQuote = {
        ...trashRecord.payload,
        restoredAt: now,
        updatedAt: now,
      };

      const nextQuotes = [restoredQuote, ...quotes.filter((quote) => quote.id !== restoredQuote.id)];
      setQuotes(nextQuotes);
      saveToStorage(nextQuotes, jobs, usedRecordNumbers);
    }

    if (trashRecord.recordType === "job") {
      const restoredJob = {
        ...trashRecord.payload,
        restoredAt: now,
        archived: Boolean(trashRecord.payload.archived),
        updatedAt: now,
      };

      const nextJobs = [restoredJob, ...jobs.filter((job) => job.id !== restoredJob.id)];
      setJobs(nextJobs);
      saveToStorage(quotes, nextJobs, usedRecordNumbers);
    }

    saveTrashRecords(trashRecords.filter((item) => item.id !== trashId));
    setTrashMessage(`${trashRecord.displayNumber} restored.`);

    if (typeof addToast === "function") {
      addToast("success", "Record restored", trashRecord.displayNumber);
    }
  }

  function permanentlyDeleteTrashRecord(trashId) {
    const trashRecord = trashRecords.find((item) => item.id === trashId);
    if (!trashRecord) return;

    const confirmed = window.confirm(
      `Permanently delete ${trashRecord.displayNumber}? This cannot be undone.`
    );

    if (!confirmed) return;

    saveTrashRecords(trashRecords.filter((item) => item.id !== trashId));
    setTrashMessage(`${trashRecord.displayNumber} permanently deleted.`);
  }

  function emptyTrash() {
    if (trashRecords.length === 0) return;

    const confirmed = window.confirm(
      `Permanently delete all ${trashRecords.length} trash record(s)? This cannot be undone.`
    );

    if (!confirmed) return;

    saveTrashRecords([]);
    setTrashMessage("Trash emptied.");
  }


  function getSnapshotPayload() {
    return {
      app: "overkill-solutions-app",
      version: APP_VERSION,
      snapshotAt: new Date().toISOString(),
      data: {
        quotes,
        jobs,
        shippingEstimates,
        customerOverrides,
        manualCustomers,
        inventoryItems,
        inventoryLogs,
        expenses,
        suppliers,
        usedRecordNumbers,
        settings: getBackupValue(BACKUP_KEYS.settings, null),
      trashRecords: getBackupValue(BACKUP_KEYS.trash, []),
      recordHistory: getBackupValue(BACKUP_KEYS.recordHistory, []),
      },
    };
  }

  function saveSnapshots(nextSnapshots) {
    const trimmed = nextSnapshots.slice(0, 25);
    setSnapshots(trimmed);
    localStorage.setItem(BACKUP_KEYS.snapshots, JSON.stringify(trimmed));
  }

  async function createCloudSnapshot(label = "Manual snapshot") {
    try {
      const snapshot = {
        id: crypto.randomUUID(),
        label,
        createdAt: new Date().toISOString(),
        source: isSupabaseConfigured ? "local+cloud-ready" : "local-only",
        payload: getSnapshotPayload(),
      };

      const nextSnapshots = [snapshot, ...snapshots];
      saveSnapshots(nextSnapshots);

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from(CLOUD_TABLES.settings).upsert(
          {
            id: `snapshot_${snapshot.id}`,
            payload: snapshot,
            updated_at: snapshot.createdAt,
          },
          { onConflict: "id" }
        );

        if (error) throw error;
      }

      setSnapshotMessage(`Snapshot saved: ${label}.`);
      if (typeof addToast === "function") {
        addToast("success", "Snapshot saved", label);
      }
    } catch (error) {
      console.error(error);
      setSnapshotMessage(`Snapshot failed: ${error?.message || "unknown error"}.`);
      if (typeof addToast === "function") {
        addToast("error", "Snapshot failed", error?.message || "Unknown error");
      }
    }
  }

  function restoreSnapshot(snapshotId) {
    const snapshot = snapshots.find((item) => item.id === snapshotId);
    if (!snapshot?.payload?.data) return;

    const confirmed = window.confirm(
      `Restore snapshot "${snapshot.label}"? This will replace current local app data on this device.`
    );

    if (!confirmed) return;

    const data = snapshot.payload.data;

    const nextQuotes = Array.isArray(data.quotes) ? data.quotes : [];
    const nextJobs = Array.isArray(data.jobs) ? data.jobs : [];
    const nextShippingEstimates = Array.isArray(data.shippingEstimates) ? data.shippingEstimates : [];
    const nextCustomerOverrides =
      data.customerOverrides && typeof data.customerOverrides === "object"
        ? data.customerOverrides
        : {};
    const nextManualCustomers = Array.isArray(data.manualCustomers) ? data.manualCustomers : [];
    const nextInventoryItems = Array.isArray(data.inventoryItems) ? data.inventoryItems : [];
    const nextInventoryLogs = Array.isArray(data.inventoryLogs) ? data.inventoryLogs : [];
    const nextExpenses = Array.isArray(data.expenses) ? data.expenses : [];
    const nextSuppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
    const nextUsedRecordNumbers = Array.isArray(data.usedRecordNumbers) ? data.usedRecordNumbers : [];

    setQuotes(nextQuotes);
    setJobs(nextJobs);
    setShippingEstimates(nextShippingEstimates);
    setCustomerOverrides(nextCustomerOverrides);
    setManualCustomers(nextManualCustomers);
    setInventoryItems(nextInventoryItems);
    setInventoryLogs(nextInventoryLogs);
    setExpenses(nextExpenses);
    setSuppliers(nextSuppliers);
    setUsedRecordNumbers(nextUsedRecordNumbers);

    localStorage.setItem(BACKUP_KEYS.quotes, JSON.stringify(nextQuotes));
    localStorage.setItem(BACKUP_KEYS.jobs, JSON.stringify(nextJobs));
    localStorage.setItem(BACKUP_KEYS.shippingEstimates, JSON.stringify(nextShippingEstimates));
    localStorage.setItem(BACKUP_KEYS.customerOverrides, JSON.stringify(nextCustomerOverrides));
    localStorage.setItem(BACKUP_KEYS.manualCustomers, JSON.stringify(nextManualCustomers));
    localStorage.setItem(BACKUP_KEYS.inventoryItems, JSON.stringify(nextInventoryItems));
    localStorage.setItem(BACKUP_KEYS.inventoryLogs, JSON.stringify(nextInventoryLogs));
    localStorage.setItem(BACKUP_KEYS.expenses, JSON.stringify(nextExpenses));
    localStorage.setItem(BACKUP_KEYS.suppliers, JSON.stringify(nextSuppliers));
    localStorage.setItem(BACKUP_KEYS.usedRecordNumbers, JSON.stringify(nextUsedRecordNumbers));

    setSnapshotMessage(`Restored snapshot: ${snapshot.label}.`);

    if (cloudSyncEnabled && isSupabaseConfigured) {
      window.setTimeout(() => pushLocalDataToCloud(), 300);
    }

    if (typeof addToast === "function") {
      addToast("success", "Snapshot restored", snapshot.label);
    }
  }

  function deleteSnapshot(snapshotId) {
    const confirmed = window.confirm("Delete this saved snapshot?");
    if (!confirmed) return;

    saveSnapshots(snapshots.filter((snapshot) => snapshot.id !== snapshotId));
    setSnapshotMessage("Snapshot deleted.");
  }



  useEffect(() => {
    if (!cloudSyncEnabled) return undefined;

    const intervalId = window.setInterval(() => {
      createCloudSnapshot("Auto snapshot");
    }, 15 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [
    cloudSyncEnabled,
    quotes,
    jobs,
    shippingEstimates,
    customerOverrides,
    manualCustomers,
    inventoryItems,
    inventoryLogs,
    expenses,
    suppliers,
    usedRecordNumbers,
  ]);


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
        expenses={expenses}
        suppliers={suppliers}
      />
    ),

    reports: (
      <ReportsPage
        quotes={quotes}
        jobs={jobs}
        inventoryItems={inventoryItems}
        inventoryLogs={inventoryLogs}
        expenses={expenses}
        shippingEstimates={shippingEstimates}
        manualCustomers={manualCustomers}
        customerOverrides={customerOverrides}
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

    schedule: (
      <SchedulePage
        jobs={jobs}
        onUpdateJob={updateJob}
      />
    ),

    automation: (
      <AutomationPage
        quotes={quotes}
        jobs={jobs}
        inventoryItems={inventoryItems}
        inventoryLogs={inventoryLogs}
        expenses={expenses}
        customerOverrides={customerOverrides}
        manualCustomers={manualCustomers}
        onUpdateQuoteWorkflow={updateQuoteWorkflow}
        onUpdateJob={updateJob}
        onUpdateCustomer={updateCustomerOverride}
        onUpdateManualCustomer={updateManualCustomer}
        onAdjustInventoryItem={adjustInventoryItem}
      />
    ),

    backend: (
      <BackendReadinessPage
        quotes={quotes}
        jobs={jobs}
        manualCustomers={manualCustomers}
        customerOverrides={customerOverrides}
        onUpdateQuoteWorkflow={updateQuoteWorkflow}
        onUpdateJob={updateJob}
        onUpdateCustomer={updateCustomerOverride}
        onUpdateManualCustomer={updateManualCustomer}
      />
    ),

    admin: (
      <AdminPage
        quotes={quotes}
        jobs={jobs}
        inventoryItems={inventoryItems}
        inventoryLogs={inventoryLogs}
        expenses={expenses}
        shippingEstimates={shippingEstimates}
        manualCustomers={manualCustomers}
        customerOverrides={customerOverrides}
        usedRecordNumbers={usedRecordNumbers}
        onUpdateQuoteWorkflow={updateQuoteWorkflow}
        onUpdateJob={updateJob}
        onUpdateCustomer={updateCustomerOverride}
        onUpdateManualCustomer={updateManualCustomer}
        onUpdateInventoryItem={updateInventoryItem}
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

    templates: (
      <TemplateManagerPage
        quotes={quotes}
        jobs={jobs}
        onUseTemplate={(template) => {
          const formData = template.formData || {};
          saveQuote({
            ...template.quoteData,
            formData,
            jobName: template.name || formData.jobName || "Template Quote",
            customerName: "",
            customerPhone: "",
            customerEmail: "",
            customerAddress: "",
          });
        }}
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


    expenses: (
      <ExpensesPage
        expenses={expenses}
        suppliers={suppliers}
        jobs={jobs}
        inventoryItems={inventoryItems}
        inventoryLogs={inventoryLogs}
        onAddExpense={addExpense}
        onUpdateExpense={updateExpense}
        onDeleteExpense={deleteExpense}
        onAddSupplier={addSupplier}
        onUpdateSupplier={updateSupplier}
        onDeleteSupplier={deleteSupplier}
      />
    ),

    settings: (
      <SettingsPage
        cloudSyncEnabled={cloudSyncEnabled}
        cloudSyncMessage={cloudSyncMessage}
        cloudSyncLastAt={cloudSyncLastAt}
        snapshotMessage={snapshotMessage}
        snapshots={snapshots}
        onCreateSnapshot={() => createCloudSnapshot("Manual snapshot")}
        onRestoreSnapshot={restoreSnapshot}
        onDeleteSnapshot={deleteSnapshot}
        trashRecords={trashRecords}
        trashMessage={trashMessage}
        onRestoreTrashRecord={restoreTrashRecord}
        onPermanentlyDeleteTrashRecord={permanentlyDeleteTrashRecord}
        onEmptyTrash={emptyTrash}
        recordHistory={recordHistory}
        conflictWarnings={conflictWarnings}
        onRestoreRecordHistoryEntry={restoreRecordHistoryEntry}
        onClearRecordHistory={clearRecordHistory}
        onDismissConflictWarning={dismissConflictWarning}
        onClearConflictWarnings={clearConflictWarnings}
      />
    ),
  };

  return (
    <div className="app-shell">
      <button
        className="mobile-menu-button"
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
      >
        <Menu size={22} />
        Menu
      </button>

      {mobileSidebarOpen && (
        <button
          className="mobile-sidebar-backdrop"
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileSidebarOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <img src={overkillMark} alt="Overkill icon" className="sidebar-mark" />

          <div>
            <div className="brand-font sidebar-title">OVERKILL</div>
            <div className="sidebar-subtitle">SOLUTIONS</div>
            <div className="helper-note">{APP_VERSION}</div>
          </div>
        </div>

        <button
          className="mobile-sidebar-close secondary-button"
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <XCircle size={18} />
          Close Menu
        </button>

        <nav className="nav-list condensed-nav-list">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.id}>
              <div className="nav-group-label">{group.label}</div>

              <div className="nav-group-items">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;

                  return (
                    <button
                      key={item.id}
                      className={`nav-button ${isActive ? "active" : ""}`}
                      onClick={() => {
                        if (item.id !== "calculator") setEditingQuoteId(null);
                        setActivePage(item.id);
                        setMobileSidebarOpen(false);
                      }}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
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

        <div className="sidebar-mini-stats snapshot-sidebar-card">
          <button
            className="secondary-button"
            type="button"
            onClick={() => createCloudSnapshot("Manual snapshot")}
          >
            Save Snapshot
          </button>

          <div>
            <span>Snapshots</span>
            <strong>{snapshots.length}</strong>
          </div>
        </div>

        {snapshotMessage && <p className="helper-note">{snapshotMessage}</p>}

        <div className="sidebar-mini-stats trash-sidebar-card">
          <div>
            <span>Trash</span>
            <strong>{trashRecords.length}</strong>
          </div>

          {trashRecords.length > 0 && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => setActivePage("settings")}
            >
              Review Trash
            </button>
          )}
        </div>

        {trashMessage && <p className="helper-note">{trashMessage}</p>}

        {conflictWarnings.length > 0 && (
          <div className="sidebar-mini-stats conflict-sidebar-card">
            <div>
              <span>Conflicts</span>
              <strong>{conflictWarnings.length}</strong>
            </div>

            <button
              className="secondary-button"
              type="button"
              onClick={() => setActivePage("settings")}
            >
              Review
            </button>
          </div>
        )}



        <div className="sidebar-mini-stats cloud-sync-mini-panel">
          <div>
            <span>Cloud Sync</span>
            <strong>{isSupabaseConfigured ? "Ready" : "Not Set"}</strong>
          </div>

          <div>
            <span>Mode</span>
            <strong>{cloudSyncEnabled ? "Auto" : "Paused"}</strong>
          </div>

          <button
            className="secondary-button"
            type="button"
            onClick={() => setCloudSyncEnabled(!cloudSyncEnabled)}
          >
            <Database size={18} />
            {cloudSyncEnabled ? "Pause Sync" : "Enable Sync"}
          </button>

          <button className="secondary-button" type="button" onClick={pushLocalDataToCloud}>
            <Upload size={18} />
            Push Cloud
          </button>

          <button className="secondary-button" type="button" onClick={pullCloudDataToLocal}>
            <Download size={18} />
            Pull Cloud
          </button>
        </div>

        <p className="helper-note">
          {cloudSyncMessage}
          {cloudSyncLastAt ? ` • ${cloudSyncLastAt}` : ""}
        </p>
      </aside>

      <main className="main-area">
        <header className="top-header">
          <img src={overkillLogo} alt="Overkill Solutions" className="top-logo" />

          <div className="top-header-content">
            <div>
              <h1 className="brand-font app-title">INTERNAL PRODUCTION SYSTEM</h1>
              <p className="muted-text">
                Quotes, jobs, scheduling, automation, invoices, inventory, CRM, and profitability.
              </p>
            </div>

            <div className={`sync-status-pill ${!isOnline ? "offline" : cloudSyncState}`}>
              <span className="sync-status-dot" />
              <strong>
                {getCloudSyncLabel(cloudSyncState, cloudSyncEnabled, isSupabaseConfigured, isOnline)}
              </strong>
              {cloudSyncLastAt && <em>{cloudSyncLastAt}</em>}
            </div>

            <div className="global-search-wrap">
              <div className="global-search-box">
                <Search size={18} />
                <input
                  type="search"
                  value={globalSearch}
                  placeholder="Search quotes, jobs, customers, payments, shipping, inventory..."
                  onFocus={() => setGlobalSearchOpen(true)}
                  onChange={(event) => {
                    setGlobalSearch(event.target.value);
                    setGlobalSearchOpen(true);
                  }}
                />

                {globalSearch && (
                  <button
                    className="global-search-clear"
                    type="button"
                    onClick={() => {
                      setGlobalSearch("");
                      setGlobalSearchOpen(false);
                    }}
                  >
                    <XCircle size={17} />
                  </button>
                )}
              </div>

              {globalSearchOpen && globalSearch.trim() && (
                <div className="global-search-results">
                  {filteredGlobalSearchResults.length === 0 ? (
                    <div className="global-search-empty">No matching records found.</div>
                  ) : (
                    Object.entries(groupedGlobalSearchResults).map(([group, results]) => (
                      <div className="global-search-group" key={group}>
                        <div className="global-search-group-title">
                          {SEARCH_GROUPS[group] || group}
                        </div>

                        {results.map((result) => (
                          <button
                            className="global-search-result"
                            key={result.id}
                            type="button"
                            onClick={() => handleGlobalSearchSelect(result)}
                          >
                            <div>
                              <strong>{result.title}</strong>
                              <span>{result.detail}</span>
                            </div>

                            <em>{result.status}</em>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {!isOnline && (
          <div className="offline-banner">
            <strong>Offline Mode</strong>
            <span>Changes are saved locally and will sync when this device reconnects.</span>
          </div>
        )}

        {pageContent[activePage]}

        {globalOpenTimers.length > 0 && (
          <div className="global-timer-dock">
            <div className="global-timer-dock-header">
              <div>
                <strong>Live Production Timers</strong>
                <span>
                  {globalOpenTimers.length} running • {formatAppDuration(globalTimerTotals.hours)} • {money(globalTimerTotals.cost)} live cost
                </span>
              </div>

              <button className="secondary-button" type="button" onClick={stopAllGlobalTimers}>
                Stop All
              </button>
            </div>

            <div className="global-timer-list">
              {globalOpenTimers.slice(0, 6).map((timer) => (
                <div className="global-timer-row" key={`${timer.job.id}-${timer.key}`}>
                  <div>
                    <strong>{timer.job.jobNumber} — {timer.type}</strong>
                    <span>
                      {timer.label || "General"} • {timer.job.customerName || "No Customer"} • {timer.event.operator || timer.job.operator || "Unassigned"}
                    </span>
                  </div>

                  <div className="global-timer-actions">
                    <span className="status-pill">{formatAppDuration(timer.elapsedHours)}</span>
                    <span className="status-pill">{money(timer.liveCost)}</span>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => stopGlobalTimer(timer.job.id, timer.key)}
                    >
                      Stop
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {toasts.length > 0 && (
          <div className="toast-stack" aria-live="polite">
            {toasts.map((toast) => (
              <div className={`app-toast ${toast.type}`} key={toast.id}>
                <div>
                  <strong>{toast.type === "error" ? "Heads up" : toast.type === "success" ? "Done" : "Update"}</strong>
                  <span>{toast.message}</span>
                </div>

                <button type="button" onClick={() => removeToast(toast.id)}>
                  <XCircle size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}