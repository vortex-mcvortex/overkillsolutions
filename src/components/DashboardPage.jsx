import {
  AlertTriangle,
  Archive,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Hammer,
  PackageSearch,
  Play,
  TimerOff,
  TrendingUp,
  Gauge,
  Activity,
  User,
  Bot,
  Bell,
} from "lucide-react";

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

function formatDuration(hoursValue) {
  const totalMinutes = Math.max(0, Math.round(num(hoursValue) * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function formatDateTime(value) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString();
}

function getPaidTotal(job) {
  return (job.paymentEvents || []).reduce((sum, payment) => {
    if (payment.type === "Refund") return sum - num(payment.amount);
    return sum + num(payment.amount);
  }, 0);
}

function getDepositPaid(job) {
  return (job.paymentEvents || []).reduce((sum, payment) => {
    if (payment.type !== "Deposit") return sum;
    return sum + num(payment.amount);
  }, 0);
}

function getPaymentSummary(job) {
  const total = num(job.finalTotal);
  const paid = getPaidTotal(job);
  const remaining = Math.max(0, total - paid);
  const suggestedDeposit = num(job.depositAmount || job.totals?.suggestedDeposit);
  const depositPaid = getDepositPaid(job);
  const depositRequired = Boolean(job.depositRequired ?? true);
  const depositDue = depositRequired && suggestedDeposit > 0 && depositPaid < suggestedDeposit;

  let status = "Unpaid";
  if (paid > 0 && paid < total) status = "Partially Paid";
  if (paid >= total) status = paid > total ? "Overpaid" : "Paid";
  if (depositDue && paid <= 0) status = "Deposit Due";

  return {
    total,
    paid,
    remaining,
    suggestedDeposit,
    depositPaid,
    depositRemaining: Math.max(0, suggestedDeposit - depositPaid),
    depositDue,
    status,
  };
}

function getTodayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getDaysFromToday(dateValue) {
  if (!dateValue) return null;

  const today = getTodayStart();
  const target = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(target.getTime())) return null;

  return Math.ceil((target - today) / 1000 / 60 / 60 / 24);
}

function getDueDateStatus(job) {
  if (!job.dueDate) {
    return {
      label: "No due date",
      isOverdue: false,
      isDueSoon: false,
      daysRemaining: null,
    };
  }

  const daysRemaining = getDaysFromToday(job.dueDate);

  if (daysRemaining === null) {
    return {
      label: "Invalid due date",
      isOverdue: false,
      isDueSoon: false,
      daysRemaining: null,
    };
  }

  if (daysRemaining < 0) {
    return {
      label: `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"}`,
      isOverdue: true,
      isDueSoon: false,
      daysRemaining,
    };
  }

  if (daysRemaining === 0) {
    return {
      label: "Due today",
      isOverdue: false,
      isDueSoon: true,
      daysRemaining,
    };
  }

  if (daysRemaining <= 3) {
    return {
      label: `Due in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
      isOverdue: false,
      isDueSoon: true,
      daysRemaining,
    };
  }

  return {
    label: `Due in ${daysRemaining} days`,
    isOverdue: false,
    isDueSoon: false,
    daysRemaining,
  };
}

function getQuoteStatus(quote) {
  return quote.quoteStatus || quote.status || "Draft Quote";
}

function getQuoteAgeDays(quote) {
  if (!quote.createdAt) return 0;

  const created = new Date(quote.createdAt);
  if (Number.isNaN(created.getTime())) return 0;

  const today = getTodayStart();
  created.setHours(0, 0, 0, 0);

  return Math.max(0, Math.floor((today - created) / 1000 / 60 / 60 / 24));
}
function getQuoteExpirationInfo(quote) {
  if (!quote.expiresAt) {
    return {
      label: "No expiration",
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: null,
    };
  }

  const daysRemaining = getDaysFromToday(quote.expiresAt);

  if (daysRemaining === null) {
    return {
      label: "Invalid expiration",
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: null,
    };
  }

  if (daysRemaining < 0) {
    return {
      label: `Expired by date ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} ago`,
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining,
    };
  }

  if (daysRemaining === 0) {
    return {
      label: "Expires today",
      isExpired: false,
      isExpiringSoon: true,
      daysRemaining,
    };
  }

  if (daysRemaining <= 7) {
    return {
      label: `Expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
      isExpired: false,
      isExpiringSoon: true,
      daysRemaining,
    };
  }

  return {
    label: `Expires in ${daysRemaining} days`,
    isExpired: false,
    isExpiringSoon: false,
    daysRemaining,
  };
}

function getOpenTimers(job) {
  const sortedEvents = [...(job.timeEvents || [])].sort((a, b) => {
    const aTime = new Date(`${a.date || ""}T${a.time || ""}`).getTime();
    const bTime = new Date(`${b.date || ""}T${b.time || ""}`).getTime();

    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;

    return aTime - bTime;
  });

  const open = {};

  sortedEvents.forEach((event) => {
    if (event.action === "Note") return;

    const key = `${event.type || "Other"}__${event.label || "General"}`;

    if (event.action === "Started") {
      open[key] = event;
    }

    if (event.action === "Stopped" && open[key]) {
      delete open[key];
    }
  });

  return Object.entries(open).map(([key, event]) => ({
    key,
    event,
    type: event.type || "Other",
    label: event.label || "General",
  }));
}


function getTimerStartDate(timerEvent) {
  if (!timerEvent?.date || !timerEvent?.time) return null;
  const date = new Date(`${timerEvent.date}T${timerEvent.time}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTimerElapsedHours(timerEvent) {
  const startDate = getTimerStartDate(timerEvent);
  if (!startDate) return 0;
  const diffMs = Date.now() - startDate.getTime();
  if (diffMs <= 0) return 0;
  return diffMs / 1000 / 60 / 60;
}

function getLiveTimerCost(timerEvent) {
  return getTimerElapsedHours(timerEvent) * num(timerEvent.rate);
}

function getRuntimeAnalytics(jobs) {
  const machineMap = new Map();
  const operatorMap = new Map();
  let pairedHours = 0;
  let liveHours = 0;
  let liveCost = 0;

  jobs.forEach((job) => {
    (job.timeEvents || []).forEach((event) => {
      const label = event.label || event.type || "General";
      const operator = event.operator || job.operator || "Unassigned";

      if (!machineMap.has(label)) {
        machineMap.set(label, { label, pairedHours: 0, liveHours: 0, cost: 0, activeTimers: 0 });
      }

      if (!operatorMap.has(operator)) {
        operatorMap.set(operator, { operator, pairedHours: 0, liveHours: 0, cost: 0, activeTimers: 0 });
      }
    });

    const openTimers = getOpenTimers(job);
    openTimers.forEach((timer) => {
      const label = timer.label || timer.type || "General";
      const operator = timer.event.operator || job.operator || "Unassigned";
      const hours = getTimerElapsedHours(timer.event);
      const cost = getLiveTimerCost(timer.event);

      liveHours += hours;
      liveCost += cost;

      const machine = machineMap.get(label) || { label, pairedHours: 0, liveHours: 0, cost: 0, activeTimers: 0 };
      machine.liveHours += hours;
      machine.cost += cost;
      machine.activeTimers += 1;
      machineMap.set(label, machine);

      const operatorEntry = operatorMap.get(operator) || { operator, pairedHours: 0, liveHours: 0, cost: 0, activeTimers: 0 };
      operatorEntry.liveHours += hours;
      operatorEntry.cost += cost;
      operatorEntry.activeTimers += 1;
      operatorMap.set(operator, operatorEntry);
    });
  });

  return {
    pairedHours,
    liveHours,
    liveCost,
    machineLeaderboard: [...machineMap.values()]
      .filter((entry) => entry.liveHours > 0 || entry.pairedHours > 0 || entry.activeTimers > 0)
      .sort((a, b) => b.liveHours + b.pairedHours - (a.liveHours + a.pairedHours))
      .slice(0, 10),
    operatorLeaderboard: [...operatorMap.values()]
      .filter((entry) => entry.liveHours > 0 || entry.pairedHours > 0 || entry.activeTimers > 0)
      .sort((a, b) => b.liveHours + b.pairedHours - (a.liveHours + a.pairedHours))
      .slice(0, 10),
  };
}

function getArchiveCleanupInfo(job) {
  if (!job.archivedAt) {
    return {
      label: "Not archived",
      readyForCleanup: false,
      daysArchived: 0,
      daysRemaining: null,
    };
  }

  const archived = new Date(job.archivedAt);
  if (Number.isNaN(archived.getTime())) {
    return {
      label: "Invalid archive date",
      readyForCleanup: false,
      daysArchived: 0,
      daysRemaining: null,
    };
  }

  const today = getTodayStart();
  archived.setHours(0, 0, 0, 0);

  const daysArchived = Math.floor((today - archived) / 1000 / 60 / 60 / 24);
  const daysRemaining = 30 - daysArchived;

  if (daysRemaining <= 0) {
    return {
      label: `Archived ${daysArchived} day${daysArchived === 1 ? "" : "s"} ago — cleanup eligible`,
      readyForCleanup: true,
      daysArchived,
      daysRemaining: 0,
    };
  }

  return {
    label: `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} until cleanup review`,
    readyForCleanup: false,
    daysArchived,
    daysRemaining,
  };
}

function calculateKnownCosts(job) {
  const actuals = job.actuals || {};

  return (
    num(actuals.materialCost) +
    num(actuals.failedPrintCost) +
    num(actuals.extraCost)
  );
}

function isLowStock(item) {
  return (
    item.active !== false &&
    num(item.reorderThreshold) > 0 &&
    num(item.quantityOnHand) <= num(item.reorderThreshold)
  );
}

function isOutOfStock(item) {
  return item.active !== false && num(item.quantityOnHand) <= 0;
}

function getInventoryValue(item) {
  return num(item.quantityOnHand) * num(item.unitCost);
}

function getJobMaterialUsage(job) {
  return job.materialUsageEvents || [];
}

function hasInventoryFinalized(job) {
  return Boolean(job.inventoryDeductedAt || job.inventoryDeductionSkipped);
}

function getMaterialUsageAnalytics(jobs) {
  const usageMap = new Map();

  jobs.forEach((job) => {
    getJobMaterialUsage(job).forEach((usage) => {
      const key = usage.itemId || usage.itemName || "unknown";

      if (!usageMap.has(key)) {
        usageMap.set(key, {
          id: key,
          itemId: usage.itemId,
          itemName: usage.itemName || "Unknown Material",
          category: usage.category || "Other",
          material: usage.material || "",
          color: usage.color || "",
          totalQuantity: 0,
          unit: usage.unit || "",
          totalCost: 0,
          usageCount: 0,
          jobs: new Set(),
          lastUsedAt: "",
        });
      }

      const entry = usageMap.get(key);

      entry.totalQuantity += num(usage.quantityUsed);
      entry.totalCost += num(usage.estimatedCost);
      entry.usageCount += 1;
      entry.unit = entry.unit || usage.unit || "";
      entry.jobs.add(job.jobNumber || job.id);

      if (!entry.lastUsedAt || new Date(usage.createdAt || 0) > new Date(entry.lastUsedAt || 0)) {
        entry.lastUsedAt = usage.createdAt || "";
      }
    });
  });

  return [...usageMap.values()]
    .map((entry) => ({
      ...entry,
      jobCount: entry.jobs.size,
      jobs: [...entry.jobs],
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}
function getReorderRecommendations(inventoryItems, materialAnalytics) {
  const analyticsByItemId = new Map();

  materialAnalytics.forEach((entry) => {
    if (entry.itemId) analyticsByItemId.set(entry.itemId, entry);
  });

  return inventoryItems
    .filter((item) => item.active !== false)
    .map((item) => {
      const analytics = analyticsByItemId.get(item.id);
      const quantityOnHand = num(item.quantityOnHand);
      const reorderThreshold = num(item.reorderThreshold);
      const usedQuantity = num(analytics?.totalQuantity);
      const averageUse =
        analytics && analytics.usageCount > 0
          ? usedQuantity / analytics.usageCount
          : 0;

      const suggestedMinimum =
        reorderThreshold > 0
          ? reorderThreshold * 2
          : item.category === "Filament"
            ? 1000
            : 1;

      const usageBasedTarget =
        averageUse > 0
          ? Math.ceil(averageUse * 3)
          : suggestedMinimum;

      const targetQuantity = Math.max(suggestedMinimum, usageBasedTarget);
      const suggestedReorderQuantity = Math.max(0, targetQuantity - quantityOnHand);

      let urgency = "normal";

      if (quantityOnHand <= 0) urgency = "danger";
      else if (reorderThreshold > 0 && quantityOnHand <= reorderThreshold) urgency = "warning";

      return {
        ...item,
        analytics,
        quantityOnHand,
        reorderThreshold,
        usedQuantity,
        averageUse,
        targetQuantity,
        suggestedReorderQuantity,
        urgency,
      };
    })
    .filter((item) => {
      return (
        item.quantityOnHand <= 0 ||
        (item.reorderThreshold > 0 && item.quantityOnHand <= item.reorderThreshold) ||
        item.suggestedReorderQuantity > 0
      );
    })
    .sort((a, b) => {
      const urgencyRank = { danger: 3, warning: 2, normal: 1 };
      const urgencyDiff = urgencyRank[b.urgency] - urgencyRank[a.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;

      return b.suggestedReorderQuantity - a.suggestedReorderQuantity;
    });
}

function getPendingInventoryJobs(jobs) {
  return jobs.filter((job) => {
    if (job.archived) return false;
    if (job.status === "Completed") return false;
    if (hasInventoryFinalized(job)) return false;

    return getJobMaterialUsage(job).length > 0;
  });
}

function getCompletedInventoryWarningJobs(jobs) {
  return jobs.filter((job) => {
    if (job.archived) return false;
    if (job.status !== "Completed") return false;

    return !hasInventoryFinalized(job);
  });
}

function getRecentActivity(quotes, jobs, inventoryLogs) {
  const activities = [];

  quotes.forEach((quote) => {
    activities.push({
      id: `quote-${quote.id}`,
      type: "Quote",
      title: `${quote.quoteNumber || "Quote"} — ${quote.customerName || "No Customer"}`,
      detail: `${quote.jobName || "Untitled Quote"} • ${getQuoteStatus(quote)} • ${money(quote.finalTotal)}`,
      date: quote.updatedAt || quote.createdAt,
    });

    if (quote.sentAt) {
      activities.push({
        id: `quote-sent-${quote.id}`,
        type: "Quote Sent",
        title: `${quote.quoteNumber} sent`,
        detail: quote.customerName || "No Customer",
        date: quote.sentAt,
      });
    }

    if (quote.approvedAt) {
      activities.push({
        id: `quote-approved-${quote.id}`,
        type: "Quote Approved",
        title: `${quote.quoteNumber} approved`,
        detail: quote.customerName || "No Customer",
        date: quote.approvedAt,
      });
    }
  });

  jobs.forEach((job) => {
    activities.push({
      id: `job-${job.id}`,
      type: "Job",
      title: `${job.jobNumber || "Job"} — ${job.customerName || "No Customer"}`,
      detail: `${job.jobName || "Untitled Job"} • ${job.status || "Approved"} • ${money(job.finalTotal)}`,
      date: job.updatedAt || job.approvedAt || job.createdAt,
    });

    if (job.completedAt) {
      activities.push({
        id: `job-completed-${job.id}`,
        type: "Completed",
        title: `${job.jobNumber} completed`,
        detail: job.jobName || "Untitled Job",
        date: job.completedAt,
      });
    }

    if (job.inventoryDeductedAt) {
      activities.push({
        id: `job-inventory-deducted-${job.id}`,
        type: "Inventory Finalized",
        title: `${job.jobNumber} inventory finalized`,
        detail: job.jobName || "Untitled Job",
        date: job.inventoryDeductedAt,
      });
    }

    if (job.inventoryDeductionSkippedAt) {
      activities.push({
        id: `job-inventory-skipped-${job.id}`,
        type: "Inventory Skipped",
        title: `${job.jobNumber} inventory skipped`,
        detail: job.inventoryDeductionNotes || job.jobName || "Untitled Job",
        date: job.inventoryDeductionSkippedAt,
      });
    }

    if (job.archivedAt) {
      activities.push({
        id: `job-archived-${job.id}`,
        type: "Archived",
        title: `${job.jobNumber} archived`,
        detail: job.jobName || "Untitled Job",
        date: job.archivedAt,
      });
    }

    (job.paymentEvents || []).forEach((payment) => {
      activities.push({
        id: `payment-${job.id}-${payment.id}`,
        type: "Payment",
        title: `${payment.type || "Payment"} — ${job.jobNumber}`,
        detail: `${money(payment.amount)} via ${payment.method || "Unknown"} • ${job.customerName || "No Customer"}`,
        date: `${payment.date || ""}T${payment.time || "00:00"}`,
      });
    });
  });

  inventoryLogs.forEach((log) => {
    activities.push({
      id: `inventory-${log.id}`,
      type: "Inventory",
      title: `${log.type} — ${log.itemName}`,
      detail: `${log.quantityChange > 0 ? "+" : ""}${log.quantityChange} ${log.unit} → ${log.quantityAfter} ${log.unit}${log.jobNumber ? ` • ${log.jobNumber}` : ""}`,
      date: log.createdAt,
    });
  });

  return activities
    .filter((activity) => activity.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 14);
}
function buildNeedsAttention(quotes, jobs, inventoryItems) {
  const items = [];

  const pendingInventoryJobs = getPendingInventoryJobs(jobs);
  const completedInventoryWarningJobs = getCompletedInventoryWarningJobs(jobs);

  pendingInventoryJobs.forEach((job) => {
    items.push({
      id: `pending-inventory-${job.id}`,
      icon: PackageSearch,
      title: `${job.jobNumber} has unfinalized inventory usage`,
      detail: `${getJobMaterialUsage(job).length} material usage log${getJobMaterialUsage(job).length === 1 ? "" : "s"} • ${job.customerName || "No Customer"}`,
      severity: "warning",
    });
  });

  completedInventoryWarningJobs.forEach((job) => {
    items.push({
      id: `completed-inventory-warning-${job.id}`,
      icon: AlertTriangle,
      title: `${job.jobNumber} completed without inventory finalization`,
      detail: `${job.customerName || "No Customer"} • ${job.jobName || "Untitled Job"}`,
      severity: "danger",
    });
  });

  inventoryItems.forEach((item) => {
    if (isOutOfStock(item)) {
      items.push({
        id: `out-stock-${item.id}`,
        icon: PackageSearch,
        title: `${item.name} is out of stock`,
        detail: `${item.category} • ${item.material || "No material"} • ${item.color || "No color"}`,
        severity: "danger",
      });
      return;
    }

    if (isLowStock(item)) {
      items.push({
        id: `low-stock-${item.id}`,
        icon: PackageSearch,
        title: `${item.name} is low stock`,
        detail: `${item.quantityOnHand} ${item.unit} remaining • reorder at ${item.reorderThreshold} ${item.unit}`,
        severity: "warning",
      });
    }
  });

  quotes.forEach((quote) => {
    const status = getQuoteStatus(quote);
    const age = getQuoteAgeDays(quote);
    const expiration = getQuoteExpirationInfo(quote);
    const closed = ["Approved", "Declined", "Expired"].includes(status);

    if (!closed && age >= 14) {
      items.push({
        id: `stale-${quote.id}`,
        icon: AlertTriangle,
        title: `${quote.quoteNumber} is stale`,
        detail: `${quote.customerName || "No Customer"} • ${age} days old • ${quote.jobName || "Untitled Quote"}`,
        severity: "warning",
      });
    }

    if (!closed && expiration.isExpiringSoon) {
      items.push({
        id: `expiring-${quote.id}`,
        icon: Clock,
        title: `${quote.quoteNumber} ${expiration.label.toLowerCase()}`,
        detail: `${quote.customerName || "No Customer"} • ${money(quote.finalTotal)}`,
        severity: "warning",
      });
    }

    if (expiration.isExpired && status !== "Expired") {
      items.push({
        id: `expired-quote-${quote.id}`,
        icon: TimerOff,
        title: `${quote.quoteNumber} expired by date`,
        detail: `${quote.customerName || "No Customer"} • status still says ${status}`,
        severity: "danger",
      });
    }
  });

  jobs.forEach((job) => {
    const due = getDueDateStatus(job);
    const payment = getPaymentSummary(job);
    const openTimers = getOpenTimers(job);
    const archive = getArchiveCleanupInfo(job);

    if (!job.archived && due.isOverdue) {
      items.push({
        id: `overdue-job-${job.id}`,
        icon: AlertTriangle,
        title: `${job.jobNumber} is overdue`,
        detail: `${job.customerName || "No Customer"} • ${due.label} • ${job.jobName || "Untitled Job"}`,
        severity: "danger",
      });
    }

    if (!job.archived && due.isDueSoon) {
      items.push({
        id: `due-soon-${job.id}`,
        icon: Clock,
        title: `${job.jobNumber} ${due.label.toLowerCase()}`,
        detail: `${job.customerName || "No Customer"} • ${job.jobName || "Untitled Job"}`,
        severity: "warning",
      });
    }

    if (!job.archived && openTimers.length > 0) {
      items.push({
        id: `timer-${job.id}`,
        icon: Play,
        title: `${job.jobNumber} has active timer${openTimers.length === 1 ? "" : "s"}`,
        detail: openTimers.map((timer) => `${timer.type} — ${timer.label}`).join(", "),
        severity: "normal",
      });
    }

    if (!job.archived && payment.depositDue) {
      items.push({
        id: `deposit-${job.id}`,
        icon: CreditCard,
        title: `${job.jobNumber} deposit due`,
        detail: `${money(payment.depositRemaining)} deposit remaining • ${job.customerName || "No Customer"}`,
        severity: "warning",
      });
    }

    if (!job.archived && payment.remaining > 0 && job.status === "Completed") {
      items.push({
        id: `balance-${job.id}`,
        icon: CreditCard,
        title: `${job.jobNumber} completed with balance`,
        detail: `${money(payment.remaining)} still outstanding • ${job.customerName || "No Customer"}`,
        severity: "danger",
      });
    }

    if (job.archived && archive.readyForCleanup) {
      items.push({
        id: `archive-cleanup-${job.id}`,
        icon: Archive,
        title: `${job.jobNumber} is cleanup eligible`,
        detail: archive.label,
        severity: "normal",
      });
    }
  });

  return items.slice(0, 18);
}


function getScheduledStart(job) {
  return job.scheduleStart || job.scheduledStart || job.productionStart || "";
}

function getScheduledMachine(job) {
  return job.scheduleMachine || job.assignedMachine || job.machine || "Unassigned";
}

function isScheduledThisWeek(job) {
  const start = getScheduledStart(job);
  if (!start) return false;

  const today = getTodayStart();
  const target = new Date(`${String(start).slice(0, 10)}T00:00:00`);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return !Number.isNaN(target.getTime()) && target >= today && target <= weekEnd;
}

function isScheduledToday(job) {
  const start = getScheduledStart(job);
  if (!start) return false;
  return String(start).slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function isScheduleOverdue(job) {
  const start = getScheduledStart(job);
  if (!start || job.archived || job.status === "Completed") return false;

  const target = new Date(`${String(start).slice(0, 10)}T00:00:00`);
  return !Number.isNaN(target.getTime()) && target < getTodayStart();
}

function getEstimatedScheduleHours(job) {
  if (num(job.estimatedScheduleHours) > 0) return num(job.estimatedScheduleHours);
  const formData = job.quoteSnapshot?.formData || job.formData || {};
  const printRuns = formData.printRuns || [];
  const printHours = printRuns.reduce((sum, run) => sum + num(run.printHours || run.machineHours || run.hours), 0);
  return Math.max(0.25, printHours || num(formData.machineHours) || 1);
}

function getSmartAutomationSignals(quotes, jobs, inventoryItems) {
  const signals = [];
  const closedQuoteStatuses = ["Approved", "Declined", "Expired"];

  quotes.forEach((quote) => {
    const status = getQuoteStatus(quote);
    const age = getQuoteAgeDays(quote);
    const expiration = getQuoteExpirationInfo(quote);

    if (!closedQuoteStatuses.includes(status) && expiration.isExpired) {
      signals.push({
        id: `auto-quote-expired-${quote.id}`,
        severity: "danger",
        title: `${quote.quoteNumber} should be expired`,
        detail: `${quote.customerName || "No Customer"} • ${expiration.label}`,
      });
    } else if (!closedQuoteStatuses.includes(status) && age >= 7) {
      signals.push({
        id: `auto-quote-followup-${quote.id}`,
        severity: age >= 14 ? "warning" : "normal",
        title: `${quote.quoteNumber} needs follow-up`,
        detail: `${quote.customerName || "No Customer"} • ${age} days old`,
      });
    }
  });

  jobs.forEach((job) => {
    const due = getDueDateStatus(job);
    const payment = getPaymentSummary(job);
    const knownCost = calculateKnownCosts(job);
    const revenue = num(job.finalTotal);
    const margin = revenue > 0 && knownCost > 0 ? ((revenue - knownCost) / revenue) * 100 : null;

    if (!job.archived && due.isOverdue && job.status !== "Completed") {
      signals.push({
        id: `auto-job-overdue-${job.id}`,
        severity: "danger",
        title: `${job.jobNumber} is overdue`,
        detail: `${job.customerName || "No Customer"} • ${due.label}`,
      });
    }

    if (!job.archived && due.isDueSoon && job.status !== "Completed") {
      signals.push({
        id: `auto-job-due-${job.id}`,
        severity: "warning",
        title: `${job.jobNumber} is due soon`,
        detail: `${job.customerName || "No Customer"} • ${due.label}`,
      });
    }

    if (!job.archived && payment.remaining > 0 && job.status === "Completed") {
      signals.push({
        id: `auto-job-balance-${job.id}`,
        severity: "danger",
        title: `${job.jobNumber} completed with balance`,
        detail: `${money(payment.remaining)} still outstanding`,
      });
    }

    if (margin !== null && margin < 20) {
      signals.push({
        id: `auto-job-margin-${job.id}`,
        severity: margin < 10 ? "danger" : "warning",
        title: `${job.jobNumber} has low margin`,
        detail: `${margin.toFixed(1)}% estimated margin`,
      });
    }
  });

  inventoryItems.forEach((item) => {
    if (isOutOfStock(item)) {
      signals.push({
        id: `auto-stock-out-${item.id}`,
        severity: "danger",
        title: `${item.name} is out of stock`,
        detail: `${item.category} • ${item.material || "No material"} • ${item.color || "No color"}`,
      });
    } else if (isLowStock(item)) {
      signals.push({
        id: `auto-stock-low-${item.id}`,
        severity: "warning",
        title: `${item.name} is low stock`,
        detail: `${item.quantityOnHand} ${item.unit} remaining`,
      });
    }
  });

  return signals.sort((a, b) => {
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

function ListCard({ title, children }) {
  return (
    <div className="form-card">
      <h3 className="card-title">{title}</h3>
      {children}
    </div>
  );
}

export default function DashboardPage({
  quotes = [],
  jobs = [],
  inventoryItems = [],
  inventoryLogs = [],
  expenses = [],
  suppliers = [],
}) {
  const activeJobs = jobs.filter((job) => !job.archived);
  const archivedJobs = jobs.filter((job) => job.archived);
  const scheduledTodayJobs = activeJobs.filter(isScheduledToday);
  const scheduledThisWeekJobs = activeJobs.filter(isScheduledThisWeek);
  const scheduleOverdueJobs = activeJobs.filter(isScheduleOverdue);
  const scheduledWeekHours = scheduledThisWeekJobs.reduce(
    (sum, job) => sum + getEstimatedScheduleHours(job),
    0
  );

  const openTimerJobs = activeJobs.filter((job) => getOpenTimers(job).length > 0);
  const overdueJobs = activeJobs.filter((job) => getDueDateStatus(job).isOverdue);
  const dueSoonJobs = activeJobs.filter((job) => getDueDateStatus(job).isDueSoon);

  const staleQuotes = quotes.filter((quote) => {
    const status = getQuoteStatus(quote);
    const closed = ["Approved", "Declined", "Expired"].includes(status);
    return !closed && getQuoteAgeDays(quote) >= 14;
  });

  const expiringQuotes = quotes.filter((quote) => {
    const status = getQuoteStatus(quote);
    const closed = ["Approved", "Declined", "Expired"].includes(status);
    return !closed && getQuoteExpirationInfo(quote).isExpiringSoon;
  });

  const expiredQuotes = quotes.filter((quote) => {
    return getQuoteExpirationInfo(quote).isExpired || getQuoteStatus(quote) === "Expired";
  });

  const depositDueJobs = activeJobs.filter((job) => getPaymentSummary(job).depositDue);
  const overdueBalanceJobs = activeJobs.filter((job) => {
    const payment = getPaymentSummary(job);
    return payment.remaining > 0 && job.status === "Completed";
  });

  const archiveReadyJobs = archivedJobs.filter((job) => getArchiveCleanupInfo(job).readyForCleanup);

  const activeInventoryItems = inventoryItems.filter((item) => item.active !== false);
  const lowStockItems = activeInventoryItems.filter(isLowStock);
  const outOfStockItems = activeInventoryItems.filter(isOutOfStock);
  const inventoryValue = inventoryItems.reduce((sum, item) => sum + getInventoryValue(item), 0);

  const materialAnalytics = getMaterialUsageAnalytics(jobs);
  const reorderRecommendations = getReorderRecommendations(inventoryItems, materialAnalytics);
  const pendingInventoryJobs = getPendingInventoryJobs(jobs);
  const completedInventoryWarningJobs = getCompletedInventoryWarningJobs(jobs);

  const totalMaterialUsageCost = materialAnalytics.reduce(
    (sum, material) => sum + num(material.totalCost),
    0
  );

  const totalMaterialUsageEvents = materialAnalytics.reduce(
    (sum, material) => sum + num(material.usageCount),
    0
  );
    const recentInventoryLogs = [...inventoryLogs]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 8);

  const totalQuoted = quotes.reduce((sum, quote) => sum + num(quote.finalTotal), 0);
  const activeJobValue = activeJobs.reduce((sum, job) => sum + num(job.finalTotal), 0);
  const collected = jobs.reduce((sum, job) => sum + getPaidTotal(job), 0);
  const outstanding = jobs.reduce((sum, job) => sum + getPaymentSummary(job).remaining, 0);
  const knownCosts = jobs.reduce((sum, job) => sum + calculateKnownCosts(job), 0);
  const estimatedProfit = activeJobValue - activeJobs.reduce((sum, job) => sum + calculateKnownCosts(job), 0);

  const activeTimerCount = openTimerJobs.reduce(
    (sum, job) => sum + getOpenTimers(job).length,
    0
  );

  const runtimeAnalytics = getRuntimeAnalytics(jobs);
  const activeTimerLiveCost = runtimeAnalytics.liveCost;
  const activeTimerLiveHours = runtimeAnalytics.liveHours;
  const productionEfficiencyScore = activeJobs.length > 0
    ? Math.max(0, Math.min(100, Math.round(100 - overdueJobs.length * 12 - dueSoonJobs.length * 4 + activeTimerCount * 3)))
    : 100;

  const needsAttention = buildNeedsAttention(quotes, jobs, inventoryItems);
  const recentActivity = getRecentActivity(quotes, jobs, inventoryLogs);
  const smartAutomationSignals = getSmartAutomationSignals(quotes, jobs, inventoryItems);
  const criticalAutomationSignals = smartAutomationSignals.filter((signal) => signal.severity === "danger").length;
  const warningAutomationSignals = smartAutomationSignals.filter((signal) => signal.severity === "warning").length;

  const currentMonthExpenses = expenses.filter((expense) => {
    if (!expense.date) return false;
    const date = new Date(`${expense.date}T00:00:00`);
    const now = new Date();
    return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });

  const currentYearExpenses = expenses.filter((expense) => {
    if (!expense.date) return false;
    const date = new Date(`${expense.date}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date.getFullYear() === new Date().getFullYear();
  });

  const currentMonthExpenseTotal = currentMonthExpenses.reduce((sum, expense) => sum + num(expense.amount), 0);
  const currentYearExpenseTotal = currentYearExpenses.reduce((sum, expense) => sum + num(expense.amount), 0);
  const recurringExpenseTotal = expenses.filter((expense) => expense.recurring).reduce((sum, expense) => sum + num(expense.amount), 0);
  const netAfterYearExpenses = collected - currentYearExpenseTotal;

  const topExpenseCategories = [...expenses.reduce((map, expense) => {
    const key = expense.category || "Other";
    const current = map.get(key) || { category: key, total: 0, count: 0 };
    current.total += num(expense.amount);
    current.count += 1;
    map.set(key, current);
    return map;
  }, new Map()).values()].sort((a, b) => b.total - a.total);

  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(`${b.date || "1900-01-01"}T00:00:00`) - new Date(`${a.date || "1900-01-01"}T00:00:00`))
    .slice(0, 8);

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Dashboard</h2>
          <p className="muted-text">
            Command center for quotes, jobs, payments, active timers, deadlines,
            stale quotes, inventory, material usage, reorder planning, and archive cleanup.
          </p>
        </div>
      </div>

      <div className="dashboard-stat-grid">
        <StatCard label="Active Jobs" value={activeJobs.length} icon={Hammer} />
        <StatCard label="Scheduled Today" value={scheduledTodayJobs.length} icon={Clock} />
        <StatCard label="Schedule Week" value={scheduledThisWeekJobs.length} icon={Hammer} />
        <StatCard label="Schedule Overdue" value={scheduleOverdueJobs.length} icon={AlertTriangle} />
        <StatCard label="Scheduled Hours" value={scheduledWeekHours.toFixed(1)} icon={Clock} />
        <StatCard label="Active Timers" value={activeTimerCount} icon={Play} />
        <StatCard label="Live Runtime" value={formatDuration(activeTimerLiveHours)} icon={Activity} />
        <StatCard label="Live Timer Cost" value={money(activeTimerLiveCost)} icon={Gauge} />
        <StatCard label="Efficiency Score" value={`${productionEfficiencyScore}%`} icon={TrendingUp} />
        <StatCard label="Overdue Jobs" value={overdueJobs.length} icon={AlertTriangle} />
        <StatCard label="Due Soon" value={dueSoonJobs.length} icon={Clock} />
        <StatCard label="Deposit Due" value={depositDueJobs.length} icon={CreditCard} />
        <StatCard label="Stale Quotes" value={staleQuotes.length} icon={FileText} />
        <StatCard label="Expiring Quotes" value={expiringQuotes.length} icon={Clock} />
        <StatCard label="Archive Cleanup" value={archiveReadyJobs.length} icon={Archive} />
        <StatCard label="Low Stock" value={lowStockItems.length} icon={PackageSearch} />
        <StatCard label="Out of Stock" value={outOfStockItems.length} icon={AlertTriangle} />
        <StatCard label="Reorder Items" value={reorderRecommendations.length} icon={PackageSearch} />
        <StatCard label="Inventory Value" value={money(inventoryValue)} icon={PackageSearch} />
        <StatCard label="Usage Events" value={totalMaterialUsageEvents} icon={TrendingUp} />
        <StatCard label="Usage Cost" value={money(totalMaterialUsageCost)} icon={TrendingUp} />
        <StatCard label="Pending Inventory" value={pendingInventoryJobs.length} icon={PackageSearch} />
        <StatCard label="Completed Warnings" value={completedInventoryWarningJobs.length} icon={AlertTriangle} />
        <StatCard label="Automation Critical" value={criticalAutomationSignals} icon={Bot} />
        <StatCard label="Automation Warnings" value={warningAutomationSignals} icon={Bell} />
        <StatCard label="Quoted Value" value={money(totalQuoted)} icon={FileText} />
        <StatCard label="Active Job Value" value={money(activeJobValue)} icon={Hammer} />
        <StatCard label="Collected" value={money(collected)} icon={CreditCard} />
        <StatCard label="Month Expenses" value={money(currentMonthExpenseTotal)} icon={CreditCard} />
        <StatCard label="Year Expenses" value={money(currentYearExpenseTotal)} icon={CreditCard} />
        <StatCard label="Net After Expenses" value={money(netAfterYearExpenses)} icon={CheckCircle} />
        <StatCard label="Recurring Expenses" value={money(recurringExpenseTotal)} icon={Clock} />
        <StatCard label="Suppliers" value={suppliers.length} icon={PackageSearch} />
        <StatCard label="Outstanding" value={money(outstanding)} icon={AlertTriangle} />
        <StatCard label="Known Costs" value={money(knownCosts)} icon={CreditCard} />
        <StatCard label="Est. Active Profit" value={money(estimatedProfit)} icon={CheckCircle} />
      </div>

      <div className="dashboard-sections">
        <div className="form-card dashboard-full-span production-dock-card">
          <h3 className="card-title">Currently Running Production</h3>
          {openTimerJobs.length === 0 ? (
            <p className="muted-text">No live production timers are running.</p>
          ) : (
            <div className="dashboard-list">
              {openTimerJobs.slice(0, 8).map((job) => (
                <div className="dashboard-list-row" key={job.id}>
                  <div>
                    <strong>{job.jobNumber} — {job.customerName || "No Customer"}</strong>
                    <span>{job.jobName || "Untitled Job"}</span>
                    <small>
                      Operator: {job.operator || "Unassigned"} • {getOpenTimers(job).length} active timer{getOpenTimers(job).length === 1 ? "" : "s"}
                    </small>
                  </div>
                  <div className="dashboard-status-stack">
                    {getOpenTimers(job).map((timer) => (
                      <span className="status-pill" key={timer.key}>
                        {timer.type} / {timer.label || "General"} • {formatDuration(getTimerElapsedHours(timer.event))}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ListCard title="Machine Runtime Leaderboard">
          {runtimeAnalytics.machineLeaderboard.length === 0 ? (
            <p className="muted-text">No active machine runtime yet.</p>
          ) : (
            <div className="dashboard-list">
              {runtimeAnalytics.machineLeaderboard.map((machine) => (
                <div className="dashboard-list-row" key={machine.label}>
                  <div>
                    <strong>{machine.label}</strong>
                    <span>{machine.activeTimers} active timer{machine.activeTimers === 1 ? "" : "s"}</span>
                  </div>
                  <div className="dashboard-status-stack">
                    <span className="status-pill">{formatDuration(machine.liveHours + machine.pairedHours)}</span>
                    <strong>{money(machine.cost)}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ListCard>

        <ListCard title="Operator Runtime Leaderboard">
          {runtimeAnalytics.operatorLeaderboard.length === 0 ? (
            <p className="muted-text">No operator runtime yet.</p>
          ) : (
            <div className="dashboard-list">
              {runtimeAnalytics.operatorLeaderboard.map((operator) => (
                <div className="dashboard-list-row" key={operator.operator}>
                  <div>
                    <strong>{operator.operator}</strong>
                    <span>{operator.activeTimers} active timer{operator.activeTimers === 1 ? "" : "s"}</span>
                  </div>
                  <div className="dashboard-status-stack">
                    <span className="status-pill">{formatDuration(operator.liveHours + operator.pairedHours)}</span>
                    <strong>{money(operator.cost)}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ListCard>


        <ListCard title="Financial Snapshot">
          {expenses.length === 0 ? (
            <p className="muted-text">No expenses logged yet.</p>
          ) : (
            <div className="dashboard-list">
              <div className="dashboard-list-row">
                <div><strong>This Month Expenses</strong><span>Current calendar month</span></div>
                <strong>{money(currentMonthExpenseTotal)}</strong>
              </div>
              <div className="dashboard-list-row">
                <div><strong>This Year Expenses</strong><span>Current calendar year</span></div>
                <strong>{money(currentYearExpenseTotal)}</strong>
              </div>
              <div className="dashboard-list-row">
                <div><strong>Estimated Net After Expenses</strong><span>Collected revenue minus current-year expenses</span></div>
                <strong>{money(netAfterYearExpenses)}</strong>
              </div>
            </div>
          )}
        </ListCard>

        <ListCard title="Top Expense Categories">
          {topExpenseCategories.length === 0 ? (
            <p className="muted-text">No category spending yet.</p>
          ) : (
            <div className="dashboard-list">
              {topExpenseCategories.slice(0, 8).map((category) => (
                <div className="dashboard-list-row" key={category.category}>
                  <div><strong>{category.category}</strong><span>{category.count} expense{category.count === 1 ? "" : "s"}</span></div>
                  <strong>{money(category.total)}</strong>
                </div>
              ))}
            </div>
          )}
        </ListCard>

        <ListCard title="Recent Expenses">
          {recentExpenses.length === 0 ? (
            <p className="muted-text">No expenses logged yet.</p>
          ) : (
            <div className="dashboard-list">
              {recentExpenses.map((expense) => (
                <div className="dashboard-list-row" key={expense.id}>
                  <div>
                    <strong>{expense.expenseNumber || "EXP"} — {expense.name || expense.vendor || "Expense"}</strong>
                    <span>{expense.category || "Expense"} • {expense.vendor || "No vendor"}</span>
                  </div>
                  <div className="dashboard-status-stack">
                    <span className="status-pill">{expense.status || "Logged"}</span>
                    <strong>{money(expense.amount)}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ListCard>

        <ListCard title="Needs Attention">
          {needsAttention.length === 0 ? (
            <p className="muted-text">Nothing urgent right now.</p>
          ) : (
            <div className="dashboard-list">
              {needsAttention.map((item) => {
                const Icon = item.icon;

                return (
                  <div className={`dashboard-list-row attention-${item.severity}`} key={item.id}>
                    <div>
                      <strong>
                        <Icon size={16} /> {item.title}
                      </strong>
                      <span>{item.detail}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ListCard>

        <ListCard title="Smart Automation Watchlist">
          {smartAutomationSignals.length === 0 ? (
            <p className="muted-text">No automation warnings right now.</p>
          ) : (
            <div className="dashboard-list">
              {smartAutomationSignals.slice(0, 10).map((signal) => (
                <div className={`dashboard-list-row attention-${signal.severity}`} key={signal.id}>
                  <div>
                    <strong>
                      <Bot size={16} /> {signal.title}
                    </strong>
                    <span>{signal.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ListCard>

        <ListCard title="This Week's Production Schedule">
          {scheduledThisWeekJobs.length === 0 ? (
            <p className="muted-text">No jobs scheduled for the next 7 days.</p>
          ) : (
            <div className="dashboard-list">
              {scheduledThisWeekJobs
                .slice()
                .sort((a, b) => new Date(getScheduledStart(a)) - new Date(getScheduledStart(b)))
                .slice(0, 10)
                .map((job) => (
                  <div className="dashboard-list-row" key={job.id}>
                    <div>
                      <strong>{job.jobNumber} — {job.customerName || "No Customer"}</strong>
                      <span>{job.jobName || "Untitled Job"}</span>
                      <small>{formatDateTime(getScheduledStart(job))} • {getScheduledMachine(job)}</small>
                    </div>

                    <div className="dashboard-status-stack">
                      {isScheduleOverdue(job) && <span className="status-pill">Overdue</span>}
                      <span className="status-pill">{getEstimatedScheduleHours(job).toFixed(1)} hr</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </ListCard>

        <ListCard title="Reorder Recommendations">
          {reorderRecommendations.length === 0 ? (
            <p className="muted-text">No reorder recommendations right now.</p>
          ) : (
            <div className="dashboard-list">
              {reorderRecommendations.slice(0, 10).map((item) => (
                <div className={`dashboard-list-row attention-${item.urgency}`} key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.category} • {item.material || "No material"} • {item.color || "No color"}
                    </span>
                    <small>
                      Used total: {item.usedQuantity.toFixed(2)} {item.unit}
                      {item.analytics ? ` across ${item.analytics.jobCount} job${item.analytics.jobCount === 1 ? "" : "s"}` : ""}
                    </small>
                  </div>

                  <div className="dashboard-status-stack">
                    <span className="status-pill">
                      On hand: {item.quantityOnHand} {item.unit}
                    </span>
                    <span className="status-pill">
                      Reorder: {item.suggestedReorderQuantity.toFixed(2)} {item.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ListCard>

        <ListCard title="Most Used Materials">
          {materialAnalytics.length === 0 ? (
            <p className="muted-text">No job-linked material usage yet.</p>
          ) : (
            <div className="dashboard-list">
              {materialAnalytics.slice(0, 10).map((material) => (
                <div className="dashboard-list-row" key={material.id}>
                  <div>
                    <strong>{material.itemName}</strong>
                    <span>
                      {material.category} • {material.material || "No material"} • {material.color || "No color"}
                    </span>
                    <small>
                      {material.usageCount} usage log{material.usageCount === 1 ? "" : "s"} • {material.jobCount} job{material.jobCount === 1 ? "" : "s"} • Last used {formatDateTime(material.lastUsedAt)}
                    </small>
                  </div>

                  <div className="dashboard-status-stack">
                    <span className="status-pill">
                      {material.totalQuantity.toFixed(2)} {material.unit}
                    </span>
                    <strong>{money(material.totalCost)}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ListCard>

        <ListCard title="Inventory Finalization">
          {pendingInventoryJobs.length === 0 && completedInventoryWarningJobs.length === 0 ? (
            <p className="muted-text">No jobs need inventory finalization review.</p>
          ) : (
            <div className="dashboard-list">
              {[...completedInventoryWarningJobs, ...pendingInventoryJobs].slice(0, 10).map((job) => (
                <div className="dashboard-list-row" key={job.id}>
                  <div>
                    <strong>{job.jobNumber} — {job.customerName || "No Customer"}</strong>
                    <span>{job.jobName || "Untitled Job"}</span>
                    <small>
                      {getJobMaterialUsage(job).length} material usage log{getJobMaterialUsage(job).length === 1 ? "" : "s"} • {job.status || "Approved"}
                    </small>
                  </div>

                  <span className="status-pill">
                    {job.status === "Completed" ? "Completed not finalized" : "Pending finalization"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ListCard>

        <ListCard title="Inventory Alerts">
          {lowStockItems.length === 0 && outOfStockItems.length === 0 ? (
            <p className="muted-text">No low-stock inventory alerts.</p>
          ) : (
            <div className="dashboard-list">
              {[...outOfStockItems, ...lowStockItems].slice(0, 10).map((item) => (
                <div className="dashboard-list-row" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.category} • {item.material || "No material"} • {item.color || "No color"}
                    </span>
                  </div>

                  <span className="status-pill">
                    {item.quantityOnHand} {item.unit} / reorder {item.reorderThreshold}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ListCard>

        <ListCard title="Recent Inventory Movement">
          {recentInventoryLogs.length === 0 ? (
            <p className="muted-text">No inventory movement yet.</p>
          ) : (
            <div className="dashboard-list">
              {recentInventoryLogs.map((log) => (
                <div className="dashboard-list-row" key={log.id}>
                  <div>
                    <strong>{log.itemName}</strong>
                    <span>
                      {log.type} • {log.quantityChange > 0 ? "+" : ""}
                      {log.quantityChange} {log.unit} → {log.quantityAfter} {log.unit}
                    </span>
                    {log.notes && <small>{log.notes}</small>}
                  </div>

                  <div className="dashboard-status-stack">
                    {log.jobNumber && <span className="status-pill">{log.jobNumber}</span>}
                    <span>{formatDateTime(log.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ListCard>

        <ListCard title="Active Timers">
          {openTimerJobs.length === 0 ? (
            <p className="muted-text">No timers are currently running.</p>
          ) : (
            <div className="dashboard-list">
              {openTimerJobs.map((job) => (
                <div className="dashboard-list-row" key={job.id}>
                  <div>
                    <strong>{job.jobNumber} — {job.customerName || "No Customer"}</strong>
                    <span>
                      {getOpenTimers(job)
                        .map((timer) => `${timer.type} / ${timer.label}`)
                        .join(", ")}
                    </span>
                  </div>
                  <span className="status-pill">{getOpenTimers(job).length} active</span>
                </div>
              ))}
            </div>
          )}
        </ListCard>

        <ListCard title="Overdue / Due Soon Jobs">
          {overdueJobs.length === 0 && dueSoonJobs.length === 0 ? (
            <p className="muted-text">No urgent job due dates.</p>
          ) : (
            <div className="dashboard-list">
              {[...overdueJobs, ...dueSoonJobs].slice(0, 8).map((job) => {
                const due = getDueDateStatus(job);

                return (
                  <div className="dashboard-list-row" key={job.id}>
                    <div>
                      <strong>{job.jobNumber} — {job.customerName || "No Customer"}</strong>
                      <span>{job.jobName || "Untitled Job"}</span>
                    </div>
                    <span className="status-pill">{due.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </ListCard>

        <ListCard title="Payment Alerts">
          {depositDueJobs.length === 0 && overdueBalanceJobs.length === 0 ? (
            <p className="muted-text">No payment alerts right now.</p>
          ) : (
            <div className="dashboard-list">
              {[...depositDueJobs, ...overdueBalanceJobs].slice(0, 8).map((job) => {
                const payment = getPaymentSummary(job);

                return (
                  <div className="dashboard-list-row" key={job.id}>
                    <div>
                      <strong>{job.jobNumber} — {job.customerName || "No Customer"}</strong>
                      <span>{payment.depositDue ? "Deposit due" : "Completed with balance"}</span>
                    </div>
                    <strong>{money(payment.remaining || payment.depositRemaining)}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </ListCard>

        <ListCard title="Quote Alerts">
          {staleQuotes.length === 0 && expiringQuotes.length === 0 && expiredQuotes.length === 0 ? (
            <p className="muted-text">No quote alerts right now.</p>
          ) : (
            <div className="dashboard-list">
              {[...expiredQuotes, ...expiringQuotes, ...staleQuotes].slice(0, 8).map((quote) => {
                const expiration = getQuoteExpirationInfo(quote);
                const age = getQuoteAgeDays(quote);

                return (
                  <div className="dashboard-list-row" key={quote.id}>
                    <div>
                      <strong>{quote.quoteNumber} — {quote.customerName || "No Customer"}</strong>
                      <span>{quote.jobName || "Untitled Quote"}</span>
                    </div>
                    <span className="status-pill">
                      {expiration.isExpired
                        ? "Expired"
                        : expiration.isExpiringSoon
                          ? expiration.label
                          : `${age} days old`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ListCard>

        <ListCard title="Archive Cleanup">
          {archiveReadyJobs.length === 0 ? (
            <p className="muted-text">No archived jobs are cleanup-eligible.</p>
          ) : (
            <div className="dashboard-list">
              {archiveReadyJobs.slice(0, 8).map((job) => {
                const archive = getArchiveCleanupInfo(job);

                return (
                  <div className="dashboard-list-row" key={job.id}>
                    <div>
                      <strong>{job.jobNumber} — {job.customerName || "No Customer"}</strong>
                      <span>{job.jobName || "Untitled Job"}</span>
                    </div>
                    <span className="status-pill">{archive.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </ListCard>

        <div className="form-card dashboard-full-span">
          <h3 className="card-title">Recent Activity</h3>

          {recentActivity.length === 0 ? (
            <p className="muted-text">No recent activity yet.</p>
          ) : (
            <div className="dashboard-list">
              {recentActivity.map((activity) => (
                <div className="dashboard-list-row" key={activity.id}>
                  <div>
                    <strong>{activity.title}</strong>
                    <span>{activity.detail}</span>
                  </div>
                  <div className="dashboard-status-stack">
                    <span className="status-pill">{activity.type}</span>
                    <span>{formatDateTime(activity.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}