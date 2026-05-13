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

function clean(value) {
  return String(value || "").trim();
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

function getRecordDate(record) {
  return (
    record.updatedAt ||
    record.createdAt ||
    record.approvedAt ||
    record.archivedAt ||
    ""
  );
}

function formatDate(value) {
  if (!value) return "No date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "No date";

  return date.toLocaleDateString();
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

function groupByStatus(records, statusGetter) {
  const map = {};

  records.forEach((record) => {
    const status = statusGetter(record);
    map[status] = (map[status] || 0) + 1;
  });

  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function customerKey(record) {
  const email = clean(record.customerEmail || record.formData?.customerEmail).toLowerCase();
  const phone = clean(record.customerPhone || record.formData?.customerPhone).replace(/\D/g, "");
  const name = clean(record.customerName || record.formData?.customerName).toLowerCase();

  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  if (name) return `name:${name}`;

  return `unknown:${record.id}`;
}

function getCustomerName(record) {
  return clean(record.customerName || record.formData?.customerName) || "Unknown Customer";
}

function buildTopCustomers(jobs) {
  const map = new Map();

  jobs.forEach((job) => {
    const key = customerKey(job);
    const current = map.get(key) || {
      key,
      name: getCustomerName(job),
      jobCount: 0,
      totalValue: 0,
      totalPaid: 0,
      outstanding: 0,
    };

    const total = num(job.finalTotal);
    const paid = getPaidTotal(job);

    current.jobCount += 1;
    current.totalValue += total;
    current.totalPaid += paid;
    current.outstanding += Math.max(0, total - paid);

    map.set(key, current);
  });

  return [...map.values()]
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);
}

function buildMonthlySummary(jobs) {
  const map = new Map();

  jobs.forEach((job) => {
    const monthKey = getMonthKey(job.approvedAt || job.createdAt || job.updatedAt);

    const current = map.get(monthKey) || {
      monthKey,
      label: getMonthLabel(monthKey),
      jobCount: 0,
      jobValue: 0,
      collected: 0,
      knownCosts: 0,
      estimatedProfit: 0,
    };

    const value = num(job.finalTotal);
    const collected = getPaidTotal(job);
    const knownCosts = calculateJobActualCost(job);

    current.jobCount += 1;
    current.jobValue += value;
    current.collected += collected;
    current.knownCosts += knownCosts;
    current.estimatedProfit += value - knownCosts;

    map.set(monthKey, current);
  });

  return [...map.values()]
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
    .slice(0, 6);
}

function buildRecentActivity(quotes, activeJobs, archivedJobs) {
  const quoteActivity = quotes.map((quote) => ({
    id: `quote-${quote.id}`,
    type: "Quote",
    number: quote.quoteNumber,
    title: quote.jobName || "Untitled Quote",
    customer: quote.customerName || "No Customer",
    amount: num(quote.finalTotal),
    date: getRecordDate(quote),
    status: quote.status || "Draft Quote",
  }));

  const activeJobActivity = activeJobs.map((job) => ({
    id: `job-${job.id}`,
    type: "Job",
    number: job.jobNumber,
    title: job.jobName || "Untitled Job",
    customer: job.customerName || "No Customer",
    amount: num(job.finalTotal),
    date: getRecordDate(job),
    status: job.status || "Approved",
  }));

  const archivedJobActivity = archivedJobs.map((job) => ({
    id: `archived-${job.id}`,
    type: "Archived Job",
    number: job.jobNumber,
    title: job.jobName || "Untitled Job",
    customer: job.customerName || "No Customer",
    amount: num(job.finalTotal),
    date: job.archivedAt || getRecordDate(job),
    status: job.status || "Archived",
  }));

  return [...quoteActivity, ...activeJobActivity, ...archivedJobActivity]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 8);
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

  const averageActiveJobValue =
    activeJobs.length > 0 ? totalActiveJobValue / activeJobs.length : 0;

  const quoteConversionPotential = totalQuoteValue + totalActiveJobValue;

  const recentQuotes = [...quotes]
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0) -
        new Date(a.updatedAt || a.createdAt || 0)
    )
    .slice(0, 5);

  const recentActiveJobs = [...activeJobs]
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.approvedAt || 0) -
        new Date(a.updatedAt || a.approvedAt || 0)
    )
    .slice(0, 5);

  const recentArchivedJobs = [...archivedJobs]
    .sort(
      (a, b) =>
        new Date(b.archivedAt || b.updatedAt || b.approvedAt || 0) -
        new Date(a.archivedAt || a.updatedAt || a.approvedAt || 0)
    )
    .slice(0, 5);

  const jobStatusBreakdown = groupByStatus(
    activeJobs,
    (job) => job.status || "Approved"
  );

  const paymentStatusBreakdown = groupByStatus(activeJobs, getPaymentStatus);
  const topCustomers = buildTopCustomers(jobs);
  const monthlySummary = buildMonthlySummary(jobs);
  const recentActivity = buildRecentActivity(quotes, activeJobs, archivedJobs);

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Dashboard</h2>
          <p className="muted-text">
            Business snapshot for quotes, active jobs, archived jobs, payments,
            monthly performance, customers, and profitability.
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

        <div className="dashboard-stat-card">
          <span>Average Active Job</span>
          <strong>{money(averageActiveJobValue)}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span>Pipeline Value</span>
          <strong>{money(quoteConversionPotential)}</strong>
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
                    <span className="status-pill">{getPaymentStatus(job)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-card">
          <h3 className="card-title">Job Status Breakdown</h3>

          {jobStatusBreakdown.length === 0 ? (
            <p className="muted-text">No active job statuses yet.</p>
          ) : (
            <div className="breakdown-list">
              {jobStatusBreakdown.map(([status, count]) => (
                <div key={status}>
                  <span>{status}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-card">
          <h3 className="card-title">Payment Status Breakdown</h3>

          {paymentStatusBreakdown.length === 0 ? (
            <p className="muted-text">No payment statuses yet.</p>
          ) : (
            <div className="breakdown-list">
              {paymentStatusBreakdown.map(([status, count]) => (
                <div key={status}>
                  <span>{status}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-card dashboard-full-span">
          <h3 className="card-title">Monthly Job Summary</h3>

          {monthlySummary.length === 0 ? (
            <p className="muted-text">No monthly job data yet.</p>
          ) : (
            <div className="dashboard-list">
              {monthlySummary.map((month) => (
                <div className="dashboard-list-row" key={month.monthKey}>
                  <div>
                    <strong>{month.label}</strong>
                    <span>{month.jobCount} job(s)</span>
                  </div>

                  <div className="dashboard-status-stack">
                    <span className="status-pill">Value {money(month.jobValue)}</span>
                    <span className="status-pill">Collected {money(month.collected)}</span>
                    <span className="status-pill">Profit {money(month.estimatedProfit)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-card">
          <h3 className="card-title">Top Customers</h3>

          {topCustomers.length === 0 ? (
            <p className="muted-text">No customer job data yet.</p>
          ) : (
            <div className="dashboard-list">
              {topCustomers.map((customer) => (
                <div className="dashboard-list-row" key={customer.key}>
                  <div>
                    <strong>{customer.name}</strong>
                    <span>{customer.jobCount} job(s)</span>
                  </div>

                  <div className="dashboard-status-stack">
                    <span>{money(customer.totalValue)}</span>
                    {customer.outstanding > 0 && (
                      <span className="status-pill">
                        Outstanding {money(customer.outstanding)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-card">
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
                    <span className="status-pill">{job.status || "Archived"}</span>
                    <span>{money(job.finalTotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-card dashboard-full-span">
          <h3 className="card-title">Recent Activity</h3>

          {recentActivity.length === 0 ? (
            <p className="muted-text">No recent activity yet.</p>
          ) : (
            <div className="dashboard-list">
              {recentActivity.map((activity) => (
                <div className="dashboard-list-row" key={activity.id}>
                  <div>
                    <strong>
                      {activity.type} {activity.number || ""}
                    </strong>
                    <span>
                      {activity.customer} • {activity.title}
                    </span>
                  </div>

                  <div className="dashboard-status-stack">
                    <span className="status-pill">{activity.status}</span>
                    <span>{money(activity.amount)}</span>
                    <span>{formatDate(activity.date)}</span>
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