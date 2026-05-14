// NOTE: This is the same JobsPage structure as the last batch, with a new
// job attachment tracker added. It stores attachment records directly on each job
// as job.attachments, so no App.jsx changes are needed.

import { useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Save,
  FileDown,
  Upload,
  ChevronDown,
  Archive,
  RotateCcw,
  Search,
  Copy,
  ClipboardList,
  Play,
  Square,
  CheckCircle,
  AlertTriangle,
  PackageSearch,
  Paperclip,
  Link,
} from "lucide-react";
import { exportInvoicePdf, exportProductionSheetPdf } from "../utils/pdf";

const PAYMENT_METHODS = ["Venmo", "Cash", "Cash App", "PayPal", "Zelle"];

const JOB_STATUSES = [
  "Approved",
  "In Production",
  "Waiting on Customer",
  "Waiting on Material",
  "Ready for Pickup",
  "Ready to Ship",
  "Completed",
  "Cancelled",
];

const PAYMENT_FILTERS = ["All", "Unpaid", "Partially Paid", "Paid", "Overpaid"];
const PRIORITY_LEVELS = ["Normal", "Low", "High", "Rush"];
const PRIORITY_FILTERS = ["All", "Rush", "High", "Normal", "Low"];

const DUE_DATE_FILTERS = [
  "All",
  "Overdue",
  "Due Soon",
  "No Due Date",
  "Has Due Date",
];

const EVENT_TYPES = [
  "Machine Time",
  "CAD / Design",
  "Assembly / Labor",
  "Sanding / Cleanup",
  "Customer Communication",
  "Delivery / Pickup",
  "Other",
];

const QUICK_TIMER_TYPES = [
  "Machine Time",
  "CAD / Design",
  "Assembly / Labor",
  "Sanding / Cleanup",
  "Customer Communication",
  "Other",
];

const EVENT_ACTIONS = ["Started", "Stopped", "Note"];

const ATTACHMENT_TYPES = [
  "Customer Reference",
  "STL / Print File",
  "STEP / CAD File",
  "SVG / Vector File",
  "Image / Photo",
  "Receipt / Material Invoice",
  "Shipping Label",
  "Other",
];

const EMPTY_MATERIAL_USAGE = {
  itemId: "",
  quantityUsed: "",
  usageType: "Estimated Job Usage",
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

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeString() {
  return new Date().toTimeString().slice(0, 5);
}

function getPaidTotal(job) {
  return (job.paymentEvents || []).reduce((sum, payment) => {
    if (payment.type === "Refund") return sum - num(payment.amount);
    return sum + num(payment.amount);
  }, 0);
}

function getPaymentStatus(job) {
  const total = num(job.finalTotal);
  const paid = getPaidTotal(job);

  if (paid <= 0) return "Unpaid";
  if (paid >= total) return paid > total ? "Overpaid" : "Paid";
  return "Partially Paid";
}

function getRemainingBalance(job) {
  return Math.max(0, num(job.finalTotal) - getPaidTotal(job));
}

function getEventDateTime(event) {
  if (!event.date || !event.time) return null;
  const value = new Date(`${event.date}T${event.time}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function calculateHours(startEvent, stopEvent) {
  const startDate = getEventDateTime(startEvent);
  const stopDate = getEventDateTime(stopEvent);

  if (!startDate || !stopDate) return 0;

  const diffMs = stopDate - startDate;
  if (diffMs <= 0) return 0;

  return diffMs / 1000 / 60 / 60;
}

function getTodayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getDueDateStatus(job) {
  if (!job.dueDate) {
    return {
      label: "No Due Date",
      tone: "neutral",
      daysRemaining: null,
      isOverdue: false,
      isDueSoon: false,
    };
  }

  const today = getTodayStart();
  const dueDate = new Date(`${job.dueDate}T00:00:00`);

  if (Number.isNaN(dueDate.getTime())) {
    return {
      label: "Invalid Due Date",
      tone: "warning",
      daysRemaining: null,
      isOverdue: false,
      isDueSoon: false,
    };
  }

  const daysRemaining = Math.ceil((dueDate - today) / 1000 / 60 / 60 / 24);

  if (daysRemaining < 0) {
    return {
      label: `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"}`,
      tone: "danger",
      daysRemaining,
      isOverdue: true,
      isDueSoon: false,
    };
  }

  if (daysRemaining === 0) {
    return {
      label: "Due Today",
      tone: "warning",
      daysRemaining,
      isOverdue: false,
      isDueSoon: true,
    };
  }

  if (daysRemaining <= 3) {
    return {
      label: `Due in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
      tone: "warning",
      daysRemaining,
      isOverdue: false,
      isDueSoon: true,
    };
  }

  return {
    label: `Due in ${daysRemaining} days`,
    tone: "normal",
    daysRemaining,
    isOverdue: false,
    isDueSoon: false,
  };
}

function getArchiveDeleteInfo(job) {
  if (!job.archivedAt) {
    return {
      label: "Not archived",
      daysRemaining: null,
      readyForDelete: false,
    };
  }

  const archivedDate = new Date(job.archivedAt);
  const today = new Date();

  if (Number.isNaN(archivedDate.getTime())) {
    return {
      label: "Invalid archive date",
      daysRemaining: null,
      readyForDelete: false,
    };
  }

  archivedDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const daysArchived = Math.floor((today - archivedDate) / 1000 / 60 / 60 / 24);
  const daysRemaining = 30 - daysArchived;

  if (daysRemaining <= 0) {
    return {
      label: `Archived ${daysArchived} day${daysArchived === 1 ? "" : "s"} ago — ready for cleanup`,
      daysRemaining: 0,
      readyForDelete: true,
    };
  }

  return {
    label: `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} until 30-day cleanup`,
    daysRemaining,
    readyForDelete: false,
  };
}

function getPriority(job) {
  return job.priority || "Normal";
}

function matchesJobSearch(job, searchTerm) {
  const search = searchTerm.trim().toLowerCase();
  if (!search) return true;

  const attachments = job.attachments || [];

  return [
    job.jobNumber,
    job.quoteNumber,
    job.invoiceNumber,
    job.customerName,
    job.customerPhone,
    job.customerEmail,
    job.jobName,
    job.status,
    getPaymentStatus(job),
    getPriority(job),
    job.dueDate,
    job.queueNotes,
    ...attachments.flatMap((attachment) => [
      attachment.name,
      attachment.type,
      attachment.url,
      attachment.notes,
    ]),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(search));
}

function matchesDueDateFilter(job, dueDateFilter) {
  const due = getDueDateStatus(job);

  if (dueDateFilter === "All") return true;
  if (dueDateFilter === "Overdue") return due.isOverdue;
  if (dueDateFilter === "Due Soon") return due.isDueSoon;
  if (dueDateFilter === "No Due Date") return !job.dueDate;
  if (dueDateFilter === "Has Due Date") return Boolean(job.dueDate);

  return true;
}

function matchesJobFilters(
  job,
  searchTerm,
  statusFilter,
  paymentFilter,
  priorityFilter,
  dueDateFilter
) {
  const paymentStatus = getPaymentStatus(job);
  const priority = getPriority(job);

  return (
    matchesJobSearch(job, searchTerm) &&
    (statusFilter === "All" || (job.status || "Approved") === statusFilter) &&
    (paymentFilter === "All" || paymentStatus === paymentFilter) &&
    (priorityFilter === "All" || priority === priorityFilter) &&
    matchesDueDateFilter(job, dueDateFilter)
  );
}

function getPriorityRank(priority) {
  if (priority === "Rush") return 4;
  if (priority === "High") return 3;
  if (priority === "Normal") return 2;
  if (priority === "Low") return 1;
  return 2;
}

function sortJobsForQueue(jobs) {
  return [...jobs].sort((a, b) => {
    const aDue = getDueDateStatus(a);
    const bDue = getDueDateStatus(b);

    if (aDue.isOverdue !== bDue.isOverdue) return aDue.isOverdue ? -1 : 1;

    const priorityDiff = getPriorityRank(getPriority(b)) - getPriorityRank(getPriority(a));
    if (priorityDiff !== 0) return priorityDiff;

    if (a.dueDate && b.dueDate) {
      return new Date(`${a.dueDate}T00:00:00`) - new Date(`${b.dueDate}T00:00:00`);
    }

    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;

    return new Date(b.updatedAt || b.approvedAt || 0) - new Date(a.updatedAt || a.approvedAt || 0);
  });
}

function Field({ label, value, onChange, type = "number", step = "0.01" }) {
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

function createTimeEvent(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    type: "Machine Time",
    action: "Started",
    label: "",
    date: "",
    time: "",
    rate: 3,
    notes: "",
    createdByTimer: false,
    timerSessionId: "",
    ...overrides,
  };
}

function createAttachment() {
  return {
    id: crypto.randomUUID(),
    type: "Customer Reference",
    name: "",
    url: "",
    notes: "",
    addedAt: new Date().toISOString(),
  };
}

function normalizeOldEvent(event) {
  if (!event.timestamp) return event;

  const [date = "", time = ""] = event.timestamp.split("T");

  return {
    ...event,
    date: event.date || date,
    time: event.time || time,
  };
}

function getQuotedPrintRuns(job) {
  return job?.quoteSnapshot?.formData?.printRuns || job?.formData?.printRuns || [];
}

function getFormData(job) {
  return job?.quoteSnapshot?.formData || job?.formData || {};
}

function buildMachineOptions(job) {
  const formData = getFormData(job);
  const quotedPrintRuns = getQuotedPrintRuns(job);

  const options = [
    { value: "", label: "General" },
    { value: "CAD", label: "CAD" },
    { value: "Assembly", label: "Assembly" },
    { value: "Cleanup", label: "Cleanup" },
  ];

  quotedPrintRuns.forEach((run, runIndex) => {
    const printer = run.printerId || "Printer";
    const nozzle = run.nozzleSize || "Nozzle";
    const material = run.materialId || "Material";
    const label = `Run ${runIndex + 1}: ${printer} / ${nozzle} / ${material}`;

    options.push({
      value: label,
      label,
    });
  });

  if (job.jobAspects?.engraving || formData.jobAspects?.engraving) {
    options.push(
      { value: "H2S Laser — 10W", label: "H2S Laser — 10W" },
      { value: "H2S Laser — 40W", label: "H2S Laser — 40W" }
    );
  }

  if (job.jobAspects?.vinyl || formData.jobAspects?.vinyl) {
    options.push({
      value: "H2S Cutter",
      label: "H2S Cutter",
    });
  }

  return options;
}

function sortEventsOldestFirst(events) {
  return [...events].sort((a, b) => {
    const aDate = getEventDateTime(a);
    const bDate = getEventDateTime(b);

    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;

    return aDate - bDate;
  });
}

function pairTimeEvents(events) {
  const sorted = sortEventsOldestFirst(events.map(normalizeOldEvent));
  const openStarts = {};
  const paired = [];

  sorted.forEach((event) => {
    if (event.action === "Note") return;

    const key = `${event.type}__${event.label || "General"}`;

    if (event.action === "Started") {
      openStarts[key] = event;
      return;
    }

    if (event.action === "Stopped" && openStarts[key]) {
      const startEvent = openStarts[key];
      const hours = calculateHours(startEvent, event);
      const rate = num(startEvent.rate || event.rate);

      paired.push({
        key,
        type: event.type,
        label: event.label || "General",
        startEvent,
        stopEvent: event,
        hours,
        rate,
        cost: hours * rate,
      });

      delete openStarts[key];
    }
  });

  return paired;
}

function getOpenTimers(events = []) {
  const sorted = sortEventsOldestFirst(events.map(normalizeOldEvent));
  const openStarts = {};

  sorted.forEach((event) => {
    if (event.action === "Note") return;

    const key = `${event.type}__${event.label || "General"}`;

    if (event.action === "Started") {
      openStarts[key] = event;
      return;
    }

    if (event.action === "Stopped" && openStarts[key]) {
      delete openStarts[key];
    }
  });

  return Object.entries(openStarts).map(([key, event]) => ({
    key,
    event,
    type: event.type,
    label: event.label || "General",
  }));
}

function getDefaultRateForEventType(type) {
  if (type === "Machine Time") return 3;
  if (type === "CAD / Design") return 30;
  if (type === "Assembly / Labor") return 30;
  if (type === "Sanding / Cleanup") return 25;
  if (type === "Customer Communication") return 0;
  if (type === "Delivery / Pickup") return 25;
  return 0;
}

function isLowStock(item) {
  return item.active !== false && num(item.quantityOnHand) <= num(item.reorderThreshold);
}

function getInventoryDisplayName(item) {
  return [item.name, item.material, item.color, item.brand].filter(Boolean).join(" • ");
}

function getJobMaterialUsage(job) {
  return job.materialUsageEvents || [];
}

function getJobAttachments(job) {
  return job.attachments || [];
}

export default function JobsPage({
  jobs,
  inventoryItems = [],
  onUpdateJob,
  onArchiveJob,
  onRestoreJob,
  onDeleteJob,
  onDuplicateJob,
  onAdjustInventoryItem,
  onImportPdf,
  importMessage,
}) {
  const fileInputRef = useRef(null);
  const [expandedJobId, setExpandedJobId] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [dueDateFilter, setDueDateFilter] = useState("All");
  const [materialUsageDrafts, setMaterialUsageDrafts] = useState({});

  const activeJobs = jobs.filter((job) => !job.archived);
  const archivedJobs = jobs.filter((job) => job.archived);
  const activeInventoryItems = inventoryItems.filter((item) => item.active !== false);
  const lowStockItems = activeInventoryItems.filter(isLowStock);

  const filteredActiveJobs = useMemo(() => {
    return sortJobsForQueue(
      activeJobs.filter((job) =>
        matchesJobFilters(
          job,
          searchTerm,
          statusFilter,
          paymentFilter,
          priorityFilter,
          dueDateFilter
        )
      )
    );
  }, [activeJobs, searchTerm, statusFilter, paymentFilter, priorityFilter, dueDateFilter]);

  const filteredArchivedJobs = useMemo(() => {
    return sortJobsForQueue(
      archivedJobs.filter((job) =>
        matchesJobFilters(
          job,
          searchTerm,
          statusFilter,
          paymentFilter,
          priorityFilter,
          dueDateFilter
        )
      )
    );
  }, [archivedJobs, searchTerm, statusFilter, paymentFilter, priorityFilter, dueDateFilter]);

  const overdueCount = activeJobs.filter((job) => getDueDateStatus(job).isOverdue).length;
  const dueSoonCount = activeJobs.filter((job) => getDueDateStatus(job).isDueSoon).length;
  const rushCount = activeJobs.filter((job) => getPriority(job) === "Rush").length;
  const highPriorityCount = activeJobs.filter((job) => getPriority(job) === "High").length;
  const activeTimerCount = activeJobs.reduce(
    (sum, job) => sum + getOpenTimers(job.timeEvents || []).length,
    0
  );
  const attachmentCount = jobs.reduce(
    (sum, job) => sum + getJobAttachments(job).length,
    0
  );

  function getMaterialUsageDraft(jobId) {
    return materialUsageDrafts[jobId] || EMPTY_MATERIAL_USAGE;
  }

  function updateMaterialUsageDraft(jobId, key, value) {
    setMaterialUsageDrafts((current) => ({
      ...current,
      [jobId]: {
        ...(current[jobId] || EMPTY_MATERIAL_USAGE),
        [key]: value,
      },
    }));
  }

  function resetMaterialUsageDraft(jobId) {
    setMaterialUsageDrafts((current) => ({
      ...current,
      [jobId]: EMPTY_MATERIAL_USAGE,
    }));
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("All");
    setPaymentFilter("All");
    setPriorityFilter("All");
    setDueDateFilter("All");
  }

  function handleImportChange(event) {
    const file = event.target.files?.[0];

    if (file) {
      onImportPdf(file);
    }

    event.target.value = "";
  }

  function saveJob(jobId) {
    onUpdateJob(jobId, {
      lastSavedAt: new Date().toISOString(),
    });
  }

  function updateActual(jobId, key, value) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    onUpdateJob(jobId, {
      actuals: {
        ...(job.actuals || {}),
        [key]: value,
      },
    });
  }

  function updatePayment(jobId, key, value) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    onUpdateJob(jobId, {
      payments: {
        ...(job.payments || {}),
        [key]: value,
      },
    });
  }

  function addAttachment(jobId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    onUpdateJob(jobId, {
      attachments: [createAttachment(), ...(job.attachments || [])],
    });
  }

  function updateAttachment(jobId, attachmentId, key, value) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    onUpdateJob(jobId, {
      attachments: (job.attachments || []).map((attachment) =>
        attachment.id === attachmentId
          ? {
              ...attachment,
              [key]: value,
              updatedAt: new Date().toISOString(),
            }
          : attachment
      ),
    });
  }

  function removeAttachment(jobId, attachmentId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    const attachment = (job.attachments || []).find((item) => item.id === attachmentId);
    const confirmed = window.confirm(
      `Remove "${attachment?.name || "this attachment"}" from ${job.jobNumber}? This does not delete the actual file.`
    );

    if (!confirmed) return;

    onUpdateJob(jobId, {
      attachments: (job.attachments || []).filter((item) => item.id !== attachmentId),
    });
  }

  function addTimeEvent(jobId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    onUpdateJob(jobId, {
      timeEvents: [...(job.timeEvents || []), createTimeEvent()],
    });
  }

  function startTimer(jobId, type, label = "") {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    const normalizedEvents = (job.timeEvents || []).map(normalizeOldEvent);
    const key = `${type}__${label || "General"}`;
    const openTimers = getOpenTimers(normalizedEvents);
    const alreadyRunning = openTimers.find((timer) => timer.key === key);

    if (alreadyRunning) {
      window.alert(`${type} / ${label || "General"} is already running.`);
      return;
    }

    const timerSessionId = crypto.randomUUID();

    const event = createTimeEvent({
      type,
      action: "Started",
      label,
      date: todayDateString(),
      time: nowTimeString(),
      rate: getDefaultRateForEventType(type),
      notes: `Timer started for ${type}${label ? ` — ${label}` : ""}.`,
      createdByTimer: true,
      timerSessionId,
    });

    onUpdateJob(jobId, {
      status: job.status === "Approved" ? "In Production" : job.status,
      timeEvents: [...normalizedEvents, event],
    });
  }

  function stopTimer(jobId, openTimer) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job || !openTimer?.event) return;

    const normalizedEvents = (job.timeEvents || []).map(normalizeOldEvent);
    const startEvent = openTimer.event;

    const event = createTimeEvent({
      type: startEvent.type,
      action: "Stopped",
      label: startEvent.label || "",
      date: todayDateString(),
      time: nowTimeString(),
      rate: startEvent.rate || getDefaultRateForEventType(startEvent.type),
      notes: `Timer stopped for ${startEvent.type}${startEvent.label ? ` — ${startEvent.label}` : ""}.`,
      createdByTimer: true,
      timerSessionId: startEvent.timerSessionId || crypto.randomUUID(),
    });

    onUpdateJob(jobId, {
      timeEvents: [...normalizedEvents, event],
    });
  }

  function stopAllTimers(jobId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    const openTimers = getOpenTimers(job.timeEvents || []);

    if (openTimers.length === 0) return;

    const stopEvents = openTimers.map((timer) =>
      createTimeEvent({
        type: timer.event.type,
        action: "Stopped",
        label: timer.event.label || "",
        date: todayDateString(),
        time: nowTimeString(),
        rate: timer.event.rate || getDefaultRateForEventType(timer.event.type),
        notes: `Timer stopped for ${timer.event.type}${timer.event.label ? ` — ${timer.event.label}` : ""}.`,
        createdByTimer: true,
        timerSessionId: timer.event.timerSessionId || crypto.randomUUID(),
      })
    );

    onUpdateJob(jobId, {
      timeEvents: [...(job.timeEvents || []).map(normalizeOldEvent), ...stopEvents],
    });
  }

  function updateTimeEvent(jobId, eventId, key, value) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    onUpdateJob(jobId, {
      timeEvents: (job.timeEvents || []).map((event) =>
        event.id === eventId
          ? { ...normalizeOldEvent(event), [key]: value }
          : normalizeOldEvent(event)
      ),
    });
  }

  function removeTimeEvent(jobId, eventId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    onUpdateJob(jobId, {
      timeEvents: (job.timeEvents || []).filter((event) => event.id !== eventId),
    });
  }

  function markJobCompleted(jobId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    const openTimers = getOpenTimers(job.timeEvents || []);
    const remainingBalance = getRemainingBalance(job);

    if (openTimers.length > 0) {
      const stopTimers = window.confirm(
        `This job has ${openTimers.length} running timer(s). Stop all timers and continue completing the job?`
      );

      if (!stopTimers) return;

      stopAllTimers(jobId);
    }

    if (remainingBalance > 0) {
      const confirmed = window.confirm(
        `This job still has ${money(remainingBalance)} remaining. Mark completed anyway?`
      );

      if (!confirmed) return;
    }

    onUpdateJob(jobId, {
      status: "Completed",
      completedAt: new Date().toISOString(),
      archiveEligibleAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastSavedAt: new Date().toISOString(),
    });
  }

  function calculateJobActuals(job) {
    const actuals = job.actuals || {};
    const payments = job.payments || {};
    const timeEvents = job.timeEvents || [];
    const pairedEvents = pairTimeEvents(timeEvents);
    const materialUsageEvents = getJobMaterialUsage(job);

    const machinePairs = pairedEvents.filter((pair) => pair.type === "Machine Time");
    const cadPairs = pairedEvents.filter((pair) => pair.type === "CAD / Design");
    const laborPairs = pairedEvents.filter(
      (pair) => pair.type !== "Machine Time" && pair.type !== "CAD / Design"
    );

    const machineHours = machinePairs.reduce((sum, pair) => sum + pair.hours, 0);
    const cadHours = cadPairs.reduce((sum, pair) => sum + pair.hours, 0);
    const laborHours = laborPairs.reduce((sum, pair) => sum + pair.hours, 0);

    const machineCost = machinePairs.reduce((sum, pair) => sum + pair.cost, 0);
    const cadCost = cadPairs.reduce((sum, pair) => sum + pair.cost, 0);
    const laborCost = laborPairs.reduce((sum, pair) => sum + pair.cost, 0);

    const loggedMaterialCost = materialUsageEvents.reduce(
      (sum, usage) => sum + num(usage.estimatedCost),
      0
    );

    const manualMaterialCost = num(actuals.materialCost);
    const materialCost = Math.max(manualMaterialCost, loggedMaterialCost);

    const failedPrintCost = num(actuals.failedPrintCost);
    const extraCost = num(actuals.extraCost);

    const totalActualCost =
      materialCost +
      machineCost +
      cadCost +
      laborCost +
      failedPrintCost +
      extraCost;

    const customerTotal = num(job.finalTotal);
    const ledgerPaid = getPaidTotal(job);
    const legacyPaid = num(payments.depositPaid) + num(payments.additionalPaid);
    const totalPaid = ledgerPaid || legacyPaid;

    const remainingToCollect = Math.max(0, customerTotal - totalPaid);
    const estimatedProfit = customerTotal - totalActualCost;
    const profitMargin =
      customerTotal > 0 ? (estimatedProfit / customerTotal) * 100 : 0;

    return {
      pairedEvents,
      machineHours,
      cadHours,
      laborHours,
      materialUsageEvents,
      loggedMaterialCost,
      manualMaterialCost,
      materialCost,
      totalActualCost,
      customerTotal,
      totalPaid,
      remainingToCollect,
      estimatedProfit,
      profitMargin,
    };
  }

  function logMaterialUsage(jobId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    if (!onAdjustInventoryItem) {
      window.alert("Inventory adjustment function is not wired into JobsPage yet.");
      return;
    }

    const draft = getMaterialUsageDraft(jobId);
    const inventoryItem = inventoryItems.find((item) => item.id === draft.itemId);
    const quantityUsed = Math.abs(num(draft.quantityUsed));

    if (!inventoryItem) {
      window.alert("Select an inventory item first.");
      return;
    }

    if (quantityUsed <= 0) {
      window.alert("Enter a material usage quantity greater than zero.");
      return;
    }

    if (quantityUsed > num(inventoryItem.quantityOnHand)) {
      const confirmed = window.confirm(
        `You are logging ${quantityUsed} ${inventoryItem.unit}, but only ${inventoryItem.quantityOnHand} ${inventoryItem.unit} is currently on hand. Continue anyway?`
      );

      if (!confirmed) return;
    }

    const estimatedCost = quantityUsed * num(inventoryItem.unitCost);
    const now = new Date().toISOString();

    const usageEvent = {
      id: crypto.randomUUID(),
      itemId: inventoryItem.id,
      itemName: inventoryItem.name,
      category: inventoryItem.category,
      material: inventoryItem.material,
      color: inventoryItem.color,
      quantityUsed,
      unit: inventoryItem.unit,
      unitCost: num(inventoryItem.unitCost),
      estimatedCost,
      usageType: draft.usageType || "Estimated Job Usage",
      notes: draft.notes || "",
      createdAt: now,
    };

    onAdjustInventoryItem(inventoryItem.id, {
      type: draft.usageType || "Estimated Job Usage",
      quantityChange: -quantityUsed,
      jobNumber: job.jobNumber || "",
      notes:
        draft.notes ||
        `Material used on ${job.jobNumber || "job"} — ${job.jobName || "Untitled Job"}.`,
    });

    const nextMaterialUsageEvents = [usageEvent, ...(job.materialUsageEvents || [])];

    const existingActuals = job.actuals || {};
    const loggedMaterialTotal = nextMaterialUsageEvents.reduce(
      (sum, usage) => sum + num(usage.estimatedCost),
      0
    );

    onUpdateJob(jobId, {
      materialUsageEvents: nextMaterialUsageEvents,
      actuals: {
        ...existingActuals,
        materialCost: Math.max(num(existingActuals.materialCost), loggedMaterialTotal),
      },
      lastSavedAt: now,
    });

    resetMaterialUsageDraft(jobId);
  }

  function removeMaterialUsageEvent(jobId, usageEventId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    const usage = (job.materialUsageEvents || []).find((event) => event.id === usageEventId);

    const confirmed = window.confirm(
      "Remove this material usage record from the job? This will NOT automatically restore inventory stock. Add a manual inventory adjustment if you need to put material back."
    );

    if (!confirmed) return;

    const nextMaterialUsageEvents = (job.materialUsageEvents || []).filter(
      (event) => event.id !== usageEventId
    );

    const nextLoggedMaterialTotal = nextMaterialUsageEvents.reduce(
      (sum, event) => sum + num(event.estimatedCost),
      0
    );

    onUpdateJob(jobId, {
      materialUsageEvents: nextMaterialUsageEvents,
      actuals: {
        ...(job.actuals || {}),
        materialCost: nextLoggedMaterialTotal,
      },
      lastSavedAt: new Date().toISOString(),
    });

    if (usage) {
      window.alert(
        `Removed usage record for ${usage.itemName}. Inventory stock was not restored automatically.`
      );
    }
  }

  function renderAttachmentsPanel(job) {
    const attachments = getJobAttachments(job);

    return (
      <div className="form-card">
        <div className="page-heading-row">
          <div>
            <h3 className="card-title">Job Attachments / File Links</h3>
            <p className="muted-text">
              Track STL, STEP, SVG, customer references, photos, receipts, shipping labels, and other project files.
            </p>
          </div>

          <button className="secondary-button" type="button" onClick={() => addAttachment(job.id)}>
            <Paperclip size={18} />
            Add Attachment
          </button>
        </div>

        {attachments.length === 0 ? (
          <p className="muted-text">No attachments saved for this job yet.</p>
        ) : (
          <div className="vinyl-lines">
            {attachments.map((attachment, index) => (
              <div className="vinyl-line" key={attachment.id}>
                <div className="vinyl-line-header">
                  <strong>Attachment {index + 1}</strong>
                  <span>{attachment.type || "Other"}</span>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>Attachment Type</span>
                    <select
                      value={attachment.type}
                      onChange={(event) =>
                        updateAttachment(job.id, attachment.id, "type", event.target.value)
                      }
                    >
                      {ATTACHMENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Field
                    label="File / Link Name"
                    type="text"
                    value={attachment.name}
                    onChange={(value) =>
                      updateAttachment(job.id, attachment.id, "name", value)
                    }
                  />

                  <Field
                    label="Path / URL / Location"
                    type="text"
                    value={attachment.url}
                    onChange={(value) =>
                      updateAttachment(job.id, attachment.id, "url", value)
                    }
                  />

                  <button
                    className="secondary-button danger-button"
                    type="button"
                    onClick={() => removeAttachment(job.id, attachment.id)}
                  >
                    <Trash2 size={18} />
                    Remove
                  </button>
                </div>

                {attachment.url && (
                  <a
                    className="secondary-button single-row-gap"
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Link size={18} />
                    Open Link / File Path
                  </a>
                )}

                <label className="field single-row-gap">
                  <span>Attachment Notes</span>
                  <textarea
                    value={attachment.notes}
                    onChange={(event) =>
                      updateAttachment(job.id, attachment.id, "notes", event.target.value)
                    }
                    placeholder="Reference image, final STL, STEP source file, customer screenshot, receipt, material invoice, etc."
                  />
                </label>

                {attachment.addedAt && (
                  <p className="helper-note">
                    Added {new Date(attachment.addedAt).toLocaleString()}
                    {attachment.updatedAt
                      ? ` • Updated ${new Date(attachment.updatedAt).toLocaleString()}`
                      : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="helper-note">
          This stores names/links/paths only. It does not upload or physically store files yet.
        </p>
      </div>
    );
  }

  function renderMaterialUsagePanel(job, calc) {
    const draft = getMaterialUsageDraft(job.id);
    const selectedItem = inventoryItems.find((item) => item.id === draft.itemId);
    const usageEvents = getJobMaterialUsage(job);

    return (
      <div className="form-card">
        <div className="page-heading-row">
          <div>
            <h3 className="card-title">Job Material Usage</h3>
            <p className="muted-text">
              Deduct inventory directly from this job. Usage logs are linked to {job.jobNumber}.
            </p>
          </div>

          <span className="status-pill">
            <PackageSearch size={14} />
            {usageEvents.length} Usage Log{usageEvents.length === 1 ? "" : "s"}
          </span>
        </div>

        {lowStockItems.length > 0 && (
          <div className="customer-warning-box">
            <strong>
              <AlertTriangle size={18} /> Inventory Warning
            </strong>
            <p>
              {lowStockItems.length} inventory item{lowStockItems.length === 1 ? "" : "s"} currently at or below reorder threshold.
            </p>
          </div>
        )}

        <div className="form-grid">
          <label className="field">
            <span>Inventory Item</span>
            <select
              value={draft.itemId}
              onChange={(event) => updateMaterialUsageDraft(job.id, "itemId", event.target.value)}
            >
              <option value="">Select inventory item...</option>
              {activeInventoryItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {getInventoryDisplayName(item)} — {item.quantityOnHand} {item.unit}
                  {isLowStock(item) ? " — LOW" : ""}
                </option>
              ))}
            </select>
          </label>

          <Field
            label={selectedItem ? `Quantity Used (${selectedItem.unit})` : "Quantity Used"}
            value={draft.quantityUsed}
            onChange={(value) => updateMaterialUsageDraft(job.id, "quantityUsed", value)}
          />

          <label className="field">
            <span>Usage Type</span>
            <select
              value={draft.usageType}
              onChange={(event) => updateMaterialUsageDraft(job.id, "usageType", event.target.value)}
            >
              <option value="Estimated Job Usage">Estimated Job Usage</option>
              <option value="Stock Used">Stock Used</option>
              <option value="Waste / Failed Print">Waste / Failed Print</option>
              <option value="Correction">Correction</option>
            </select>
          </label>
        </div>

        {selectedItem && (
          <div className="job-summary-grid single-row-gap">
            <div>
              <span>Selected Stock</span>
              <strong>{selectedItem.quantityOnHand} {selectedItem.unit}</strong>
            </div>

            <div>
              <span>Reorder Threshold</span>
              <strong>{selectedItem.reorderThreshold} {selectedItem.unit}</strong>
            </div>

            <div>
              <span>Unit Cost</span>
              <strong>{money(selectedItem.unitCost)}</strong>
            </div>

            <div>
              <span>Estimated Usage Cost</span>
              <strong>{money(num(draft.quantityUsed) * num(selectedItem.unitCost))}</strong>
            </div>
          </div>
        )}

        <label className="field single-row-gap">
          <span>Usage Notes</span>
          <textarea
            value={draft.notes}
            onChange={(event) => updateMaterialUsageDraft(job.id, "notes", event.target.value)}
            placeholder="Used 87g black PETG for final print, failed print waste, engraving blanks used, vinyl sheet used, etc."
          />
        </label>

        <button
          className="primary-button single-row-gap"
          type="button"
          onClick={() => logMaterialUsage(job.id)}
        >
          <PackageSearch size={18} />
          Deduct Inventory for {job.jobNumber}
        </button>

        <div className="job-summary-grid single-row-gap">
          <div>
            <span>Logged Material Cost</span>
            <strong>{money(calc.loggedMaterialCost)}</strong>
          </div>

          <div>
            <span>Manual Material Cost</span>
            <strong>{money(calc.manualMaterialCost)}</strong>
          </div>

          <div>
            <span>Material Cost Used</span>
            <strong>{money(calc.materialCost)}</strong>
          </div>
        </div>

        {usageEvents.length === 0 ? (
          <p className="muted-text single-row-gap">No job-linked material usage yet.</p>
        ) : (
          <div className="dashboard-list single-row-gap">
            {usageEvents.map((usage) => (
              <div className="dashboard-list-row" key={usage.id}>
                <div>
                  <strong>{usage.itemName}</strong>
                  <span>
                    {usage.usageType} • {usage.quantityUsed} {usage.unit} • {money(usage.estimatedCost)}
                  </span>
                  {usage.notes && <small>{usage.notes}</small>}
                </div>

                <div className="dashboard-status-stack">
                  <span>{new Date(usage.createdAt).toLocaleString()}</span>
                  <button
                    className="secondary-button danger-button"
                    type="button"
                    onClick={() => removeMaterialUsageEvent(job.id, usage.id)}
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="helper-note">
          Removing a job usage record does not restore inventory automatically. Use Inventory → Adjustment if stock needs to be corrected.
        </p>
      </div>
    );
  }

  function renderJobCard(job) {
    const actuals = {
      materialCost: 0,
      failedPrintCost: 0,
      extraCost: 0,
      notes: "",
      ...(job.actuals || {}),
    };

    const payments = {
      depositPaid: 0,
      additionalPaid: 0,
      paymentMethod: "Venmo",
      paymentNotes: "",
      ...(job.payments || {}),
    };

    const timeEvents = sortEventsOldestFirst((job.timeEvents || []).map(normalizeOldEvent));
    const machineOptions = buildMachineOptions(job);
    const openTimers = getOpenTimers(timeEvents);
    const attachments = getJobAttachments(job);
    const calc = calculateJobActuals({
      ...job,
      actuals,
      payments,
      timeEvents,
    });

    const isExpanded = expandedJobId === job.id;
    const paymentStatus = getPaymentStatus(job);
    const dueStatus = getDueDateStatus(job);
    const priority = getPriority(job);
    const archiveInfo = getArchiveDeleteInfo(job);
    const remainingBalance = getRemainingBalance(job);

    return (
      <article
        className={`job-detail-card expandable-job-card ${isExpanded ? "expanded" : ""} ${
          job.archived ? "archived-job-card" : ""
        }`}
        key={job.id}
      >
        <button
          className="job-list-header"
          type="button"
          onClick={() => setExpandedJobId(isExpanded ? "" : job.id)}
        >
          <div className="job-list-main">
            <strong>{job.jobNumber}</strong>
            <span>{job.customerName || "No Customer Name"}</span>
            <small>{job.jobName || "Untitled Job"}</small>
          </div>

          <div className="job-list-meta">
            {job.archived && <span className="archive-pill">Archived</span>}

            {openTimers.length > 0 && (
              <span className="status-pill">{openTimers.length} Timer Active</span>
            )}

            {getJobMaterialUsage(job).length > 0 && (
              <span className="status-pill">
                {getJobMaterialUsage(job).length} Material Log
                {getJobMaterialUsage(job).length === 1 ? "" : "s"}
              </span>
            )}

            {attachments.length > 0 && (
              <span className="status-pill">
                {attachments.length} Attachment{attachments.length === 1 ? "" : "s"}
              </span>
            )}

            <span className="status-pill">{priority}</span>

            <span className="status-pill">
              {job.dueDate ? `${job.dueDate} • ${dueStatus.label}` : dueStatus.label}
            </span>

            <span className={`payment-status-pill payment-${slug(paymentStatus)}`}>
              {paymentStatus}
            </span>

            <span className={`job-status-button status-${slug(job.status || "Approved")}`}>
              {job.status || "Approved"}
            </span>

            <strong>{money(job.finalTotal)}</strong>

            <ChevronDown
              size={20}
              className={`job-expand-icon ${isExpanded ? "open" : ""}`}
            />
          </div>
        </button>

        {isExpanded && (
          <div className="job-expanded-body">
            <div className="record-card-top">
              <div>
                <h3>{job.jobNumber}</h3>
                <p>{job.customerName || "No Customer Name"}</p>
              </div>

              <div className="job-status-control-group">
                <span className="status-pill">{priority}</span>

                <span className="status-pill">
                  {job.dueDate ? `${job.dueDate} • ${dueStatus.label}` : dueStatus.label}
                </span>

                <span className={`payment-status-pill payment-${slug(paymentStatus)}`}>
                  {paymentStatus}
                </span>

                <label className="field compact-status-field">
                  <select
                    className={`status-pill status-${slug(job.status || "Approved")}`}
                    value={job.status || "Approved"}
                    onChange={(event) =>
                      onUpdateJob(job.id, {
                        status: event.target.value,
                      })
                    }
                  >
                    {JOB_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="record-title">{job.jobName || "Untitled Job"}</div>

            {openTimers.length > 0 && (
              <div className="customer-warning-box">
                <strong>
                  <Play size={18} /> Active Timer{openTimers.length === 1 ? "" : "s"}
                </strong>
                <p>
                  {openTimers
                    .map((timer) => `${timer.type} — ${timer.label || "General"}`)
                    .join(", ")}
                </p>
              </div>
            )}

            {job.status === "Completed" && (
              <div className="customer-warning-box">
                <strong>
                  <CheckCircle size={18} /> Job Completed
                </strong>
                <p>
                  Completed {job.completedAt ? new Date(job.completedAt).toLocaleString() : "recently"}.
                  {remainingBalance > 0
                    ? ` Remaining balance: ${money(remainingBalance)}.`
                    : " No remaining balance."}
                </p>
              </div>
            )}

            {job.archived && (
              <div className="customer-warning-box">
                <strong>
                  <Archive size={18} /> Archived Job
                </strong>
                <p>
                  {archiveInfo.label}. This is a warning only — jobs are not auto-deleted unless you delete them manually.
                </p>
              </div>
            )}

            <div className="form-card single-row-gap">
              <h3 className="card-title">Production Queue Controls</h3>

              <div className="form-grid">
                <label className="field">
                  <span>Priority</span>
                  <select
                    value={priority}
                    onChange={(event) =>
                      onUpdateJob(job.id, {
                        priority: event.target.value,
                      })
                    }
                  >
                    {PRIORITY_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>

                <Field
                  label="Due Date"
                  type="date"
                  value={job.dueDate || ""}
                  onChange={(value) =>
                    onUpdateJob(job.id, {
                      dueDate: value,
                    })
                  }
                />

                <Field
                  label="Archive Eligible Date"
                  type="date"
                  value={job.archiveEligibleAt ? job.archiveEligibleAt.slice(0, 10) : ""}
                  onChange={(value) =>
                    onUpdateJob(job.id, {
                      archiveEligibleAt: value ? `${value}T00:00:00.000Z` : "",
                    })
                  }
                />

                <Field
                  label="Internal Queue Notes"
                  type="text"
                  value={job.queueNotes || ""}
                  onChange={(value) =>
                    onUpdateJob(job.id, {
                      queueNotes: value,
                    })
                  }
                />
              </div>

              <p className="helper-note">
                Active jobs are sorted by overdue status, priority, due date, then latest update.
              </p>
            </div>

            <div className="record-tags">
              {job.jobAspects?.cad && <span>CAD</span>}
              {job.jobAspects?.printing && <span>3D Printing</span>}
              {job.jobAspects?.engraving && <span>Engraving</span>}
              {job.jobAspects?.vinyl && <span>Vinyl</span>}
              {job.jobAspects?.custom && <span>Custom</span>}
              {job.importedFromPdf && <span>Imported PDF</span>}
              {job.archived && <span>Archived</span>}
              {priority && <span>{priority} Priority</span>}
              {job.dueDate && <span>Due {job.dueDate}</span>}
              {dueStatus.isOverdue && <span>{dueStatus.label}</span>}
              {openTimers.length > 0 && <span>{openTimers.length} Active Timer(s)</span>}
              {getJobMaterialUsage(job).length > 0 && (
                <span>{getJobMaterialUsage(job).length} Material Usage Log(s)</span>
              )}
              {attachments.length > 0 && (
                <span>{attachments.length} Attachment(s)</span>
              )}
            </div>

            {job.queueNotes && <p className="helper-note">Queue Notes: {job.queueNotes}</p>}

            <div className="record-button-row job-action-row">
              <button className="primary-button record-action" onClick={() => saveJob(job.id)}>
                <Save size={18} />
                Save Job Changes
              </button>

              <button className="secondary-button record-action" onClick={() => markJobCompleted(job.id)}>
                <CheckCircle size={18} />
                Mark Completed
              </button>

              <button className="secondary-button record-action" onClick={() => exportInvoicePdf(job)}>
                <FileDown size={18} />
                Export Invoice
              </button>

              <button className="secondary-button record-action" onClick={() => exportProductionSheetPdf(job)}>
                <ClipboardList size={18} />
                Production Sheet
              </button>

              <button className="secondary-button record-action" onClick={() => onDuplicateJob(job.id)}>
                <Copy size={18} />
                Duplicate Job
              </button>

              {!job.archived ? (
                <button className="secondary-button record-action" onClick={() => onArchiveJob(job.id)}>
                  <Archive size={18} />
                  Archive Job
                </button>
              ) : (
                <button className="secondary-button record-action" onClick={() => onRestoreJob(job.id)}>
                  <RotateCcw size={18} />
                  Restore Job
                </button>
              )}

              <button className="secondary-button danger-button record-action" onClick={() => onDeleteJob(job.id)}>
                <Trash2 size={18} />
                Delete Job
              </button>
            </div>

            {job.lastSavedAt && (
              <p className="helper-note">
                Last saved: {new Date(job.lastSavedAt).toLocaleString()}
              </p>
            )}

            {job.archivedAt && (
              <p className="helper-note">
                Archived: {new Date(job.archivedAt).toLocaleString()}
              </p>
            )}

            <div className="job-summary-grid">
              <div><span>Quoted Total</span><strong>{money(job.finalTotal)}</strong></div>
              <div><span>Actual Cost</span><strong>{money(calc.totalActualCost)}</strong></div>
              <div><span>Estimated Profit</span><strong>{money(calc.estimatedProfit)}</strong></div>
              <div><span>Profit Margin</span><strong>{calc.profitMargin.toFixed(1)}%</strong></div>
              <div><span>Machine Hours</span><strong>{calc.machineHours.toFixed(2)}</strong></div>
              <div><span>CAD Hours</span><strong>{calc.cadHours.toFixed(2)}</strong></div>
              <div><span>Labor / Other Hours</span><strong>{calc.laborHours.toFixed(2)}</strong></div>
              <div><span>Material Cost</span><strong>{money(calc.materialCost)}</strong></div>
              <div><span>Total Paid</span><strong>{money(calc.totalPaid)}</strong></div>
              <div><span>Remaining</span><strong>{money(calc.remainingToCollect)}</strong></div>
              <div><span>Active Timers</span><strong>{openTimers.length}</strong></div>
              <div><span>Attachments</span><strong>{attachments.length}</strong></div>
            </div>

            {renderAttachmentsPanel(job)}
            {renderMaterialUsagePanel(job, calc)}

            <div className="form-card">
              <div className="page-heading-row">
                <div>
                  <h3 className="card-title">Timer Shortcuts</h3>
                  <p className="muted-text">
                    These buttons create normal Started/Stopped production log events. Manual entries below still work exactly the same.
                  </p>
                </div>

                {openTimers.length > 0 && (
                  <button className="secondary-button" onClick={() => stopAllTimers(job.id)}>
                    <Square size={18} />
                    Stop All Timers
                  </button>
                )}
              </div>

              <div className="record-button-row job-action-row">
                {QUICK_TIMER_TYPES.map((type) => (
                  <button
                    key={type}
                    className="secondary-button"
                    type="button"
                    onClick={() => startTimer(job.id, type, "")}
                  >
                    <Play size={18} />
                    Start {type}
                  </button>
                ))}
              </div>

              {openTimers.length > 0 && (
                <div className="vinyl-lines single-row-gap">
                  {openTimers.map((timer) => (
                    <div className="vinyl-line" key={timer.key}>
                      <div className="vinyl-line-header">
                        <strong>{timer.type}</strong>
                        <span>{timer.label || "General"}</span>
                      </div>

                      <p className="helper-note">
                        Started {timer.event.date || "No date"} at {timer.event.time || "No time"}.
                      </p>

                      <button
                        className="primary-button single-row-gap"
                        type="button"
                        onClick={() => stopTimer(job.id, timer)}
                      >
                        <Square size={18} />
                        Stop Timer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-card">
              <div className="page-heading-row">
                <div>
                  <h3 className="card-title">Manual Production Log</h3>
                  <p className="muted-text">
                    Manual entries and timer-created entries live together. You can edit timer-created dates/times if needed.
                  </p>
                </div>

                <button className="secondary-button" onClick={() => addTimeEvent(job.id)}>
                  <Plus size={18} />
                  Add Manual Event
                </button>
              </div>

              <div className="vinyl-lines">
                {timeEvents.length === 0 ? (
                  <p className="muted-text">No production events yet.</p>
                ) : (
                  timeEvents.map((event, index) => (
                    <div className="vinyl-line" key={event.id}>
                      <div className="vinyl-line-header">
                        <strong>Event {index + 1}</strong>
                        <span>
                          {event.action}
                          {event.createdByTimer ? " • Timer" : " • Manual"}
                        </span>
                      </div>

                      <div className="form-grid">
                        <label className="field">
                          <span>Type</span>
                          <select
                            value={event.type}
                            onChange={(change) =>
                              updateTimeEvent(job.id, event.id, "type", change.target.value)
                            }
                          >
                            {EVENT_TYPES.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </label>

                        <label className="field">
                          <span>Action</span>
                          <select
                            value={event.action}
                            onChange={(change) =>
                              updateTimeEvent(job.id, event.id, "action", change.target.value)
                            }
                          >
                            {EVENT_ACTIONS.map((action) => (
                              <option key={action} value={action}>{action}</option>
                            ))}
                          </select>
                        </label>

                        <Field
                          label="Date"
                          type="date"
                          value={event.date}
                          onChange={(value) =>
                            updateTimeEvent(job.id, event.id, "date", value)
                          }
                        />

                        <Field
                          label="Time"
                          type="time"
                          value={event.time}
                          onChange={(value) =>
                            updateTimeEvent(job.id, event.id, "time", value)
                          }
                        />

                        <label className="field">
                          <span>Machine / Task</span>
                          <select
                            value={event.label}
                            onChange={(change) =>
                              updateTimeEvent(job.id, event.id, "label", change.target.value)
                            }
                          >
                            {machineOptions.map((option) => (
                              <option key={option.value || "general"} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <Field
                          label="Rate ($/hr)"
                          value={event.rate}
                          onChange={(value) =>
                            updateTimeEvent(job.id, event.id, "rate", value)
                          }
                        />

                        <button
                          className="secondary-button danger-button"
                          onClick={() => removeTimeEvent(job.id, event.id)}
                          type="button"
                        >
                          <Trash2 size={18} />
                          Remove
                        </button>
                      </div>

                      <label className="field single-row-gap">
                        <span>Notes</span>
                        <textarea
                          value={event.notes}
                          onChange={(change) =>
                            updateTimeEvent(job.id, event.id, "notes", change.target.value)
                          }
                          placeholder="P1S started, H2S laser stopped, CAD revision started, customer requested change, etc."
                        />
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="form-card single-row-gap">
              <h3 className="card-title">Calculated Time Pairs</h3>

              {calc.pairedEvents.length === 0 ? (
                <p className="muted-text">No completed start/stop pairs yet.</p>
              ) : (
                <div className="breakdown-list">
                  {calc.pairedEvents.map((pair, index) => (
                    <div key={`${pair.key}-${index}`}>
                      <span>{pair.type} — {pair.label}</span>
                      <strong>{pair.hours.toFixed(2)} hr / {money(pair.cost)}</strong>
                    </div>
                  ))}
                </div>
              )}

              {openTimers.length > 0 && (
                <p className="helper-note">
                  <AlertTriangle size={14} /> Open timers are not included in calculated totals until stopped.
                </p>
              )}
            </div>

            <div className="job-sections-grid single-row-gap">
              <div className="form-card">
                <h3 className="card-title">Actual Extra Costs</h3>

                <div className="form-grid">
                  <Field
                    label="Actual Material Cost"
                    value={actuals.materialCost}
                    onChange={(value) => updateActual(job.id, "materialCost", value)}
                  />

                  <Field
                    label="Failed Print / Waste Cost"
                    value={actuals.failedPrintCost}
                    onChange={(value) => updateActual(job.id, "failedPrintCost", value)}
                  />

                  <Field
                    label="Extra Costs"
                    value={actuals.extraCost}
                    onChange={(value) => updateActual(job.id, "extraCost", value)}
                  />
                </div>

                <label className="field single-row-gap">
                  <span>Actual Notes</span>
                  <textarea
                    value={actuals.notes}
                    onChange={(event) => updateActual(job.id, "notes", event.target.value)}
                    placeholder="Failed prints, support cleanup, material changes, customer changes, etc."
                  />
                </label>
              </div>

              <div className="form-card">
                <h3 className="card-title">Legacy Quick Payments</h3>

                <div className="form-grid">
                  <Field
                    label="Deposit Paid"
                    value={payments.depositPaid}
                    onChange={(value) => updatePayment(job.id, "depositPaid", value)}
                  />

                  <Field
                    label="Additional Paid"
                    value={payments.additionalPaid}
                    onChange={(value) => updatePayment(job.id, "additionalPaid", value)}
                  />

                  <label className="field">
                    <span>Payment Method</span>
                    <select
                      value={payments.paymentMethod}
                      onChange={(event) => updatePayment(job.id, "paymentMethod", event.target.value)}
                    >
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field single-row-gap">
                  <span>Payment Notes</span>
                  <textarea
                    value={payments.paymentNotes}
                    onChange={(event) => updatePayment(job.id, "paymentNotes", event.target.value)}
                    placeholder="Main payment tracking now lives in the Payments tab."
                  />
                </label>

                <p className="helper-note">
                  Main payment ledger is in the Payments tab. These fields are kept for older jobs and quick notes.
                </p>
              </div>
            </div>
          </div>
        )}
      </article>
    );
  }

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Jobs</h2>
          <p className="muted-text">
            Active work queue with production logs, timers, job-linked inventory,
            attachments, priority, due dates, production sheets, archiving,
            search, filters, payments, and status tracking.
          </p>

          {importMessage && <p className="helper-note">{importMessage}</p>}
        </div>

        <div>
          <input
            ref={fileInputRef}
            className="hidden-file-input"
            type="file"
            accept="application/pdf"
            onChange={handleImportChange}
          />

          <button
            className="secondary-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={18} />
            Import Invoice PDF
          </button>
        </div>
      </div>

      <div className="filter-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            type="search"
            value={searchTerm}
            placeholder="Search jobs, customers, due dates, attachments, file names, URLs, quote numbers, or invoice numbers..."
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <label className="filter-select-field">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="All">All Statuses</option>
            {JOB_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>

        <label className="filter-select-field">
          <span>Payment</span>
          <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
            {PAYMENT_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status === "All" ? "All Payments" : status}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-select-field">
          <span>Priority</span>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            {PRIORITY_FILTERS.map((priority) => (
              <option key={priority} value={priority}>
                {priority === "All" ? "All Priorities" : priority}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-select-field">
          <span>Due Date</span>
          <select value={dueDateFilter} onChange={(event) => setDueDateFilter(event.target.value)}>
            {DUE_DATE_FILTERS.map((filter) => (
              <option key={filter} value={filter}>{filter}</option>
            ))}
          </select>
        </label>

        <button className="secondary-button filter-clear-button" onClick={clearFilters}>
          Clear
        </button>
      </div>

      <div className="job-queue-summary">
        <div><span>Active Jobs</span><strong>{activeJobs.length}</strong></div>
        <div><span>Matching Active</span><strong>{filteredActiveJobs.length}</strong></div>
        <div><span>Overdue</span><strong>{overdueCount}</strong></div>
        <div><span>Due Soon</span><strong>{dueSoonCount}</strong></div>
        <div><span>Rush Jobs</span><strong>{rushCount}</strong></div>
        <div><span>High Priority</span><strong>{highPriorityCount}</strong></div>
        <div><span>Active Timers</span><strong>{activeTimerCount}</strong></div>
        <div><span>Low Stock</span><strong>{lowStockItems.length}</strong></div>
        <div><span>Attachments</span><strong>{attachmentCount}</strong></div>
        <div><span>Archived Jobs</span><strong>{archivedJobs.length}</strong></div>
        <div>
          <span>Active Value</span>
          <strong>{money(activeJobs.reduce((sum, job) => sum + num(job.finalTotal), 0))}</strong>
        </div>
      </div>

      {activeJobs.length === 0 ? (
        <div className="empty-state">
          <h3>No active jobs yet.</h3>
          <p>Convert an approved quote into a job to begin production tracking.</p>
        </div>
      ) : filteredActiveJobs.length === 0 ? (
        <div className="empty-state">
          <h3>No matching active jobs.</h3>
          <p>Try a different search term, job status, payment status, priority, due date, or attachment search.</p>
        </div>
      ) : (
        <div className="jobs-stack">
          <h3 className="card-title">Active Jobs</h3>
          {filteredActiveJobs.map(renderJobCard)}
        </div>
      )}

      <div className="archived-jobs-section">
        <button
          className="secondary-button archive-toggle-button"
          type="button"
          onClick={() => setShowArchived(!showArchived)}
        >
          <Archive size={18} />
          {showArchived
            ? "Hide Archived Jobs"
            : `Show Archived Jobs (${filteredArchivedJobs.length}/${archivedJobs.length})`}
        </button>

        {showArchived && (
          <div className="jobs-stack single-row-gap">
            {archivedJobs.length === 0 ? (
              <div className="empty-state">
                <h3>No archived jobs.</h3>
                <p>Completed or cancelled jobs will appear here after archiving.</p>
              </div>
            ) : filteredArchivedJobs.length === 0 ? (
              <div className="empty-state">
                <h3>No matching archived jobs.</h3>
                <p>Try clearing filters or changing your search.</p>
              </div>
            ) : (
              <>
                <h3 className="card-title">Archived Jobs</h3>
                {filteredArchivedJobs.map(renderJobCard)}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}