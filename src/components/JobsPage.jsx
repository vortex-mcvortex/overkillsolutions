import { useRef } from "react";
import { Plus, Trash2, Save, FileDown, Upload } from "lucide-react";
import { exportInvoicePdf } from "../utils/pdf";

const PAYMENT_METHODS = ["Venmo", "Cash", "Cash App", "PayPal", "Zelle"];

const EVENT_TYPES = [
  "Machine Time",
  "CAD / Design",
  "Assembly / Labor",
  "Sanding / Cleanup",
  "Customer Communication",
  "Delivery / Pickup",
  "Other",
];

const EVENT_ACTIONS = ["Started", "Stopped", "Note"];

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

function getEventDateTime(event) {
  if (!event.date || !event.time) return null;
  const value = new Date(`${event.date}T${event.time}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function calculateHours(startEvent, stopEvent) {
  const startDate = getEventDateTime(startEvent);
  const stopDate = getEventDateTime(stopEvent);

  if (!startDate || !stopDate) return 0;

  const diffMs = stopDate - startDate;
  if (diffMs <= 0) return 0;

  return diffMs / 1000 / 60 / 60;
}

function Field({ label, value, onChange, type = "number", step = "0.01" }) {
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

function createTimeEvent() {
  return {
    id: crypto.randomUUID(),
    type: "Machine Time",
    action: "Started",
    label: "",
    date: "",
    time: "",
    rate: 3,
    notes: "",
  };
}

function normalizeOldEvent(event) {
  if (!event.timestamp) return event;

  const [date = "", time = ""] = event.timestamp.split("T");

  return {
    ...event,
    date: event.date || date,
    time: event.time || time,
  };
}

function getQuotedPrintRuns(job) {
  return job?.quoteSnapshot?.formData?.printRuns || job?.formData?.printRuns || [];
}

function getFormData(job) {
  return job?.quoteSnapshot?.formData || job?.formData || {};
}

function buildMachineOptions(job) {
  const formData = getFormData(job);
  const quotedPrintRuns = getQuotedPrintRuns(job);

  const options = [
    { value: "", label: "General" },
    { value: "CAD", label: "CAD" },
    { value: "Assembly", label: "Assembly" },
    { value: "Cleanup", label: "Cleanup" },
  ];

  quotedPrintRuns.forEach((run, runIndex) => {
    const printer = run.printerId || "Printer";
    const nozzle = run.nozzleSize || "Nozzle";
    const material = run.materialId || "Material";
    const label = `Run ${runIndex + 1}: ${printer} / ${nozzle}mm / ${material}`;

    options.push({
      value: label,
      label,
    });
  });

  if (job.jobAspects?.engraving || formData.jobAspects?.engraving) {
    options.push(
      { value: "H2S Laser — 10W", label: "H2S Laser — 10W" },
      { value: "H2S Laser — 40W", label: "H2S Laser — 40W" }
    );
  }

  if (job.jobAspects?.vinyl || formData.jobAspects?.vinyl) {
    options.push({
      value: "H2S Cutter",
      label: "H2S Cutter",
    });
  }

  return options;
}

function pairTimeEvents(events) {
  const normalizedEvents = events.map(normalizeOldEvent);

  const sorted = [...normalizedEvents].sort((a, b) => {
    const aDate = getEventDateTime(a);
    const bDate = getEventDateTime(b);

    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;

    return aDate - bDate;
  });

  const openStarts = {};
  const paired = [];

  sorted.forEach((event) => {
    if (event.action === "Note") return;

    const key = `${event.type}__${event.label || "General"}`;

    if (event.action === "Started") {
      openStarts[key] = event;
      return;
    }

    if (event.action === "Stopped" && openStarts[key]) {
      const startEvent = openStarts[key];
      const hours = calculateHours(startEvent, event);
      const rate = num(startEvent.rate || event.rate);

      paired.push({
        key,
        type: event.type,
        label: event.label || "General",
        startEvent,
        stopEvent: event,
        hours,
        rate,
        cost: hours * rate,
      });

      delete openStarts[key];
    }
  });

  return paired;
}

export default function JobsPage({
  jobs,
  onUpdateJob,
  onImportPdf,
  importMessage,
}) {
  const fileInputRef = useRef(null);

  function handleImportChange(event) {
    const file = event.target.files?.[0];

    if (file) {
      onImportPdf(file);
    }

    event.target.value = "";
  }

  function saveJob(jobId) {
    onUpdateJob(jobId, {
      lastSavedAt: new Date().toISOString(),
    });
  }

  function updateActual(jobId, key, value) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    onUpdateJob(jobId, {
      actuals: {
        ...(job.actuals || {}),
        [key]: value,
      },
    });
  }

  function updatePayment(jobId, key, value) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    onUpdateJob(jobId, {
      payments: {
        ...(job.payments || {}),
        [key]: value,
      },
    });
  }

  function addTimeEvent(jobId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    onUpdateJob(jobId, {
      timeEvents: [createTimeEvent(), ...(job.timeEvents || [])],
    });
  }

  function updateTimeEvent(jobId, eventId, key, value) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    onUpdateJob(jobId, {
      timeEvents: (job.timeEvents || []).map((event) =>
        event.id === eventId
          ? { ...normalizeOldEvent(event), [key]: value }
          : normalizeOldEvent(event)
      ),
    });
  }

  function removeTimeEvent(jobId, eventId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;

    onUpdateJob(jobId, {
      timeEvents: (job.timeEvents || []).filter((event) => event.id !== eventId),
    });
  }

  function calculateJobActuals(job) {
    const actuals = job.actuals || {};
    const payments = job.payments || {};
    const paymentEvents = job.paymentEvents || [];
    const timeEvents = job.timeEvents || [];
    const pairedEvents = pairTimeEvents(timeEvents);

    const machinePairs = pairedEvents.filter((pair) => pair.type === "Machine Time");
    const cadPairs = pairedEvents.filter((pair) => pair.type === "CAD / Design");
    const laborPairs = pairedEvents.filter(
      (pair) => pair.type !== "Machine Time" && pair.type !== "CAD / Design"
    );

    const machineHours = machinePairs.reduce((sum, pair) => sum + pair.hours, 0);
    const cadHours = cadPairs.reduce((sum, pair) => sum + pair.hours, 0);
    const laborHours = laborPairs.reduce((sum, pair) => sum + pair.hours, 0);

    const machineCost = machinePairs.reduce((sum, pair) => sum + pair.cost, 0);
    const cadCost = cadPairs.reduce((sum, pair) => sum + pair.cost, 0);
    const laborCost = laborPairs.reduce((sum, pair) => sum + pair.cost, 0);

    const materialCost = num(actuals.materialCost);
    const failedPrintCost = num(actuals.failedPrintCost);
    const extraCost = num(actuals.extraCost);

    const totalActualCost =
      materialCost +
      machineCost +
      cadCost +
      laborCost +
      failedPrintCost +
      extraCost;

    const customerTotal = num(job.finalTotal);

    const ledgerPaid = paymentEvents.reduce((sum, payment) => {
      if (payment.type === "Refund") return sum - num(payment.amount);
      return sum + num(payment.amount);
    }, 0);

    const legacyPaid = num(payments.depositPaid) + num(payments.additionalPaid);
    const totalPaid = ledgerPaid || legacyPaid;

    const remainingToCollect = Math.max(0, customerTotal - totalPaid);
    const estimatedProfit = customerTotal - totalActualCost;
    const profitMargin =
      customerTotal > 0 ? (estimatedProfit / customerTotal) * 100 : 0;

    return {
      pairedEvents,
      machineHours,
      cadHours,
      laborHours,
      materialCost,
      machineCost,
      cadCost,
      laborCost,
      failedPrintCost,
      extraCost,
      totalActualCost,
      customerTotal,
      totalPaid,
      remainingToCollect,
      estimatedProfit,
      profitMargin,
    };
  }

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Jobs</h2>
          <p className="muted-text">
            Approved work with editable timestamp logs, actual costs, payments, and profit estimates.
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
            Import Invoice PDF
          </button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <h3>No active jobs yet.</h3>
          <p>Convert an approved quote into a job to begin production tracking.</p>
        </div>
      ) : (
        <div className="jobs-stack">
          {jobs.map((job) => {
            const actuals = {
              materialCost: 0,
              failedPrintCost: 0,
              extraCost: 0,
              notes: "",
              ...(job.actuals || {}),
            };

            const payments = {
              depositPaid: 0,
              additionalPaid: 0,
              paymentMethod: "Venmo",
              paymentNotes: "",
              ...(job.payments || {}),
            };

            const timeEvents = (job.timeEvents || []).map(normalizeOldEvent);
            const machineOptions = buildMachineOptions(job);

            const calc = calculateJobActuals({
              ...job,
              actuals,
              payments,
              timeEvents,
            });

            return (
              <article className="job-detail-card" key={job.id}>
                <div className="record-card-top">
                  <div>
                    <h3>{job.jobNumber}</h3>
                    <p>{job.customerName || "No Customer Name"}</p>
                  </div>

                  <span className="status-pill">{job.status}</span>
                </div>

                <div className="record-title">{job.jobName || "Untitled Job"}</div>

                <div className="record-tags">
                  {job.jobAspects?.cad && <span>CAD</span>}
                  {job.jobAspects?.printing && <span>3D Printing</span>}
                  {job.jobAspects?.engraving && <span>Engraving</span>}
                  {job.jobAspects?.vinyl && <span>Vinyl</span>}
                  {job.jobAspects?.custom && <span>Custom</span>}
                  {job.importedFromPdf && <span>Imported PDF</span>}
                </div>

                <div className="record-button-row">
                  <button
                    className="primary-button record-action"
                    onClick={() => saveJob(job.id)}
                  >
                    <Save size={18} />
                    Save Job Changes
                  </button>

                  <button
                    className="secondary-button record-action"
                    onClick={() => exportInvoicePdf(job)}
                  >
                    <FileDown size={18} />
                    Export Invoice PDF
                  </button>
                </div>

                {job.lastSavedAt && (
                  <p className="helper-note">
                    Last saved: {new Date(job.lastSavedAt).toLocaleString()}
                  </p>
                )}

                <div className="job-summary-grid">
                  <div><span>Quoted Total</span><strong>{money(job.finalTotal)}</strong></div>
                  <div><span>Actual Cost</span><strong>{money(calc.totalActualCost)}</strong></div>
                  <div><span>Estimated Profit</span><strong>{money(calc.estimatedProfit)}</strong></div>
                  <div><span>Profit Margin</span><strong>{calc.profitMargin.toFixed(1)}%</strong></div>
                  <div><span>Machine Hours</span><strong>{calc.machineHours.toFixed(2)}</strong></div>
                  <div><span>CAD Hours</span><strong>{calc.cadHours.toFixed(2)}</strong></div>
                  <div><span>Total Paid</span><strong>{money(calc.totalPaid)}</strong></div>
                  <div><span>Remaining</span><strong>{money(calc.remainingToCollect)}</strong></div>
                </div>

                <div className="form-card">
                  <div className="page-heading-row">
                    <div>
                      <h3 className="card-title">Production Log</h3>
                      <p className="muted-text">
                        Add one editable event at a time: date, time, type, action, and machine/task.
                      </p>
                    </div>

                    <button
                      className="secondary-button"
                      onClick={() => addTimeEvent(job.id)}
                    >
                      <Plus size={18} />
                      Add Event
                    </button>
                  </div>

                  <div className="vinyl-lines">
                    {timeEvents.length === 0 ? (
                      <p className="muted-text">No production events yet.</p>
                    ) : (
                      timeEvents.map((event, index) => (
                        <div className="vinyl-line" key={event.id}>
                          <div className="vinyl-line-header">
                            <strong>Event {index + 1}</strong>
                            <span>{event.action}</span>
                          </div>

                          <div className="form-grid">
                            <label className="field">
                              <span>Type</span>
                              <select
                                value={event.type}
                                onChange={(change) =>
                                  updateTimeEvent(job.id, event.id, "type", change.target.value)
                                }
                              >
                                {EVENT_TYPES.map((type) => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                            </label>

                            <label className="field">
                              <span>Action</span>
                              <select
                                value={event.action}
                                onChange={(change) =>
                                  updateTimeEvent(job.id, event.id, "action", change.target.value)
                                }
                              >
                                {EVENT_ACTIONS.map((action) => (
                                  <option key={action} value={action}>{action}</option>
                                ))}
                              </select>
                            </label>

                            <Field
                              label="Date"
                              type="date"
                              value={event.date}
                              onChange={(value) =>
                                updateTimeEvent(job.id, event.id, "date", value)
                              }
                            />

                            <Field
                              label="Time"
                              type="time"
                              value={event.time}
                              onChange={(value) =>
                                updateTimeEvent(job.id, event.id, "time", value)
                              }
                            />

                            <label className="field">
                              <span>Machine / Task</span>
                              <select
                                value={event.label}
                                onChange={(change) =>
                                  updateTimeEvent(job.id, event.id, "label", change.target.value)
                                }
                              >
                                {machineOptions.map((option) => (
                                  <option key={option.value || "general"} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <Field
                              label="Rate ($/hr)"
                              value={event.rate}
                              onChange={(value) =>
                                updateTimeEvent(job.id, event.id, "rate", value)
                              }
                            />

                            <button
                              className="secondary-button danger-button"
                              onClick={() => removeTimeEvent(job.id, event.id)}
                              type="button"
                            >
                              <Trash2 size={18} />
                              Remove
                            </button>
                          </div>

                          <label className="field single-row-gap">
                            <span>Notes</span>
                            <textarea
                              value={event.notes}
                              onChange={(change) =>
                                updateTimeEvent(job.id, event.id, "notes", change.target.value)
                              }
                              placeholder="P1S started, H2S laser stopped, CAD revision started, customer requested change, etc."
                            />
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="form-card single-row-gap">
                  <h3 className="card-title">Calculated Time Pairs</h3>

                  {calc.pairedEvents.length === 0 ? (
                    <p className="muted-text">No completed start/stop pairs yet.</p>
                  ) : (
                    <div className="breakdown-list">
                      {calc.pairedEvents.map((pair, index) => (
                        <div key={`${pair.key}-${index}`}>
                          <span>{pair.type} — {pair.label}</span>
                          <strong>{pair.hours.toFixed(2)} hr / {money(pair.cost)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="job-sections-grid single-row-gap">
                  <div className="form-card">
                    <h3 className="card-title">Actual Extra Costs</h3>

                    <div className="form-grid">
                      <Field
                        label="Actual Material Cost"
                        value={actuals.materialCost}
                        onChange={(value) => updateActual(job.id, "materialCost", value)}
                      />

                      <Field
                        label="Failed Print / Waste Cost"
                        value={actuals.failedPrintCost}
                        onChange={(value) => updateActual(job.id, "failedPrintCost", value)}
                      />

                      <Field
                        label="Extra Costs"
                        value={actuals.extraCost}
                        onChange={(value) => updateActual(job.id, "extraCost", value)}
                      />
                    </div>

                    <label className="field single-row-gap">
                      <span>Actual Notes</span>
                      <textarea
                        value={actuals.notes}
                        onChange={(event) =>
                          updateActual(job.id, "notes", event.target.value)
                        }
                        placeholder="Failed prints, support cleanup, material changes, customer changes, etc."
                      />
                    </label>
                  </div>

                  <div className="form-card">
                    <h3 className="card-title">Legacy Quick Payments</h3>

                    <div className="form-grid">
                      <Field
                        label="Deposit Paid"
                        value={payments.depositPaid}
                        onChange={(value) => updatePayment(job.id, "depositPaid", value)}
                      />

                      <Field
                        label="Additional Paid"
                        value={payments.additionalPaid}
                        onChange={(value) => updatePayment(job.id, "additionalPaid", value)}
                      />

                      <label className="field">
                        <span>Payment Method</span>
                        <select
                          value={payments.paymentMethod}
                          onChange={(event) =>
                            updatePayment(job.id, "paymentMethod", event.target.value)
                          }
                        >
                          {PAYMENT_METHODS.map((method) => (
                            <option key={method} value={method}>{method}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="field single-row-gap">
                      <span>Payment Notes</span>
                      <textarea
                        value={payments.paymentNotes}
                        onChange={(event) =>
                          updatePayment(job.id, "paymentNotes", event.target.value)
                        }
                        placeholder="Main payment tracking now lives in the Payments tab."
                      />
                    </label>

                    <p className="helper-note">
                      Main payment ledger is in the Payments tab. These fields are kept for older jobs and quick notes.
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}