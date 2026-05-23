import { num } from "./appFormatters";

export function analyzeDataHealth({
  quotes = [],
  jobs = [],
  inventoryItems = [],
  inventoryLogs = [],
  expenses = [],
  manualCustomers = [],
  usedRecordNumbers = [],
}) {
  const issues = [];

  const quoteNumbers = new Set();
  quotes.forEach((quote) => {
    if (!quote.quoteNumber) issues.push({ severity: "danger", type: "Quote", title: "Quote missing quote number", id: quote.id });
    if (quote.quoteNumber && quoteNumbers.has(quote.quoteNumber)) issues.push({ severity: "danger", type: "Quote", title: `Duplicate quote number ${quote.quoteNumber}`, id: quote.id });
    if (quote.quoteNumber) quoteNumbers.add(quote.quoteNumber);
    if (!quote.customerName) issues.push({ severity: "warning", type: "Quote", title: `${quote.quoteNumber || "Quote"} missing customer name`, id: quote.id });
    if (!quote.publicId) issues.push({ severity: "normal", type: "Backend", title: `${quote.quoteNumber || "Quote"} missing publicId`, id: quote.id });
    if (num(quote.finalTotal) <= 0) issues.push({ severity: "warning", type: "Quote", title: `${quote.quoteNumber || "Quote"} has zero total`, id: quote.id });
  });

  const jobNumbers = new Set();
  jobs.forEach((job) => {
    if (!job.jobNumber) issues.push({ severity: "danger", type: "Job", title: "Job missing job number", id: job.id });
    if (job.jobNumber && jobNumbers.has(job.jobNumber)) issues.push({ severity: "danger", type: "Job", title: `Duplicate job number ${job.jobNumber}`, id: job.id });
    if (job.jobNumber) jobNumbers.add(job.jobNumber);
    if (!job.customerName) issues.push({ severity: "warning", type: "Job", title: `${job.jobNumber || "Job"} missing customer name`, id: job.id });
    if (!job.publicId) issues.push({ severity: "normal", type: "Backend", title: `${job.jobNumber || "Job"} missing publicId`, id: job.id });
    if (job.status === "Completed" && !job.completedAt) issues.push({ severity: "warning", type: "Job", title: `${job.jobNumber || "Job"} completed without completedAt`, id: job.id });
  });

  inventoryItems.forEach((item) => {
    if (!item.name) issues.push({ severity: "warning", type: "Inventory", title: "Inventory item missing name", id: item.id });
    if (num(item.unitCost) <= 0) issues.push({ severity: "warning", type: "Inventory", title: `${item.name || "Inventory item"} missing unit cost`, id: item.id });
    if (item.active !== false && num(item.quantityOnHand) <= num(item.reorderThreshold) && num(item.reorderThreshold) > 0) {
      issues.push({ severity: "normal", type: "Inventory", title: `${item.name} is at/below reorder threshold`, id: item.id });
    }
  });

  inventoryLogs.forEach((log) => {
    if (!log.itemId) issues.push({ severity: "normal", type: "Inventory Log", title: `${log.itemName || "Inventory log"} missing itemId`, id: log.id });
  });

  expenses.forEach((expense) => {
    if (!expense.category) issues.push({ severity: "normal", type: "Expense", title: `${expense.name || expense.description || "Expense"} missing category`, id: expense.id });
    if (num(expense.amount || expense.total) <= 0) issues.push({ severity: "warning", type: "Expense", title: `${expense.name || expense.description || "Expense"} has zero amount`, id: expense.id });
  });

  manualCustomers.forEach((customer) => {
    if (!customer.name) issues.push({ severity: "warning", type: "Customer", title: "Manual customer missing name", id: customer.id });
    if (!customer.phone && !customer.email) issues.push({ severity: "normal", type: "Customer", title: `${customer.name || "Customer"} missing phone/email`, id: customer.id });
  });

  return {
    issues,
    counts: {
      issues: issues.length,
      danger: issues.filter((issue) => issue.severity === "danger").length,
      warning: issues.filter((issue) => issue.severity === "warning").length,
      normal: issues.filter((issue) => issue.severity === "normal").length,
      quotes: quotes.length,
      jobs: jobs.length,
      inventoryItems: inventoryItems.length,
      inventoryLogs: inventoryLogs.length,
      expenses: expenses.length,
      manualCustomers: manualCustomers.length,
      usedRecordNumbers: usedRecordNumbers.length,
    },
  };
}
