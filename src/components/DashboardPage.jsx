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
  if (paid >= total) return paid > total ? "Overpaid" : "Paid";
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
  const activeJobs = jobs.filter((job) => !job.archived);
  const archivedJobs = jobs.filter((job) => job.archived);

  const totalQuoteValue = quotes.reduce(
    (sum, quote) => sum + num(quote.finalTotal),
    0
  );

  const totalActiveJobValue = activeJobs.reduce(
    (sum, job) => sum + num(job.finalTotal),
    0
  );

  const totalArchivedJobValue = archivedJobs.reduce(
    (sum, job) => sum + num(job.finalTotal),
    0
  );

  const totalCollected = activeJobs.reduce(
    (sum, job) => sum + getPaidTotal(job),
    0
  );

  const outstandingBalance = activeJobs.reduce((sum, job) => {
    return sum + Math.max(0, num(job.finalTotal) - getPaidTotal(job));
  }, 0);

  const estimatedKnownCost = activeJobs.reduce(
    (sum, job) => sum + calculateJobActualCost(job),
    0
  );

  const estimatedProfit = totalActiveJobValue - estimatedKnownCost;

  const recentQuotes = [...quotes]
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt) -
        new Date(a.updatedAt || a.createdAt)
    )
    .slice(0, 5);

  const recentActiveJobs = [...activeJobs]
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.approvedAt) -
        new Date(a.updatedAt || a.approvedAt)
    )
    .slice(0, 5);

  const recentArchivedJobs = [...archivedJobs]
    .sort(
      (a, b) =>
        new Date(b.archivedAt || b.updatedAt || b.approvedAt) -
        new Date(a.archivedAt || a.updatedAt || a.approvedAt)
    )
    .slice(0, 5);

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Dashboard</h2>
          <p className="muted-text">
            Business snapshot for active quotes, active jobs, archived jobs,
            payments, and profitability.
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
          <strong>{activeJobs.length}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span>Archived Jobs</span>
          <strong>{archivedJobs.length}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span>Quote Value</span>
          <strong>{money(totalQuoteValue)}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span>Active Job Value</span>
          <strong>{money(totalActiveJobValue)}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span>Archived Value</span>
          <strong>{money(totalArchivedJobValue)}</strong>
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
          <h3 className="card-title">Recent Active Jobs</h3>

          {recentActiveJobs.length === 0 ? (
            <p className="muted-text">No active jobs yet.</p>
          ) : (
            <div className="dashboard-list">
              {recentActiveJobs.map((job) => (
                <div className="dashboard-list-row" key={job.id}>
                  <div>
                    <strong>{job.jobNumber}</strong>
                    <span>{job.jobName || "Untitled Job"}</span>
                  </div>

                  <div className="dashboard-status-stack">
                    <span className="status-pill">{job.status || "Approved"}</span>
                    <span className="status-pill">
                      {getPaymentStatus(job)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-card dashboard-full-span">
          <h3 className="card-title">Recently Archived Jobs</h3>

          {recentArchivedJobs.length === 0 ? (
            <p className="muted-text">No archived jobs yet.</p>
          ) : (
            <div className="dashboard-list">
              {recentArchivedJobs.map((job) => (
                <div className="dashboard-list-row" key={job.id}>
                  <div>
                    <strong>{job.jobNumber}</strong>
                    <span>{job.jobName || "Untitled Job"}</span>
                  </div>

                  <div className="dashboard-status-stack">
                    <span className="status-pill">
                      {job.status || "Archived"}
                    </span>
                    <span>{money(job.finalTotal)}</span>
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