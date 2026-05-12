import { useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";

const EMPTY_FORM = {
  customerName: "",
  projectName: "",
  carrier: "USPS",
  service: "Ground Advantage",
  packagePreset: "Custom",
  length: 8,
  width: 6,
  height: 4,
  weightLb: 1,
  weightOz: 0,
  packageCost: 1.5,
  packingMaterialCost: 1,
  handlingFee: 5,
  quotedShipping: 0,
  insurance: 0,
  signatureConfirmation: 0,
  notes: "",
};

const PACKAGE_PRESETS = [
  { label: "Custom", length: 8, width: 6, height: 4 },
  { label: "Small Box", length: 8, width: 6, height: 4 },
  { label: "Medium Box", length: 12, width: 9, height: 6 },
  { label: "Large Box", length: 16, width: 12, height: 8 },
  { label: "Flat Mailer", length: 12, width: 9, height: 1 },
  { label: "Card Mailer", length: 7, width: 5, height: 1 },
];

const CARRIERS = {
  USPS: ["Ground Advantage", "Priority Mail", "Priority Mail Express"],
  UPS: ["Ground", "3 Day Select", "2nd Day Air", "Next Day Air"],
  FedEx: ["Ground", "Express Saver", "2Day", "Priority Overnight"],
  Manual: ["Manual Quote"],
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

function calculateShippingTotal(form) {
  return (
    num(form.quotedShipping) +
    num(form.packageCost) +
    num(form.packingMaterialCost) +
    num(form.handlingFee) +
    num(form.insurance) +
    num(form.signatureConfirmation)
  );
}

function getDimensionalWeight(form) {
  const cubic = num(form.length) * num(form.width) * num(form.height);
  return cubic > 0 ? Math.ceil(cubic / 139) : 0;
}

function getActualWeight(form) {
  return num(form.weightLb) + num(form.weightOz) / 16;
}

function Field({
  label,
  value,
  onChange,
  type = "number",
  step = "0.01",
  placeholder = "",
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        step={type === "number" ? step : undefined}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function matchesEstimateSearch(estimate, searchTerm) {
  const search = searchTerm.trim().toLowerCase();

  if (!search) return true;

  return [
    estimate.estimateNumber,
    estimate.customerName,
    estimate.projectName,
    estimate.carrier,
    estimate.service,
    estimate.packagePreset,
    estimate.status,
    estimate.notes,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(search));
}

export default function ShippingPage({
  quotes,
  jobs,
  shippingEstimates,
  onAddEstimate,
  onUpdateEstimate,
  onDeleteEstimate,
  onAttachToQuote,
  onAttachToJob,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [attachType, setAttachType] = useState("quote");
  const [selectedRecordId, setSelectedRecordId] = useState("");

  const filteredEstimates = useMemo(() => {
    return shippingEstimates.filter((estimate) =>
      matchesEstimateSearch(estimate, searchTerm)
    );
  }, [shippingEstimates, searchTerm]);

  const attachableRecords = attachType === "quote" ? quotes : jobs;

  const actualWeight = getActualWeight(form);
  const dimensionalWeight = getDimensionalWeight(form);
  const billableWeight = Math.max(actualWeight, dimensionalWeight);
  const total = calculateShippingTotal(form);

  function update(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updatePreset(value) {
    const preset = PACKAGE_PRESETS.find((item) => item.label === value);

    if (!preset) {
      update("packagePreset", value);
      return;
    }

    setForm((current) => ({
      ...current,
      packagePreset: preset.label,
      length: preset.length,
      width: preset.width,
      height: preset.height,
    }));
  }

  function updateCarrier(value) {
    const services = CARRIERS[value] || ["Manual Quote"];

    setForm((current) => ({
      ...current,
      carrier: value,
      service: services[0],
    }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId("");
  }

  function saveEstimate() {
    const estimateData = {
      ...form,
      total,
      actualWeight,
      dimensionalWeight,
      billableWeight,
    };

    if (editingId) {
      onUpdateEstimate(editingId, estimateData);
    } else {
      onAddEstimate(estimateData);
    }

    resetForm();
  }

  function editEstimate(estimate) {
    setEditingId(estimate.id);
    setForm({
      customerName: estimate.customerName || "",
      projectName: estimate.projectName || "",
      carrier: estimate.carrier || "USPS",
      service: estimate.service || "Ground Advantage",
      packagePreset: estimate.packagePreset || "Custom",
      length: estimate.length || 8,
      width: estimate.width || 6,
      height: estimate.height || 4,
      weightLb: estimate.weightLb || 1,
      weightOz: estimate.weightOz || 0,
      packageCost: estimate.packageCost || 0,
      packingMaterialCost: estimate.packingMaterialCost || 0,
      handlingFee: estimate.handlingFee || 0,
      quotedShipping: estimate.quotedShipping || 0,
      insurance: estimate.insurance || 0,
      signatureConfirmation: estimate.signatureConfirmation || 0,
      notes: estimate.notes || "",
    });
  }

  function attachEstimate(estimateId) {
    if (!selectedRecordId) {
      window.alert("Pick a quote or job to attach this shipping estimate to.");
      return;
    }

    if (attachType === "quote") {
      onAttachToQuote(estimateId, selectedRecordId);
    } else {
      onAttachToJob(estimateId, selectedRecordId);
    }
  }

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Shipping</h2>
          <p className="muted-text">
            Build package estimates, save shipping records, and attach shipping costs to quotes or jobs.
          </p>
        </div>
      </div>

      <div className="shipping-layout">
        <div className="form-card">
          <div className="page-heading-row">
            <div>
              <h3 className="card-title">
                {editingId ? "Edit Shipping Estimate" : "New Shipping Estimate"}
              </h3>
              <p className="muted-text">
                Enter the carrier quote manually for now. The total includes shipping, packaging, insurance, and handling.
              </p>
            </div>

            {editingId && (
              <button className="secondary-button" onClick={resetForm}>
                <XCircle size={18} />
                Cancel Edit
              </button>
            )}
          </div>

          <div className="form-grid">
            <Field
              label="Customer Name"
              type="text"
              value={form.customerName}
              onChange={(value) => update("customerName", value)}
            />

            <Field
              label="Project / Job Name"
              type="text"
              value={form.projectName}
              onChange={(value) => update("projectName", value)}
            />

            <label className="field">
              <span>Carrier</span>
              <select
                value={form.carrier}
                onChange={(event) => updateCarrier(event.target.value)}
              >
                {Object.keys(CARRIERS).map((carrier) => (
                  <option key={carrier} value={carrier}>
                    {carrier}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Service</span>
              <select
                value={form.service}
                onChange={(event) => update("service", event.target.value)}
              >
                {(CARRIERS[form.carrier] || ["Manual Quote"]).map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Package Preset</span>
              <select
                value={form.packagePreset}
                onChange={(event) => updatePreset(event.target.value)}
              >
                {PACKAGE_PRESETS.map((preset) => (
                  <option key={preset.label} value={preset.label}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <Field label="Length (in)" value={form.length} onChange={(value) => update("length", value)} />
            <Field label="Width (in)" value={form.width} onChange={(value) => update("width", value)} />
            <Field label="Height (in)" value={form.height} onChange={(value) => update("height", value)} />
            <Field label="Weight lb" value={form.weightLb} onChange={(value) => update("weightLb", value)} />
            <Field label="Weight oz" value={form.weightOz} onChange={(value) => update("weightOz", value)} />

            <Field
              label="Carrier Shipping Quote"
              value={form.quotedShipping}
              onChange={(value) => update("quotedShipping", value)}
            />

            <Field
              label="Box / Mailer Cost"
              value={form.packageCost}
              onChange={(value) => update("packageCost", value)}
            />

            <Field
              label="Packing Material Cost"
              value={form.packingMaterialCost}
              onChange={(value) => update("packingMaterialCost", value)}
            />

            <Field
              label="Handling Fee"
              value={form.handlingFee}
              onChange={(value) => update("handlingFee", value)}
            />

            <Field
              label="Insurance"
              value={form.insurance}
              onChange={(value) => update("insurance", value)}
            />

            <Field
              label="Signature Confirmation"
              value={form.signatureConfirmation}
              onChange={(value) => update("signatureConfirmation", value)}
            />
          </div>

          <label className="field single-row-gap">
            <span>Shipping Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="Carrier quote source, fragile packaging notes, customer delivery preference, tracking notes, etc."
            />
          </label>

          <div className="shipping-total-box">
            <div>
              <span>Actual Weight</span>
              <strong>{actualWeight.toFixed(2)} lb</strong>
            </div>

            <div>
              <span>Dimensional Weight</span>
              <strong>{dimensionalWeight} lb</strong>
            </div>

            <div>
              <span>Billable Weight</span>
              <strong>{billableWeight.toFixed(2)} lb</strong>
            </div>

            <div>
              <span>Total Shipping Add-On</span>
              <strong>{money(total)}</strong>
            </div>
          </div>

          <button className="primary-button single-row-gap" onClick={saveEstimate}>
            <Save size={18} />
            {editingId ? "Update Shipping Estimate" : "Save Shipping Estimate"}
          </button>
        </div>

        <div className="form-card">
          <h3 className="card-title">Attach Shipping</h3>

          <div className="form-grid">
            <label className="field">
              <span>Attach To</span>
              <select
                value={attachType}
                onChange={(event) => {
                  setAttachType(event.target.value);
                  setSelectedRecordId("");
                }}
              >
                <option value="quote">Quote</option>
                <option value="job">Job</option>
              </select>
            </label>

            <label className="field">
              <span>{attachType === "quote" ? "Quote" : "Job"}</span>
              <select
                value={selectedRecordId}
                onChange={(event) => setSelectedRecordId(event.target.value)}
              >
                <option value="">Select {attachType}</option>
                {attachableRecords.map((record) => (
                  <option key={record.id} value={record.id}>
                    {attachType === "quote" ? record.quoteNumber : record.jobNumber} —{" "}
                    {record.customerName || "No Customer"} — {record.jobName || "Untitled"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="helper-note">
            Attaching shipping updates the selected quote/job total and stores the shipping estimate inside that record for PDFs.
          </p>
        </div>
      </div>

      <div className="filter-toolbar single-row-gap">
        <label className="search-field">
          <Search size={18} />
          <input
            type="search"
            value={searchTerm}
            placeholder="Search shipping estimates by customer, project, carrier, service, or estimate number..."
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <div className="filter-count-pill">
          Showing {filteredEstimates.length} of {shippingEstimates.length}
        </div>
      </div>

      {filteredEstimates.length === 0 ? (
        <div className="empty-state">
          <h3>No shipping estimates yet.</h3>
          <p>Create one above, then attach it to a quote or job.</p>
        </div>
      ) : (
        <div className="records-grid">
          {filteredEstimates.map((estimate) => (
            <article className="record-card" key={estimate.id}>
              <div className="record-card-top">
                <div>
                  <h3>{estimate.estimateNumber}</h3>
                  <p>{estimate.customerName || "No Customer Name"}</p>
                </div>

                <span className="status-pill">{estimate.status || "Estimate"}</span>
              </div>

              <div className="record-title">
                {estimate.projectName || "Untitled Shipment"}
              </div>

              <div className="record-details">
                <div>
                  <span>Carrier</span>
                  <strong>{estimate.carrier}</strong>
                </div>

                <div>
                  <span>Service</span>
                  <strong>{estimate.service}</strong>
                </div>

                <div>
                  <span>Package</span>
                  <strong>
                    {estimate.length} x {estimate.width} x {estimate.height}
                  </strong>
                </div>

                <div>
                  <span>Total</span>
                  <strong>{money(estimate.total)}</strong>
                </div>
              </div>

              <div className="record-tags">
                <span>{estimate.packagePreset}</span>
                <span>{estimate.billableWeight || 0} lb billable</span>
                {estimate.attachedType && <span>Attached to {estimate.attachedType}</span>}
              </div>

              {estimate.notes && <p className="helper-note">{estimate.notes}</p>}

              <div className="record-button-row shipping-button-row">
                <button
                  className="secondary-button"
                  onClick={() => editEstimate(estimate)}
                >
                  <Pencil size={18} />
                  Edit
                </button>

                <button
                  className="secondary-button"
                  onClick={() => attachEstimate(estimate.id)}
                >
                  <Truck size={18} />
                  Attach
                </button>

                <button
                  className="secondary-button danger-button"
                  onClick={() => onDeleteEstimate(estimate.id)}
                >
                  <Trash2 size={18} />
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}