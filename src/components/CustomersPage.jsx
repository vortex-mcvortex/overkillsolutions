import { useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";

const CONTACT_METHODS = ["Not Set", "Phone", "Text", "Email", "Facebook", "In Person"];
const PAYMENT_METHODS = ["Not Set", "Venmo", "Cash", "Cash App", "PayPal", "Zelle", "Card", "Check"];

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

function customerKey(record) {
  const email = clean(record.customerEmail || record.formData?.customerEmail).toLowerCase();
  const phone = clean(record.customerPhone || record.formData?.customerPhone).replace(/\D/g, "");
  const name = clean(record.customerName || record.formData?.customerName).toLowerCase();

  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  if (name) return `name:${name}`;

  return `unknown:${record.id}`;
}

function getCustomerInfo(record) {
  return {
    name: clean(record.customerName || record.formData?.customerName) || "Unknown Customer",
    phone: clean(record.customerPhone || record.formData?.customerPhone),
    email: clean(record.customerEmail || record.formData?.customerEmail),
    address: clean(record.customerAddress || record.formData?.customerAddress),
    notes: "",
    tags: "",
    preferredContactMethod: "Not Set",
    preferredPaymentMethod: "Not Set",
  };
}

function getPaidTotal(job) {
  return (job.paymentEvents || []).reduce((sum, payment) => {
    if (payment.type === "Refund") return sum - num(payment.amount);
    return sum + num(payment.amount);
  }, 0);
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function normalizeCustomerRecord(customer) {
  return {
    ...customer,
    tags: customer.tags || "",
    preferredContactMethod: customer.preferredContactMethod || "Not Set",
    preferredPaymentMethod: customer.preferredPaymentMethod || "Not Set",
    notes: customer.notes || "",
  };
}

function buildCustomers(quotes, jobs, customerOverrides = {}, manualCustomers = []) {
  const map = new Map();

  manualCustomers.forEach((manualCustomer) => {
    const normalized = normalizeCustomerRecord(manualCustomer);

    map.set(normalized.key, {
      key: normalized.key,
      source: "manual",
      name: normalized.name || "Manual Customer",
      phone: normalized.phone || "",
      email: normalized.email || "",
      address: normalized.address || "",
      notes: normalized.notes || "",
      tags: normalized.tags || "",
      preferredContactMethod: normalized.preferredContactMethod || "Not Set",
      preferredPaymentMethod: normalized.preferredPaymentMethod || "Not Set",
      quotes: [],
      jobs: [],
      totalQuoted: 0,
      totalJobValue: 0,
      totalPaid: 0,
      outstanding: 0,
      latestActivity: normalized.updatedAt || normalized.createdAt || "",
    });
  });

  function ensureCustomer(record) {
    const key = customerKey(record);
    const info = getCustomerInfo(record);
    const override = normalizeCustomerRecord(customerOverrides[key] || {});

    if (!map.has(key)) {
      map.set(key, {
        key,
        source: "generated",
        ...info,
        ...override,
        quotes: [],
        jobs: [],
        totalQuoted: 0,
        totalJobValue: 0,
        totalPaid: 0,
        outstanding: 0,
        latestActivity: record.updatedAt || record.createdAt || record.approvedAt || "",
      });
    }

    const customer = map.get(key);

    customer.name = override.name || customer.name || info.name;
    customer.phone = override.phone || customer.phone || info.phone;
    customer.email = override.email || customer.email || info.email;
    customer.address = override.address || customer.address || info.address;
    customer.notes = override.notes || customer.notes || "";
    customer.tags = override.tags || customer.tags || "";
    customer.preferredContactMethod =
      override.preferredContactMethod ||
      customer.preferredContactMethod ||
      "Not Set";
    customer.preferredPaymentMethod =
      override.preferredPaymentMethod ||
      customer.preferredPaymentMethod ||
      "Not Set";

    const recordDate = record.updatedAt || record.createdAt || record.approvedAt || "";
    if (recordDate && (!customer.latestActivity || new Date(recordDate) > new Date(customer.latestActivity))) {
      customer.latestActivity = recordDate;
    }

    return customer;
  }

  quotes.forEach((quote) => {
    const customer = ensureCustomer(quote);
    customer.quotes.push(quote);
    customer.totalQuoted += num(quote.finalTotal);
  });

  jobs.forEach((job) => {
    const customer = ensureCustomer(job);
    const paid = getPaidTotal(job);

    customer.jobs.push(job);
    customer.totalJobValue += num(job.finalTotal);
    customer.totalPaid += paid;
    customer.outstanding += Math.max(0, num(job.finalTotal) - paid);
  });

  return [...map.values()].sort((a, b) => {
    const aDate = a.latestActivity ? new Date(a.latestActivity) : new Date(0);
    const bDate = b.latestActivity ? new Date(b.latestActivity) : new Date(0);
    return bDate - aDate;
  });
}

function splitTags(tags) {
  return String(tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function matchesCustomerSearch(customer, searchTerm) {
  const search = searchTerm.trim().toLowerCase();

  if (!search) return true;

  const baseFields = [
    customer.name,
    customer.phone,
    customer.email,
    customer.address,
    customer.notes,
    customer.tags,
    customer.preferredContactMethod,
    customer.preferredPaymentMethod,
    customer.source,
  ];

  const quoteFields = customer.quotes.flatMap((quote) => [
    quote.quoteNumber,
    quote.jobName,
    quote.status,
  ]);

  const jobFields = customer.jobs.flatMap((job) => [
    job.jobNumber,
    job.quoteNumber,
    job.invoiceNumber,
    job.jobName,
    job.status,
    job.priority,
    job.dueDate,
    job.queueNotes,
  ]);

  return [...baseFields, ...quoteFields, ...jobFields]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(search));
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => {
          const nextValue =
            type === "tel" ? formatPhone(event.target.value) : event.target.value;

          onChange(nextValue);
        }}
      />
    </label>
  );
}

const EMPTY_CUSTOMER_DRAFT = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  tags: "",
  preferredContactMethod: "Not Set",
  preferredPaymentMethod: "Not Set",
};

export default function CustomersPage({
  quotes,
  jobs,
  customerOverrides = {},
  manualCustomers = [],
  onUpdateCustomer,
  onAddManualCustomer,
  onUpdateManualCustomer,
  onDeleteManualCustomer,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCustomerKey, setExpandedCustomerKey] = useState("");
  const [editingCustomerKey, setEditingCustomerKey] = useState("");
  const [draftCustomer, setDraftCustomer] = useState(null);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomerDraft, setNewCustomerDraft] = useState(EMPTY_CUSTOMER_DRAFT);

  const customers = useMemo(
    () => buildCustomers(quotes, jobs, customerOverrides, manualCustomers),
    [quotes, jobs, customerOverrides, manualCustomers]
  );

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) =>
      matchesCustomerSearch(customer, searchTerm)
    );
  }, [customers, searchTerm]);

  const totalCustomerJobValue = customers.reduce(
    (sum, customer) => sum + customer.totalJobValue,
    0
  );

  const totalOutstanding = customers.reduce(
    (sum, customer) => sum + customer.outstanding,
    0
  );

  const taggedCustomers = customers.filter((customer) => splitTags(customer.tags).length > 0);
  const repeatCustomers = customers.filter((customer) => customer.jobs.length > 1);

  function startCreateCustomer() {
    setIsCreatingCustomer(true);
    setNewCustomerDraft(EMPTY_CUSTOMER_DRAFT);
  }

  function cancelCreateCustomer() {
    setIsCreatingCustomer(false);
    setNewCustomerDraft(EMPTY_CUSTOMER_DRAFT);
  }

  function updateNewCustomerDraft(key, value) {
    setNewCustomerDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function saveNewCustomer() {
    if (!newCustomerDraft.name.trim()) {
      window.alert("Customer name is required.");
      return;
    }

    onAddManualCustomer(newCustomerDraft);
    setIsCreatingCustomer(false);
    setNewCustomerDraft(EMPTY_CUSTOMER_DRAFT);
  }

  function startEdit(customer) {
    setExpandedCustomerKey(customer.key);
    setEditingCustomerKey(customer.key);
    setDraftCustomer({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
      tags: customer.tags || "",
      preferredContactMethod: customer.preferredContactMethod || "Not Set",
      preferredPaymentMethod: customer.preferredPaymentMethod || "Not Set",
    });
  }

  function cancelEdit() {
    setEditingCustomerKey("");
    setDraftCustomer(null);
  }

  function updateDraft(key, value) {
    setDraftCustomer((current) => ({
      ...(current || {}),
      [key]: value,
    }));
  }

  function saveCustomer(customer) {
    if (!draftCustomer) return;

    if (!draftCustomer.name.trim()) {
      window.alert("Customer name is required.");
      return;
    }

    if (customer.source === "manual") {
      onUpdateManualCustomer(customer.key, draftCustomer);
    } else {
      onUpdateCustomer(customer.key, draftCustomer);
    }

    setEditingCustomerKey("");
    setDraftCustomer(null);
  }

  function deleteManualCustomer(customer) {
    if (customer.source !== "manual") return;
    onDeleteManualCustomer(customer.key);
  }

  function renderCustomerForm(draft, updateFn) {
    return (
      <>
        <div className="form-grid">
          <Field
            label="Customer Name"
            value={draft.name}
            onChange={(value) => updateFn("name", value)}
          />

          <Field
            label="Phone"
            type="tel"
            value={draft.phone}
            onChange={(value) => updateFn("phone", value)}
          />

          <Field
            label="Email"
            type="email"
            value={draft.email}
            onChange={(value) => updateFn("email", value)}
          />

          <label className="field">
            <span>Preferred Contact</span>
            <select
              value={draft.preferredContactMethod || "Not Set"}
              onChange={(event) => updateFn("preferredContactMethod", event.target.value)}
            >
              {CONTACT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Preferred Payment</span>
            <select
              value={draft.preferredPaymentMethod || "Not Set"}
              onChange={(event) => updateFn("preferredPaymentMethod", event.target.value)}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>

          <Field
            label="Tags"
            value={draft.tags || ""}
            onChange={(value) => updateFn("tags", value)}
          />
        </div>

        <p className="helper-note">
          Tags are comma-separated. Example: repeat customer, rush-friendly, local pickup, picky, business client.
        </p>

        <label className="field single-row-gap">
          <span>Address</span>
          <textarea
            value={draft.address}
            onChange={(event) => updateFn("address", event.target.value)}
          />
        </label>

        <label className="field single-row-gap">
          <span>Customer Notes</span>
          <textarea
            value={draft.notes}
            onChange={(event) => updateFn("notes", event.target.value)}
            placeholder="Preferences, delivery notes, repeat-customer details, quote warnings, etc."
          />
        </label>
      </>
    );
  }

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Customers</h2>
          <p className="muted-text">
            Editable customer database from saved quotes, jobs, manually created records, preferences, tags, and history.
          </p>
        </div>

        <button className="primary-button customer-new-button" onClick={startCreateCustomer}>
          <Plus size={18} />
          New Customer
        </button>
      </div>

      {isCreatingCustomer && (
        <div className="form-card customer-create-card">
          <div className="page-heading-row">
            <div>
              <h3 className="card-title">Create Customer</h3>
              <p className="muted-text">
                Manual customers can be used later for quote autofill.
              </p>
            </div>

            <div className="record-button-row customer-edit-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={cancelCreateCustomer}
              >
                <XCircle size={18} />
                Cancel
              </button>

              <button
                className="primary-button"
                type="button"
                onClick={saveNewCustomer}
              >
                <Save size={18} />
                Save Customer
              </button>
            </div>
          </div>

          {renderCustomerForm(newCustomerDraft, updateNewCustomerDraft)}
        </div>
      )}

      <div className="filter-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            type="search"
            value={searchTerm}
            placeholder="Search customers by name, phone, email, tags, preferences, address, job, quote, invoice, priority, or notes..."
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <div className="filter-count-pill">
          Showing {filteredCustomers.length} of {customers.length}
        </div>
      </div>

      <div className="job-queue-summary">
        <div>
          <span>Total Customers</span>
          <strong>{customers.length}</strong>
        </div>

        <div>
          <span>Manual Customers</span>
          <strong>{manualCustomers.length}</strong>
        </div>

        <div>
          <span>Tagged Customers</span>
          <strong>{taggedCustomers.length}</strong>
        </div>

        <div>
          <span>Repeat Customers</span>
          <strong>{repeatCustomers.length}</strong>
        </div>

        <div>
          <span>Total Customer Job Value</span>
          <strong>{money(totalCustomerJobValue)}</strong>
        </div>

        <div>
          <span>Total Outstanding</span>
          <strong>{money(totalOutstanding)}</strong>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="empty-state">
          <h3>No customers yet.</h3>
          <p>Create a customer manually or create quotes/jobs with customer contact info.</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="empty-state">
          <h3>No matching customers.</h3>
          <p>Try a different name, phone number, email, tag, preference, job, quote, or invoice.</p>
        </div>
      ) : (
        <div className="customers-grid">
          {filteredCustomers.map((customer) => {
            const isExpanded = expandedCustomerKey === customer.key;
            const isEditing = editingCustomerKey === customer.key;
            const tags = splitTags(customer.tags);

            return (
              <article className="customer-card" key={customer.key}>
                <button
                  className="customer-card-header"
                  type="button"
                  onClick={() =>
                    setExpandedCustomerKey(isExpanded ? "" : customer.key)
                  }
                >
                  <div className="customer-avatar">
                    <UserRound size={22} />
                  </div>

                  <div className="customer-main">
                    <strong>{customer.name}</strong>
                    <span>{customer.phone || "No phone saved"}</span>
                    <small>{customer.email || "No email saved"}</small>

                    <div className="record-tags">
                      {tags.slice(0, 4).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}

                      {customer.preferredContactMethod !== "Not Set" && (
                        <span>Contact: {customer.preferredContactMethod}</span>
                      )}

                      {customer.preferredPaymentMethod !== "Not Set" && (
                        <span>Pay: {customer.preferredPaymentMethod}</span>
                      )}
                    </div>
                  </div>

                  <div className="customer-metrics">
                    <div>
                      <span>Source</span>
                      <strong>{customer.source === "manual" ? "Manual" : "Auto"}</strong>
                    </div>

                    <div>
                      <span>Quotes</span>
                      <strong>{customer.quotes.length}</strong>
                    </div>

                    <div>
                      <span>Jobs</span>
                      <strong>{customer.jobs.length}</strong>
                    </div>

                    <div>
                      <span>Value</span>
                      <strong>{money(customer.totalJobValue)}</strong>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="customer-expanded">
                    {isEditing ? (
                      <div className="form-card customer-edit-card">
                        <div className="page-heading-row">
                          <div>
                            <h3 className="card-title">Edit Customer Info</h3>
                            <p className="muted-text">
                              {customer.source === "manual"
                                ? "This edits the manually created customer record."
                                : "These edits override contact info generated from old quotes and jobs."}
                            </p>
                          </div>

                          <div className="record-button-row customer-edit-actions">
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={cancelEdit}
                            >
                              <XCircle size={18} />
                              Cancel
                            </button>

                            <button
                              className="primary-button"
                              type="button"
                              onClick={() => saveCustomer(customer)}
                            >
                              <Save size={18} />
                              Save Customer
                            </button>
                          </div>
                        </div>

                        {renderCustomerForm(draftCustomer || EMPTY_CUSTOMER_DRAFT, updateDraft)}
                      </div>
                    ) : (
                      <>
                        <div className="customer-expanded-actions">
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => startEdit(customer)}
                          >
                            <Pencil size={18} />
                            Edit Customer
                          </button>

                          {customer.source === "manual" && (
                            <button
                              className="secondary-button danger-button"
                              type="button"
                              onClick={() => deleteManualCustomer(customer)}
                            >
                              <Trash2 size={18} />
                              Delete Manual Customer
                            </button>
                          )}
                        </div>

                        <div className="customer-contact-grid">
                          <div>
                            <span>Phone</span>
                            <strong>{customer.phone || "Not saved"}</strong>
                          </div>

                          <div>
                            <span>Email</span>
                            <strong>{customer.email || "Not saved"}</strong>
                          </div>

                          <div>
                            <span>Preferred Contact</span>
                            <strong>{customer.preferredContactMethod || "Not Set"}</strong>
                          </div>

                          <div>
                            <span>Preferred Payment</span>
                            <strong>{customer.preferredPaymentMethod || "Not Set"}</strong>
                          </div>

                          <div>
                            <span>Address</span>
                            <strong>{customer.address || "Not saved"}</strong>
                          </div>

                          <div>
                            <span>Total Quoted</span>
                            <strong>{money(customer.totalQuoted)}</strong>
                          </div>

                          <div>
                            <span>Total Paid</span>
                            <strong>{money(customer.totalPaid)}</strong>
                          </div>

                          <div>
                            <span>Outstanding</span>
                            <strong>{money(customer.outstanding)}</strong>
                          </div>
                        </div>

                        {tags.length > 0 && (
                          <div className="record-tags">
                            {tags.map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                        )}

                        {customer.notes && (
                          <div className="customer-notes-box">
                            <span>Customer Notes</span>
                            <p>{customer.notes}</p>
                          </div>
                        )}

                        <div className="customer-history-grid">
                          <div className="form-card">
                            <h3 className="card-title">Quote History</h3>

                            {customer.quotes.length === 0 ? (
                              <p className="muted-text">No quotes for this customer.</p>
                            ) : (
                              <div className="dashboard-list">
                                {customer.quotes.map((quote) => (
                                  <div className="dashboard-list-row" key={quote.id}>
                                    <div>
                                      <strong>{quote.quoteNumber}</strong>
                                      <span>{quote.jobName || "Untitled Quote"}</span>
                                    </div>
                                    <strong>{money(quote.finalTotal)}</strong>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="form-card">
                            <h3 className="card-title">Job History</h3>

                            {customer.jobs.length === 0 ? (
                              <p className="muted-text">No jobs for this customer.</p>
                            ) : (
                              <div className="dashboard-list">
                                {customer.jobs.map((job) => (
                                  <div className="dashboard-list-row" key={job.id}>
                                    <div>
                                      <strong>{job.jobNumber}</strong>
                                      <span>{job.jobName || "Untitled Job"}</span>
                                      {(job.priority || job.dueDate) && (
                                        <small>
                                          {job.priority ? `${job.priority} priority` : ""}
                                          {job.priority && job.dueDate ? " • " : ""}
                                          {job.dueDate ? `Due ${job.dueDate}` : ""}
                                        </small>
                                      )}
                                    </div>

                                    <div className="dashboard-status-stack">
                                      {job.archived && <span className="status-pill">Archived</span>}
                                      <span className="status-pill">{job.status || "Approved"}</span>
                                      <strong>{money(job.finalTotal)}</strong>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
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