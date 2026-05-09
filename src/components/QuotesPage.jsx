import { FileDown, Pencil } from "lucide-react";
import { exportQuotePdf } from "../utils/pdf";

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function QuotesPage({
  quotes,
  onEditQuote,
  onConvertToJob,
}) {
  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Quotes</h2>

          <p className="muted-text">
            Saved quote history and pricing records.
          </p>
        </div>
      </div>

      {quotes.length === 0 ? (
        <div className="empty-state">
          <h3>No active quotes.</h3>
          <p>Create a quote in the calculator to begin tracking work.</p>
        </div>
      ) : (
        <div className="records-grid">
          {quotes.map((quote) => (
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
                    {new Date(
                      quote.createdAt
                    ).toLocaleDateString()}
                  </strong>
                </div>
              </div>

              <div className="record-tags">
                {quote.jobAspects?.cad && <span>CAD</span>}
                {quote.jobAspects?.printing && <span>3D Printing</span>}
                {quote.jobAspects?.engraving && <span>Engraving</span>}
                {quote.jobAspects?.vinyl && <span>Vinyl</span>}
                {quote.jobAspects?.custom && <span>Custom</span>}
              </div>

              <div className="record-button-row">
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