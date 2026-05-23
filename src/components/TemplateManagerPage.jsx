import { useMemo, useState } from "react";
import {
  ClipboardList,
  Copy,
  Edit,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  XCircle,
} from "lucide-react";

const STORAGE_KEY = "overkill_quote_templates_v2";

const EMPTY_TEMPLATE = {
  name: "",
  category: "3D Printing",
  tags: "",
  notes: "",
  favorite: false,
  formData: {
    jobName: "",
    jobAspects: {
      cad: false,
      printing: true,
      engraving: false,
      vinyl: false,
      custom: false,
    },
    notes: "",
  },
  quoteData: {},
};

const TEMPLATE_CATEGORIES = [
  "3D Printing",
  "CAD + Print",
  "Engraving",
  "Vinyl",
  "Custom Fabrication",
  "Maintenance / Repeat Job",
  "Other",
];

function loadTemplates() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function splitTags(tags) {
  return String(tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function makeTemplateFromQuote(quote) {
  const formData = quote.formData || {};
  return {
    id: crypto.randomUUID(),
    name: quote.jobName || formData.jobName || quote.quoteNumber || "Saved Quote Template",
    category: quote.jobAspects?.printing || formData.jobAspects?.printing ? "3D Printing" : "Other",
    tags: "from quote, reusable",
    notes: `Created from ${quote.quoteNumber || "saved quote"}. Customer-specific info was intentionally left out when reusing this template.`,
    favorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceQuoteNumber: quote.quoteNumber || "",
    formData: {
      ...formData,
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      customerAddress: "",
    },
    quoteData: {
      jobAspects: quote.jobAspects || formData.jobAspects || EMPTY_TEMPLATE.formData.jobAspects,
      finalTotal: quote.finalTotal || 0,
      depositAmount: quote.depositAmount || 0,
      totals: quote.totals || {},
    },
  };
}

function matchesTemplate(template, searchTerm, categoryFilter, favoriteOnly) {
  const search = searchTerm.trim().toLowerCase();
  const fields = [
    template.name,
    template.category,
    template.tags,
    template.notes,
    template.sourceQuoteNumber,
    template.formData?.jobName,
    template.formData?.notes,
  ];

  const matchesSearch =
    !search || fields.filter(Boolean).some((value) => String(value).toLowerCase().includes(search));

  const matchesCategory = categoryFilter === "All" || template.category === categoryFilter;
  const matchesFavorite = !favoriteOnly || template.favorite;

  return matchesSearch && matchesCategory && matchesFavorite;
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export default function TemplateManagerPage({ quotes = [], jobs = [], onUseTemplate }) {
  const [templates, setTemplates] = useState(loadTemplates);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState(EMPTY_TEMPLATE);
  const [editingId, setEditingId] = useState("");
  const [editingDraft, setEditingDraft] = useState(null);

  const filteredTemplates = useMemo(() => {
    return templates
      .filter((template) => matchesTemplate(template, searchTerm, categoryFilter, favoriteOnly))
      .sort((a, b) => {
        if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
        return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
      });
  }, [templates, searchTerm, categoryFilter, favoriteOnly]);

  const quoteTemplateCandidates = useMemo(() => {
    return quotes
      .filter((quote) => quote.finalTotal || quote.formData)
      .slice(0, 12);
  }, [quotes]);

  function persist(nextTemplates) {
    setTemplates(nextTemplates);
    saveTemplates(nextTemplates);
  }

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateNestedDraft(path, value) {
    setDraft((current) => ({
      ...current,
      formData: {
        ...(current.formData || {}),
        [path]: value,
      },
    }));
  }

  function saveNewTemplate() {
    if (!draft.name.trim()) {
      window.alert("Template name is required.");
      return;
    }

    const now = new Date().toISOString();
    const template = {
      ...draft,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    persist([template, ...templates]);
    setDraft(EMPTY_TEMPLATE);
    setShowCreate(false);
  }

  function saveTemplateEdit(templateId) {
    if (!editingDraft?.name?.trim()) {
      window.alert("Template name is required.");
      return;
    }

    persist(
      templates.map((template) =>
        template.id === templateId
          ? { ...template, ...editingDraft, updatedAt: new Date().toISOString() }
          : template
      )
    );
    setEditingId("");
    setEditingDraft(null);
  }

  function duplicateTemplate(template) {
    const copy = {
      ...template,
      id: crypto.randomUUID(),
      name: `${template.name} Copy`,
      favorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    persist([copy, ...templates]);
  }

  function deleteTemplate(templateId) {
    const template = templates.find((item) => item.id === templateId);
    const confirmed = window.confirm(`Delete template "${template?.name || "this template"}"?`);
    if (!confirmed) return;
    persist(templates.filter((item) => item.id !== templateId));
  }

  function toggleFavorite(templateId) {
    persist(
      templates.map((template) =>
        template.id === templateId
          ? { ...template, favorite: !template.favorite, updatedAt: new Date().toISOString() }
          : template
      )
    );
  }

  function importQuoteAsTemplate(quote) {
    const template = makeTemplateFromQuote(quote);
    persist([template, ...templates]);
  }

  function renderTemplateForm(currentDraft, updateFn, updateNestedFn) {
    return (
      <>
        <div className="form-grid">
          <Field label="Template Name" value={currentDraft.name} onChange={(value) => updateFn("name", value)} />

          <label className="field">
            <span>Category</span>
            <select value={currentDraft.category} onChange={(event) => updateFn("category", event.target.value)}>
              {TEMPLATE_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>

          <Field label="Tags" value={currentDraft.tags} onChange={(value) => updateFn("tags", value)} />

          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={Boolean(currentDraft.favorite)}
              onChange={(event) => updateFn("favorite", event.target.checked)}
            />
            <span>Favorite Template</span>
          </label>
        </div>

        <label className="field single-row-gap">
          <span>Template Notes</span>
          <textarea value={currentDraft.notes} onChange={(event) => updateFn("notes", event.target.value)} />
        </label>

        <label className="field single-row-gap">
          <span>Default Job Notes</span>
          <textarea
            value={currentDraft.formData?.notes || ""}
            onChange={(event) => updateNestedFn("notes", event.target.value)}
            placeholder="Reusable production details, customer questions to ask, material reminders, etc."
          />
        </label>
      </>
    );
  }

  return (
    <section className="page-panel">
      <div className="page-heading-row">
        <div>
          <h2 className="section-title brand-font">Templates</h2>
          <p className="muted-text">
            Reusable quote/job starting points for repeat work, common products, and standard pricing structures.
          </p>
        </div>

        <button className="primary-button" type="button" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={18} />
          {showCreate ? "Hide Template Form" : "New Template"}
        </button>
      </div>

      <div className="job-queue-summary">
        <div><span>Templates</span><strong>{templates.length}</strong></div>
        <div><span>Favorites</span><strong>{templates.filter((template) => template.favorite).length}</strong></div>
        <div><span>Categories</span><strong>{new Set(templates.map((template) => template.category)).size}</strong></div>
        <div><span>Source Quotes</span><strong>{templates.filter((template) => template.sourceQuoteNumber).length}</strong></div>
        <div><span>Saved Quotes</span><strong>{quotes.length}</strong></div>
        <div><span>Jobs Available</span><strong>{jobs.length}</strong></div>
      </div>

      {showCreate && (
        <div className="form-card customer-create-card">
          <div className="page-heading-row">
            <div>
              <h3 className="card-title">Create Template</h3>
              <p className="muted-text">Templates intentionally avoid storing customer-specific information.</p>
            </div>
            <div className="record-button-row">
              <button className="secondary-button" type="button" onClick={() => { setShowCreate(false); setDraft(EMPTY_TEMPLATE); }}>
                <XCircle size={18} /> Cancel
              </button>
              <button className="primary-button" type="button" onClick={saveNewTemplate}>
                <Save size={18} /> Save Template
              </button>
            </div>
          </div>
          {renderTemplateForm(draft, updateDraft, updateNestedDraft)}
        </div>
      )}

      <div className="form-card">
        <div className="page-heading-row">
          <div>
            <h3 className="card-title">Create from Existing Quote</h3>
            <p className="muted-text">Pull reusable pricing and job details from a prior quote without carrying customer info forward.</p>
          </div>
        </div>
        {quoteTemplateCandidates.length === 0 ? (
          <p className="muted-text">No saved quote candidates yet.</p>
        ) : (
          <div className="dashboard-list">
            {quoteTemplateCandidates.map((quote) => (
              <div className="dashboard-list-row" key={quote.id}>
                <div>
                  <strong>{quote.quoteNumber} — {quote.jobName || "Untitled Quote"}</strong>
                  <span>{quote.customerName || "No customer"} • {money(quote.finalTotal)}</span>
                </div>
                <button className="secondary-button" type="button" onClick={() => importQuoteAsTemplate(quote)}>
                  <ClipboardList size={16} /> Save as Template
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="filter-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            type="search"
            value={searchTerm}
            placeholder="Search templates by name, category, tags, notes, or source quote..."
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
        <label className="filter-select-field">
          <span>Category</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="All">All Categories</option>
            {TEMPLATE_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        <button
          className={`secondary-button ${favoriteOnly ? "active-filter-button" : ""}`}
          type="button"
          onClick={() => setFavoriteOnly(!favoriteOnly)}
        >
          <Star size={18} /> Favorites
        </button>
        <div className="filter-count-pill">Showing {filteredTemplates.length} of {templates.length}</div>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="empty-state">
          <h3>No matching templates.</h3>
          <p>Create a new template or save one from an existing quote.</p>
        </div>
      ) : (
        <div className="template-grid">
          {filteredTemplates.map((template) => {
            const isEditing = editingId === template.id;
            const tags = splitTags(template.tags);
            return (
              <article className="template-card" key={template.id}>
                {isEditing ? (
                  <>
                    <div className="page-heading-row">
                      <h3 className="card-title">Edit Template</h3>
                      <div className="record-button-row">
                        <button className="secondary-button" type="button" onClick={() => { setEditingId(""); setEditingDraft(null); }}>
                          <XCircle size={18} /> Cancel
                        </button>
                        <button className="primary-button" type="button" onClick={() => saveTemplateEdit(template.id)}>
                          <Save size={18} /> Save
                        </button>
                      </div>
                    </div>
                    {renderTemplateForm(
                      editingDraft || template,
                      (key, value) => setEditingDraft((current) => ({ ...(current || template), [key]: value })),
                      (key, value) => setEditingDraft((current) => ({
                        ...(current || template),
                        formData: { ...((current || template).formData || {}), [key]: value },
                      }))
                    )}
                  </>
                ) : (
                  <>
                    <div className="template-card-top">
                      <div>
                        <h3>{template.favorite && <Star size={16} />} {template.name}</h3>
                        <p>{template.category} {template.sourceQuoteNumber ? `• From ${template.sourceQuoteNumber}` : ""}</p>
                      </div>
                      <span className="status-pill">{template.favorite ? "Favorite" : "Template"}</span>
                    </div>

                    {tags.length > 0 && <div className="record-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
                    {template.notes && <p className="helper-note">{template.notes}</p>}

                    <div className="record-button-row quote-button-row">
                      <button className="primary-button" type="button" onClick={() => onUseTemplate?.(template)}>
                        <ClipboardList size={18} /> Use Template
                      </button>
                      <button className="secondary-button" type="button" onClick={() => toggleFavorite(template.id)}>
                        <Star size={18} /> {template.favorite ? "Unfavorite" : "Favorite"}
                      </button>
                      <button className="secondary-button" type="button" onClick={() => { setEditingId(template.id); setEditingDraft({ ...template }); }}>
                        <Edit size={18} /> Edit
                      </button>
                      <button className="secondary-button" type="button" onClick={() => duplicateTemplate(template)}>
                        <Copy size={18} /> Duplicate
                      </button>
                      <button className="secondary-button danger-button" type="button" onClick={() => deleteTemplate(template.id)}>
                        <Trash2 size={18} /> Delete
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
