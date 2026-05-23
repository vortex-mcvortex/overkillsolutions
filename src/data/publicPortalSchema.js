export const PUBLIC_STATUS_OPTIONS = [
  "Not Published",
  "Request Received",
  "Quote In Review",
  "Quote Sent",
  "Approved",
  "In Production",
  "Ready for Pickup",
  "Ready to Ship",
  "Completed",
  "Closed",
];

export const PUBLIC_VISIBILITY_OPTIONS = [
  "Internal Only",
  "Customer Visible",
  "Customer Action Needed",
];

export function createPublicId(prefix = "PUB") {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  const stamp = Date.now().toString(36).slice(-5).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

export function createAccessToken() {
  const parts = [
    Math.random().toString(36).slice(2, 8),
    Math.random().toString(36).slice(2, 8),
    Date.now().toString(36).slice(-6),
  ];

  return parts.join("-").toUpperCase();
}

export function getCustomerVisibleStatus(record) {
  if (record.publicStatus) return record.publicStatus;

  const status = record.quoteStatus || record.status || "";

  if (status === "Draft Quote") return "Quote In Review";
  if (status === "Sent") return "Quote Sent";
  if (status === "Approved") return record.jobNumber ? "In Production" : "Approved";
  if (status === "Ready for Pickup") return "Ready for Pickup";
  if (status === "Ready to Ship") return "Ready to Ship";
  if (status === "Completed") return "Completed";
  if (status === "Cancelled" || status === "Declined" || status === "Expired") return "Closed";

  return "Not Published";
}

export function normalizePublicRecord(record, type = "quote") {
  const now = new Date().toISOString();
  const publicPrefix = type === "job" ? "JOB" : "QUOTE";

  return {
    publicId: record.publicId || createPublicId(publicPrefix),
    publicAccessToken: record.publicAccessToken || createAccessToken(),
    publicEnabled: Boolean(record.publicEnabled),
    publicVisibility: record.publicVisibility || "Internal Only",
    publicStatus: record.publicStatus || getCustomerVisibleStatus(record),
    customerFacingTitle:
      record.customerFacingTitle ||
      record.jobName ||
      record.formData?.jobName ||
      (type === "job" ? "Production Job" : "Quote Request"),
    customerFacingSummary: record.customerFacingSummary || "",
    customerFacingNotes: record.customerFacingNotes || "",
    internalOnlyNotes: record.internalOnlyNotes || record.queueNotes || "",
    customerActionRequired: Boolean(record.customerActionRequired),
    customerActionLabel: record.customerActionLabel || "",
    customerPortalUpdatedAt: now,
  };
}

export function buildPublicQuotePayload(quote) {
  return {
    publicId: quote.publicId,
    quoteNumber: quote.quoteNumber,
    status: quote.publicStatus || getCustomerVisibleStatus(quote),
    title: quote.customerFacingTitle || quote.jobName,
    summary: quote.customerFacingSummary || "",
    customerNotes: quote.customerFacingNotes || "",
    customerName: quote.customerName || "",
    total: Number(quote.finalTotal || 0),
    deposit: Number(quote.depositAmount || quote.totals?.suggestedDeposit || 0),
    expiresAt: quote.expiresAt || "",
    updatedAt: quote.customerPortalUpdatedAt || quote.updatedAt || quote.createdAt || "",
  };
}

export function buildPublicJobPayload(job) {
  return {
    publicId: job.publicId,
    jobNumber: job.jobNumber,
    quoteNumber: job.quoteNumber,
    status: job.publicStatus || getCustomerVisibleStatus(job),
    title: job.customerFacingTitle || job.jobName,
    summary: job.customerFacingSummary || "",
    customerNotes: job.customerFacingNotes || "",
    customerName: job.customerName || "",
    dueDate: job.dueDate || "",
    readyDate: job.readyDate || "",
    updatedAt: job.customerPortalUpdatedAt || job.updatedAt || job.createdAt || "",
  };
}

export function buildFutureTablePlan() {
  return [
    {
      table: "customers",
      purpose: "Shared customer identity and contact preferences for both apps.",
      fields: "id, public_id, name, phone, email, address, preferred_contact, preferred_payment, tags, notes_internal",
    },
    {
      table: "quote_requests",
      purpose: "Future customer-facing intake form records from the separate portal URL.",
      fields: "id, public_id, customer_id, service_types, budget, deadline, uploaded_files, customer_notes, internal_status",
    },
    {
      table: "quotes",
      purpose: "Internal quote data with customer-safe fields separated for portal display.",
      fields: "id, public_id, access_token_hash, customer_id, quote_number, totals, internal_notes, customer_notes, public_status",
    },
    {
      table: "jobs",
      purpose: "Production tracking for internal app with limited public status exposed to portal.",
      fields: "id, public_id, quote_id, job_number, internal_status, public_status, schedule, internal_notes, customer_notes",
    },
    {
      table: "payments",
      purpose: "Payment ledger and future deposit/payment portal integration.",
      fields: "id, job_id, quote_id, amount, method, type, processor_ref, paid_at",
    },
    {
      table: "portal_events",
      purpose: "Audit trail for customer views, approvals, uploads, and messages.",
      fields: "id, public_record_id, event_type, payload, created_at",
    },
  ];
}
