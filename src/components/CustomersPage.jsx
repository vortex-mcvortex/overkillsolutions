import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Crown,
  Mail,
  Merge,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  TrendingUp,
  UserRound,
  XCircle,
} from "lucide-react";

const CONTACT_METHODS = ["Not Set", "Phone", "Text", "Email", "Facebook", "In Person"];
const PAYMENT_METHODS = ["Not Set", "Venmo", "Cash", "Cash App", "PayPal", "Zelle", "Card", "Check"];
const CUSTOMER_TYPES = ["Standard", "VIP", "Business", "Repeat", "Prospect", "Do Not Prioritize"];
const RISK_LEVELS = ["None", "Low", "Medium", "High"];
const STATUS_FILTERS = ["All", "Needs Follow-Up", "Overdue Follow-Up", "VIP", "High Value", "Repeat", "Outstanding Balance", "Risk Flag", "Inactive", "Manual"];
const SORT_OPTIONS = ["Recent Activity", "Customer Value", "Outstanding Balance", "Follow-Up Date", "Name", "Job Count"];

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

function dateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString();
}

function getDaysFromToday(value) {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${value}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target - today) / 1000 / 60 / 60 / 24);
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
    customerType: "Standard",
    riskLevel: "None",
    followUpDate: "",
    lastContactedAt: "",
    crmStatus: "Active",
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
    customerType: customer.customerType || "Standard",
    riskLevel: customer.riskLevel || "None",
    followUpDate: customer.followUpDate || "",
    lastContactedAt: customer.lastContactedAt || "",
    crmStatus: customer.crmStatus || "Active",
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
      customerType: normalized.customerType || "Standard",
      riskLevel: normalized.riskLevel || "None",
      followUpDate: normalized.followUpDate || "",
      lastContactedAt: normalized.lastContactedAt || "",
      crmStatus: normalized.crmStatus || "Active",
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
    customer.preferredContactMethod = override.preferredContactMethod || customer.preferredContactMethod || "Not Set";
    customer.preferredPaymentMethod = override.preferredPaymentMethod || customer.preferredPaymentMethod || "Not Set";
    customer.customerType = override.customerType || customer.customerType || "Standard";
    customer.riskLevel = override.riskLevel || customer.riskLevel || "None";
    customer.followUpDate = override.followUpDate || customer.followUpDate || "";
    customer.lastContactedAt = override.lastContactedAt || customer.lastContactedAt || "";
    customer.crmStatus = override.crmStatus || customer.crmStatus || "Active";

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

  return [...map.values()].map(enrichCustomer).sort((a, b) => {
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

function getFollowUpInfo(customer) {
  if (!customer.followUpDate) {
    return {
      label: "No follow-up set",
      days: null,
      due: false,
      overdue: false,
    };
  }

  const days = getDaysFromToday(customer.followUpDate);

  if (days === null) {
    return {
      label: "Invalid follow-up date",
      days: null,
      due: false,
      overdue: false,
    };
  }

  if (days < 0) {
    return {
      label: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`,
      days,
      due: true,
      overdue: true,
    };
  }

  if (days === 0) {
    return {
      label: "Follow up today",
      days,
      due: true,
      overdue: false,
    };
  }

  if (days <= 3) {
    return {
      label: `Follow up in ${days} day${days === 1 ? "" : "s"}`,
      days,
      due: true,
      overdue: false,
    };
  }

  return {
    label: `Follow up ${formatDate(customer.followUpDate)}`,
    days,
    due: false,
    overdue: false,
  };
}

function getInactiveDays(customer) {
  if (!customer.latestActivity) return 9999;
  const latest = new Date(customer.latestActivity);
  if (Number.isNaN(latest.getTime())) return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  latest.setHours(0, 0, 0, 0);
  return Math.floor((today - latest) / 1000 / 60 / 60 / 24);
}

function getAverageOrderValue(customer) {
  return customer.jobs.length > 0 ? customer.totalJobValue / customer.jobs.length : 0;
}

function getQuoteConversionRate(customer) {
  const total = customer.quotes.length + customer.jobs.length;
  if (total === 0) return 0;
  return (customer.jobs.length / total) * 100;
}

function getCustomerValueTier(customer) {
  if (customer.customerType === "VIP") return "VIP";
  if (customer.totalJobValue >= 1000 || customer.jobs.length >= 5) return "VIP";
  if (customer.totalJobValue >= 400 || customer.jobs.length >= 2) return "High Value";
  if (customer.totalQuoted > 0 && customer.jobs.length === 0) return "Prospect";
  return "Standard";
}

function getCustomerHealth(customer) {
  let score = 60;

  if (customer.jobs.length > 0) score += 10;
  if (customer.jobs.length > 1) score += 10;
  if (customer.totalPaid >= customer.totalJobValue && customer.totalJobValue > 0) score += 10;
  if (customer.preferredContactMethod !== "Not Set") score += 5;
  if (customer.preferredPaymentMethod !== "Not Set") score += 5;
  if (customer.notes) score += 5;
  if (splitTags(customer.tags).length > 0) score += 5;
  if (customer.outstanding > 0) score -= 15;
  if (customer.riskLevel === "Medium") score -= 20;
  if (customer.riskLevel === "High") score -= 35;
  if (getFollowUpInfo(customer).overdue) score -= 10;
  if (getInactiveDays(customer) > 180) score -= 10;

  score = Math.max(0, Math.min(100, score));

  let label = "Healthy";
  if (score < 45) label = "Needs Attention";
  else if (score < 70) label = "Watch";

  return { score, label };
}

function enrichCustomer(customer) {
  const valueTier = getCustomerValueTier(customer);
  const health = getCustomerHealth(customer);
  const followUp = getFollowUpInfo(customer);
  const inactiveDays = getInactiveDays(customer);
  const averageOrderValue = getAverageOrderValue(customer);
  const conversionRate = getQuoteConversionRate(customer);

  return {
    ...customer,
    valueTier,
    health,
    followUp,
    inactiveDays,
    averageOrderValue,
    conversionRate,
  };
}

function buildCustomerTimeline(customer) {
  const items = [];

  customer.quotes.forEach((quote) => {
    items.push({
      id: `quote-${quote.id}`,
      type: "Quote",
      title: quote.quoteNumber || "Quote",
      detail: `${quote.jobName || "Untitled Quote"} • ${quote.quoteStatus || quote.status || "Draft Quote"} • ${money(quote.finalTotal)}`,
      date: quote.updatedAt || quote.createdAt || "",
    });
  });

  customer.jobs.forEach((job) => {
    items.push({
      id: `job-${job.id}`,
      type: "Job",
      title: job.jobNumber || "Job",
      detail: `${job.jobName || "Untitled Job"} • ${job.status || "Approved"} • ${money(job.finalTotal)}`,
      date: job.updatedAt || job.approvedAt || job.createdAt || "",
    });

    (job.paymentEvents || []).forEach((payment) => {
      items.push({
        id: `payment-${job.id}-${payment.id}`,
        type: "Payment",
        title: `${payment.type || "Payment"} — ${job.jobNumber || "Job"}`,
        detail: `${money(payment.amount)} via ${payment.method || "Unknown"}`,
        date: `${payment.date || ""}T${payment.time || "00:00"}`,
      });
    });
  });

  return items
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function findDuplicateCandidates(customer, customers) {
  const phone = String(customer.phone || "").replace(/\D/g, "");
  const email = String(customer.email || "").trim().toLowerCase();
  const name = String(customer.name || "").trim().toLowerCase();

  return customers.filter((candidate) => {
    if (candidate.key === customer.key) return false;

    const candidatePhone = String(candidate.phone || "").replace(/\D/g, "");
    const candidateEmail = String(candidate.email || "").trim().toLowerCase();
    const candidateName = String(candidate.name || "").trim().toLowerCase();

    if (email && candidateEmail && email === candidateEmail) return true;
    if (phone && candidatePhone && phone === candidatePhone) return true;
    if (name && candidateName && name === candidateName) return true;

    return false;
  });
}

function matchesCustomerSearch(customer, searchTerm, statusFilter) {
  const search = searchTerm.trim().toLowerCase();

  const statusMatches =
    statusFilter === "All" ||
    (statusFilter === "Needs Follow-Up" && customer.followUp.due) ||
    (statusFilter === "Overdue Follow-Up" && customer.followUp.overdue) ||
    (statusFilter === "VIP" && customer.valueTier === "VIP") ||
    (statusFilter === "High Value" && ["VIP", "High Value"].includes(customer.valueTier)) ||
    (statusFilter === "Repeat" && customer.jobs.length > 1) ||
    (statusFilter === "Outstanding Balance" && customer.outstanding > 0) ||
    (statusFilter === "Risk Flag" && customer.riskLevel !== "None") ||
    (statusFilter === "Inactive" && customer.inactiveDays >= 90) ||
    (statusFilter === "Manual" && customer.source === "manual");

  if (!statusMatches) return false;

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
    customer.customerType,
    customer.riskLevel,
    customer.crmStatus,
    customer.source,
    customer.valueTier,
    customer.health.label,
    customer.followUp.label,
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

function sortCustomers(customers, sortMode) {
  return [...customers].sort((a, b) => {
    if (sortMode === "Customer Value") return b.totalJobValue - a.totalJobValue;
    if (sortMode === "Outstanding Balance") return b.outstanding - a.outstanding;
    if (sortMode === "Job Count") return b.jobs.length - a.jobs.length;
    if (sortMode === "Name") return String(a.name).localeCompare(String(b.name));
    if (sortMode === "Follow-Up Date") {
      const aDate = a.followUpDate ? new Date(a.followUpDate) : new Date("2999-01-01");
      const bDate = b.followUpDate ? new Date(b.followUpDate) : new Date("2999-01-01");
      return aDate - bDate;
    }

    const aDate = a.latestActivity ? new Date(a.latestActivity) : new Date(0);
    const bDate = b.latestActivity ? new Date(b.latestActivity) : new Date(0);
    return bDate - aDate;
  });
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => {
          const nextValue = type === "tel" ? formatPhone(event.target.value) : event.target.value;
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
  customerType: "Standard",
  riskLevel: "None",
  followUpDate: "",
  lastContactedAt: "",
  crmStatus: "Active",
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
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortMode, setSortMode] = useState("Recent Activity");
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
    return sortCustomers(
      customers.filter((customer) => matchesCustomerSearch(customer, searchTerm, statusFilter)),
      sortMode
    );
  }, [customers, searchTerm, statusFilter, sortMode]);

  const totalCustomerJobValue = customers.reduce((sum, customer) => sum + customer.totalJobValue, 0);
  const totalOutstanding = customers.reduce((sum, customer) => sum + customer.outstanding, 0);
  const taggedCustomers = customers.filter((customer) => splitTags(customer.tags).length > 0);
  const repeatCustomers = customers.filter((customer) => customer.jobs.length > 1);
  const vipCustomers = customers.filter((customer) => customer.valueTier === "VIP");
  const followUpCustomers = customers.filter((customer) => customer.followUp.due);
  const overdueFollowUps = customers.filter((customer) => customer.followUp.overdue);
  const riskCustomers = customers.filter((customer) => customer.riskLevel !== "None");
  const inactiveCustomers = customers.filter((customer) => customer.inactiveDays >= 90);
  const topCustomers = [...customers].sort((a, b) => b.totalJobValue - a.totalJobValue).slice(0, 5);

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
      customerType: customer.customerType || "Standard",
      riskLevel: customer.riskLevel || "None",
      followUpDate: customer.followUpDate || "",
      lastContactedAt: dateOnly(customer.lastContactedAt) || "",
      crmStatus: customer.crmStatus || "Active",
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

  function markContacted(customer) {
    const payload = {
      lastContactedAt: new Date().toISOString(),
      followUpDate: "",
    };

    if (customer.source === "manual") {
      onUpdateManualCustomer(customer.key, payload);
    } else {
      onUpdateCustomer(customer.key, payload);
    }
  }

  function setQuickFollowUp(customer, days) {
    const date = new Date();
    date.setDate(date.getDate() + days);

    const payload = {
      followUpDate: date.toISOString().slice(0, 10),
    };

    if (customer.source === "manual") {
      onUpdateManualCustomer(customer.key, payload);
    } else {
      onUpdateCustomer(customer.key, payload);
    }
  }

  function renderCustomerForm(draft, updateFn) {
    return (
      <>
        <div className="form-grid">
          <Field label="Customer Name" value={draft.name} onChange={(value) => updateFn("name", value)} />
          <Field label="Phone" type="tel" value={draft.phone} onChange={(value) => updateFn("phone", value)} />
          <Field label="Email" type="email" value={draft.email} onChange={(value) => updateFn("email", value)} />

          <label className="field">
            <span>Preferred Contact</span>
            <select value={draft.preferredContactMethod || "Not Set"} onChange={(event) => updateFn("preferredContactMethod", event.target.value)}>
              {CONTACT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </label>

          <label className="field">
            <span>Preferred Payment</span>
            <select value={draft.preferredPaymentMethod || "Not Set"} onChange={(event) => updateFn("preferredPaymentMethod", event.target.value)}>
              {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </label>

          <label className="field">
            <span>Customer Type</span>
            <select value={draft.customerType || "Standard"} onChange={(event) => updateFn("customerType", event.target.value)}>
              {CUSTOMER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>

          <label className="field">
            <span>Risk Level</span>
            <select value={draft.riskLevel || "None"} onChange={(event) => updateFn("riskLevel", event.target.value)}>
              {RISK_LEVELS.map((risk) => <option key={risk} value={risk}>{risk}</option>)}
            </select>
          </label>

          <Field label="Follow-Up Date" type="date" value={draft.followUpDate || ""} onChange={(value) => updateFn("followUpDate", value)} />
          <Field label="Last Contacted" type="date" value={dateOnly(draft.lastContactedAt) || ""} onChange={(value) => updateFn("lastContactedAt", value)} />
          <Field label="Tags" value={draft.tags || ""} onChange={(value) => updateFn("tags", value)} />
        </div>

        <p className="helper-note">
          Tags are comma-separated. Example: repeat customer, rush-friendly, local pickup, picky, business client.
        </p>

        <label className="field single-row-gap">
          <span>Address</span>
          <textarea value={draft.address} onChange={(event) => updateFn("address", event.target.value)} />
        </label>

        <label className="field single-row-gap">
          <span>Customer Notes / Warnings</span>
          <textarea
            value={draft.notes}
            onChange={(event) => updateFn("notes", event.target.value)}
            placeholder="Preferences, delivery notes, repeat-customer details, quote warnings, risk notes, follow-up context, etc."
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
            CRM database from quotes, jobs, manual records, preferences, tags, follow-ups, health scoring, and customer value tracking.
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
              <p className="muted-text">Manual customers can be used later for quote autofill and CRM tracking.</p>
            </div>

            <div className="record-button-row customer-edit-actions">
              <button className="secondary-button" type="button" onClick={cancelCreateCustomer}><XCircle size={18} />Cancel</button>
              <button className="primary-button" type="button" onClick={saveNewCustomer}><Save size={18} />Save Customer</button>
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
            placeholder="Search customers by name, phone, email, tags, preferences, follow-up, job, quote, invoice, priority, or notes..."
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <label className="filter-select-field">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {STATUS_FILTERS.map((filter) => <option key={filter} value={filter}>{filter}</option>)}
          </select>
        </label>

        <label className="filter-select-field">
          <span>Sort</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            {SORT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>

        <div className="filter-count-pill">Showing {filteredCustomers.length} of {customers.length}</div>
      </div>

      <div className="job-queue-summary">
        <div><span>Total Customers</span><strong>{customers.length}</strong></div>
        <div><span>Manual Customers</span><strong>{manualCustomers.length}</strong></div>
        <div><span>Tagged Customers</span><strong>{taggedCustomers.length}</strong></div>
        <div><span>Repeat Customers</span><strong>{repeatCustomers.length}</strong></div>
        <div><span>VIP / High Value</span><strong>{vipCustomers.length}</strong></div>
        <div><span>Follow-Ups Due</span><strong>{followUpCustomers.length}</strong></div>
        <div><span>Overdue Follow-Ups</span><strong>{overdueFollowUps.length}</strong></div>
        <div><span>Risk Flags</span><strong>{riskCustomers.length}</strong></div>
        <div><span>Inactive 90+ Days</span><strong>{inactiveCustomers.length}</strong></div>
        <div><span>Total Customer Job Value</span><strong>{money(totalCustomerJobValue)}</strong></div>
        <div><span>Total Outstanding</span><strong>{money(totalOutstanding)}</strong></div>
      </div>

      {topCustomers.length > 0 && (
        <div className="form-card single-row-gap">
          <h3 className="card-title">Top Customers</h3>
          <div className="dashboard-list">
            {topCustomers.map((customer) => (
              <div className="dashboard-list-row" key={customer.key}>
                <div>
                  <strong>{customer.name}</strong>
                  <span>{customer.valueTier} • {customer.jobs.length} job{customer.jobs.length === 1 ? "" : "s"} • Avg order {money(customer.averageOrderValue)}</span>
                </div>
                <strong>{money(customer.totalJobValue)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {customers.length === 0 ? (
        <div className="empty-state"><h3>No customers yet.</h3><p>Create a customer manually or create quotes/jobs with customer contact info.</p></div>
      ) : filteredCustomers.length === 0 ? (
        <div className="empty-state"><h3>No matching customers.</h3><p>Try a different name, status, phone number, email, tag, preference, job, quote, or invoice.</p></div>
      ) : (
        <div className="customers-grid">
          {filteredCustomers.map((customer) => {
            const isExpanded = expandedCustomerKey === customer.key;
            const isEditing = editingCustomerKey === customer.key;
            const tags = splitTags(customer.tags);
            const duplicateCandidates = findDuplicateCandidates(customer, customers);
            const timeline = buildCustomerTimeline(customer).slice(0, 12);

            return (
              <article className={`customer-card customer-health-${customer.health.label.toLowerCase().replace(/\s+/g, "-")}`} key={customer.key}>
                <button className="customer-card-header" type="button" onClick={() => setExpandedCustomerKey(isExpanded ? "" : customer.key)}>
                  <div className="customer-avatar"><UserRound size={22} /></div>

                  <div className="customer-main">
                    <strong>{customer.name}</strong>
                    <span>{customer.phone || "No phone saved"}</span>
                    <small>{customer.email || "No email saved"}</small>

                    <div className="record-tags">
                      {customer.valueTier === "VIP" && <span><Crown size={12} /> VIP</span>}
                      {customer.valueTier === "High Value" && <span><Star size={12} /> High Value</span>}
                      {customer.followUp.due && <span><CalendarClock size={12} /> {customer.followUp.label}</span>}
                      {customer.riskLevel !== "None" && <span><AlertTriangle size={12} /> Risk: {customer.riskLevel}</span>}
                      {tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
                      {customer.preferredContactMethod !== "Not Set" && <span>Contact: {customer.preferredContactMethod}</span>}
                      {customer.preferredPaymentMethod !== "Not Set" && <span>Pay: {customer.preferredPaymentMethod}</span>}
                    </div>
                  </div>

                  <div className="customer-metrics">
                    <div><span>Tier</span><strong>{customer.valueTier}</strong></div>
                    <div><span>Health</span><strong>{customer.health.score}%</strong></div>
                    <div><span>Quotes</span><strong>{customer.quotes.length}</strong></div>
                    <div><span>Jobs</span><strong>{customer.jobs.length}</strong></div>
                    <div><span>Value</span><strong>{money(customer.totalJobValue)}</strong></div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="customer-expanded">
                    {isEditing ? (
                      <div className="form-card customer-edit-card">
                        <div className="page-heading-row">
                          <div>
                            <h3 className="card-title">Edit Customer Info</h3>
                            <p className="muted-text">{customer.source === "manual" ? "This edits the manually created customer record." : "These edits override contact info generated from old quotes and jobs."}</p>
                          </div>

                          <div className="record-button-row customer-edit-actions">
                            <button className="secondary-button" type="button" onClick={cancelEdit}><XCircle size={18} />Cancel</button>
                            <button className="primary-button" type="button" onClick={() => saveCustomer(customer)}><Save size={18} />Save Customer</button>
                          </div>
                        </div>

                        {renderCustomerForm(draftCustomer || EMPTY_CUSTOMER_DRAFT, updateDraft)}
                      </div>
                    ) : (
                      <>
                        <div className="customer-expanded-actions">
                          <button className="secondary-button" type="button" onClick={() => startEdit(customer)}><Pencil size={18} />Edit Customer</button>
                          <button className="secondary-button" type="button" onClick={() => markContacted(customer)}><MessageCircle size={18} />Mark Contacted</button>
                          <button className="secondary-button" type="button" onClick={() => setQuickFollowUp(customer, 3)}><CalendarClock size={18} />Follow Up 3 Days</button>
                          <button className="secondary-button" type="button" onClick={() => setQuickFollowUp(customer, 7)}><CalendarClock size={18} />Follow Up 7 Days</button>
                          {customer.source === "manual" && <button className="secondary-button danger-button" type="button" onClick={() => deleteManualCustomer(customer)}><Trash2 size={18} />Delete Manual Customer</button>}
                        </div>

                        {duplicateCandidates.length > 0 && (
                          <div className="customer-warning-box">
                            <strong><Merge size={18} /> Possible Duplicate Customer</strong>
                            <p>{duplicateCandidates.length} possible duplicate{duplicateCandidates.length === 1 ? "" : "s"}: {duplicateCandidates.map((item) => item.name).join(", ")}. Merge is not automated yet, but this flags records that share a name, phone, or email.</p>
                          </div>
                        )}

                        <div className="customer-contact-grid">
                          <div><span>Phone</span><strong>{customer.phone || "Not saved"}</strong></div>
                          <div><span>Email</span><strong>{customer.email || "Not saved"}</strong></div>
                          <div><span>Preferred Contact</span><strong>{customer.preferredContactMethod || "Not Set"}</strong></div>
                          <div><span>Preferred Payment</span><strong>{customer.preferredPaymentMethod || "Not Set"}</strong></div>
                          <div><span>Customer Tier</span><strong>{customer.valueTier}</strong></div>
                          <div><span>Health Score</span><strong>{customer.health.score}% — {customer.health.label}</strong></div>
                          <div><span>Follow-Up</span><strong>{customer.followUp.label}</strong></div>
                          <div><span>Last Contacted</span><strong>{formatDate(customer.lastContactedAt)}</strong></div>
                          <div><span>Risk Level</span><strong>{customer.riskLevel || "None"}</strong></div>
                          <div><span>Inactive Days</span><strong>{customer.inactiveDays >= 9999 ? "Unknown" : `${customer.inactiveDays} days`}</strong></div>
                          <div><span>Conversion Rate</span><strong>{customer.conversionRate.toFixed(1)}%</strong></div>
                          <div><span>Average Order</span><strong>{money(customer.averageOrderValue)}</strong></div>
                          <div><span>Address</span><strong>{customer.address || "Not saved"}</strong></div>
                          <div><span>Total Quoted</span><strong>{money(customer.totalQuoted)}</strong></div>
                          <div><span>Total Paid</span><strong>{money(customer.totalPaid)}</strong></div>
                          <div><span>Outstanding</span><strong>{money(customer.outstanding)}</strong></div>
                        </div>

                        <div className="record-button-row customer-contact-actions">
                          {customer.phone && <a className="secondary-button" href={`tel:${customer.phone}`}><Phone size={18} />Call</a>}
                          {customer.phone && <a className="secondary-button" href={`sms:${customer.phone}`}><MessageCircle size={18} />Text</a>}
                          {customer.email && <a className="secondary-button" href={`mailto:${customer.email}`}><Mail size={18} />Email</a>}
                        </div>

                        {tags.length > 0 && <div className="record-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}

                        {customer.notes && <div className="customer-notes-box"><span>Customer Notes / Warnings</span><p>{customer.notes}</p></div>}

                        <div className="customer-history-grid">
                          <div className="form-card">
                            <h3 className="card-title">Customer Timeline</h3>
                            {timeline.length === 0 ? <p className="muted-text">No timeline activity yet.</p> : (
                              <div className="dashboard-list">
                                {timeline.map((item) => (
                                  <div className="dashboard-list-row" key={item.id}>
                                    <div><strong>{item.title}</strong><span>{item.detail}</span></div>
                                    <div className="dashboard-status-stack"><span className="status-pill">{item.type}</span><span>{formatDateTime(item.date)}</span></div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="form-card">
                            <h3 className="card-title">CRM Intelligence</h3>
                            <div className="job-summary-grid">
                              <div><span>Lifetime Value</span><strong>{money(customer.totalJobValue)}</strong></div>
                              <div><span>Outstanding</span><strong>{money(customer.outstanding)}</strong></div>
                              <div><span>Avg Order</span><strong>{money(customer.averageOrderValue)}</strong></div>
                              <div><span>Conversion</span><strong>{customer.conversionRate.toFixed(1)}%</strong></div>
                              <div><span>Quotes</span><strong>{customer.quotes.length}</strong></div>
                              <div><span>Jobs</span><strong>{customer.jobs.length}</strong></div>
                            </div>
                          </div>

                          <div className="form-card">
                            <h3 className="card-title">Quote History</h3>
                            {customer.quotes.length === 0 ? <p className="muted-text">No quotes for this customer.</p> : (
                              <div className="dashboard-list">
                                {customer.quotes.map((quote) => <div className="dashboard-list-row" key={quote.id}><div><strong>{quote.quoteNumber}</strong><span>{quote.jobName || "Untitled Quote"}</span></div><strong>{money(quote.finalTotal)}</strong></div>)}
                              </div>
                            )}
                          </div>

                          <div className="form-card">
                            <h3 className="card-title">Job History</h3>
                            {customer.jobs.length === 0 ? <p className="muted-text">No jobs for this customer.</p> : (
                              <div className="dashboard-list">
                                {customer.jobs.map((job) => (
                                  <div className="dashboard-list-row" key={job.id}>
                                    <div><strong>{job.jobNumber}</strong><span>{job.jobName || "Untitled Job"}</span>{(job.priority || job.dueDate) && <small>{job.priority ? `${job.priority} priority` : ""}{job.priority && job.dueDate ? " • " : ""}{job.dueDate ? `Due ${job.dueDate}` : ""}</small>}</div>
                                    <div className="dashboard-status-stack">{job.archived && <span className="status-pill">Archived</span>}<span className="status-pill">{job.status || "Approved"}</span><strong>{money(job.finalTotal)}</strong></div>
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
