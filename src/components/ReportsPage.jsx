import { useMemo, useState } from "react";
import {
  BarChart3,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  Hammer,
  PackageSearch,
  Printer,
  QrCode,
  Search,
  Truck,
  Users,
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

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString();
}

function clean(value) {
  return String(value || "").trim();
}

function getPaidTotal(job) {
  return (job.paymentEvents || []).reduce((sum, payment) => {
    if (payment.type === "Refund") return sum - num(payment.amount);
    return sum + num(payment.amount);
  }, 0);
}

function getRemainingBalance(job) {
  return Math.max(0, num(job.finalTotal) - getPaidTotal(job));
}

function getPaymentStatus(job) {
  const total = num(job.finalTotal);
  const paid = getPaidTotal(job);

  if (paid <= 0) return "Unpaid";
  if (paid >= total) return paid > total ? "Overpaid" : "Paid";
  return "Partially Paid";
}

function getInventoryValue(item) {
  return num(item.quantityOnHand) * num(item.unitCost);
}

function getKnownJobCost(job) {
  const actuals = job.actuals || {};
  return num(actuals.materialCost) + num(actuals.failedPrintCost) + num(actuals.extraCost);
}

function getCsvSafe(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function makeCsv(headers, rows) {
  return [
    headers.map(getCsvSafe).join(","),
    ...rows.map((row) => row.map(getCsvSafe).join(",")),
  ].join("\n");
}

function exportCsv(filename, headers, rows) {
  downloadTextFile(filename, makeCsv(headers, rows), "text/csv;charset=utf-8");
}

function getCustomerKey(record) {
  const email = clean(record.customerEmail || record.formData?.customerEmail).toLowerCase();
  const phone = clean(record.customerPhone || record.formData?.customerPhone).replace(/\D/g, "");
  const name = clean(record.customerName || record.formData?.customerName).toLowerCase();

  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  if (name) return `name:${name}`;
  return `unknown:${record.id}`;
}

function getCustomerInfo(record) {
  return {
    name: clean(record.customerName || record.formData?.customerName) || "Unknown Customer",
    phone: clean(record.customerPhone || record.formData?.customerPhone),
    email: clean(record.customerEmail || record.formData?.customerEmail),
    address: clean(record.customerAddress || record.formData?.customerAddress),
  };
}

function buildCustomerSummaries(quotes, jobs, manualCustomers = [], customerOverrides = {}) {
  const map = new Map();

  manualCustomers.forEach((customer) => {
    map.set(customer.key || `manual:${customer.id}`, {
      key: customer.key || `manual:${customer.id}`,
      name: customer.name || "Manual Customer",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
      tags: customer.tags || "",
      source: "Manual",
      quotes: [],
      jobs: [],
      totalQuoted: 0,
      totalJobValue: 0,
      totalPaid: 0,
      outstanding: 0,
      latestActivity: customer.updatedAt || customer.createdAt || "",
    });
  });

  function ensureCustomer(record) {
    const key = getCustomerKey(record);
    const info = getCustomerInfo(record);
    const override = customerOverrides[key] || {};

    if (!map.has(key)) {
      map.set(key, {
        key,
        ...info,
        source: "Generated",
        notes: "",
        tags: "",
        quotes: [],
        jobs: [],
        totalQuoted: 0,
        totalJobValue: 0,
        totalPaid: 0,
        outstanding: 0,
        latestActivity: record.updatedAt || record.createdAt || record.approvedAt || "",
      });
    }

    const customer = map.get(key);
    customer.name = override.name || customer.name || info.name;
    customer.phone = override.phone || customer.phone || info.phone;
    customer.email = override.email || customer.email || info.email;
    customer.address = override.address || customer.address || info.address;
    customer.notes = override.notes || customer.notes || "";
    customer.tags = override.tags || customer.tags || "";

    const activityDate = record.updatedAt || record.createdAt || record.approvedAt || "";
    if (activityDate && (!customer.latestActivity || new Date(activityDate) > new Date(customer.latestActivity))) {
      customer.latestActivity = activityDate;
    }

    return customer;
  }

  quotes.forEach((quote) => {
    const customer = ensureCustomer(quote);
    customer.quotes.push(quote);
    customer.totalQuoted += num(quote.finalTotal);
  });

  jobs.forEach((job) => {
    const customer = ensureCustomer(job);
    const paid = getPaidTotal(job);
    customer.jobs.push(job);
    customer.totalJobValue += num(job.finalTotal);
    customer.totalPaid += paid;
    customer.outstanding += Math.max(0, num(job.finalTotal) - paid);
  });

  return [...map.values()].sort((a, b) => b.totalJobValue - a.totalJobValue);
}

function getQrImageUrl(value) {
  const data = encodeURIComponent(value || "Overkill Solutions");
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=${data}`;
}

function getDefaultPaymentSettings() {
  try {
    const saved = localStorage.getItem("overkill_payment_qr_settings");
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore bad localStorage
  }

  return {
    venmo: "",
    cashApp: "",
    paypal: "",
    zelle: "",
    paymentNote: "Please include your quote, job, or invoice number in the payment note.",
  };
}

function getDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function printableHtml({ title, subtitle, body }) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 32px; }
    h1 { margin: 0 0 4px; font-size: 26px; letter-spacing: 0.04em; }
    h2 { margin: 24px 0 8px; font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
    h3 { margin: 14px 0 4px; font-size: 15px; }
    p { margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 7px; font-size: 12px; text-align: left; vertical-align: top; }
    th { background: #f4f4f4; }
    .muted { color: #666; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 18px; }
    .box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin: 10px 0; }
    .signature { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 40px; }
    .line { border-top: 1px solid #111; padding-top: 6px; }
    .qr-row { display: flex; gap: 20px; flex-wrap: wrap; align-items: flex-start; }
    .qr-card { border: 1px solid #ddd; padding: 12px; width: 190px; text-align: center; border-radius: 8px; }
    .qr-card img { width: 150px; height: 150px; }
    @media print { button { display: none; } body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>Overkill Solutions</h1>
  <p class="muted">${subtitle || "Internal printable report"}</p>
  <button onclick="window.print()">Print</button>
  ${body}
</body>
</html>`;
}

function openPrintWindow(html) {
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) {
    window.alert("Pop-up blocked. Allow pop-ups for this site to use print reports.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
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

function ReportCard({ icon: Icon, title, description, children }) {
  return (
    <div className="form-card report-action-card">
      <div className="page-heading-row">
        <div>
          <h3 className="card-title">
            {Icon && <Icon size={18} />} {title}
          </h3>
          <p className="muted-text">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function ReportsPage({
  quotes = [],
  jobs = [],
  inventoryItems = [],
  inventoryLogs = [],
  expenses = [],
  shippingEstimates = [],
  manualCustomers = [],
  customerOverrides = {},
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentSettings, setPaymentSettings] = useState(getDefaultPaymentSettings);

  const activeJobs = jobs.filter((job) => !job.archived);
  const completedJobs = jobs.filter((job) => job.status === "Completed");
  const unpaidJobs = jobs.filter((job) => getRemainingBalance(job) > 0);
  const lowStockItems = inventoryItems.filter(
    (item) => item.active !== false && num(item.reorderThreshold) > 0 && num(item.quantityOnHand) <= num(item.reorderThreshold)
  );
  const outOfStockItems = inventoryItems.filter((item) => item.active !== false && num(item.quantityOnHand) <= 0);

  const customers = useMemo(
    () => buildCustomerSummaries(quotes, jobs, manualCustomers, customerOverrides),
    [quotes, jobs, manualCustomers, customerOverrides]
  );

  const filteredJobs = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return jobs;

    return jobs.filter((job) =>
      [job.jobNumber, job.quoteNumber, job.invoiceNumber, job.customerName, job.jobName, job.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search))
    );
  }, [jobs, searchTerm]);

  const financialSummary = useMemo(() => {
    const quotedValue = quotes.reduce((sum, quote) => sum + num(quote.finalTotal), 0);
    const jobValue = jobs.reduce((sum, job) => sum + num(job.finalTotal), 0);
    const collected = jobs.reduce((sum, job) => sum + getPaidTotal(job), 0);
    const outstanding = jobs.reduce((sum, job) => sum + getRemainingBalance(job), 0);
    const inventoryValue = inventoryItems.reduce((sum, item) => sum + getInventoryValue(item), 0);
    const expenseTotal = expenses.reduce((sum, expense) => sum + num(expense.amount), 0);
    const knownJobCosts = jobs.reduce((sum, job) => sum + getKnownJobCost(job), 0);
    const estimatedProfit = collected - knownJobCosts - expenseTotal;

    return {
      quotedValue,
      jobValue,
      collected,
      outstanding,
      inventoryValue,
      expenseTotal,
      knownJobCosts,
      estimatedProfit,
    };
  }, [quotes, jobs, inventoryItems, expenses]);

  function savePaymentSettings(nextSettings) {
    setPaymentSettings(nextSettings);
    localStorage.setItem("overkill_payment_qr_settings", JSON.stringify(nextSettings));
  }

  function updatePaymentSetting(key, value) {
    savePaymentSettings({
      ...paymentSettings,
      [key]: value,
    });
  }

  function exportJobsCsv() {
    exportCsv(
      `overkill-jobs-report-${getDateStamp()}.csv`,
      ["Job", "Quote", "Invoice", "Customer", "Job Name", "Status", "Priority", "Due Date", "Total", "Paid", "Remaining", "Known Cost", "Profit Estimate"],
      jobs.map((job) => [
        job.jobNumber,
        job.quoteNumber,
        job.invoiceNumber,
        job.customerName,
        job.jobName,
        job.status,
        job.priority,
        job.dueDate,
        num(job.finalTotal),
        getPaidTotal(job),
        getRemainingBalance(job),
        getKnownJobCost(job),
        num(job.finalTotal) - getKnownJobCost(job),
      ])
    );
  }

  function exportCustomersCsv() {
    exportCsv(
      `overkill-customers-report-${getDateStamp()}.csv`,
      ["Customer", "Phone", "Email", "Address", "Quotes", "Jobs", "Quoted Value", "Job Value", "Paid", "Outstanding", "Tags", "Notes", "Latest Activity"],
      customers.map((customer) => [
        customer.name,
        customer.phone,
        customer.email,
        customer.address,
        customer.quotes.length,
        customer.jobs.length,
        customer.totalQuoted,
        customer.totalJobValue,
        customer.totalPaid,
        customer.outstanding,
        customer.tags,
        customer.notes,
        customer.latestActivity,
      ])
    );
  }

  function exportInventoryCsv() {
    exportCsv(
      `overkill-inventory-report-${getDateStamp()}.csv`,
      ["Name", "Category", "Material", "Color", "Brand", "Location", "Quantity", "Unit", "Reorder Threshold", "Unit Cost", "Stock Value", "Vendor", "SKU", "Bambu Code", "Hex Code", "Active", "Notes"],
      inventoryItems.map((item) => [
        item.name,
        item.category,
        item.material,
        item.color,
        item.brand,
        item.location,
        item.quantityOnHand,
        item.unit,
        item.reorderThreshold,
        item.unitCost,
        getInventoryValue(item),
        item.vendor,
        item.sku,
        item.bambuCode,
        item.hexCode,
        item.active !== false ? "Yes" : "No",
        item.notes,
      ])
    );
  }

  function exportFinancialCsv() {
    exportCsv(
      `overkill-financial-summary-${getDateStamp()}.csv`,
      ["Metric", "Value"],
      [
        ["Quoted Value", financialSummary.quotedValue],
        ["Job Value", financialSummary.jobValue],
        ["Collected", financialSummary.collected],
        ["Outstanding", financialSummary.outstanding],
        ["Inventory Value", financialSummary.inventoryValue],
        ["Expenses", financialSummary.expenseTotal],
        ["Known Job Costs", financialSummary.knownJobCosts],
        ["Estimated Profit", financialSummary.estimatedProfit],
      ]
    );
  }

  function exportShippingCsv() {
    exportCsv(
      `overkill-shipping-report-${getDateStamp()}.csv`,
      ["Estimate", "Customer", "Carrier", "Service", "Status", "Tracking", "State", "Total", "Attached Type", "Attached ID", "Created"],
      shippingEstimates.map((estimate) => [
        estimate.estimateNumber,
        estimate.customerName,
        estimate.carrier,
        estimate.service,
        estimate.status || estimate.shipmentStatus,
        estimate.trackingNumber,
        estimate.destinationState,
        estimate.total,
        estimate.attachedType,
        estimate.attachedId,
        estimate.createdAt,
      ])
    );
  }

  function printJobPacket(job) {
    const paymentQrValue = `${job.jobNumber || job.invoiceNumber || "Overkill Job"} | Balance: ${money(getRemainingBalance(job))}`;
    const materialRows = (job.materialUsageEvents || [])
      .map((usage) => `<tr><td>${usage.itemName || "Material"}</td><td>${usage.quantityUsed || 0} ${usage.unit || ""}</td><td>${money(usage.estimatedCost)}</td><td>${usage.notes || ""}</td></tr>`)
      .join("");

    const timerRows = (job.timeEvents || [])
      .map((event) => `<tr><td>${event.date || ""}</td><td>${event.time || ""}</td><td>${event.type || ""}</td><td>${event.action || ""}</td><td>${event.label || ""}</td><td>${event.notes || ""}</td></tr>`)
      .join("");

    const attachmentRows = (job.attachments || [])
      .map((attachment) => `<tr><td>${attachment.type || ""}</td><td>${attachment.name || ""}</td><td>${attachment.url || ""}</td><td>${attachment.notes || ""}</td></tr>`)
      .join("");

    openPrintWindow(printableHtml({
      title: `${job.jobNumber || "Job"} Production Packet`,
      subtitle: `Production packet generated ${formatDateTime(new Date().toISOString())}`,
      body: `
        <h2>Job Overview</h2>
        <div class="grid">
          <p><strong>Job:</strong> ${job.jobNumber || "Not set"}</p>
          <p><strong>Quote:</strong> ${job.quoteNumber || "Not set"}</p>
          <p><strong>Invoice:</strong> ${job.invoiceNumber || "Not set"}</p>
          <p><strong>Status:</strong> ${job.status || "Approved"}</p>
          <p><strong>Customer:</strong> ${job.customerName || "No Customer"}</p>
          <p><strong>Phone:</strong> ${job.customerPhone || "Not saved"}</p>
          <p><strong>Email:</strong> ${job.customerEmail || "Not saved"}</p>
          <p><strong>Due Date:</strong> ${job.dueDate || "Not set"}</p>
          <p><strong>Total:</strong> ${money(job.finalTotal)}</p>
          <p><strong>Paid:</strong> ${money(getPaidTotal(job))}</p>
          <p><strong>Remaining:</strong> ${money(getRemainingBalance(job))}</p>
          <p><strong>Priority:</strong> ${job.priority || "Normal"}</p>
        </div>

        <h2>Production Notes</h2>
        <div class="box"><p>${job.queueNotes || job.formData?.notes || "No production notes saved."}</p></div>

        <h2>Payment Reference</h2>
        <div class="qr-row">
          <div class="qr-card"><img src="${getQrImageUrl(paymentQrValue)}" /><p>${paymentQrValue}</p></div>
        </div>

        <h2>Material Usage</h2>
        <table><thead><tr><th>Material</th><th>Qty</th><th>Cost</th><th>Notes</th></tr></thead><tbody>${materialRows || `<tr><td colspan="4">No material usage logged.</td></tr>`}</tbody></table>

        <h2>Production Timeline</h2>
        <table><thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Action</th><th>Machine / Task</th><th>Notes</th></tr></thead><tbody>${timerRows || `<tr><td colspan="6">No timer or production events logged.</td></tr>`}</tbody></table>

        <h2>Attachments / File Links</h2>
        <table><thead><tr><th>Type</th><th>Name</th><th>Path / URL</th><th>Notes</th></tr></thead><tbody>${attachmentRows || `<tr><td colspan="4">No attachments saved.</td></tr>`}</tbody></table>

        <div class="signature">
          <div class="line">Prepared By / Date</div>
          <div class="line">Customer Pickup / Date</div>
        </div>
      `,
    }));
  }

  function printCustomerSummary(customer) {
    const quoteRows = customer.quotes
      .map((quote) => `<tr><td>${quote.quoteNumber || ""}</td><td>${quote.jobName || ""}</td><td>${quote.quoteStatus || quote.status || ""}</td><td>${money(quote.finalTotal)}</td><td>${formatDate(quote.createdAt)}</td></tr>`)
      .join("");

    const jobRows = customer.jobs
      .map((job) => `<tr><td>${job.jobNumber || ""}</td><td>${job.jobName || ""}</td><td>${job.status || ""}</td><td>${money(job.finalTotal)}</td><td>${money(getPaidTotal(job))}</td><td>${money(getRemainingBalance(job))}</td></tr>`)
      .join("");

    openPrintWindow(printableHtml({
      title: `${customer.name} Customer Summary`,
      subtitle: `Customer summary generated ${formatDateTime(new Date().toISOString())}`,
      body: `
        <h2>Customer Information</h2>
        <div class="grid">
          <p><strong>Name:</strong> ${customer.name}</p>
          <p><strong>Phone:</strong> ${customer.phone || "Not saved"}</p>
          <p><strong>Email:</strong> ${customer.email || "Not saved"}</p>
          <p><strong>Address:</strong> ${customer.address || "Not saved"}</p>
          <p><strong>Tags:</strong> ${customer.tags || "None"}</p>
          <p><strong>Latest Activity:</strong> ${formatDateTime(customer.latestActivity)}</p>
        </div>
        <h2>Summary</h2>
        <div class="grid">
          <p><strong>Quotes:</strong> ${customer.quotes.length}</p>
          <p><strong>Jobs:</strong> ${customer.jobs.length}</p>
          <p><strong>Total Quoted:</strong> ${money(customer.totalQuoted)}</p>
          <p><strong>Total Job Value:</strong> ${money(customer.totalJobValue)}</p>
          <p><strong>Total Paid:</strong> ${money(customer.totalPaid)}</p>
          <p><strong>Outstanding:</strong> ${money(customer.outstanding)}</p>
        </div>
        <h2>Notes</h2>
        <div class="box"><p>${customer.notes || "No customer notes saved."}</p></div>
        <h2>Quote History</h2>
        <table><thead><tr><th>Quote</th><th>Project</th><th>Status</th><th>Total</th><th>Created</th></tr></thead><tbody>${quoteRows || `<tr><td colspan="5">No quotes.</td></tr>`}</tbody></table>
        <h2>Job History</h2>
        <table><thead><tr><th>Job</th><th>Project</th><th>Status</th><th>Total</th><th>Paid</th><th>Remaining</th></tr></thead><tbody>${jobRows || `<tr><td colspan="6">No jobs.</td></tr>`}</tbody></table>
      `,
    }));
  }

  function printFinancialReport() {
    const unpaidRows = unpaidJobs
      .map((job) => `<tr><td>${job.jobNumber || ""}</td><td>${job.customerName || ""}</td><td>${job.jobName || ""}</td><td>${getPaymentStatus(job)}</td><td>${money(job.finalTotal)}</td><td>${money(getPaidTotal(job))}</td><td>${money(getRemainingBalance(job))}</td></tr>`)
      .join("");

    const expenseRows = expenses
      .slice(0, 50)
      .map((expense) => `<tr><td>${formatDate(expense.date || expense.createdAt)}</td><td>${expense.category || ""}</td><td>${expense.name || expense.description || ""}</td><td>${money(expense.amount)}</td><td>${expense.notes || ""}</td></tr>`)
      .join("");

    openPrintWindow(printableHtml({
      title: "Financial Snapshot",
      subtitle: `Financial report generated ${formatDateTime(new Date().toISOString())}`,
      body: `
        <h2>Summary</h2>
        <div class="grid">
          <p><strong>Quoted Value:</strong> ${money(financialSummary.quotedValue)}</p>
          <p><strong>Job Value:</strong> ${money(financialSummary.jobValue)}</p>
          <p><strong>Collected:</strong> ${money(financialSummary.collected)}</p>
          <p><strong>Outstanding:</strong> ${money(financialSummary.outstanding)}</p>
          <p><strong>Inventory Value:</strong> ${money(financialSummary.inventoryValue)}</p>
          <p><strong>Expenses:</strong> ${money(financialSummary.expenseTotal)}</p>
          <p><strong>Known Job Costs:</strong> ${money(financialSummary.knownJobCosts)}</p>
          <p><strong>Estimated Profit:</strong> ${money(financialSummary.estimatedProfit)}</p>
        </div>
        <h2>Unpaid / Partially Paid Jobs</h2>
        <table><thead><tr><th>Job</th><th>Customer</th><th>Project</th><th>Status</th><th>Total</th><th>Paid</th><th>Remaining</th></tr></thead><tbody>${unpaidRows || `<tr><td colspan="7">No unpaid jobs.</td></tr>`}</tbody></table>
        <h2>Recent Expenses</h2>
        <table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Notes</th></tr></thead><tbody>${expenseRows || `<tr><td colspan="5">No expenses saved.</td></tr>`}</tbody></table>
      `,
    }));
  }

  function printInventoryReport() {
    const lowStockRows = [...outOfStockItems, ...lowStockItems]
      .map((item) => `<tr><td>${item.name || ""}</td><td>${item.category || ""}</td><td>${item.material || ""}</td><td>${item.color || ""}</td><td>${item.quantityOnHand || 0} ${item.unit || ""}</td><td>${item.reorderThreshold || 0} ${item.unit || ""}</td><td>${money(getInventoryValue(item))}</td></tr>`)
      .join("");

    const recentLogRows = [...inventoryLogs]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 75)
      .map((log) => `<tr><td>${formatDateTime(log.createdAt)}</td><td>${log.itemName || ""}</td><td>${log.type || ""}</td><td>${log.quantityChange || 0} ${log.unit || ""}</td><td>${log.quantityAfter || 0} ${log.unit || ""}</td><td>${log.jobNumber || ""}</td><td>${log.notes || ""}</td></tr>`)
      .join("");

    openPrintWindow(printableHtml({
      title: "Inventory Report",
      subtitle: `Inventory report generated ${formatDateTime(new Date().toISOString())}`,
      body: `
        <h2>Inventory Summary</h2>
        <div class="grid">
          <p><strong>Total Items:</strong> ${inventoryItems.length}</p>
          <p><strong>Active Items:</strong> ${inventoryItems.filter((item) => item.active !== false).length}</p>
          <p><strong>Low Stock:</strong> ${lowStockItems.length}</p>
          <p><strong>Out of Stock:</strong> ${outOfStockItems.length}</p>
          <p><strong>Inventory Value:</strong> ${money(financialSummary.inventoryValue)}</p>
          <p><strong>Inventory Logs:</strong> ${inventoryLogs.length}</p>
        </div>
        <h2>Low / Out-of-Stock Items</h2>
        <table><thead><tr><th>Name</th><th>Category</th><th>Material</th><th>Color</th><th>On Hand</th><th>Reorder</th><th>Value</th></tr></thead><tbody>${lowStockRows || `<tr><td colspan="7">No low-stock items.</td></tr>`}</tbody></table>
        <h2>Recent Inventory Movement</h2>
        <table><thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Change</th><th>After</th><th>Job</th><th>Notes</th></tr></thead><tbody>${recentLogRows || `<tr><td colspan="7">No inventory logs.</td></tr>`}</tbody></table>
      `,
    }));
  }

  function printPaymentQrSheet() {
    const paymentLinks = [
      ["Venmo", paymentSettings.venmo],
      ["Cash App", paymentSettings.cashApp],
      ["PayPal", paymentSettings.paypal],
      ["Zelle", paymentSettings.zelle],
    ].filter(([, value]) => clean(value));

    openPrintWindow(printableHtml({
      title: "Payment QR Sheet",
      subtitle: `Payment references generated ${formatDateTime(new Date().toISOString())}`,
      body: `
        <h2>Payment QR Codes</h2>
        <p>${paymentSettings.paymentNote || "Please include your quote, job, or invoice number in the payment note."}</p>
        <div class="qr-row">
          ${paymentLinks.length === 0 ? `<p>No payment links or handles saved yet.</p>` : paymentLinks.map(([label, value]) => `
            <div class="qr-card">
              <h3>${label}</h3>
              <img src="${getQrImageUrl(value)}" />
              <p>${value}</p>
            </div>
          `).join("")}
        </div>
      `,
    }));
  }

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Reports</h2>
          <p className="muted-text">
            Printable reports, CSV exports, job packets, customer summaries, QR payment references, and local business snapshots.
          </p>
        </div>
      </div>

      <div className="dashboard-stat-grid">
        <StatCard label="Jobs" value={jobs.length} icon={Hammer} />
        <StatCard label="Active Jobs" value={activeJobs.length} icon={ClipboardList} />
        <StatCard label="Completed" value={completedJobs.length} icon={FileText} />
        <StatCard label="Unpaid Jobs" value={unpaidJobs.length} icon={CreditCard} />
        <StatCard label="Customers" value={customers.length} icon={Users} />
        <StatCard label="Inventory Value" value={money(financialSummary.inventoryValue)} icon={PackageSearch} />
        <StatCard label="Collected" value={money(financialSummary.collected)} icon={CreditCard} />
        <StatCard label="Outstanding" value={money(financialSummary.outstanding)} icon={CreditCard} />
      </div>

      <div className="reports-grid">
        <ReportCard
          icon={Printer}
          title="Printable Report Hub"
          description="Generate browser-printable reports without changing app data."
        >
          <div className="record-button-row report-button-grid">
            <button className="primary-button" type="button" onClick={printFinancialReport}>
              <Printer size={18} /> Financial Snapshot
            </button>
            <button className="secondary-button" type="button" onClick={printInventoryReport}>
              <Printer size={18} /> Inventory Report
            </button>
            <button className="secondary-button" type="button" onClick={printPaymentQrSheet}>
              <QrCode size={18} /> Payment QR Sheet
            </button>
          </div>
        </ReportCard>

        <ReportCard
          icon={Download}
          title="CSV Export Center"
          description="Export clean spreadsheet-friendly reports for local backups, tax prep, or manual review."
        >
          <div className="record-button-row report-button-grid">
            <button className="secondary-button" type="button" onClick={exportJobsCsv}>
              <Download size={18} /> Jobs CSV
            </button>
            <button className="secondary-button" type="button" onClick={exportCustomersCsv}>
              <Download size={18} /> Customers CSV
            </button>
            <button className="secondary-button" type="button" onClick={exportInventoryCsv}>
              <Download size={18} /> Inventory CSV
            </button>
            <button className="secondary-button" type="button" onClick={exportFinancialCsv}>
              <Download size={18} /> Financial CSV
            </button>
            <button className="secondary-button" type="button" onClick={exportShippingCsv}>
              <Truck size={18} /> Shipping CSV
            </button>
          </div>
        </ReportCard>

        <ReportCard
          icon={QrCode}
          title="Payment QR References"
          description="Optional static payment links/handles for printable sheets and job packets. No auto-email or payment processor required."
        >
          <div className="form-grid">
            <label className="field">
              <span>Venmo Link / Handle</span>
              <input value={paymentSettings.venmo} onChange={(event) => updatePaymentSetting("venmo", event.target.value)} placeholder="https://venmo.com/u/... or @handle" />
            </label>
            <label className="field">
              <span>Cash App Link / Cashtag</span>
              <input value={paymentSettings.cashApp} onChange={(event) => updatePaymentSetting("cashApp", event.target.value)} placeholder="https://cash.app/$... or $cashtag" />
            </label>
            <label className="field">
              <span>PayPal Link</span>
              <input value={paymentSettings.paypal} onChange={(event) => updatePaymentSetting("paypal", event.target.value)} placeholder="https://paypal.me/..." />
            </label>
            <label className="field">
              <span>Zelle Info</span>
              <input value={paymentSettings.zelle} onChange={(event) => updatePaymentSetting("zelle", event.target.value)} placeholder="email or phone" />
            </label>
          </div>
          <label className="field single-row-gap">
            <span>Payment Note</span>
            <textarea value={paymentSettings.paymentNote} onChange={(event) => updatePaymentSetting("paymentNote", event.target.value)} />
          </label>
          <p className="helper-note">QR images use a public QR image endpoint when printed. If you want fully offline QR generation later, add a QR package.</p>
        </ReportCard>

        <ReportCard
          icon={Hammer}
          title="Job Packet Printer"
          description="Search a job and print a production packet with notes, material usage, timers, attachments, and pickup signature lines."
        >
          <label className="search-field single-row-gap">
            <Search size={18} />
            <input
              type="search"
              value={searchTerm}
              placeholder="Search jobs by customer, job number, quote, invoice, project, or status..."
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
          <div className="dashboard-list reports-scroll-list">
            {filteredJobs.slice(0, 20).map((job) => (
              <div className="dashboard-list-row" key={job.id}>
                <div>
                  <strong>{job.jobNumber || "Job"} — {job.customerName || "No Customer"}</strong>
                  <span>{job.jobName || "Untitled Job"} • {job.status || "Approved"} • {money(job.finalTotal)}</span>
                  <small>Paid {money(getPaidTotal(job))} • Remaining {money(getRemainingBalance(job))}</small>
                </div>
                <button className="secondary-button" type="button" onClick={() => printJobPacket(job)}>
                  <Printer size={16} /> Print Packet
                </button>
              </div>
            ))}
            {filteredJobs.length === 0 && <p className="muted-text">No matching jobs.</p>}
          </div>
        </ReportCard>

        <ReportCard
          icon={Users}
          title="Customer Summary Printer"
          description="Print customer summaries with quote history, job history, payment totals, outstanding balance, tags, and notes."
        >
          <div className="dashboard-list reports-scroll-list">
            {customers.slice(0, 20).map((customer) => (
              <div className="dashboard-list-row" key={customer.key}>
                <div>
                  <strong>{customer.name}</strong>
                  <span>{customer.phone || "No phone"} • {customer.email || "No email"}</span>
                  <small>{customer.jobs.length} jobs • {money(customer.totalJobValue)} value • {money(customer.outstanding)} outstanding</small>
                </div>
                <button className="secondary-button" type="button" onClick={() => printCustomerSummary(customer)}>
                  <Printer size={16} /> Print Summary
                </button>
              </div>
            ))}
            {customers.length === 0 && <p className="muted-text">No customers yet.</p>}
          </div>
        </ReportCard>
      </div>
    </section>
  );
}
