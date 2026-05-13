import { useMemo, useRef, useState } from "react";
import {
  CheckCircle,
  ChevronDown,
  Copy,
  FileDown,
  Pencil,
  RefreshCcw,
  Search,
  Send,
  TimerOff,
  Upload,
  Trash2,
  XCircle,
} from "lucide-react";
import { exportQuotePdf } from "../utils/pdf";

const QUOTE_STATUS_OPTIONS = [
  "All",
  "Draft Quote",
  "Sent",
  "Approved",
  "Declined",
  "Expired",
  "Stale",
];

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function getQuoteStatus(quote) {
  return quote.quoteStatus || quote.status || "Draft Quote";
}

function getRevisionLabel(quote) {
  const revisionNumber = Number(quote.revisionNumber || 0);

  if (revisionNumber > 0) return `Revision ${revisionNumber}`;
  if (quote.sourceQuoteNumber) return "Copied Quote";
  return "Original Quote";
}

function getQuoteLineageText(quote) {
  if (quote.revisionNumber > 0 && quote.sourceQuoteNumber) {
    return `Revised from ${quote.sourceQuoteNumber}`;
  }

  if (quote.sourceQuoteNumber) {
    return `Copied from ${quote.sourceQuoteNumber}`;
  }

  return "";
}

function getAgeInDays(value) {
  if (!value) return 0;

  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return 0;

  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return Math.max(0, Math.floor((today - start) / 1000 / 60 / 60 / 24));
}

function getExpirationInfo(quote) {
  if (!quote.expiresAt) {
    return {
      label: "No expiration",
      daysRemaining: null,
      isExpiredByDate: false,
      isExpiringSoon: false,
    };
  }

  const today = new Date();
  const expires = new Date(`${quote.expiresAt}T00:00:00`);

  today.setHours(0, 0, 0, 0);

  if (Number.isNaN(expires.getTime())) {
    return {
      label: "Invalid expiration",
      daysRemaining: null,
      isExpiredByDate: false,
      isExpiringSoon: false,
    };
  }

  const daysRemaining = Math.ceil((expires - today) / 1000 / 60 / 60 / 24);

  if (daysRemaining < 0) {
    return {
      label: `Expired by date ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} ago`,
      daysRemaining,
      isExpiredByDate: true,
      isExpiringSoon: false,
    };
  }

  if (daysRemaining === 0) {
    return {
      label: "Expires today",
      daysRemaining,
      isExpiredByDate: false,
      isExpiringSoon: true,
    };
  }

  if (daysRemaining <= 7) {
    return {
      label: `Expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
      daysRemaining,
      isExpiredByDate: false,
      isExpiringSoon: true,
    };
  }

  return {
    label: `Expires in ${daysRemaining} days`,
    daysRemaining,
    isExpiredByDate: false,
    isExpiringSoon: false,
  };
}

function getQuoteWorkflowMeta(quote) {
  const status = getQuoteStatus(quote);
  const ageDays = getAgeInDays(quote.createdAt);
  const expiration = getExpirationInfo(quote);
  const isClosed = ["Approved", "Declined", "Expired"].includes(status);
  const isStale = !isClosed && ageDays >= 14;
  const isExpired = status === "Expired" || expiration.isExpiredByDate;

  return {
    status,
    ageDays,
    expiration,
    isClosed,
    isStale,
    isExpired,
    warningLabel: isExpired
      ? "Expired"
      : isStale
        ? `Stale: ${ageDays} days old`
        : expiration.isExpiringSoon
          ? expiration.label
          : "",
  };
}

function matchesQuoteSearch(quote, searchTerm) {
  const search = searchTerm.trim().toLowerCase();

  if (!search) return true;

  const meta = getQuoteWorkflowMeta(quote);

  return [
    quote.quoteNumber,
    quote.customerName,
    quote.customerPhone,
    quote.customerEmail,
    quote.jobName,
    getQuoteStatus(quote),
    quote.revisionNumber ? `revision ${quote.revisionNumber}` : "",
    quote.sourceQuoteNumber,
    quote.originalRecordNumber,
    quote.sourceRecordNumber,
    getRevisionLabel(quote),
    getQuoteLineageText(quote),
    quote.expiresAt,
    meta.warningLabel,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(search));
}

function matchesStatusFilter(quote, statusFilter) {
  if (statusFilter === "All") return true;

  const meta = getQuoteWorkflowMeta(quote);

  if (statusFilter === "Stale") return meta.isStale;

  return meta.status === statusFilter;
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

function sortQuotes(quotes) {
  return [...quotes].sort((a, b) => {
    const aMeta = getQuoteWorkflowMeta(a);
    const bMeta = getQuoteWorkflowMeta(b);

    if (aMeta.isExpired !== bMeta.isExpired) return aMeta.isExpired ? -1 : 1;
    if (aMeta.isStale !== bMeta.isStale) return aMeta.isStale ? -1 : 1;

    return (
      new Date(b.updatedAt || b.createdAt || 0) -
      new Date(a.updatedAt || a.createdAt || 0)
    );
  });
}

export default function QuotesPage({
  quotes,
  onEditQuote,
  onDuplicateQuote,
  onReviseQuote,
  onUpdateQuoteWorkflow,
  onMarkQuoteSent,
  onMarkQuoteApproved,
  onMarkQuoteDeclined,
  onMarkQuoteExpired,
  onUpdateQuoteExpiration,
  onConvertToJob,
  onDeleteQuote,
  onImportPdf,
  importMessage,
}) {
  const fileInputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedQuoteId, setExpandedQuoteId] = useState("");

  const filteredQuotes = useMemo(() => {
    return sortQuotes(
      quotes.filter((quote) => {
        return (
          matchesQuoteSearch(quote, searchTerm) &&
          matchesStatusFilter(quote, statusFilter)
        );
      })
    );
  }, [quotes, searchTerm, statusFilter]);

  const quoteCounts = useMemo(() => {
    const counts = {
      all: quotes.length,
      draft: 0,
      sent: 0,
      approved: 0,
      declined: 0,
      expired: 0,
      stale: 0,
      expiringSoon: 0,
    };

    quotes.forEach((quote) => {
      const meta = getQuoteWorkflowMeta(quote);

      if (meta.status === "Draft Quote") counts.draft += 1;
      if (meta.status === "Sent") counts.sent += 1;
      if (meta.status === "Approved") counts.approved += 1;
      if (meta.status === "Declined") counts.declined += 1;
      if (meta.isExpired) counts.expired += 1;
      if (meta.isStale) counts.stale += 1;
      if (meta.expiration.isExpiringSoon) counts.expiringSoon += 1;
    });

    return counts;
  }, [quotes]);

  function handleImportChange(event) {
    const file = event.target.files?.[0];

    if (file) {
      onImportPdf(file);
    }

    event.target.value = "";
  }

  function setStatusManually(quote, status) {
    if (status === "Sent") {
      onMarkQuoteSent(quote.id);
      return;
    }

    if (status === "Approved") {
      onMarkQuoteApproved(quote.id);
      return;
    }

    if (status === "Declined") {
      onMarkQuoteDeclined(quote.id);
      return;
    }

    if (status === "Expired") {
      onMarkQuoteExpired(quote.id);
      return;
    }

    onUpdateQuoteWorkflow(quote.id, {
      status,
      quoteStatus: status,
    });
  }

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Quotes</h2>

          <p className="muted-text">
            Collapsible quote history with revisions, workflow status,
            expirations, stale warnings, duplicated drafts, and pricing records.
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
            Import Quote PDF
          </button>
        </div>
      </div>

      <div className="job-queue-summary">
        <div>
          <span>Total Quotes</span>
          <strong>{quoteCounts.all}</strong>
        </div>

        <div>
          <span>Drafts</span>
          <strong>{quoteCounts.draft}</strong>
        </div>

        <div>
          <span>Sent</span>
          <strong>{quoteCounts.sent}</strong>
        </div>

        <div>
          <span>Approved</span>
          <strong>{quoteCounts.approved}</strong>
        </div>

        <div>
          <span>Declined</span>
          <strong>{quoteCounts.declined}</strong>
        </div>

        <div>
          <span>Expired</span>
          <strong>{quoteCounts.expired}</strong>
        </div>

        <div>
          <span>Stale</span>
          <strong>{quoteCounts.stale}</strong>
        </div>

        <div>
          <span>Expiring Soon</span>
          <strong>{quoteCounts.expiringSoon}</strong>
        </div>
      </div>

      <div className="filter-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            type="search"
            value={searchTerm}
            placeholder="Search quotes by customer, job, phone, email, quote number, status, revision, expiration, or source quote..."
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <label className="filter-select-field">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {QUOTE_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === "All" ? "All Statuses" : status}
              </option>
            ))}
          </select>
        </label>

        <button
          className="secondary-button filter-clear-button"
          type="button"
          onClick={() => {
            setSearchTerm("");
            setStatusFilter("All");
          }}
        >
          Clear
        </button>

        <div className="filter-count-pill">
          Showing {filteredQuotes.length} of {quotes.length}
        </div>
      </div>

      {quotes.length === 0 ? (
        <div className="empty-state">
          <h3>No active quotes.</h3>
          <p>Create a quote in the calculator to begin tracking work.</p>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="empty-state">
          <h3>No matching quotes.</h3>
          <p>
            Try a different customer name, job name, phone number, email, quote
            number, status, revision, or expiration search.
          </p>
        </div>
      ) : (
        <div className="jobs-stack">
          {filteredQuotes.map((quote) => {
            const lineageText = getQuoteLineageText(quote);
            const revisionLabel = getRevisionLabel(quote);
            const meta = getQuoteWorkflowMeta(quote);
            const status = meta.status;
            const isExpanded = expandedQuoteId === quote.id;

            return (
              <article
                className={`job-detail-card expandable-job-card ${isExpanded ? "expanded" : ""}`}
                key={quote.id}
              >
                <button
                  className="job-list-header"
                  type="button"
                  onClick={() => setExpandedQuoteId(isExpanded ? "" : quote.id)}
                >
                  <div className="job-list-main">
                    <strong>{quote.quoteNumber}</strong>
                    <span>{quote.customerName || "No Customer Name"}</span>
                    <small>{quote.jobName || "Untitled Job"}</small>
                  </div>

                  <div className="job-list-meta">
                    <span className={`job-status-button status-${slug(status)}`}>
                      {status}
                    </span>

                    {Number(quote.revisionNumber || 0) > 0 && (
                      <span className="status-pill">Rev {quote.revisionNumber}</span>
                    )}

                    {meta.isStale && <span className="status-pill">Stale</span>}
                    {meta.isExpired && <span className="status-pill">Expired</span>}
                    {meta.expiration.isExpiringSoon && (
                      <span className="status-pill">Expiring Soon</span>
                    )}

                    <span className="status-pill">{meta.ageDays} day old</span>
                    <strong>{money(quote.finalTotal)}</strong>

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
                        <h3>{quote.quoteNumber}</h3>
                        <p>{quote.customerName || "No Customer Name"}</p>
                      </div>

                      <span className="status-pill">{status}</span>
                    </div>

                    <div className="record-title">
                      {quote.jobName || "Untitled Job"}
                    </div>

                    {meta.warningLabel && (
                      <div className="customer-warning-box">
                        <strong>{meta.warningLabel}</strong>
                        <p>
                          Quote age: {meta.ageDays} day
                          {meta.ageDays === 1 ? "" : "s"}.
                          {quote.expiresAt
                            ? ` Expiration date: ${quote.expiresAt}.`
                            : " No expiration date set."}
                        </p>
                      </div>
                    )}

                    <div className="record-details single-row-gap">
                      <div>
                        <span>Total</span>
                        <strong>{money(quote.finalTotal)}</strong>
                      </div>

                      <div>
                        <span>Deposit</span>
                        <strong>{money(quote.depositAmount)}</strong>
                      </div>

                      <div>
                        <span>Remaining</span>
                        <strong>{money(quote.remainingBalance)}</strong>
                      </div>

                      <div>
                        <span>Created</span>
                        <strong>{formatDate(quote.createdAt)}</strong>
                      </div>

                      <div>
                        <span>Age</span>
                        <strong>
                          {meta.ageDays} day{meta.ageDays === 1 ? "" : "s"}
                        </strong>
                      </div>

                      <div>
                        <span>Expires</span>
                        <strong>{quote.expiresAt || "Not set"}</strong>
                      </div>

                      <div>
                        <span>Expiration Status</span>
                        <strong>{meta.expiration.label}</strong>
                      </div>

                      <div>
                        <span>Version</span>
                        <strong>{revisionLabel}</strong>
                      </div>

                      <div>
                        <span>Source</span>
                        <strong>{lineageText || "New Quote"}</strong>
                      </div>

                      <div>
                        <span>Sent</span>
                        <strong>{formatDateTime(quote.sentAt)}</strong>
                      </div>

                      <div>
                        <span>Approved</span>
                        <strong>{formatDateTime(quote.approvedAt)}</strong>
                      </div>

                      <div>
                        <span>Declined</span>
                        <strong>{formatDateTime(quote.declinedAt)}</strong>
                      </div>
                    </div>

                    <div className="form-card single-row-gap">
                      <h3 className="card-title">Quote Workflow</h3>

                      <div className="form-grid">
                        <label className="field">
                          <span>Quote Status</span>
                          <select
                            value={status}
                            onChange={(event) =>
                              setStatusManually(quote, event.target.value)
                            }
                          >
                            <option value="Draft Quote">Draft Quote</option>
                            <option value="Sent">Sent</option>
                            <option value="Approved">Approved</option>
                            <option value="Declined">Declined</option>
                            <option value="Expired">Expired</option>
                          </select>
                        </label>

                        <label className="field">
                          <span>Expiration Date</span>
                          <input
                            type="date"
                            value={quote.expiresAt || ""}
                            onChange={(event) =>
                              onUpdateQuoteExpiration(quote.id, event.target.value)
                            }
                          />
                        </label>
                      </div>
                    </div>

                    <div className="record-tags single-row-gap">
                      {quote.jobAspects?.cad && <span>CAD</span>}
                      {quote.jobAspects?.printing && <span>3D Printing</span>}
                      {quote.jobAspects?.engraving && <span>Engraving</span>}
                      {quote.jobAspects?.vinyl && <span>Vinyl</span>}
                      {quote.jobAspects?.custom && <span>Custom</span>}
                      {quote.importedFromPdf && <span>Imported PDF</span>}
                      {Number(quote.revisionNumber || 0) > 0 && (
                        <span>Rev {quote.revisionNumber}</span>
                      )}
                      {quote.sourceQuoteNumber && (
                        <span>Source {quote.sourceQuoteNumber}</span>
                      )}
                      {meta.isStale && <span>Stale</span>}
                      {meta.isExpired && <span>Expired</span>}
                      {meta.expiration.isExpiringSoon && <span>Expiring Soon</span>}
                    </div>

                    <div className="record-button-row job-action-row">
                      <button
                        className="secondary-button"
                        onClick={() => onEditQuote(quote.id)}
                      >
                        <Pencil size={18} />
                        Edit Quote
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() => exportQuotePdf(quote)}
                      >
                        <FileDown size={18} />
                        Export PDF
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() => onDuplicateQuote(quote.id)}
                      >
                        <Copy size={18} />
                        Duplicate
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() => onReviseQuote(quote.id)}
                      >
                        <RefreshCcw size={18} />
                        Revise
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() => onMarkQuoteSent(quote.id)}
                      >
                        <Send size={18} />
                        Mark Sent
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() => onMarkQuoteApproved(quote.id)}
                      >
                        <CheckCircle size={18} />
                        Approve
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() => onMarkQuoteDeclined(quote.id)}
                      >
                        <XCircle size={18} />
                        Decline
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() => onMarkQuoteExpired(quote.id)}
                      >
                        <TimerOff size={18} />
                        Expire
                      </button>

                      <button
                        className="secondary-button danger-button"
                        onClick={() => onDeleteQuote(quote.id)}
                      >
                        <Trash2 size={18} />
                        Delete Quote
                      </button>

                      <button
                        className="primary-button record-action"
                        onClick={() => onConvertToJob(quote.id)}
                      >
                        Convert to Job
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}