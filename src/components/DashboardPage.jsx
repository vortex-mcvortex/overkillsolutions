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

function getPaidTotal(job) {
  return (job.paymentEvents || []).reduce((sum, payment) => {
    if (payment.type === "Refund") return sum - num(payment.amount);
    return sum + num(payment.amount);
  }, 0);
}

function getPaymentStatus(job) {
  const total = num(job.finalTotal);
  const paid = getPaidTotal(job);

  if (paid <= 0) return "Unpaid";
  if (paid >= total) return paid > total ? "Overpaid" : "Paid in Full";
  return "Partially Paid";
}

function calculateJobActualCost(job) {
  const actuals = job.actuals || {};
  return (
    num(actuals.materialCost) +
    num(actuals.failedPrintCost) +
    num(actuals.extraCost)
  );
}

export default function DashboardPage({ quotes, jobs }) {
  const totalQuoteValue = quotes.reduce(
    (sum, quote) => sum + num(quote.finalTotal),
    0
  );

  const totalJobValue = jobs.reduce(
    (sum, job) => sum + num(job.finalTotal),
    0
  );

  const totalCollected = jobs.reduce(
    (sum, job) => sum + getPaidTotal(job),
    0
  );

  const outstandingBalance = jobs.reduce((sum, job) => {
    return sum + Math.max(0, num(job.finalTotal) - getPaidTotal(job));
  }, 0);

  const estimatedKnownCost = jobs.reduce(
    (sum, job) => sum + calculateJobActualCost(job),
    0
  );

  const estimatedProfit = totalJobValue - estimatedKnownCost;

  const recentQuotes = [...quotes]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 5);

  const recentJobs = [...jobs]
    .sort((a, b) => new Date(b.updatedAt || b.approvedAt) - new Date(a.updatedAt || a.approvedAt))
    .slice(0, 5);

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Dashboard</h2>
          <p className="muted-text">
            Business snapshot for quotes, jobs, payments, and profitability.
          </p>
        </div>
      </div>

      <div className="dashboard-stat-grid">
        <div className="dashboard-stat-card">
          <span>Active Quotes</span>
          <strong>{quotes.length}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span>Active Jobs</span>
          <strong>{jobs.length}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span>Quote Value</span>
          <strong>{money(totalQuoteValue)}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span>Job Value</span>
          <strong>{money(totalJobValue)}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span>Collected</span>
          <strong>{money(totalCollected)}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span>Outstanding</span>
          <strong>{money(outstandingBalance)}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span>Known Costs</span>
          <strong>{money(estimatedKnownCost)}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span>Estimated Profit</span>
          <strong>{money(estimatedProfit)}</strong>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="form-card">
          <h3 className="card-title">Recent Quotes</h3>

          {recentQuotes.length === 0 ? (
            <p className="muted-text">No quotes yet.</p>
          ) : (
            <div className="dashboard-list">
              {recentQuotes.map((quote) => (
                <div className="dashboard-list-row" key={quote.id}>
                  <div>
                    <strong>{quote.quoteNumber}</strong>
                    <span>{quote.jobName || "Untitled Job"}</span>
                  </div>
                  <strong>{money(quote.finalTotal)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-card">
          <h3 className="card-title">Recent Jobs</h3>

          {recentJobs.length === 0 ? (
            <p className="muted-text">No jobs yet.</p>
          ) : (
            <div className="dashboard-list">
              {recentJobs.map((job) => (
                <div className="dashboard-list-row" key={job.id}>
                  <div>
                    <strong>{job.jobNumber}</strong>
                    <span>{job.jobName || "Untitled Job"}</span>
                  </div>
                  <span className="status-pill">{getPaymentStatus(job)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}