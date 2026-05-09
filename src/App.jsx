import { useMemo, useState } from "react";
import {
  LayoutDashboard,
  Calculator,
  FileText,
  Hammer,
  Settings,
  CreditCard,
} from "lucide-react";

import CalculatorPage from "./components/CalculatorPage";
import QuotesPage from "./components/QuotesPage";
import JobsPage from "./components/JobsPage";
import PaymentsPage from "./components/PaymentsPage";
import DashboardPage from "./components/DashboardPage";

import overkillLogo from "./assets/logos/overkill_main.png";
import overkillMark from "./assets/logos/overkill_mark.png";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "calculator", label: "Calculator", icon: Calculator },
  { id: "quotes", label: "Quotes", icon: FileText },
  { id: "jobs", label: "Jobs", icon: Hammer },
  { id: "payments", label: "Payments", icon: CreditCard },
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

function PlaceholderPage({ title, description }) {
  return (
    <section className="page-panel">
      <h2 className="section-title brand-font">{title}</h2>
      <p className="muted-text">{description}</p>
    </section>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [quotes, setQuotes] = useState(() => getInitialState("overkill_quotes", []));
  const [jobs, setJobs] = useState(() => getInitialState("overkill_jobs", []));
  const [usedRecordNumbers, setUsedRecordNumbers] = useState(() =>
    getInitialState("overkill_used_record_numbers", [])
  );
  const [selectedPaymentJobId, setSelectedPaymentJobId] = useState("");
  const [editingQuoteId, setEditingQuoteId] = useState(null);

  const editingQuote = quotes.find((quote) => quote.id === editingQuoteId) || null;

  function saveToStorage(nextQuotes, nextJobs, nextUsedNumbers) {
    localStorage.setItem("overkill_quotes", JSON.stringify(nextQuotes));
    localStorage.setItem("overkill_jobs", JSON.stringify(nextJobs));
    localStorage.setItem(
      "overkill_used_record_numbers",
      JSON.stringify(nextUsedNumbers)
    );
  }

  function generateNextRecordNumber() {
    const highest = usedRecordNumbers.length
      ? Math.max(...usedRecordNumbers)
      : 1000;

    return highest + 1;
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

  const sidebarStats = useMemo(() => {
    const totalQuoted = quotes.reduce(
      (sum, quote) => sum + Number(quote.finalTotal || 0),
      0
    );

    const totalJobsValue = jobs.reduce(
      (sum, job) => sum + Number(job.finalTotal || 0),
      0
    );

    return {
      totalQuotes: quotes.length,
      totalJobs: jobs.length,
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
      />
    ),
    quotes: (
      <QuotesPage
        quotes={quotes}
        onEditQuote={startEditQuote}
        onConvertToJob={convertQuoteToJob}
      />
    ),
    jobs: <JobsPage jobs={jobs} onUpdateJob={updateJob} />,
    payments: (
      <PaymentsPage
        jobs={jobs}
        selectedJobId={selectedPaymentJobId}
        onSelectJob={setSelectedPaymentJobId}
        onUpdateJob={updateJob}
      />
    ),
    settings: (
      <PlaceholderPage
        title="Settings"
        description="Rates, materials, payment methods, tax options, and app preferences will live here."
      />
    ),
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
            <span>Jobs</span>
            <strong>{sidebarStats.totalJobs}</strong>
          </div>

          <div>
            <span>Quoted</span>
            <strong>{money(sidebarStats.totalQuoted)}</strong>
          </div>

          <div>
            <span>Jobs Value</span>
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