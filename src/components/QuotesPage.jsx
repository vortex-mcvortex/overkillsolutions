import { useMemo, useRef, useState } from "react";
import { FileDown, Pencil, Search, Upload, Trash2 } from "lucide-react";
import { exportQuotePdf } from "../utils/pdf";

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function matchesQuoteSearch(quote, searchTerm) {
  const search = searchTerm.trim().toLowerCase();

  if (!search) return true;

  return [
    quote.quoteNumber,
    quote.customerName,
    quote.customerPhone,
    quote.customerEmail,
    quote.jobName,
    quote.status,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(search));
}

export default function QuotesPage({
  quotes,
  onEditQuote,
  onConvertToJob,
  onDeleteQuote,
  onImportPdf,
  importMessage,
}) {
  const fileInputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredQuotes = useMemo(() => {
    return quotes.filter((quote) => matchesQuoteSearch(quote, searchTerm));
  }, [quotes, searchTerm]);

  function handleImportChange(event) {
    const file = event.target.files?.[0];

    if (file) {
      onImportPdf(file);
    }

    event.target.value = "";
  }

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Quotes</h2>

          <p className="muted-text">
            Saved quote history and pricing records.
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

      <div className="filter-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            type="search"
            value={searchTerm}
            placeholder="Search quotes by customer, job, phone, email, or quote number..."
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

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
          <p>Try a different customer name, job name, phone number, email, or quote number.</p>
        </div>
      ) : (
        <div className="records-grid">
          {filteredQuotes.map((quote) => (
            <article className="record-card" key={quote.id}>
              <div className="record-card-top">
                <div>
                  <h3>{quote.quoteNumber}</h3>
                  <p>{quote.customerName || "No Customer Name"}</p>
                </div>

                <span className="status-pill">{quote.status}</span>
              </div>

              <div className="record-title">
                {quote.jobName || "Untitled Job"}
              </div>

              <div className="record-details">
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
                  <strong>
                    {new Date(quote.createdAt).toLocaleDateString()}
                  </strong>
                </div>
              </div>

              <div className="record-tags">
                {quote.jobAspects?.cad && <span>CAD</span>}
                {quote.jobAspects?.printing && <span>3D Printing</span>}
                {quote.jobAspects?.engraving && <span>Engraving</span>}
                {quote.jobAspects?.vinyl && <span>Vinyl</span>}
                {quote.jobAspects?.custom && <span>Custom</span>}
                {quote.importedFromPdf && <span>Imported PDF</span>}
              </div>

              <div className="record-button-row quote-button-row">
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
            </article>
          ))}
        </div>
      )}
    </section>
  );
}