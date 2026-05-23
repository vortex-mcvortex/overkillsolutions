import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import {
  PUBLIC_STATUS_OPTIONS,
  PUBLIC_VISIBILITY_OPTIONS,
  buildFutureTablePlan,
  buildPublicJobPayload,
  buildPublicQuotePayload,
  createAccessToken,
  createPublicId,
  getCustomerVisibleStatus,
  normalizePublicRecord,
} from "../data/publicPortalSchema";

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString();
}

function isPortalReady(record) {
  return Boolean(record.publicId && record.publicAccessToken && record.customerFacingTitle);
}

function copyText(value, label = "Copied") {
  navigator.clipboard?.writeText(String(value || ""));
  window.alert(label);
}

function JsonPreview({ title, data }) {
  return (
    <div className="backend-json-card">
      <div className="page-heading-row">
        <h3 className="card-title">{title}</h3>
        <button
          className="secondary-button"
          type="button"
          onClick={() => copyText(JSON.stringify(data, null, 2), "JSON copied.")}
        >
          <Copy size={18} />
          Copy JSON
        </button>
      </div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

function BackendRecordCard({ record, type, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const ready = isPortalReady(record);
  const publicPayload = type === "job" ? buildPublicJobPayload(record) : buildPublicQuotePayload(record);

  function prepareRecord() {
    const normalized = normalizePublicRecord(record, type);

    onUpdate(record.id, {
      ...normalized,
      publicVisibility: record.publicVisibility || "Internal Only",
      publicEnabled: Boolean(record.publicEnabled),
    });
  }

  function regenerateAccessToken() {
    const confirmed = window.confirm(
      `Regenerate the customer portal access token for ${record.quoteNumber || record.jobNumber}? Old customer links would stop working later once this is cloud-backed.`
    );

    if (!confirmed) return;

    onUpdate(record.id, {
      publicAccessToken: createAccessToken(),
      customerPortalUpdatedAt: new Date().toISOString(),
    });
  }

  function updateField(key, value) {
    onUpdate(record.id, {
      [key]: value,
      customerPortalUpdatedAt: new Date().toISOString(),
    });
  }

  return (
    <article className={`backend-record-card ${ready ? "backend-ready" : "backend-not-ready"}`}>
      <button className="job-list-header" type="button" onClick={() => setExpanded(!expanded)}>
        <div className="job-list-main">
          <strong>{record.quoteNumber || record.jobNumber || "Record"}</strong>
          <span>{record.customerName || "No Customer"}</span>
          <small>{record.customerFacingTitle || record.jobName || "No customer-facing title yet"}</small>
        </div>

        <div className="job-list-meta">
          <span className="status-pill">{type === "job" ? "Job" : "Quote"}</span>
          <span className="status-pill">{record.publicStatus || getCustomerVisibleStatus(record)}</span>
          {record.publicEnabled ? <span className="status-pill">Portal Enabled</span> : <span className="status-pill">Internal Only</span>}
          {ready ? <span className="status-pill">Ready</span> : <span className="status-pill">Needs Prep</span>}
          <strong>{type === "quote" ? money(record.finalTotal) : record.status || "Job"}</strong>
        </div>
      </button>

      {expanded && (
        <div className="job-expanded-body">
          {!ready && (
            <div className="customer-warning-box">
              <strong><AlertTriangle size={18} /> Backend Prep Needed</strong>
              <p>This record needs a public ID, access token, and customer-facing title before it is safe to expose through a future customer portal.</p>
            </div>
          )}

          <div className="record-button-row job-action-row">
            <button className="primary-button" type="button" onClick={prepareRecord}>
              <ShieldCheck size={18} />
              Prepare Record
            </button>
            <button className="secondary-button" type="button" onClick={regenerateAccessToken}>
              <RefreshCcw size={18} />
              Regenerate Token
            </button>
            <button className="secondary-button" type="button" onClick={() => updateField("publicEnabled", !record.publicEnabled)}>
              {record.publicEnabled ? <EyeOff size={18} /> : <Eye size={18} />}
              {record.publicEnabled ? "Disable Portal" : "Enable Portal"}
            </button>
            <button className="secondary-button" type="button" onClick={() => copyText(record.publicAccessToken || "", "Access token copied.")}>
              <KeyRound size={18} />
              Copy Token
            </button>
          </div>

          <div className="form-grid single-row-gap">
            <label className="field">
              <span>Public ID</span>
              <input
                value={record.publicId || ""}
                placeholder="Auto-generated"
                onChange={(event) => updateField("publicId", event.target.value)}
              />
            </label>

            <label className="field">
              <span>Public Access Token</span>
              <input
                value={record.publicAccessToken || ""}
                placeholder="Auto-generated"
                onChange={(event) => updateField("publicAccessToken", event.target.value)}
              />
            </label>

            <label className="field">
              <span>Public Visibility</span>
              <select
                value={record.publicVisibility || "Internal Only"}
                onChange={(event) => updateField("publicVisibility", event.target.value)}
              >
                {PUBLIC_VISIBILITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Customer Status</span>
              <select
                value={record.publicStatus || getCustomerVisibleStatus(record)}
                onChange={(event) => updateField("publicStatus", event.target.value)}
              >
                {PUBLIC_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Customer-Facing Title</span>
              <input
                value={record.customerFacingTitle || record.jobName || ""}
                onChange={(event) => updateField("customerFacingTitle", event.target.value)}
              />
            </label>

            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={Boolean(record.customerActionRequired)}
                onChange={(event) => updateField("customerActionRequired", event.target.checked)}
              />
              <span>Customer Action Required</span>
            </label>
          </div>

          <label className="field single-row-gap">
            <span>Customer-Facing Summary</span>
            <textarea
              value={record.customerFacingSummary || ""}
              onChange={(event) => updateField("customerFacingSummary", event.target.value)}
              placeholder="Short customer-safe summary shown in the future portal."
            />
          </label>

          <label className="field single-row-gap">
            <span>Customer-Facing Notes</span>
            <textarea
              value={record.customerFacingNotes || ""}
              onChange={(event) => updateField("customerFacingNotes", event.target.value)}
              placeholder="Only put notes here that are safe for the customer to read."
            />
          </label>

          <label className="field single-row-gap">
            <span>Internal-Only Notes</span>
            <textarea
              value={record.internalOnlyNotes || record.queueNotes || ""}
              onChange={(event) => updateField("internalOnlyNotes", event.target.value)}
              placeholder="Internal production, pricing, customer, or workflow notes. Never shown to the customer portal."
            />
          </label>

          <JsonPreview title="Future Customer Portal Payload Preview" data={publicPayload} />

          <p className="helper-note">
            Last portal metadata update: {formatDate(record.customerPortalUpdatedAt)}
          </p>
        </div>
      )}
    </article>
  );
}

export default function BackendReadinessPage({
  quotes = [],
  jobs = [],
  manualCustomers = [],
  customerOverrides = {},
  onUpdateQuoteWorkflow,
  onUpdateJob,
  onUpdateCustomer,
  onUpdateManualCustomer,
}) {
  const [filter, setFilter] = useState("needs-prep");

  const quoteRecords = quotes.map((quote) => ({ ...quote, backendType: "quote" }));
  const jobRecords = jobs.map((job) => ({ ...job, backendType: "job" }));
  const records = [...quoteRecords, ...jobRecords];

  const stats = useMemo(() => {
    const readyRecords = records.filter(isPortalReady);
    const enabledRecords = records.filter((record) => record.publicEnabled);
    const actionRecords = records.filter((record) => record.customerActionRequired);

    return {
      total: records.length,
      ready: readyRecords.length,
      needsPrep: records.length - readyRecords.length,
      enabled: enabledRecords.length,
      actionNeeded: actionRecords.length,
      customers: manualCustomers.length + Object.keys(customerOverrides || {}).length,
    };
  }, [records, manualCustomers, customerOverrides]);

  const filteredRecords = records.filter((record) => {
    if (filter === "all") return true;
    if (filter === "ready") return isPortalReady(record);
    if (filter === "enabled") return record.publicEnabled;
    if (filter === "action") return record.customerActionRequired;
    return !isPortalReady(record);
  });

  function updateRecord(recordType, recordId, updates) {
    if (recordType === "job") {
      onUpdateJob(recordId, updates);
      return;
    }

    onUpdateQuoteWorkflow(recordId, updates);
  }

  function prepareAllNeeded() {
    const needsPrep = records.filter((record) => !isPortalReady(record));

    if (needsPrep.length === 0) {
      window.alert("Everything is already backend-ready.");
      return;
    }

    const confirmed = window.confirm(
      `Prepare ${needsPrep.length} quote/job records with public IDs, access tokens, customer-safe status fields, and note separation?`
    );

    if (!confirmed) return;

    needsPrep.forEach((record) => {
      updateRecord(record.backendType, record.id, normalizePublicRecord(record, record.backendType));
    });
  }

  function prepareCustomerRecords() {
    const now = new Date().toISOString();
    let changed = 0;

    manualCustomers.forEach((customer) => {
      if (customer.publicId) return;
      changed += 1;
      onUpdateManualCustomer(customer.key, {
        publicId: createPublicId("CUST"),
        internalOnlyNotes: customer.internalOnlyNotes || customer.notes || "",
        customerPortalUpdatedAt: now,
      });
    });

    Object.entries(customerOverrides || {}).forEach(([key, customer]) => {
      if (customer.publicId) return;
      changed += 1;
      onUpdateCustomer(key, {
        publicId: createPublicId("CUST"),
        internalOnlyNotes: customer.internalOnlyNotes || customer.notes || "",
        customerPortalUpdatedAt: now,
      });
    });

    window.alert(changed ? `Prepared ${changed} customer records.` : "No customer records needed prep.");
  }

  const tablePlan = buildFutureTablePlan();

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Backend / Portal Prep</h2>
          <p className="muted-text">
            Prepare internal records for a future separate customer portal URL without making the internal app look customer-facing.
          </p>
        </div>

        <div className="record-button-row">
          <button className="primary-button" type="button" onClick={prepareAllNeeded}>
            <ShieldCheck size={18} />
            Prepare All Records
          </button>
          <button className="secondary-button" type="button" onClick={prepareCustomerRecords}>
            <Database size={18} />
            Prepare Customers
          </button>
        </div>
      </div>

      <div className="customer-warning-box">
        <strong><Lock size={18} /> Customer Portal Separation Rule</strong>
        <p>
          Keep customer-visible summaries and notes separate from internal notes. The future portal should read only public IDs, public status, customer-facing notes, totals, dates, and action flags.
        </p>
      </div>

      <div className="job-queue-summary single-row-gap">
        <div><span>Total Records</span><strong>{stats.total}</strong></div>
        <div><span>Backend Ready</span><strong>{stats.ready}</strong></div>
        <div><span>Needs Prep</span><strong>{stats.needsPrep}</strong></div>
        <div><span>Portal Enabled</span><strong>{stats.enabled}</strong></div>
        <div><span>Customer Action</span><strong>{stats.actionNeeded}</strong></div>
        <div><span>Known Customer Records</span><strong>{stats.customers}</strong></div>
      </div>

      <div className="filter-toolbar">
        <label className="filter-select-field">
          <span>Record Filter</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="needs-prep">Needs Prep</option>
            <option value="all">All Records</option>
            <option value="ready">Backend Ready</option>
            <option value="enabled">Portal Enabled</option>
            <option value="action">Customer Action Required</option>
          </select>
        </label>
        <div className="filter-count-pill">Showing {filteredRecords.length} of {records.length}</div>
      </div>

      <div className="jobs-stack">
        {filteredRecords.length === 0 ? (
          <div className="empty-state">
            <h3>No records in this filter.</h3>
            <p>Try switching filters or preparing existing records.</p>
          </div>
        ) : (
          filteredRecords.map((record) => (
            <BackendRecordCard
              key={`${record.backendType}-${record.id}`}
              record={record}
              type={record.backendType}
              onUpdate={(recordId, updates) => updateRecord(record.backendType, recordId, updates)}
            />
          ))
        )}
      </div>

      <div className="form-card single-row-gap">
        <h3 className="card-title">Future Shared Database Plan</h3>
        <p className="muted-text">
          This is the split I’d use when you move the internal app and customer portal onto Supabase or another shared backend.
        </p>

        <div className="dashboard-list single-row-gap">
          {tablePlan.map((table) => (
            <div className="dashboard-list-row" key={table.table}>
              <div>
                <strong>{table.table}</strong>
                <span>{table.purpose}</span>
                <small>{table.fields}</small>
              </div>
              <span className="status-pill">Future Table</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
