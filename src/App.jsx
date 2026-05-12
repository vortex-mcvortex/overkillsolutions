import { useMemo, useState } from "react";
import {
  LayoutDashboard,
  Calculator,
  FileText,
  Hammer,
  Settings,
  CreditCard,
  Users,
} from "lucide-react";

import CalculatorPage from "./components/CalculatorPage";
import QuotesPage from "./components/QuotesPage";
import JobsPage from "./components/JobsPage";
import PaymentsPage from "./components/PaymentsPage";
import DashboardPage from "./components/DashboardPage";
import SettingsPage from "./components/SettingsPage";
import CustomersPage from "./components/CustomersPage";
import { importOverkillPdf } from "./utils/pdfImport";

import overkillLogo from "./assets/logos/overkill_main.png";
import overkillMark from "./assets/logos/overkill_mark.png";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "calculator", label: "Calculator", icon: Calculator },
  { id: "quotes", label: "Quotes", icon: FileText },
  { id: "jobs", label: "Jobs", icon: Hammer },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "customers", label: "Customers", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function getInitialState(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
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

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [quotes, setQuotes] = useState(() => getInitialState("overkill_quotes", []));
  const [jobs, setJobs] = useState(() => getInitialState("overkill_jobs", []));
  const [customerOverrides, setCustomerOverrides] = useState(() =>
    getInitialState("overkill_customer_overrides", {})
  );
  const [manualCustomers, setManualCustomers] = useState(() =>
    getInitialState("overkill_manual_customers", [])
  );
  const [usedRecordNumbers, setUsedRecordNumbers] = useState(() =>
    getInitialState("overkill_used_record_numbers", [])
  );
  const [selectedPaymentJobId, setSelectedPaymentJobId] = useState("");
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const [importMessage, setImportMessage] = useState("");

  const editingQuote = quotes.find((quote) => quote.id === editingQuoteId) || null;

  function saveToStorage(nextQuotes, nextJobs, nextUsedNumbers) {
    localStorage.setItem("overkill_quotes", JSON.stringify(nextQuotes));
    localStorage.setItem("overkill_jobs", JSON.stringify(nextJobs));
    localStorage.setItem("overkill_used_record_numbers", JSON.stringify(nextUsedNumbers));
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

  function convertQuoteToJob(quoteId) {
    const quote = quotes.find((item) => item.id === quoteId);
    if (!quote) return;

    const newJob = {
      ...quote,
      id: crypto.randomUUID(),
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      jobNumber: `J-${quote.recordNumber}`,
      invoiceNumber: null,
      status: "Approved",
      archived: false,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      quoteSnapshot: { ...quote },
      actuals: {
        materialCost: 0,
        failedPrintCost: 0,
        extraCost: 0,
        notes: "",
      },
      timeEvents: [],
      paymentEvents: [],
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
      actuals: {
        materialCost: 0,
        failedPrintCost: 0,
        extraCost: 0,
        notes: "",
      },
      timeEvents: [],
      paymentEvents: [],
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
        status: record.status || "Draft Quote",
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

    return {
      totalQuotes: quotes.length,
      totalJobs: activeJobs.length,
      totalQuoted,
      totalJobsValue,
    };
  }, [quotes, jobs]);

  const pageContent = {
    dashboard: <DashboardPage quotes={quotes} jobs={jobs} />,
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
        onConvertToJob={convertQuoteToJob}
        onDeleteQuote={deleteQuote}
        onImportPdf={(file) => importPdfFile(file, "quote")}
        importMessage={importMessage}
      />
    ),
    jobs: (
      <JobsPage
        jobs={jobs}
        onUpdateJob={updateJob}
        onArchiveJob={archiveJob}
        onRestoreJob={restoreJob}
        onDeleteJob={deleteJob}
        onDuplicateJob={duplicateJob}
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
            <span>Quoted</span>
            <strong>{money(sidebarStats.totalQuoted)}</strong>
          </div>

          <div>
            <span>Active Value</span>
            <strong>{money(sidebarStats.totalJobsValue)}</strong>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="top-header">
          <img src={overkillLogo} alt="Overkill Solutions" className="top-logo" />

          <div>
            <h1 className="brand-font app-title">INTERNAL PRODUCTION SYSTEM</h1>
            <p className="muted-text">
              Quotes, jobs, time tracking, invoices, and profitability.
            </p>
          </div>
        </header>

        {pageContent[activePage]}
      </main>
    </div>
  );
}