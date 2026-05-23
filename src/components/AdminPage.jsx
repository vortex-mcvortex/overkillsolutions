import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Database,
  Download,
  FileWarning,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function clean(value) {
  return String(value || "").trim();
}

function formatDateTime(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString();
}

function isValidDate(value) {
  if (!value) return true;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function getRecordCustomerKey(record) {
  const email = clean(record.customerEmail || record.formData?.customerEmail).toLowerCase();
  const phone = clean(record.customerPhone || record.formData?.customerPhone).replace(/\D/g, "");
  const name = clean(record.customerName || record.formData?.customerName).toLowerCase();

  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  if (name) return `name:${name}`;
  return "";
}

function getRecordName(record) {
  return clean(record.customerName || record.formData?.customerName);
}

function getRecordPhone(record) {
  return clean(record.customerPhone || record.formData?.customerPhone);
}

function getRecordEmail(record) {
  return clean(record.customerEmail || record.formData?.customerEmail);
}

function getPaymentTotal(job) {
  return (job.paymentEvents || []).reduce((sum, payment) => {
    if (payment.type === "Refund") return sum - num(payment.amount);
    return sum + num(payment.amount);
  }, 0);
}

function hasPublicIdentity(record) {
  return Boolean(
    record.publicId ||
      record.publicRecordId ||
      record.portalId ||
      record.portalAccessId ||
      record.customerAccessToken ||
      record.accessToken
  );
}

function hasCustomerVisibleStatus(record) {
  return Boolean(record.customerVisibleStatus || record.publicStatus || record.portalStatus);
}

function getDefaultCustomerVisibleStatus(record) {
  if (record.jobNumber) {
    if (record.status === "Completed") return "Completed";
    if (record.status === "Ready for Pickup") return "Ready for Pickup";
    if (record.status === "Ready to Ship") return "Ready to Ship";
    if (record.status === "Cancelled") return "Cancelled";
    return "In Production";
  }

  const quoteStatus = record.quoteStatus || record.status || "Draft Quote";
  if (quoteStatus === "Approved") return "Approved";
  if (quoteStatus === "Declined") return "Declined";
  if (quoteStatus === "Expired") return "Expired";
  if (quoteStatus === "Sent") return "Awaiting Approval";
  return "Draft";
}

function createPublicPatch(record) {
  const prefix = record.jobNumber ? "job" : "quote";
  const recordNumber = record.recordNumber || String(record.jobNumber || record.quoteNumber || crypto.randomUUID()).replace(/\D/g, "") || crypto.randomUUID();

  return {
    publicId: record.publicId || `${prefix}_${recordNumber}_${crypto.randomUUID().slice(0, 8)}`,
    customerAccessToken: record.customerAccessToken || crypto.randomUUID().replaceAll("-", ""),
    customerVisibleStatus: record.customerVisibleStatus || getDefaultCustomerVisibleStatus(record),
    customerVisibleNotes: record.customerVisibleNotes || "",
    internalNotes: record.internalNotes || record.queueNotes || "",
    backendReadyAt: record.backendReadyAt || new Date().toISOString(),
  };
}

function getQuoteAgeDays(quote) {
  if (!quote.createdAt) return 0;
  const created = new Date(quote.createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  return Math.floor((Date.now() - created.getTime()) / 1000 / 60 / 60 / 24);
}

function isExpiredQuoteByDate(quote) {
  if (!quote.expiresAt) return false;
  const status = quote.quoteStatus || quote.status || "Draft Quote";
  if (status === "Expired" || status === "Approved" || status === "Declined") return false;
  const expires = new Date(`${quote.expiresAt}T23:59:59`);
  if (Number.isNaN(expires.getTime())) return false;
  return expires.getTime() < Date.now();
}

function buildDuplicateCustomerGroups(quotes, jobs, manualCustomers) {
  const groups = new Map();

  manualCustomers.forEach((customer) => {
    const key = getRecordCustomerKey({
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
    });
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ type: "Manual", label: customer.name || "Manual Customer", id: customer.id || customer.key });
  });

  [...quotes, ...jobs].forEach((record) => {
    const key = getRecordCustomerKey(record);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      type: record.jobNumber ? "Job" : "Quote",
      label: `${record.jobNumber || record.quoteNumber || "Record"} — ${getRecordName(record) || "No name"}`,
      id: record.id,
    });
  });

  return [...groups.entries()]
    .map(([key, records]) => ({ key, records }))
    .filter((group) => group.records.length > 1)
    .sort((a, b) => b.records.length - a.records.length);
}

function createDiagnosticReport(data) {
  return {
    app: "overkill-solutions-app",
    reportType: "data-health-diagnostics",
    generatedAt: new Date().toISOString(),
    counts: data.counts,
    score: data.score,
    issues: data.issues.map((issue) => ({
      id: issue.id,
      severity: issue.severity,
      category: issue.category,
      title: issue.title,
      detail: issue.detail,
      affectedCount: issue.affected?.length || 0,
      affected: issue.affected || [],
    })),
  };
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function issueRank(issue) {
  const ranks = { danger: 4, warning: 3, info: 2, success: 1 };
  return ranks[issue.severity] || 0;
}

function matchesIssueSearch(issue, searchTerm) {
  const search = searchTerm.trim().toLowerCase();
  if (!search) return true;

  return [
    issue.title,
    issue.detail,
    issue.category,
    issue.severity,
    ...(issue.affected || []).map((item) => `${item.label || ""} ${item.detail || ""}`),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(search));
}

function StatCard({ label, value, icon: Icon, helper }) {
  return (
    <div className="dashboard-stat-card admin-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {helper && <small>{helper}</small>}
      {Icon && <Icon size={20} />}
    </div>
  );
}

export default function AdminPage({
  quotes = [],
  jobs = [],
  inventoryItems = [],
  inventoryLogs = [],
  expenses = [],
  shippingEstimates = [],
  manualCustomers = [],
  customerOverrides = {},
  usedRecordNumbers = [],
  onUpdateQuoteWorkflow,
  onUpdateJob,
  onUpdateCustomer,
  onUpdateManualCustomer,
  onUpdateInventoryItem,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [repairMessage, setRepairMessage] = useState("");

  const diagnostics = useMemo(() => {
    const issues = [];
    const allRecords = [...quotes, ...jobs];

    const missingCustomerRecords = allRecords
      .filter((record) => !getRecordName(record) || (!getRecordPhone(record) && !getRecordEmail(record)))
      .map((record) => ({
        id: record.id,
        label: record.jobNumber || record.quoteNumber || "Record",
        detail: `${getRecordName(record) || "Missing name"} • ${getRecordPhone(record) || "No phone"} • ${getRecordEmail(record) || "No email"}`,
      }));

    if (missingCustomerRecords.length > 0) {
      issues.push({
        id: "missing-customer-info",
        severity: "warning",
        category: "Customers",
        title: "Records missing customer contact info",
        detail: "Some quotes/jobs are missing customer name, phone, or email. This weakens CRM matching and portal readiness.",
        affected: missingCustomerRecords,
      });
    }

    const duplicateCustomerGroups = buildDuplicateCustomerGroups(quotes, jobs, manualCustomers);
    const suspiciousDuplicateGroups = duplicateCustomerGroups.filter((group) => group.records.length > 2);
    if (suspiciousDuplicateGroups.length > 0) {
      issues.push({
        id: "duplicate-customer-groups",
        severity: "info",
        category: "Customers",
        title: "Possible duplicate customer groups",
        detail: "These records share the same email, phone, or name key. Review before exposing customer history in a portal.",
        affected: suspiciousDuplicateGroups.slice(0, 20).map((group) => ({
          id: group.key,
          label: group.key,
          detail: `${group.records.length} matching records`,
        })),
      });
    }

    const invalidDateRecords = [];
    allRecords.forEach((record) => {
      ["createdAt", "updatedAt", "approvedAt", "completedAt", "archivedAt", "expiresAt", "dueDate"].forEach((field) => {
        if (record[field] && !isValidDate(record[field])) {
          invalidDateRecords.push({
            id: `${record.id}-${field}`,
            label: `${record.jobNumber || record.quoteNumber || "Record"} — ${field}`,
            detail: String(record[field]),
          });
        }
      });
    });

    if (invalidDateRecords.length > 0) {
      issues.push({
        id: "invalid-dates",
        severity: "danger",
        category: "Records",
        title: "Invalid dates found",
        detail: "Invalid dates can break sorting, dashboards, automations, and customer-visible timelines.",
        affected: invalidDateRecords,
      });
    }

    const missingPublicIdentity = allRecords
      .filter((record) => !hasPublicIdentity(record) || !hasCustomerVisibleStatus(record))
      .map((record) => ({
        id: record.id,
        label: record.jobNumber || record.quoteNumber || "Record",
        detail: `${!hasPublicIdentity(record) ? "missing public ID/token" : "has public ID/token"} • ${!hasCustomerVisibleStatus(record) ? "missing customer status" : "has customer status"}`,
      }));

    if (missingPublicIdentity.length > 0) {
      issues.push({
        id: "missing-public-fields",
        severity: "warning",
        category: "Backend Prep",
        title: "Records missing public/backend readiness fields",
        detail: "These can be safely repaired by adding public IDs, access tokens, customer-visible status, and note fields.",
        affected: missingPublicIdentity,
        repairType: "public-fields",
      });
    }

    const expiredQuotes = quotes
      .filter(isExpiredQuoteByDate)
      .map((quote) => ({
        id: quote.id,
        label: quote.quoteNumber || "Quote",
        detail: `Expired ${quote.expiresAt} • status is ${quote.quoteStatus || quote.status || "Draft Quote"}`,
      }));

    if (expiredQuotes.length > 0) {
      issues.push({
        id: "expired-quotes-not-marked",
        severity: "warning",
        category: "Quotes",
        title: "Quotes expired by date but not marked expired",
        detail: "These can be marked expired automatically so dashboard warnings and customer-visible status stay accurate.",
        affected: expiredQuotes,
        repairType: "mark-expired-quotes",
      });
    }

    const recordNumbers = new Map();
    allRecords.forEach((record) => {
      if (!record.recordNumber) return;
      if (!recordNumbers.has(record.recordNumber)) recordNumbers.set(record.recordNumber, []);
      recordNumbers.get(record.recordNumber).push(record);
    });
    const duplicateNumbers = [...recordNumbers.entries()]
      .filter(([, records]) => records.length > 1)
      .map(([number, records]) => ({
        id: `record-number-${number}`,
        label: `Record #${number}`,
        detail: records.map((record) => record.jobNumber || record.quoteNumber || record.id).join(", "),
      }));

    if (duplicateNumbers.length > 0) {
      issues.push({
        id: "duplicate-record-numbers",
        severity: "danger",
        category: "Records",
        title: "Duplicate record numbers found",
        detail: "Duplicate record numbers can break quote/job/invoice identity. Review manually before repairing.",
        affected: duplicateNumbers,
      });
    }

    const negativeStock = inventoryItems
      .filter((item) => num(item.quantityOnHand) < 0)
      .map((item) => ({
        id: item.id,
        label: item.name,
        detail: `${item.quantityOnHand} ${item.unit || "units"}`,
      }));

    if (negativeStock.length > 0) {
      issues.push({
        id: "negative-inventory",
        severity: "danger",
        category: "Inventory",
        title: "Inventory items have negative stock",
        detail: "Negative stock usually means usage was deducted without receiving enough inventory first.",
        affected: negativeStock,
      });
    }

    const missingInventoryCosts = inventoryItems
      .filter((item) => item.active !== false && num(item.unitCost) <= 0)
      .map((item) => ({
        id: item.id,
        label: item.name,
        detail: `${item.category || "Inventory"} • ${item.material || "No material"} • ${item.color || "No color"}`,
      }));

    if (missingInventoryCosts.length > 0) {
      issues.push({
        id: "missing-inventory-costs",
        severity: "warning",
        category: "Inventory",
        title: "Active inventory missing unit costs",
        detail: "Missing costs weaken quote accuracy, material analytics, and job profitability.",
        affected: missingInventoryCosts.slice(0, 50),
      });
    }

    const noReorderThresholds = inventoryItems
      .filter((item) => item.active !== false && num(item.reorderThreshold) <= 0)
      .map((item) => ({
        id: item.id,
        label: item.name,
        detail: `${item.quantityOnHand} ${item.unit || "units"} on hand`,
      }));

    if (noReorderThresholds.length > 0) {
      issues.push({
        id: "missing-reorder-thresholds",
        severity: "info",
        category: "Inventory",
        title: "Active inventory missing reorder thresholds",
        detail: "Reorder recommendations work better when active inventory has thresholds.",
        affected: noReorderThresholds.slice(0, 50),
      });
    }

    const unfinalizedInventoryJobs = jobs
      .filter((job) => !job.archived && (job.materialUsageEvents || []).length > 0 && !job.inventoryDeductedAt && !job.inventoryDeductionSkipped)
      .map((job) => ({
        id: job.id,
        label: job.jobNumber || "Job",
        detail: `${job.materialUsageEvents.length} material usage log${job.materialUsageEvents.length === 1 ? "" : "s"} • ${job.status || "Approved"}`,
      }));

    if (unfinalizedInventoryJobs.length > 0) {
      issues.push({
        id: "unfinalized-inventory-jobs",
        severity: "warning",
        category: "Jobs",
        title: "Jobs with material usage not finalized",
        detail: "These jobs have material usage logs but no final inventory completion status.",
        affected: unfinalizedInventoryJobs,
      });
    }

    const completedJobsWithBalance = jobs
      .filter((job) => !job.archived && job.status === "Completed" && Math.max(0, num(job.finalTotal) - getPaymentTotal(job)) > 0)
      .map((job) => ({
        id: job.id,
        label: job.jobNumber || "Job",
        detail: `${money(Math.max(0, num(job.finalTotal) - getPaymentTotal(job)))} remaining • ${job.customerName || "No customer"}`,
      }));

    if (completedJobsWithBalance.length > 0) {
      issues.push({
        id: "completed-jobs-with-balance",
        severity: "danger",
        category: "Payments",
        title: "Completed jobs still have balances",
        detail: "Completed work with unpaid balances should be followed up before archiving.",
        affected: completedJobsWithBalance,
      });
    }

    const oldDraftQuotes = quotes
      .filter((quote) => {
        const status = quote.quoteStatus || quote.status || "Draft Quote";
        return status === "Draft Quote" && getQuoteAgeDays(quote) >= 30;
      })
      .map((quote) => ({
        id: quote.id,
        label: quote.quoteNumber || "Quote",
        detail: `${getQuoteAgeDays(quote)} days old • ${quote.customerName || "No customer"}`,
      }));

    if (oldDraftQuotes.length > 0) {
      issues.push({
        id: "old-draft-quotes",
        severity: "info",
        category: "Quotes",
        title: "Old draft quotes",
        detail: "These may be abandoned estimates or drafts that should be sent, revised, or deleted.",
        affected: oldDraftQuotes,
      });
    }

    const possibleOrphanExpenses = expenses
      .filter((expense) => expense.jobNumber && !jobs.some((job) => job.jobNumber === expense.jobNumber))
      .map((expense) => ({
        id: expense.id,
        label: expense.description || expense.category || "Expense",
        detail: `References ${expense.jobNumber}, but no matching job was found`,
      }));

    if (possibleOrphanExpenses.length > 0) {
      issues.push({
        id: "orphan-expenses",
        severity: "info",
        category: "Expenses",
        title: "Expenses reference missing jobs",
        detail: "These may be typos, deleted jobs, or older imported records.",
        affected: possibleOrphanExpenses,
      });
    }

    if (issues.length === 0) {
      issues.push({
        id: "all-clear",
        severity: "success",
        category: "System",
        title: "No major data health issues detected",
        detail: "Your local data looks clean enough for normal internal use.",
        affected: [],
      });
    }

    const dangerCount = issues.filter((issue) => issue.severity === "danger").length;
    const warningCount = issues.filter((issue) => issue.severity === "warning").length;
    const infoCount = issues.filter((issue) => issue.severity === "info").length;
    const score = Math.max(0, Math.round(100 - dangerCount * 18 - warningCount * 8 - infoCount * 2));

    return {
      issues: issues.sort((a, b) => issueRank(b) - issueRank(a)),
      counts: {
        quotes: quotes.length,
        jobs: jobs.length,
        inventoryItems: inventoryItems.length,
        inventoryLogs: inventoryLogs.length,
        expenses: expenses.length,
        shippingEstimates: shippingEstimates.length,
        manualCustomers: manualCustomers.length,
        customerOverrides: Object.keys(customerOverrides || {}).length,
        usedRecordNumbers: usedRecordNumbers.length,
        danger: dangerCount,
        warning: warningCount,
        info: infoCount,
      },
      score,
    };
  }, [quotes, jobs, inventoryItems, inventoryLogs, expenses, shippingEstimates, manualCustomers, customerOverrides, usedRecordNumbers]);

  const categories = useMemo(() => {
    return ["All", ...new Set(diagnostics.issues.map((issue) => issue.category))];
  }, [diagnostics.issues]);

  const filteredIssues = useMemo(() => {
    return diagnostics.issues.filter((issue) => {
      const severityMatches = severityFilter === "All" || issue.severity === severityFilter;
      const categoryMatches = categoryFilter === "All" || issue.category === categoryFilter;
      return severityMatches && categoryMatches && matchesIssueSearch(issue, searchTerm);
    });
  }, [diagnostics.issues, searchTerm, severityFilter, categoryFilter]);

  function exportDiagnosticsReport() {
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadJson(
      `overkill-diagnostics-${dateStamp}.json`,
      createDiagnosticReport(diagnostics)
    );
  }

  function repairPublicFields() {
    const records = [...quotes, ...jobs].filter((record) => !hasPublicIdentity(record) || !hasCustomerVisibleStatus(record));

    if (records.length === 0) {
      setRepairMessage("No public/backend fields needed repair.");
      return;
    }

    const confirmed = window.confirm(
      `Add public/backend readiness fields to ${records.length} record${records.length === 1 ? "" : "s"}?`
    );

    if (!confirmed) return;

    records.forEach((record) => {
      const patch = createPublicPatch(record);
      if (record.jobNumber) onUpdateJob(record.id, patch);
      else onUpdateQuoteWorkflow(record.id, patch);
    });

    setRepairMessage(`Queued public/backend field repairs for ${records.length} record${records.length === 1 ? "" : "s"}.`);
  }

  function markExpiredQuotes() {
    const expiredQuotes = quotes.filter(isExpiredQuoteByDate);

    if (expiredQuotes.length === 0) {
      setRepairMessage("No expired quotes needed updates.");
      return;
    }

    const confirmed = window.confirm(
      `Mark ${expiredQuotes.length} quote${expiredQuotes.length === 1 ? "" : "s"} as expired?`
    );

    if (!confirmed) return;

    expiredQuotes.forEach((quote) => {
      onUpdateQuoteWorkflow(quote.id, {
        status: "Expired",
        quoteStatus: "Expired",
        expiredAt: quote.expiredAt || new Date().toISOString(),
        customerVisibleStatus: "Expired",
      });
    });

    setRepairMessage(`Queued expiration updates for ${expiredQuotes.length} quote${expiredQuotes.length === 1 ? "" : "s"}.`);
  }

  function setDefaultReorderThresholds() {
    const items = inventoryItems.filter((item) => item.active !== false && num(item.reorderThreshold) <= 0);

    if (items.length === 0) {
      setRepairMessage("No active inventory items needed reorder thresholds.");
      return;
    }

    const confirmed = window.confirm(
      `Set default reorder thresholds on ${items.length} active inventory item${items.length === 1 ? "" : "s"}?\n\nFilament defaults to 250g. Sheet/piece items default to 1.`
    );

    if (!confirmed) return;

    items.forEach((item) => {
      const defaultThreshold = item.unit === "g" || item.category === "Filament" ? 250 : 1;
      onUpdateInventoryItem(item.id, {
        reorderThreshold: defaultThreshold,
      });
    });

    setRepairMessage(`Queued reorder threshold repairs for ${items.length} item${items.length === 1 ? "" : "s"}.`);
  }

  function repairManualCustomerPublicFields() {
    const manualRecords = manualCustomers.filter((customer) => !customer.publicId && !customer.customerAccessToken);

    if (manualRecords.length === 0) {
      setRepairMessage("No manual customer public fields needed repair.");
      return;
    }

    const confirmed = window.confirm(
      `Add internal/public identity fields to ${manualRecords.length} manual customer${manualRecords.length === 1 ? "" : "s"}?`
    );

    if (!confirmed) return;

    manualRecords.forEach((customer) => {
      onUpdateManualCustomer(customer.key, {
        publicId: customer.publicId || `customer_${crypto.randomUUID().slice(0, 12)}`,
        customerAccessToken: customer.customerAccessToken || crypto.randomUUID().replaceAll("-", ""),
        updatedAt: new Date().toISOString(),
      });
    });

    setRepairMessage(`Queued manual customer repairs for ${manualRecords.length} customer${manualRecords.length === 1 ? "" : "s"}.`);
  }

  return (
    <section className="page-panel admin-page">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Admin / Data Maintenance</h2>
          <p className="muted-text">
            Find messy local data before it becomes a portal, automation, or reporting problem. This page is for diagnostics, cleanup, and safe one-click repairs.
          </p>
          {repairMessage && <p className="helper-note">{repairMessage}</p>}
        </div>

        <button className="secondary-button" type="button" onClick={exportDiagnosticsReport}>
          <Download size={18} />
          Export Diagnostics
        </button>
      </div>

      <div className="dashboard-stat-grid admin-health-grid">
        <StatCard label="Data Health" value={`${diagnostics.score}%`} icon={ShieldCheck} helper="Higher is cleaner" />
        <StatCard label="Danger Issues" value={diagnostics.counts.danger} icon={AlertTriangle} />
        <StatCard label="Warnings" value={diagnostics.counts.warning} icon={FileWarning} />
        <StatCard label="Info Items" value={diagnostics.counts.info} icon={ClipboardList} />
        <StatCard label="Quotes" value={diagnostics.counts.quotes} icon={Database} />
        <StatCard label="Jobs" value={diagnostics.counts.jobs} icon={Database} />
        <StatCard label="Inventory Items" value={diagnostics.counts.inventoryItems} icon={Database} />
        <StatCard label="Expenses" value={diagnostics.counts.expenses} icon={Database} />
      </div>

      <div className="form-card admin-repair-card">
        <div className="page-heading-row">
          <div>
            <h3 className="card-title">Safe Repair Tools</h3>
            <p className="muted-text">
              These repairs add missing metadata or update obvious statuses. They do not delete records or merge customers automatically.
            </p>
          </div>
        </div>

        <div className="record-button-row admin-repair-actions">
          <button className="secondary-button" type="button" onClick={repairPublicFields}>
            <Wrench size={18} />
            Add Public Fields
          </button>

          <button className="secondary-button" type="button" onClick={markExpiredQuotes}>
            <RefreshCw size={18} />
            Mark Expired Quotes
          </button>

          <button className="secondary-button" type="button" onClick={setDefaultReorderThresholds}>
            <Sparkles size={18} />
            Default Reorder Thresholds
          </button>

          <button className="secondary-button" type="button" onClick={repairManualCustomerPublicFields}>
            <Wrench size={18} />
            Repair Manual Customers
          </button>
        </div>
      </div>

      <div className="filter-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            type="search"
            value={searchTerm}
            placeholder="Search diagnostics by issue, record, category, severity, or detail..."
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <label className="filter-select-field">
          <span>Severity</span>
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
            <option value="All">All Severities</option>
            <option value="danger">Danger</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
          </select>
        </label>

        <label className="filter-select-field">
          <span>Category</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>

        <div className="filter-count-pill">
          Showing {filteredIssues.length} of {diagnostics.issues.length}
        </div>
      </div>

      <div className="admin-diagnostics-list">
        {filteredIssues.map((issue) => {
          const Icon = issue.severity === "success" ? CheckCircle : issue.severity === "danger" ? AlertTriangle : issue.severity === "warning" ? FileWarning : ClipboardList;

          return (
            <article className={`form-card admin-issue-card admin-issue-${issue.severity}`} key={issue.id}>
              <div className="page-heading-row">
                <div>
                  <h3 className="card-title">
                    <Icon size={18} /> {issue.title}
                  </h3>
                  <p className="muted-text">{issue.detail}</p>
                </div>

                <div className="dashboard-status-stack">
                  <span className="status-pill">{issue.category}</span>
                  <span className={`status-pill admin-severity-${issue.severity}`}>{issue.severity}</span>
                  <strong>{issue.affected?.length || 0}</strong>
                </div>
              </div>

              {issue.affected?.length > 0 && (
                <div className="dashboard-list single-row-gap">
                  {issue.affected.slice(0, 12).map((item) => (
                    <div className="dashboard-list-row" key={item.id || item.label}>
                      <div>
                        <strong>{item.label || item.id}</strong>
                        <span>{item.detail || "No detail"}</span>
                      </div>
                    </div>
                  ))}

                  {issue.affected.length > 12 && (
                    <p className="helper-note">Showing first 12 of {issue.affected.length} affected records. Export diagnostics for the full list.</p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
