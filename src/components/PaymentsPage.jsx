import { Plus, Trash2 } from "lucide-react";

const PAYMENT_TYPES = ["Deposit", "Partial Payment", "Final Payment", "Refund", "Other"];
const PAYMENT_METHODS = ["Venmo", "Cash", "Cash App", "PayPal", "Zelle"];

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

function createPaymentEvent() {
  return {
    id: crypto.randomUUID(),
    type: "Deposit",
    method: "Venmo",
    amount: "",
    date: "",
    time: "",
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

function getPaymentStatus(total, paid) {
  if (paid <= 0) return "Unpaid";
  if (paid >= total) return paid > total ? "Overpaid" : "Paid in Full";
  return "Partially Paid";
}

export default function PaymentsPage({ jobs, selectedJobId, onSelectJob, onUpdateJob }) {
  const selectedJob = jobs.find((job) => job.id === selectedJobId) || jobs[0];

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
  const totalPaid = payments.reduce((sum, payment) => {
    if (payment.type === "Refund") return sum - num(payment.amount);
    return sum + num(payment.amount);
  }, 0);

  const quotedTotal = num(selectedJob?.finalTotal);
  const remaining = Math.max(0, quotedTotal - totalPaid);
  const status = getPaymentStatus(quotedTotal, totalPaid);

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Payments</h2>
          <p className="muted-text">
            Track deposits, partial payments, final payments, refunds, and notes by job.
          </p>
        </div>
      </div>

      <div className="payments-layout">
        <aside className="payments-job-list">
          <h3 className="card-title">Jobs</h3>

          {jobs.map((job) => {
            const jobPayments = job.paymentEvents || [];
            const jobPaid = jobPayments.reduce((sum, payment) => {
              if (payment.type === "Refund") return sum - num(payment.amount);
              return sum + num(payment.amount);
            }, 0);

            const isActive = selectedJob?.id === job.id;

            return (
              <button
                key={job.id}
                className={`payment-job-button ${isActive ? "active" : ""}`}
                onClick={() => onSelectJob(job.id)}
              >
                <strong>{job.jobNumber}</strong>
                <span>{job.jobName || "Untitled Job"}</span>
                <small>{money(jobPaid)} / {money(job.finalTotal)}</small>
              </button>
            );
          })}
        </aside>

        <div className="payments-main">
          <div className="job-detail-card">
            <div className="record-card-top">
              <div>
                <h3>{selectedJob.jobNumber}</h3>
                <p>{selectedJob.customerName || "No Customer Name"}</p>
              </div>

              <span className="status-pill">{status}</span>
            </div>

            <div className="record-title">{selectedJob.jobName || "Untitled Job"}</div>

            <div className="job-summary-grid">
              <div>
                <span>Quoted Total</span>
                <strong>{money(quotedTotal)}</strong>
              </div>
              <div>
                <span>Total Paid</span>
                <strong>{money(totalPaid)}</strong>
              </div>
              <div>
                <span>Remaining</span>
                <strong>{money(remaining)}</strong>
              </div>
              <div>
                <span>Payment Status</span>
                <strong>{status}</strong>
              </div>
            </div>

            <div className="page-heading-row single-row-gap">
              <div>
                <h3 className="card-title">Payment Events</h3>
                <p className="muted-text">
                  Add one payment event at a time, similar to the production log.
                </p>
              </div>

              <button
                className="secondary-button"
                onClick={() => addPayment(selectedJob.id)}
              >
                <Plus size={18} />
                Add Payment
              </button>
            </div>

            <div className="vinyl-lines">
              {payments.length === 0 ? (
                <p className="muted-text">No payment events yet.</p>
              ) : (
                payments.map((payment, index) => (
                  <div className="vinyl-line" key={payment.id}>
                    <div className="vinyl-line-header">
                      <strong>Payment Event {index + 1}</strong>
                      <span>{money(payment.amount)}</span>
                    </div>

                    <div className="form-grid">
                      <label className="field">
                        <span>Payment Type</span>
                        <select
                          value={payment.type}
                          onChange={(event) =>
                            updatePayment(selectedJob.id, payment.id, "type", event.target.value)
                          }
                        >
                          {PAYMENT_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Method</span>
                        <select
                          value={payment.method}
                          onChange={(event) =>
                            updatePayment(selectedJob.id, payment.id, "method", event.target.value)
                          }
                        >
                          {PAYMENT_METHODS.map((method) => (
                            <option key={method} value={method}>{method}</option>
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
                          updatePayment(selectedJob.id, payment.id, "notes", event.target.value)
                        }
                        placeholder="Deposit received through Venmo, final cash payment, refund reason, etc."
                      />
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}