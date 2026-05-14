import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  FileDown,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { exportInvoicePdf } from "../utils/pdf";

const PAYMENT_TYPES = ["Deposit", "Partial Payment", "Final Payment", "Refund", "Other"];
const PAYMENT_METHODS = ["Venmo", "Cash", "Cash App", "PayPal", "Zelle", "Card", "Check", "Other"];
const PAYMENT_STATUS_FILTERS = [
  "All",
  "Unpaid",
  "Deposit Due",
  "Partially Paid",
  "Paid in Full",
  "Overpaid",
  "Overdue",
];

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

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeString() {
  return new Date().toTimeString().slice(0, 5);
}

function createPaymentEvent() {
  return {
    id: crypto.randomUUID(),
    type: "Deposit",
    method: "Venmo",
    amount: "",
    date: todayDateString(),
    time: nowTimeString(),
    notes: "",
  };
}

function Field({ label, value, onChange, type = "text", step = "0.01" }) {
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

function getDueDateStatus(job) {
  if (!job.paymentDueDate) {
    return {
      label: "No due date",
      isOverdue: false,
      daysRemaining: null,
    };
  }

  const today = new Date();
  const due = new Date(`${job.paymentDueDate}T00:00:00`);

  today.setHours(0, 0, 0, 0);

  if (Number.isNaN(due.getTime())) {
    return {
      label: "Invalid due date",
      isOverdue: false,
      daysRemaining: null,
    };
  }

  const daysRemaining = Math.ceil((due - today) / 1000 / 60 / 60 / 24);

  if (daysRemaining < 0) {
    return {
      label: `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"}`,
      isOverdue: true,
      daysRemaining,
    };
  }

  if (daysRemaining === 0) {
    return {
      label: "Due today",
      isOverdue: false,
      daysRemaining,
    };
  }

  return {
    label: `Due in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
    isOverdue: false,
    daysRemaining,
  };
}

function getPaymentSummary(job) {
  const quotedTotal = num(job.finalTotal);
  const totalPaid = getPaidTotal(job);
  const depositPaid = getDepositPaid(job);
  const suggestedDeposit = num(job.depositAmount || job.totals?.suggestedDeposit);
  const remaining = Math.max(0, quotedTotal - totalPaid);
  const dueStatus = getDueDateStatus(job);
  const depositRequired = Boolean(job.depositRequired ?? true);
  const depositDue = depositRequired && suggestedDeposit > 0 && depositPaid < suggestedDeposit;

  let status = "Unpaid";

  if (totalPaid > 0 && totalPaid < quotedTotal) status = "Partially Paid";
  if (totalPaid >= quotedTotal) status = totalPaid > quotedTotal ? "Overpaid" : "Paid in Full";
  if (depositDue && totalPaid <= 0) status = "Deposit Due";
  if (dueStatus.isOverdue && remaining > 0) status = "Overdue";

  return {
    quotedTotal,
    totalPaid,
    depositPaid,
    suggestedDeposit,
    depositRemaining: Math.max(0, suggestedDeposit - depositPaid),
    remaining,
    dueStatus,
    depositRequired,
    depositDue,
    status,
  };
}

function calculateJobActualCost(job) {
  const actuals = job.actuals || {};

  return (
    num(actuals.materialCost) +
    num(actuals.failedPrintCost) +
    num(actuals.extraCost)
  );
}

function escapeCsv(value) {
  const safe = String(value ?? "").replace(/"/g, '""');
  return `"${safe}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function matchesSearch(job, searchTerm) {
  const search = searchTerm.trim().toLowerCase();
  if (!search) return true;

  const summary = getPaymentSummary(job);

  return [
    job.jobNumber,
    job.quoteNumber,
    job.invoiceNumber,
    job.customerName,
    job.customerPhone,
    job.customerEmail,
    job.jobName,
    job.status,
    summary.status,
    job.paymentDueDate,
    job.paymentNotes,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(search));
}

function matchesStatus(job, statusFilter) {
  if (statusFilter === "All") return true;

  const summary = getPaymentSummary(job);

  if (statusFilter === "Overdue") return summary.dueStatus.isOverdue && summary.remaining > 0;

  return summary.status === statusFilter;
}

function getMonthKey(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, "0")}`;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function buildMonthlyPaymentSummary(jobs) {
  const map = new Map();

  jobs.forEach((job) => {
    (job.paymentEvents || []).forEach((payment) => {
      const monthKey = getMonthKey(payment.date || job.updatedAt || job.createdAt);
      const current = map.get(monthKey) || {
        monthKey,
        label: getMonthLabel(monthKey),
        collected: 0,
        refunds: 0,
        netCollected: 0,
        paymentCount: 0,
      };

      const amount = num(payment.amount);

      if (payment.type === "Refund") {
        current.refunds += amount;
        current.netCollected -= amount;
      } else {
        current.collected += amount;
        current.netCollected += amount;
      }

      current.paymentCount += 1;
      map.set(monthKey, current);
    });
  });

  return [...map.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey)).slice(0, 8);
}

export default function PaymentsPage({
  jobs,
  selectedJobId,
  onSelectJob,
  onUpdateJob,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const selectedJob = jobs.find((job) => job.id === selectedJobId) || jobs[0];

  const filteredJobs = useMemo(() => {
    return jobs
      .filter((job) => matchesSearch(job, searchTerm) && matchesStatus(job, statusFilter))
      .sort((a, b) => {
        const aSummary = getPaymentSummary(a);
        const bSummary = getPaymentSummary(b);

        if (aSummary.dueStatus.isOverdue !== bSummary.dueStatus.isOverdue) {
          return aSummary.dueStatus.isOverdue ? -1 : 1;
        }

        return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
      });
  }, [jobs, searchTerm, statusFilter]);

  const reportSummary = useMemo(() => {
    return jobs.reduce(
      (summary, job) => {
        const payment = getPaymentSummary(job);
        const actualCost = calculateJobActualCost(job);

        summary.totalInvoiced += payment.quotedTotal;
        summary.totalCollected += payment.totalPaid;
        summary.totalOutstanding += payment.remaining;
        summary.knownCosts += actualCost;
        summary.estimatedProfit += payment.quotedTotal - actualCost;

        if (payment.status === "Unpaid") summary.unpaid += 1;
        if (payment.status === "Deposit Due") summary.depositDue += 1;
        if (payment.status === "Partially Paid") summary.partiallyPaid += 1;
        if (payment.status === "Paid in Full") summary.paid += 1;
        if (payment.status === "Overpaid") summary.overpaid += 1;
        if (payment.dueStatus.isOverdue && payment.remaining > 0) summary.overdue += 1;

        return summary;
      },
      {
        totalInvoiced: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        knownCosts: 0,
        estimatedProfit: 0,
        unpaid: 0,
        depositDue: 0,
        partiallyPaid: 0,
        paid: 0,
        overpaid: 0,
        overdue: 0,
      }
    );
  }, [jobs]);

  const monthlySummary = useMemo(() => buildMonthlyPaymentSummary(jobs), [jobs]);

  function addPayment(jobId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    onUpdateJob(jobId, {
      paymentEvents: [createPaymentEvent(), ...(job.paymentEvents || [])],
    });
  }

  function updatePayment(jobId, paymentId, key, value) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    onUpdateJob(jobId, {
      paymentEvents: (job.paymentEvents || []).map((payment) =>
        payment.id === paymentId ? { ...payment, [key]: value } : payment
      ),
    });
  }

  function removePayment(jobId, paymentId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    onUpdateJob(jobId, {
      paymentEvents: (job.paymentEvents || []).filter(
        (payment) => payment.id !== paymentId
      ),
    });
  }

  function updatePaymentMeta(jobId, key, value) {
    onUpdateJob(jobId, {
      [key]: value,
    });
  }

  function exportPaymentReport() {
    const rows = [
      [
        "Job Number",
        "Customer",
        "Job Name",
        "Payment Status",
        "Final Total",
        "Total Paid",
        "Remaining",
        "Deposit Required",
        "Suggested Deposit",
        "Deposit Paid",
        "Deposit Remaining",
        "Payment Due Date",
        "Due Status",
        "Known Costs",
        "Estimated Profit",
      ],
    ];

    jobs.forEach((job) => {
      const summary = getPaymentSummary(job);
      const knownCosts = calculateJobActualCost(job);

      rows.push([
        job.jobNumber || "",
        job.customerName || "",
        job.jobName || "",
        summary.status,
        summary.quotedTotal,
        summary.totalPaid,
        summary.remaining,
        summary.depositRequired ? "Yes" : "No",
        summary.suggestedDeposit,
        summary.depositPaid,
        summary.depositRemaining,
        job.paymentDueDate || "",
        summary.dueStatus.label,
        knownCosts,
        summary.quotedTotal - knownCosts,
      ]);
    });

    downloadCsv(`overkill-payment-report-${todayDateString()}.csv`, rows);
  }

  function exportMonthlyRevenueReport() {
    const rows = [
      ["Month", "Payment Count", "Collected", "Refunds", "Net Collected"],
      ...monthlySummary.map((month) => [
        month.label,
        month.paymentCount,
        month.collected,
        month.refunds,
        month.netCollected,
      ]),
    ];

    downloadCsv(`overkill-monthly-revenue-${todayDateString()}.csv`, rows);
  }

  if (jobs.length === 0) {
    return (
      <section className="page-panel">
        <h2 className="section-title brand-font">Payments</h2>

        <div className="empty-state">
          <h3>No jobs available.</h3>
          <p>Convert a quote to a job before tracking payments.</p>
        </div>
      </section>
    );
  }

  const payments = selectedJob?.paymentEvents || [];
  const selectedSummary = getPaymentSummary(selectedJob);

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Payments</h2>
          <p className="muted-text">
            Track deposits, balances, payment due dates, overdue invoices, refunds, and monthly payment reports.
          </p>
        </div>

        <div className="record-button-row customer-edit-actions">
          <button className="secondary-button" onClick={exportPaymentReport}>
            <Download size={18} />
            Export Payment CSV
          </button>

          <button className="secondary-button" onClick={exportMonthlyRevenueReport}>
            <Download size={18} />
            Export Monthly CSV
          </button>
        </div>
      </div>

      <div className="job-queue-summary">
        <div>
          <span>Total Invoiced</span>
          <strong>{money(reportSummary.totalInvoiced)}</strong>
        </div>

        <div>
          <span>Collected</span>
          <strong>{money(reportSummary.totalCollected)}</strong>
        </div>

        <div>
          <span>Outstanding</span>
          <strong>{money(reportSummary.totalOutstanding)}</strong>
        </div>

        <div>
          <span>Known Costs</span>
          <strong>{money(reportSummary.knownCosts)}</strong>
        </div>

        <div>
          <span>Estimated Profit</span>
          <strong>{money(reportSummary.estimatedProfit)}</strong>
        </div>

        <div>
          <span>Deposit Due</span>
          <strong>{reportSummary.depositDue}</strong>
        </div>

        <div>
          <span>Overdue</span>
          <strong>{reportSummary.overdue}</strong>
        </div>

        <div>
          <span>Paid Jobs</span>
          <strong>{reportSummary.paid}</strong>
        </div>
      </div>

      <div className="filter-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            type="search"
            value={searchTerm}
            placeholder="Search jobs by customer, job, status, due date, quote, invoice, or job number..."
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <label className="filter-select-field">
          <span>Payment Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {PAYMENT_STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status === "All" ? "All Payments" : status}
              </option>
            ))}
          </select>
        </label>

        <button
          className="secondary-button filter-clear-button"
          onClick={() => {
            setSearchTerm("");
            setStatusFilter("All");
          }}
        >
          Clear
        </button>

        <div className="filter-count-pill">
          Showing {filteredJobs.length} of {jobs.length}
        </div>
      </div>

      <div className="payments-layout">
        <aside className="payments-job-list">
          <h3 className="card-title">Jobs</h3>

          {filteredJobs.length === 0 ? (
            <p className="muted-text">No matching jobs.</p>
          ) : (
            filteredJobs.map((job) => {
              const summary = getPaymentSummary(job);
              const isActive = selectedJob?.id === job.id;

              return (
                <button
                  key={job.id}
                  className={`payment-job-button ${isActive ? "active" : ""}`}
                  onClick={() => onSelectJob(job.id)}
                >
                  <strong>{job.jobNumber}</strong>
                  <span>{job.jobName || "Untitled Job"}</span>
                  <small>
                    {money(summary.totalPaid)} / {money(summary.quotedTotal)}
                  </small>

                  <small>
                    {summary.status} • {summary.dueStatus.label}
                  </small>
                </button>
              );
            })
          )}
        </aside>

        <div className="payments-main">
          <div className="job-detail-card">
            <div className="record-card-top">
              <div>
                <h3>{selectedJob.jobNumber}</h3>
                <p>{selectedJob.customerName || "No Customer Name"}</p>
              </div>

              <span className="status-pill">{selectedSummary.status}</span>
            </div>

            <div className="record-title">
              {selectedJob.jobName || "Untitled Job"}
            </div>

            {selectedSummary.dueStatus.isOverdue && selectedSummary.remaining > 0 && (
              <div className="customer-warning-box">
                <strong>
                  <AlertTriangle size={18} /> Overdue Balance
                </strong>
                <p>
                  This job has {money(selectedSummary.remaining)} remaining and is {selectedSummary.dueStatus.label.toLowerCase()}.
                </p>
              </div>
            )}

            {selectedSummary.depositDue && (
              <div className="customer-warning-box">
                <strong>Deposit Required</strong>
                <p>
                  Suggested deposit is {money(selectedSummary.suggestedDeposit)}.
                  Deposit paid so far is {money(selectedSummary.depositPaid)}.
                  Remaining deposit needed is {money(selectedSummary.depositRemaining)}.
                </p>
              </div>
            )}

            <div className="job-summary-grid">
              <div>
                <span>Quoted Total</span>
                <strong>{money(selectedSummary.quotedTotal)}</strong>
              </div>

              <div>
                <span>Total Paid</span>
                <strong>{money(selectedSummary.totalPaid)}</strong>
              </div>

              <div>
                <span>Remaining</span>
                <strong>{money(selectedSummary.remaining)}</strong>
              </div>

              <div>
                <span>Payment Status</span>
                <strong>{selectedSummary.status}</strong>
              </div>

              <div>
                <span>Suggested Deposit</span>
                <strong>{money(selectedSummary.suggestedDeposit)}</strong>
              </div>

              <div>
                <span>Deposit Paid</span>
                <strong>{money(selectedSummary.depositPaid)}</strong>
              </div>

              <div>
                <span>Payment Due</span>
                <strong>{selectedJob.paymentDueDate || "Not set"}</strong>
              </div>

              <div>
                <span>Due Status</span>
                <strong>{selectedSummary.dueStatus.label}</strong>
              </div>
            </div>

            <div className="form-card single-row-gap">
              <h3 className="card-title">Payment Controls</h3>

              <div className="form-grid">
                <label className="field checkbox-field">
                  <input
                    type="checkbox"
                    checked={selectedSummary.depositRequired}
                    onChange={(event) =>
                      updatePaymentMeta(selectedJob.id, "depositRequired", event.target.checked)
                    }
                  />
                  <span>Deposit Required</span>
                </label>

                <Field
                  label="Payment Due Date"
                  type="date"
                  value={selectedJob.paymentDueDate || ""}
                  onChange={(value) =>
                    updatePaymentMeta(selectedJob.id, "paymentDueDate", value)
                  }
                />

                <label className="field full-span">
                  <span>Payment Notes</span>
                  <textarea
                    value={selectedJob.paymentNotes || ""}
                    onChange={(event) =>
                      updatePaymentMeta(selectedJob.id, "paymentNotes", event.target.value)
                    }
                    placeholder="Deposit terms, invoice notes, late payment notes, customer payment preference, etc."
                  />
                </label>
              </div>
            </div>

            <div className="record-button-row single-row-gap">
              <button
                className="secondary-button"
                onClick={() => exportInvoicePdf(selectedJob)}
              >
                <FileDown size={18} />
                Export Invoice PDF
              </button>

              <button
                className="secondary-button"
                onClick={() => addPayment(selectedJob.id)}
              >
                <Plus size={18} />
                Add Payment
              </button>
            </div>

            <div className="page-heading-row single-row-gap">
              <div>
                <h3 className="card-title">Payment Events</h3>
                <p className="muted-text">
                  Add one payment event at a time, similar to the production log.
                </p>
              </div>
            </div>

            <div className="vinyl-lines">
              {payments.length === 0 ? (
                <p className="muted-text">No payment events yet.</p>
              ) : (
                payments.map((payment, index) => (
                  <div className="vinyl-line" key={payment.id}>
                    <div className="vinyl-line-header">
                      <strong>Payment Event {index + 1}</strong>
                      <span>{payment.type === "Refund" ? "-" : ""}{money(payment.amount)}</span>
                    </div>

                    <div className="form-grid">
                      <label className="field">
                        <span>Payment Type</span>
                        <select
                          value={payment.type}
                          onChange={(event) =>
                            updatePayment(
                              selectedJob.id,
                              payment.id,
                              "type",
                              event.target.value
                            )
                          }
                        >
                          {PAYMENT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Method</span>
                        <select
                          value={payment.method}
                          onChange={(event) =>
                            updatePayment(
                              selectedJob.id,
                              payment.id,
                              "method",
                              event.target.value
                            )
                          }
                        >
                          {PAYMENT_METHODS.map((method) => (
                            <option key={method} value={method}>
                              {method}
                            </option>
                          ))}
                        </select>
                      </label>

                      <Field
                        label="Amount"
                        type="number"
                        value={payment.amount}
                        onChange={(value) =>
                          updatePayment(selectedJob.id, payment.id, "amount", value)
                        }
                      />

                      <Field
                        label="Date"
                        type="date"
                        value={payment.date}
                        onChange={(value) =>
                          updatePayment(selectedJob.id, payment.id, "date", value)
                        }
                      />

                      <Field
                        label="Time"
                        type="time"
                        value={payment.time}
                        onChange={(value) =>
                          updatePayment(selectedJob.id, payment.id, "time", value)
                        }
                      />

                      <button
                        className="secondary-button danger-button"
                        onClick={() => removePayment(selectedJob.id, payment.id)}
                        type="button"
                      >
                        <Trash2 size={18} />
                        Remove
                      </button>
                    </div>

                    <label className="field single-row-gap">
                      <span>Notes</span>
                      <textarea
                        value={payment.notes}
                        onChange={(event) =>
                          updatePayment(
                            selectedJob.id,
                            payment.id,
                            "notes",
                            event.target.value
                          )
                        }
                        placeholder="Deposit received through Venmo, final cash payment, refund reason, etc."
                      />
                    </label>
                  </div>
                ))
              )}
            </div>

            <div className="form-card single-row-gap">
              <h3 className="card-title">Monthly Revenue Summary</h3>

              {monthlySummary.length === 0 ? (
                <p className="muted-text">No payment history yet.</p>
              ) : (
                <div className="dashboard-list">
                  {monthlySummary.map((month) => (
                    <div className="dashboard-list-row" key={month.monthKey}>
                      <div>
                        <strong>{month.label}</strong>
                        <span>{month.paymentCount} payment event(s)</span>
                      </div>

                      <div className="dashboard-status-stack">
                        <span className="status-pill">Collected {money(month.collected)}</span>
                        <span className="status-pill">Refunds {money(month.refunds)}</span>
                        <span className="status-pill">Net {money(month.netCollected)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}