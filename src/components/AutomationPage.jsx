import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Bell,
  Bot,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Gauge,
  Hammer,
  PackageSearch,
  RefreshCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

const CLOSED_QUOTE_STATUSES = ["Approved", "Declined", "Expired"];
const AUTO_TAGS = {
  vip: "VIP",
  repeat: "Repeat Customer",
  outstanding: "Outstanding Balance",
  inactive: "Inactive Customer",
  quoteFollowup: "Quote Follow-Up",
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

function todayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysFromToday(dateValue) {
  if (!dateValue) return null;
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date - todayStart()) / 1000 / 60 / 60 / 24);
}

function ageDays(value) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000 / 60 / 60 / 24));
}

function getPaidTotal(job) {
  return (job.paymentEvents || []).reduce((sum, payment) => {
    if (payment.type === "Refund") return sum - num(payment.amount);
    return sum + num(payment.amount);
  }, 0);
}

function getRemaining(job) {
  return Math.max(0, num(job.finalTotal) - getPaidTotal(job));
}

function getCustomerKey(record) {
  const email = String(record.customerEmail || record.formData?.customerEmail || "").trim().toLowerCase();
  const phone = String(record.customerPhone || record.formData?.customerPhone || "").replace(/\D/g, "");
  const name = String(record.customerName || record.formData?.customerName || "").trim().toLowerCase();

  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  if (name) return `name:${name}`;
  return "";
}

function mergeTags(existingTags, newTags) {
  const set = new Set(
    String(existingTags || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  );

  newTags.forEach((tag) => set.add(tag));
  return [...set].join(", ");
}

function getQuoteStatus(quote) {
  return quote.quoteStatus || quote.status || "Draft Quote";
}

function getOpenTimers(job) {
  const sorted = [...(job.timeEvents || [])].sort((a, b) => {
    const aTime = new Date(`${a.date || ""}T${a.time || ""}`).getTime();
    const bTime = new Date(`${b.date || ""}T${b.time || ""}`).getTime();
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return aTime - bTime;
  });

  const open = {};
  sorted.forEach((event) => {
    if (event.action === "Note") return;
    const key = `${event.type || "Other"}__${event.label || "General"}`;
    if (event.action === "Started") open[key] = event;
    if (event.action === "Stopped" && open[key]) delete open[key];
  });

  return Object.entries(open).map(([key, event]) => ({ key, event }));
}

function getJobActualCost(job) {
  const actuals = job.actuals || {};
  const materialUsageCost = (job.materialUsageEvents || []).reduce(
    (sum, usage) => sum + num(usage.estimatedCost),
    0
  );

  return (
    Math.max(num(actuals.materialCost), materialUsageCost) +
    num(actuals.failedPrintCost) +
    num(actuals.extraCost)
  );
}

function buildCustomerSummaries(quotes, jobs, customerOverrides, manualCustomers) {
  const map = new Map();

  manualCustomers.forEach((customer) => {
    const key = customer.key || `manual:${customer.id}`;
    map.set(key, {
      key,
      source: "manual",
      name: customer.name || "Manual Customer",
      tags: customer.tags || "",
      latestActivity: customer.updatedAt || customer.createdAt || "",
      quotes: [],
      jobs: [],
      value: 0,
      paid: 0,
      outstanding: 0,
    });
  });

  [...quotes, ...jobs].forEach((record) => {
    const key = getCustomerKey(record);
    if (!key) return;

    const existing = map.get(key) || {
      key,
      source: "generated",
      name: record.customerName || record.formData?.customerName || "Customer",
      tags: customerOverrides[key]?.tags || "",
      latestActivity: "",
      quotes: [],
      jobs: [],
      value: 0,
      paid: 0,
      outstanding: 0,
    };

    const recordDate = record.updatedAt || record.createdAt || record.approvedAt || "";
    if (recordDate && (!existing.latestActivity || new Date(recordDate) > new Date(existing.latestActivity))) {
      existing.latestActivity = recordDate;
    }

    if (record.jobNumber) {
      existing.jobs.push(record);
      existing.value += num(record.finalTotal);
      existing.paid += getPaidTotal(record);
      existing.outstanding += getRemaining(record);
    } else {
      existing.quotes.push(record);
    }

    map.set(key, existing);
  });

  Object.entries(customerOverrides || {}).forEach(([key, override]) => {
    const existing = map.get(key) || {
      key,
      source: "generated",
      name: override.name || "Customer",
      tags: "",
      latestActivity: override.updatedAt || "",
      quotes: [],
      jobs: [],
      value: 0,
      paid: 0,
      outstanding: 0,
    };

    map.set(key, {
      ...existing,
      ...override,
      key,
      tags: override.tags || existing.tags || "",
    });
  });

  return [...map.values()];
}

function buildAutomationInsights({ quotes, jobs, inventoryItems, expenses, customerSummaries }) {
  const insights = [];
  const today = new Date().toISOString().slice(0, 10);

  quotes.forEach((quote) => {
    const status = getQuoteStatus(quote);
    const closed = CLOSED_QUOTE_STATUSES.includes(status);
    const quoteAge = ageDays(quote.sentAt || quote.createdAt || quote.updatedAt);
    const expiresIn = daysFromToday(quote.expiresAt);

    if (!closed && expiresIn !== null && expiresIn < 0) {
      insights.push({
        id: `quote-expired-${quote.id}`,
        type: "Quote Automation",
        severity: "danger",
        icon: FileText,
        title: `${quote.quoteNumber} is past expiration`,
        detail: `${quote.customerName || "No Customer"} • expired ${Math.abs(expiresIn)} day${Math.abs(expiresIn) === 1 ? "" : "s"} ago`,
        action: "Mark expired during Smart Sweep",
      });
    } else if (!closed && quoteAge >= 7) {
      insights.push({
        id: `quote-followup-${quote.id}`,
        type: "CRM Automation",
        severity: quoteAge >= 14 ? "warning" : "normal",
        icon: Bell,
        title: `${quote.quoteNumber} needs follow-up`,
        detail: `${quote.customerName || "No Customer"} • ${quoteAge} days since quote activity`,
        action: "Auto-tag customer for follow-up",
      });
    }
  });

  jobs.forEach((job) => {
    const dueIn = daysFromToday(job.dueDate);
    const remaining = getRemaining(job);
    const actualCost = getJobActualCost(job);
    const revenue = num(job.finalTotal);
    const margin = revenue > 0 ? ((revenue - actualCost) / revenue) * 100 : 0;
    const openTimers = getOpenTimers(job);

    if (!job.archived && dueIn !== null && dueIn < 0 && job.status !== "Completed" && job.status !== "Cancelled") {
      insights.push({
        id: `job-overdue-${job.id}`,
        type: "Job Automation",
        severity: "danger",
        icon: Hammer,
        title: `${job.jobNumber} is overdue`,
        detail: `${job.customerName || "No Customer"} • overdue by ${Math.abs(dueIn)} day${Math.abs(dueIn) === 1 ? "" : "s"}`,
        action: "Smart Sweep will flag as overdue",
      });
    }

    if (!job.archived && dueIn !== null && dueIn >= 0 && dueIn <= 2 && job.status !== "Completed") {
      insights.push({
        id: `job-due-soon-${job.id}`,
        type: "Job Automation",
        severity: "warning",
        icon: Clock,
        title: `${job.jobNumber} is due soon`,
        detail: `${job.customerName || "No Customer"} • due ${dueIn === 0 ? "today" : `in ${dueIn} day${dueIn === 1 ? "" : "s"}`}`,
        action: "Add due-soon flag",
      });
    }

    if (!job.archived && job.status === "Completed" && remaining > 0) {
      insights.push({
        id: `job-balance-${job.id}`,
        type: "Payment Automation",
        severity: "danger",
        icon: CreditCard,
        title: `${job.jobNumber} is completed with balance due`,
        detail: `${money(remaining)} still outstanding`,
        action: "Payment alert stays active",
      });
    }

    if (!job.archived && revenue > 0 && actualCost > 0 && margin < 20) {
      insights.push({
        id: `job-low-margin-${job.id}`,
        type: "Financial Automation",
        severity: margin < 10 ? "danger" : "warning",
        icon: TrendingDown,
        title: `${job.jobNumber} margin is low`,
        detail: `${margin.toFixed(1)}% estimated margin • ${money(revenue - actualCost)} estimated profit`,
        action: "Smart Sweep will flag low-margin job",
      });
    }

    if (openTimers.length > 0) {
      insights.push({
        id: `job-running-${job.id}`,
        type: "Production Automation",
        severity: "normal",
        icon: Zap,
        title: `${job.jobNumber} has active timer${openTimers.length === 1 ? "" : "s"}`,
        detail: `${openTimers.length} running timer${openTimers.length === 1 ? "" : "s"} • ${job.customerName || "No Customer"}`,
        action: "Live timer dock tracks this",
      });
    }

    if (!job.archived && job.status === "Completed" && !job.inventoryDeductedAt && !job.inventoryDeductionSkipped) {
      insights.push({
        id: `job-inventory-finalization-${job.id}`,
        type: "Inventory Automation",
        severity: "warning",
        icon: PackageSearch,
        title: `${job.jobNumber} completed without inventory finalization`,
        detail: "Inventory deduction should be finalized or explicitly skipped.",
        action: "Smart Sweep will keep warning active",
      });
    }
  });

  inventoryItems.forEach((item) => {
    if (item.active === false) return;
    const quantity = num(item.quantityOnHand);
    const threshold = num(item.reorderThreshold);

    if (quantity <= 0) {
      insights.push({
        id: `inventory-out-${item.id}`,
        type: "Inventory Automation",
        severity: "danger",
        icon: PackageSearch,
        title: `${item.name} is out of stock`,
        detail: `${item.category || "Inventory"} • ${item.material || "No material"} • ${item.color || "No color"}`,
        action: "Out-of-stock alert active",
      });
    } else if (threshold > 0 && quantity <= threshold) {
      insights.push({
        id: `inventory-low-${item.id}`,
        type: "Inventory Automation",
        severity: "warning",
        icon: PackageSearch,
        title: `${item.name} is low stock`,
        detail: `${quantity} ${item.unit} remaining • reorder at ${threshold} ${item.unit}`,
        action: "Low-stock alert active",
      });
    }
  });

  customerSummaries.forEach((customer) => {
    const lastActivityAge = ageDays(customer.latestActivity);
    const quoteFollowups = customer.quotes.filter((quote) => {
      const status = getQuoteStatus(quote);
      return !CLOSED_QUOTE_STATUSES.includes(status) && ageDays(quote.sentAt || quote.createdAt) >= 7;
    });

    if (customer.value >= 500 || customer.jobs.length >= 3) {
      insights.push({
        id: `customer-vip-${customer.key}`,
        type: "CRM Automation",
        severity: "normal",
        icon: Users,
        title: `${customer.name} qualifies as VIP/repeat`,
        detail: `${customer.jobs.length} jobs • ${money(customer.value)} lifetime job value`,
        action: "Smart Sweep can auto-tag VIP/repeat",
      });
    }

    if (customer.outstanding > 0) {
      insights.push({
        id: `customer-outstanding-${customer.key}`,
        type: "CRM Automation",
        severity: "warning",
        icon: CreditCard,
        title: `${customer.name} has outstanding balance`,
        detail: `${money(customer.outstanding)} outstanding`,
        action: "Smart Sweep can auto-tag outstanding balance",
      });
    }

    if (quoteFollowups.length > 0) {
      insights.push({
        id: `customer-quote-followup-${customer.key}`,
        type: "CRM Automation",
        severity: "warning",
        icon: Bell,
        title: `${customer.name} needs quote follow-up`,
        detail: `${quoteFollowups.length} quote${quoteFollowups.length === 1 ? "" : "s"} need follow-up`,
        action: "Smart Sweep can auto-tag quote follow-up",
      });
    }

    if (lastActivityAge >= 90 && customer.jobs.length > 0) {
      insights.push({
        id: `customer-inactive-${customer.key}`,
        type: "CRM Automation",
        severity: "normal",
        icon: Clock,
        title: `${customer.name} is inactive`,
        detail: `${lastActivityAge} days since last activity`,
        action: "Smart Sweep can auto-tag inactive customer",
      });
    }
  });

  const unpaidExpenses = expenses.filter((expense) => expense.status === "Planned" || expense.status === "Logged");
  if (unpaidExpenses.length > 0) {
    insights.push({
      id: `expenses-open-${today}`,
      type: "Financial Automation",
      severity: "normal",
      icon: CreditCard,
      title: `${unpaidExpenses.length} expenses are open/planned`,
      detail: `${money(unpaidExpenses.reduce((sum, expense) => sum + num(expense.amount), 0))} not marked paid/cancelled`,
      action: "Financial watchlist active",
    });
  }

  return insights.sort((a, b) => {
    const rank = { danger: 3, warning: 2, normal: 1 };
    return rank[b.severity] - rank[a.severity];
  });
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="dashboard-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {Icon && <Icon size={20} />}
    </div>
  );
}

function AutomationCard({ insight }) {
  const Icon = insight.icon || AlertTriangle;

  return (
    <div className={`automation-card automation-${insight.severity}`}>
      <div>
        <strong>
          <Icon size={16} /> {insight.title}
        </strong>
        <span>{insight.detail}</span>
        <small>{insight.type} • {insight.action}</small>
      </div>
    </div>
  );
}

export default function AutomationPage({
  quotes = [],
  jobs = [],
  inventoryItems = [],
  inventoryLogs = [],
  expenses = [],
  customerOverrides = {},
  manualCustomers = [],
  onUpdateQuoteWorkflow,
  onUpdateJob,
  onUpdateCustomer,
  onUpdateManualCustomer,
}) {
  const [automationLog, setAutomationLog] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("overkill_automation_log") || "[]");
    } catch {
      return [];
    }
  });

  const customerSummaries = useMemo(
    () => buildCustomerSummaries(quotes, jobs, customerOverrides, manualCustomers),
    [quotes, jobs, customerOverrides, manualCustomers]
  );

  const insights = useMemo(
    () => buildAutomationInsights({ quotes, jobs, inventoryItems, inventoryLogs, expenses, customerSummaries }),
    [quotes, jobs, inventoryItems, inventoryLogs, expenses, customerSummaries]
  );

  const dangerCount = insights.filter((item) => item.severity === "danger").length;
  const warningCount = insights.filter((item) => item.severity === "warning").length;
  const normalCount = insights.filter((item) => item.severity === "normal").length;

  const quoteFollowupCount = insights.filter((item) => item.type === "CRM Automation" && item.title.toLowerCase().includes("follow-up")).length;
  const inventoryAlertCount = insights.filter((item) => item.type === "Inventory Automation").length;
  const paymentAlertCount = insights.filter((item) => item.type === "Payment Automation" || item.title.toLowerCase().includes("balance")).length;
  const productionAlertCount = insights.filter((item) => item.type === "Production Automation" || item.type === "Job Automation").length;

  function pushAutomationLog(message, details = "") {
    const nextLog = [
      {
        id: crypto.randomUUID(),
        message,
        details,
        createdAt: new Date().toISOString(),
      },
      ...automationLog,
    ].slice(0, 100);

    setAutomationLog(nextLog);
    localStorage.setItem("overkill_automation_log", JSON.stringify(nextLog));
  }

  function runSmartSweep() {
    const confirmed = window.confirm(
      "Run Smart Sweep?\n\nThis applies safe automation flags/tags only. It will not delete data, charge customers, or send messages."
    );

    if (!confirmed) return;

    let quoteUpdates = 0;
    let jobUpdates = 0;
    let customerUpdates = 0;

    quotes.forEach((quote) => {
      const status = getQuoteStatus(quote);
      const expiresIn = daysFromToday(quote.expiresAt);
      const closed = CLOSED_QUOTE_STATUSES.includes(status);

      if (!closed && expiresIn !== null && expiresIn < 0) {
        onUpdateQuoteWorkflow?.(quote.id, {
          status: "Expired",
          quoteStatus: "Expired",
          expiredAt: new Date().toISOString(),
          automationFlags: {
            ...(quote.automationFlags || {}),
            expiredByDate: true,
          },
        });
        quoteUpdates += 1;
      }
    });

    jobs.forEach((job) => {
      const dueIn = daysFromToday(job.dueDate);
      const actualCost = getJobActualCost(job);
      const revenue = num(job.finalTotal);
      const margin = revenue > 0 && actualCost > 0 ? ((revenue - actualCost) / revenue) * 100 : null;
      const nextFlags = { ...(job.automationFlags || {}) };
      let changed = false;

      if (!job.archived && dueIn !== null && dueIn < 0 && job.status !== "Completed" && job.status !== "Cancelled") {
        nextFlags.overdue = true;
        nextFlags.overdueDays = Math.abs(dueIn);
        changed = true;
      }

      if (!job.archived && dueIn !== null && dueIn >= 0 && dueIn <= 2 && job.status !== "Completed") {
        nextFlags.dueSoon = true;
        nextFlags.dueSoonDays = dueIn;
        changed = true;
      }

      if (margin !== null && margin < 20) {
        nextFlags.lowMargin = true;
        nextFlags.margin = Number(margin.toFixed(1));
        changed = true;
      }

      if (job.status === "Completed" && getRemaining(job) > 0) {
        nextFlags.completedWithBalance = true;
        changed = true;
      }

      if (changed) {
        onUpdateJob?.(job.id, {
          automationFlags: nextFlags,
          automationCheckedAt: new Date().toISOString(),
        });
        jobUpdates += 1;
      }
    });

    customerSummaries.forEach((customer) => {
      const newTags = [];
      const quoteFollowups = customer.quotes.filter((quote) => {
        const status = getQuoteStatus(quote);
        return !CLOSED_QUOTE_STATUSES.includes(status) && ageDays(quote.sentAt || quote.createdAt) >= 7;
      });

      if (customer.value >= 500) newTags.push(AUTO_TAGS.vip);
      if (customer.jobs.length >= 2) newTags.push(AUTO_TAGS.repeat);
      if (customer.outstanding > 0) newTags.push(AUTO_TAGS.outstanding);
      if (quoteFollowups.length > 0) newTags.push(AUTO_TAGS.quoteFollowup);
      if (ageDays(customer.latestActivity) >= 90 && customer.jobs.length > 0) newTags.push(AUTO_TAGS.inactive);

      if (newTags.length === 0) return;

      const mergedTags = mergeTags(customer.tags, newTags);
      const payload = {
        tags: mergedTags,
        automationLastTaggedAt: new Date().toISOString(),
      };

      if (customer.source === "manual") {
        onUpdateManualCustomer?.(customer.key, payload);
      } else {
        onUpdateCustomer?.(customer.key, payload);
      }

      customerUpdates += 1;
    });

    pushAutomationLog(
      "Smart Sweep completed",
      `${quoteUpdates} quote updates • ${jobUpdates} job flags • ${customerUpdates} customer tag updates`
    );
  }

  function autoArchiveEligibleJobs() {
    const eligibleJobs = jobs.filter((job) => {
      if (job.archived) return false;
      if (job.status !== "Completed" && job.status !== "Cancelled") return false;
      if (!job.completedAt) return false;
      return ageDays(job.completedAt) >= 30;
    });

    if (eligibleJobs.length === 0) {
      window.alert("No jobs are eligible for 30-day auto-archive.");
      return;
    }

    const confirmed = window.confirm(
      `Archive ${eligibleJobs.length} completed/cancelled job${eligibleJobs.length === 1 ? "" : "s"} older than 30 days?`
    );

    if (!confirmed) return;

    eligibleJobs.forEach((job) => {
      onUpdateJob?.(job.id, {
        archived: true,
        archivedAt: new Date().toISOString(),
        automationFlags: {
          ...(job.automationFlags || {}),
          autoArchived: true,
        },
      });
    });

    pushAutomationLog("Auto-archive completed", `${eligibleJobs.length} job${eligibleJobs.length === 1 ? "" : "s"} archived.`);
  }

  function clearAutomationLog() {
    const confirmed = window.confirm("Clear the local automation log?");
    if (!confirmed) return;
    setAutomationLog([]);
    localStorage.setItem("overkill_automation_log", JSON.stringify([]));
  }

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Automation</h2>
          <p className="muted-text">
            Smart workflow checks for jobs, quotes, inventory, CRM follow-ups, payments, margins, and production bottlenecks.
          </p>
        </div>

        <div className="record-button-row">
          <button className="primary-button" type="button" onClick={runSmartSweep}>
            <Sparkles size={18} />
            Run Smart Sweep
          </button>

          <button className="secondary-button" type="button" onClick={autoArchiveEligibleJobs}>
            <Archive size={18} />
            Auto-Archive Eligible
          </button>
        </div>
      </div>

      <div className="job-queue-summary">
        <StatCard label="Critical" value={dangerCount} icon={AlertTriangle} />
        <StatCard label="Warnings" value={warningCount} icon={Bell} />
        <StatCard label="Info" value={normalCount} icon={CheckCircle} />
        <StatCard label="Quote Follow-Ups" value={quoteFollowupCount} icon={FileText} />
        <StatCard label="Inventory Alerts" value={inventoryAlertCount} icon={PackageSearch} />
        <StatCard label="Payment Alerts" value={paymentAlertCount} icon={CreditCard} />
        <StatCard label="Production Alerts" value={productionAlertCount} icon={Hammer} />
        <StatCard label="Total Signals" value={insights.length} icon={Bot} />
      </div>

      <div className="automation-grid">
        <div className="form-card automation-main-panel">
          <div className="page-heading-row">
            <div>
              <h3 className="card-title">Smart Notification Feed</h3>
              <p className="muted-text">
                These are generated from current local app data. Smart Sweep only applies safe flags/tags.
              </p>
            </div>
          </div>

          {insights.length === 0 ? (
            <div className="empty-state">
              <h3>No automation issues detected.</h3>
              <p>The system does not see overdue jobs, quote follow-ups, stock issues, payment issues, or bottlenecks right now.</p>
            </div>
          ) : (
            <div className="automation-feed">
              {insights.slice(0, 60).map((insight) => (
                <AutomationCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </div>

        <div className="form-card">
          <h3 className="card-title">Automation Actions</h3>

          <div className="dashboard-list">
            <div className="dashboard-list-row">
              <div>
                <strong><Sparkles size={16} /> Smart Sweep</strong>
                <span>Expires old quotes, flags overdue/due-soon/low-margin jobs, and auto-tags customers.</span>
              </div>
            </div>

            <div className="dashboard-list-row">
              <div>
                <strong><Archive size={16} /> Auto-Archive</strong>
                <span>Archives completed/cancelled jobs that are at least 30 days old.</span>
              </div>
            </div>

            <div className="dashboard-list-row">
              <div>
                <strong><PackageSearch size={16} /> Inventory Watch</strong>
                <span>Low-stock and out-of-stock alerts are generated automatically from inventory thresholds.</span>
              </div>
            </div>

            <div className="dashboard-list-row">
              <div>
                <strong><Gauge size={16} /> Bottleneck Detection</strong>
                <span>Active timers, overdue jobs, and low-margin jobs are flagged for review.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="form-card dashboard-full-span">
          <div className="page-heading-row">
            <div>
              <h3 className="card-title">Automation Log</h3>
              <p className="muted-text">Local history of Smart Sweep and automation actions on this device.</p>
            </div>

            <button className="secondary-button" type="button" onClick={clearAutomationLog}>
              <RefreshCcw size={18} />
              Clear Log
            </button>
          </div>

          {automationLog.length === 0 ? (
            <p className="muted-text">No automation actions have been logged yet.</p>
          ) : (
            <div className="dashboard-list">
              {automationLog.map((log) => (
                <div className="dashboard-list-row" key={log.id}>
                  <div>
                    <strong>{log.message}</strong>
                    <span>{log.details}</span>
                  </div>
                  <span>{formatDateTime(log.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
