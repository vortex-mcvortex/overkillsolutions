import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle,
  CreditCard,
  DollarSign,
  Edit,
  FileDown,
  PackageSearch,
  Plus,
  Save,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

const EXPENSE_CATEGORIES = [
  "Materials",
  "Inventory Purchase",
  "Machine Maintenance",
  "Machine Upgrade",
  "Tooling",
  "Shipping",
  "Packaging",
  "Software",
  "Utilities",
  "Rent / Space",
  "Marketing",
  "Labor",
  "Refund / Rework",
  "Business Admin",
  "Other",
];

const EXPENSE_STATUSES = ["Logged", "Planned", "Paid", "Reimbursable", "Cancelled"];
const PAYMENT_METHODS = ["Cash", "Venmo", "Cash App", "PayPal", "Zelle", "Card", "Check", "Bank", "Other"];
const SUPPLIER_CATEGORIES = ["Filament", "Laser Materials", "Vinyl", "Hardware", "Packaging", "Tools", "Software", "Shipping", "General"];
const DATE_FILTERS = ["All", "This Month", "Last Month", "This Year", "Last 90 Days"];

const EMPTY_EXPENSE = {
  name: "",
  vendor: "",
  category: "Materials",
  subcategory: "",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  paymentMethod: "Card",
  status: "Logged",
  recurring: false,
  recurringInterval: "Monthly",
  relatedJobNumber: "",
  relatedInventoryItemId: "",
  supplierId: "",
  notes: "",
};

const EMPTY_SUPPLIER = {
  name: "",
  category: "General",
  contactName: "",
  phone: "",
  email: "",
  website: "",
  preferred: false,
  notes: "",
};

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

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString();
}

function isSameMonth(dateValue, offset = 0) {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const target = new Date();
  target.setMonth(target.getMonth() + offset);
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth();
}

function isThisYear(dateValue) {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.getFullYear() === new Date().getFullYear();
}

function isLast90Days(dateValue) {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  return date >= cutoff;
}

function matchesDateFilter(expense, filter) {
  if (filter === "All") return true;
  if (filter === "This Month") return isSameMonth(expense.date, 0);
  if (filter === "Last Month") return isSameMonth(expense.date, -1);
  if (filter === "This Year") return isThisYear(expense.date);
  if (filter === "Last 90 Days") return isLast90Days(expense.date);
  return true;
}

function matchesExpense(expense, searchTerm, categoryFilter, statusFilter, dateFilter) {
  const search = searchTerm.trim().toLowerCase();
  const searchMatches =
    !search ||
    [
      expense.expenseNumber,
      expense.name,
      expense.vendor,
      expense.category,
      expense.subcategory,
      expense.paymentMethod,
      expense.status,
      expense.relatedJobNumber,
      expense.notes,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));

  const categoryMatches = categoryFilter === "All" || expense.category === categoryFilter;
  const statusMatches = statusFilter === "All" || expense.status === statusFilter;

  return searchMatches && categoryMatches && statusMatches && matchesDateFilter(expense, dateFilter);
}

function groupByCategory(expenses) {
  const map = new Map();

  expenses.forEach((expense) => {
    const key = expense.category || "Other";
    const existing = map.get(key) || { category: key, total: 0, count: 0 };
    existing.total += num(expense.amount);
    existing.count += 1;
    map.set(key, existing);
  });

  return [...map.values()].sort((a, b) => b.total - a.total);
}

function groupByVendor(expenses) {
  const map = new Map();

  expenses.forEach((expense) => {
    const key = expense.vendor || "Unknown Vendor";
    const existing = map.get(key) || { vendor: key, total: 0, count: 0 };
    existing.total += num(expense.amount);
    existing.count += 1;
    map.set(key, existing);
  });

  return [...map.values()].sort((a, b) => b.total - a.total);
}

function getPaidTotal(job) {
  return (job.paymentEvents || []).reduce((sum, payment) => {
    if (payment.type === "Refund") return sum - num(payment.amount);
    return sum + num(payment.amount);
  }, 0);
}

function calculateRevenue(jobs) {
  return jobs.reduce((sum, job) => sum + getPaidTotal(job), 0);
}

function calculateJobValue(jobs) {
  return jobs.reduce((sum, job) => sum + num(job.finalTotal), 0);
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

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="dashboard-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {Icon && <Icon size={20} />}
    </div>
  );
}

export default function ExpensesPage({
  expenses = [],
  suppliers = [],
  jobs = [],
  inventoryItems = [],
  inventoryLogs = [],
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("This Month");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [expenseDraft, setExpenseDraft] = useState(EMPTY_EXPENSE);
  const [supplierDraft, setSupplierDraft] = useState(EMPTY_SUPPLIER);
  const [editingExpenseId, setEditingExpenseId] = useState("");
  const [editingExpenseDraft, setEditingExpenseDraft] = useState(null);
  const [editingSupplierId, setEditingSupplierId] = useState("");
  const [editingSupplierDraft, setEditingSupplierDraft] = useState(null);

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((expense) => matchesExpense(expense, searchTerm, categoryFilter, statusFilter, dateFilter))
      .sort((a, b) => new Date(`${b.date || "1900-01-01"}T00:00:00`) - new Date(`${a.date || "1900-01-01"}T00:00:00`));
  }, [expenses, searchTerm, categoryFilter, statusFilter, dateFilter]);

  const thisMonthExpenses = expenses.filter((expense) => isSameMonth(expense.date, 0));
  const lastMonthExpenses = expenses.filter((expense) => isSameMonth(expense.date, -1));
  const thisYearExpenses = expenses.filter(isThisYearExpense);

  function isThisYearExpense(expense) {
    return isThisYear(expense.date);
  }

  const totalFiltered = filteredExpenses.reduce((sum, expense) => sum + num(expense.amount), 0);
  const thisMonthExpenseTotal = thisMonthExpenses.reduce((sum, expense) => sum + num(expense.amount), 0);
  const lastMonthExpenseTotal = lastMonthExpenses.reduce((sum, expense) => sum + num(expense.amount), 0);
  const thisYearExpenseTotal = thisYearExpenses.reduce((sum, expense) => sum + num(expense.amount), 0);
  const recurringExpenseTotal = expenses.filter((expense) => expense.recurring).reduce((sum, expense) => sum + num(expense.amount), 0);
  const revenueCollected = calculateRevenue(jobs);
  const bookedRevenue = calculateJobValue(jobs);
  const estimatedNet = revenueCollected - thisYearExpenseTotal;
  const inventoryPurchaseTotal = expenses.filter((expense) => ["Materials", "Inventory Purchase"].includes(expense.category)).reduce((sum, expense) => sum + num(expense.amount), 0);
  const maintenanceTotal = expenses.filter((expense) => expense.category === "Machine Maintenance").reduce((sum, expense) => sum + num(expense.amount), 0);

  const categoryTotals = groupByCategory(filteredExpenses);
  const vendorTotals = groupByVendor(filteredExpenses);
  const recentInventoryPurchases = inventoryLogs.filter((log) => ["Stock Added", "Bulk Imported", "Created"].includes(log.type)).slice(0, 8);

  function updateExpenseDraft(key, value) {
    setExpenseDraft((current) => ({ ...current, [key]: value }));
  }

  function updateSupplierDraft(key, value) {
    setSupplierDraft((current) => ({ ...current, [key]: value }));
  }

  function updateEditingExpenseDraft(key, value) {
    setEditingExpenseDraft((current) => ({ ...(current || {}), [key]: value }));
  }

  function updateEditingSupplierDraft(key, value) {
    setEditingSupplierDraft((current) => ({ ...(current || {}), [key]: value }));
  }

  function saveExpense() {
    if (!expenseDraft.name.trim() && !expenseDraft.vendor.trim()) {
      window.alert("Expense name or vendor is required.");
      return;
    }

    if (num(expenseDraft.amount) <= 0) {
      window.alert("Expense amount must be greater than zero.");
      return;
    }

    onAddExpense({ ...expenseDraft, amount: num(expenseDraft.amount) });
    setExpenseDraft(EMPTY_EXPENSE);
    setShowExpenseForm(false);
  }

  function startEditExpense(expense) {
    setEditingExpenseId(expense.id);
    setEditingExpenseDraft({ ...expense });
  }

  function saveEditingExpense(expenseId) {
    if (!editingExpenseDraft) return;
    onUpdateExpense(expenseId, { ...editingExpenseDraft, amount: num(editingExpenseDraft.amount) });
    setEditingExpenseId("");
    setEditingExpenseDraft(null);
  }

  function cancelEditingExpense() {
    setEditingExpenseId("");
    setEditingExpenseDraft(null);
  }

  function saveSupplier() {
    if (!supplierDraft.name.trim()) {
      window.alert("Supplier name is required.");
      return;
    }

    onAddSupplier(supplierDraft);
    setSupplierDraft(EMPTY_SUPPLIER);
    setShowSupplierForm(false);
  }

  function startEditSupplier(supplier) {
    setEditingSupplierId(supplier.id);
    setEditingSupplierDraft({ ...supplier });
  }

  function saveEditingSupplier(supplierId) {
    if (!editingSupplierDraft?.name?.trim()) {
      window.alert("Supplier name is required.");
      return;
    }

    onUpdateSupplier(supplierId, editingSupplierDraft);
    setEditingSupplierId("");
    setEditingSupplierDraft(null);
  }

  function exportExpensesCsv() {
    const headers = ["Expense #", "Date", "Name", "Vendor", "Category", "Subcategory", "Amount", "Method", "Status", "Recurring", "Job", "Notes"];
    const rows = expenses.map((expense) => [
      expense.expenseNumber,
      expense.date,
      expense.name,
      expense.vendor,
      expense.category,
      expense.subcategory,
      expense.amount,
      expense.paymentMethod,
      expense.status,
      expense.recurring ? "Yes" : "No",
      expense.relatedJobNumber,
      expense.notes,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `overkill-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function renderExpenseForm(draft, updateFn) {
    return (
      <>
        <div className="form-grid">
          <Field label="Expense Name" value={draft.name} onChange={(value) => updateFn("name", value)} />
          <Field label="Vendor / Supplier" value={draft.vendor} onChange={(value) => updateFn("vendor", value)} />
          <SelectField label="Category" value={draft.category} onChange={(value) => updateFn("category", value)} options={EXPENSE_CATEGORIES} />
          <Field label="Subcategory" value={draft.subcategory || ""} onChange={(value) => updateFn("subcategory", value)} />
          <Field label="Amount" type="number" value={draft.amount} onChange={(value) => updateFn("amount", value)} />
          <Field label="Date" type="date" value={draft.date} onChange={(value) => updateFn("date", value)} />
          <SelectField label="Payment Method" value={draft.paymentMethod} onChange={(value) => updateFn("paymentMethod", value)} options={PAYMENT_METHODS} />
          <SelectField label="Status" value={draft.status} onChange={(value) => updateFn("status", value)} options={EXPENSE_STATUSES} />

          <label className="field">
            <span>Supplier Link</span>
            <select value={draft.supplierId || ""} onChange={(event) => updateFn("supplierId", event.target.value)}>
              <option value="">No Supplier Link</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Related Job</span>
            <select value={draft.relatedJobNumber || ""} onChange={(event) => updateFn("relatedJobNumber", event.target.value)}>
              <option value="">No Job</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.jobNumber}>{job.jobNumber} — {job.customerName}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Related Inventory Item</span>
            <select value={draft.relatedInventoryItemId || ""} onChange={(event) => updateFn("relatedInventoryItemId", event.target.value)}>
              <option value="">No Inventory Link</option>
              {inventoryItems.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <label className="field checkbox-field">
            <input type="checkbox" checked={Boolean(draft.recurring)} onChange={(event) => updateFn("recurring", event.target.checked)} />
            <span>Recurring Expense</span>
          </label>
        </div>

        {draft.recurring && (
          <label className="field single-row-gap">
            <span>Recurring Interval</span>
            <select value={draft.recurringInterval || "Monthly"} onChange={(event) => updateFn("recurringInterval", event.target.value)}>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Yearly">Yearly</option>
            </select>
          </label>
        )}

        <label className="field single-row-gap">
          <span>Notes</span>
          <textarea value={draft.notes || ""} onChange={(event) => updateFn("notes", event.target.value)} placeholder="Receipt notes, purchase purpose, machine maintenance details, project link, etc." />
        </label>
      </>
    );
  }

  function renderSupplierForm(draft, updateFn) {
    return (
      <>
        <div className="form-grid">
          <Field label="Supplier Name" value={draft.name} onChange={(value) => updateFn("name", value)} />
          <SelectField label="Category" value={draft.category} onChange={(value) => updateFn("category", value)} options={SUPPLIER_CATEGORIES} />
          <Field label="Contact Name" value={draft.contactName || ""} onChange={(value) => updateFn("contactName", value)} />
          <Field label="Phone" value={draft.phone || ""} onChange={(value) => updateFn("phone", value)} />
          <Field label="Email" type="email" value={draft.email || ""} onChange={(value) => updateFn("email", value)} />
          <Field label="Website" value={draft.website || ""} onChange={(value) => updateFn("website", value)} />
          <label className="field checkbox-field">
            <input type="checkbox" checked={Boolean(draft.preferred)} onChange={(event) => updateFn("preferred", event.target.checked)} />
            <span>Preferred Supplier</span>
          </label>
        </div>

        <label className="field single-row-gap">
          <span>Supplier Notes</span>
          <textarea value={draft.notes || ""} onChange={(event) => updateFn("notes", event.target.value)} placeholder="Best materials to buy here, pricing notes, shipping speed, quality notes, etc." />
        </label>
      </>
    );
  }

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Expenses / Business Intelligence</h2>
          <p className="muted-text">
            Track expenses, suppliers, material purchases, machine maintenance, overhead, and true business profitability.
          </p>
        </div>

        <div className="record-button-row">
          <button className="secondary-button" type="button" onClick={exportExpensesCsv}>
            <FileDown size={18} /> Export CSV
          </button>
          <button className="secondary-button" type="button" onClick={() => setShowSupplierForm(!showSupplierForm)}>
            <Building2 size={18} /> {showSupplierForm ? "Hide Supplier" : "New Supplier"}
          </button>
          <button className="primary-button customer-new-button" type="button" onClick={() => setShowExpenseForm(!showExpenseForm)}>
            <Plus size={18} /> {showExpenseForm ? "Hide Expense" : "New Expense"}
          </button>
        </div>
      </div>

      <div className="dashboard-stat-grid financial-stat-grid">
        <StatCard label="Filtered Expenses" value={money(totalFiltered)} icon={DollarSign} />
        <StatCard label="This Month" value={money(thisMonthExpenseTotal)} icon={CalendarClock} />
        <StatCard label="Last Month" value={money(lastMonthExpenseTotal)} icon={CalendarClock} />
        <StatCard label="This Year Expenses" value={money(thisYearExpenseTotal)} icon={BarChart3} />
        <StatCard label="Collected Revenue" value={money(revenueCollected)} icon={CreditCard} />
        <StatCard label="Booked Job Value" value={money(bookedRevenue)} icon={CheckCircle} />
        <StatCard label="Est. Net After Expenses" value={money(estimatedNet)} icon={DollarSign} />
        <StatCard label="Recurring / Month" value={money(recurringExpenseTotal)} icon={CalendarClock} />
        <StatCard label="Inventory Purchases" value={money(inventoryPurchaseTotal)} icon={PackageSearch} />
        <StatCard label="Maintenance" value={money(maintenanceTotal)} icon={AlertTriangle} />
        <StatCard label="Suppliers" value={suppliers.length} icon={Building2} />
        <StatCard label="Preferred Vendors" value={suppliers.filter((supplier) => supplier.preferred).length} icon={CheckCircle} />
      </div>

      {showExpenseForm && (
        <div className="form-card customer-create-card">
          <div className="page-heading-row">
            <div>
              <h3 className="card-title">Create Expense</h3>
              <p className="muted-text">Log purchases, maintenance, overhead, rework, tools, software, and project costs.</p>
            </div>
            <div className="record-button-row customer-edit-actions">
              <button className="secondary-button" type="button" onClick={() => { setExpenseDraft(EMPTY_EXPENSE); setShowExpenseForm(false); }}>
                <XCircle size={18} /> Cancel
              </button>
              <button className="primary-button" type="button" onClick={saveExpense}>
                <Save size={18} /> Save Expense
              </button>
            </div>
          </div>
          {renderExpenseForm(expenseDraft, updateExpenseDraft)}
        </div>
      )}

      {showSupplierForm && (
        <div className="form-card customer-create-card">
          <div className="page-heading-row">
            <div>
              <h3 className="card-title">Create Supplier</h3>
              <p className="muted-text">Track preferred vendors, material sources, pricing notes, and contact info.</p>
            </div>
            <div className="record-button-row customer-edit-actions">
              <button className="secondary-button" type="button" onClick={() => { setSupplierDraft(EMPTY_SUPPLIER); setShowSupplierForm(false); }}>
                <XCircle size={18} /> Cancel
              </button>
              <button className="primary-button" type="button" onClick={saveSupplier}>
                <Save size={18} /> Save Supplier
              </button>
            </div>
          </div>
          {renderSupplierForm(supplierDraft, updateSupplierDraft)}
        </div>
      )}

      <div className="filter-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input type="search" value={searchTerm} placeholder="Search expenses by vendor, category, notes, job number, or payment method..." onChange={(event) => setSearchTerm(event.target.value)} />
        </label>
        <label className="filter-select-field"><span>Category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="All">All Categories</option>{EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        <label className="filter-select-field"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="All">All Statuses</option>{EXPENSE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        <label className="filter-select-field"><span>Date</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>{DATE_FILTERS.map((filter) => <option key={filter} value={filter}>{filter}</option>)}</select></label>
        <div className="filter-count-pill">Showing {filteredExpenses.length} of {expenses.length}</div>
      </div>

      <div className="dashboard-sections financial-sections">
        <div className="form-card">
          <h3 className="card-title">Expense Categories</h3>
          {categoryTotals.length === 0 ? <p className="muted-text">No category data yet.</p> : <div className="dashboard-list">{categoryTotals.slice(0, 10).map((item) => <div className="dashboard-list-row" key={item.category}><div><strong>{item.category}</strong><span>{item.count} expense{item.count === 1 ? "" : "s"}</span></div><strong>{money(item.total)}</strong></div>)}</div>}
        </div>

        <div className="form-card">
          <h3 className="card-title">Top Vendors</h3>
          {vendorTotals.length === 0 ? <p className="muted-text">No vendor spending yet.</p> : <div className="dashboard-list">{vendorTotals.slice(0, 10).map((item) => <div className="dashboard-list-row" key={item.vendor}><div><strong>{item.vendor}</strong><span>{item.count} transaction{item.count === 1 ? "" : "s"}</span></div><strong>{money(item.total)}</strong></div>)}</div>}
        </div>

        <div className="form-card">
          <h3 className="card-title">Suppliers / Vendors</h3>
          {suppliers.length === 0 ? <p className="muted-text">No suppliers saved yet.</p> : <div className="dashboard-list">{suppliers.map((supplier) => {
            const isEditing = editingSupplierId === supplier.id;
            return <div className="dashboard-list-row supplier-row" key={supplier.id}>{isEditing ? <div className="dashboard-full-span">{renderSupplierForm(editingSupplierDraft || supplier, updateEditingSupplierDraft)}<div className="record-button-row single-row-gap"><button className="secondary-button" type="button" onClick={() => { setEditingSupplierId(""); setEditingSupplierDraft(null); }}><XCircle size={18}/>Cancel</button><button className="primary-button" type="button" onClick={() => saveEditingSupplier(supplier.id)}><Save size={18}/>Save</button></div></div> : <><div><strong>{supplier.name}</strong><span>{supplier.category || "General"}{supplier.preferred ? " • Preferred" : ""}</span><small>{supplier.website || supplier.email || supplier.phone || "No contact info"}</small></div><div className="dashboard-status-stack"><button className="secondary-button" type="button" onClick={() => startEditSupplier(supplier)}><Edit size={14}/>Edit</button><button className="secondary-button danger-button" type="button" onClick={() => onDeleteSupplier(supplier.id)}><Trash2 size={14}/>Delete</button></div></>}</div>
          })}</div>}
        </div>

        <div className="form-card">
          <h3 className="card-title">Recent Inventory Movement</h3>
          {recentInventoryPurchases.length === 0 ? <p className="muted-text">No recent inventory additions.</p> : <div className="dashboard-list">{recentInventoryPurchases.map((log) => <div className="dashboard-list-row" key={log.id}><div><strong>{log.itemName}</strong><span>{log.type} • {log.quantityChange > 0 ? "+" : ""}{log.quantityChange} {log.unit}</span>{log.notes && <small>{log.notes}</small>}</div><span className="status-pill">{log.jobNumber || "Inventory"}</span></div>)}</div>}
        </div>
      </div>

      <div className="form-card single-row-gap">
        <h3 className="card-title">Expense Ledger</h3>
        {filteredExpenses.length === 0 ? <p className="muted-text">No expenses match the current filters.</p> : <div className="dashboard-list">{filteredExpenses.map((expense) => {
          const isEditing = editingExpenseId === expense.id;
          return <div className="dashboard-list-row expense-row" key={expense.id}>{isEditing ? <div className="dashboard-full-span">{renderExpenseForm(editingExpenseDraft || expense, updateEditingExpenseDraft)}<div className="record-button-row single-row-gap"><button className="secondary-button" type="button" onClick={cancelEditingExpense}><XCircle size={18}/>Cancel</button><button className="primary-button" type="button" onClick={() => saveEditingExpense(expense.id)}><Save size={18}/>Save Expense</button></div></div> : <><div><strong>{expense.expenseNumber || "EXP"} — {expense.name || expense.vendor || "Expense"}</strong><span>{expense.category || "Expense"} • {expense.vendor || "No vendor"} • {formatDate(expense.date)}</span><small>{expense.relatedJobNumber ? `Job: ${expense.relatedJobNumber} • ` : ""}{expense.recurring ? `${expense.recurringInterval || "Monthly"} recurring • ` : ""}{expense.notes || "No notes"}</small></div><div className="dashboard-status-stack"><span className="status-pill">{expense.status || "Logged"}</span><strong>{money(expense.amount)}</strong><button className="secondary-button" type="button" onClick={() => startEditExpense(expense)}><Edit size={14}/>Edit</button><button className="secondary-button danger-button" type="button" onClick={() => onDeleteExpense(expense.id)}><Trash2 size={14}/>Delete</button></div></>}</div>
        })}</div>}
      </div>
    </section>
  );
}
