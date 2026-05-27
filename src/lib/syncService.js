import { requireSupabase } from "./supabaseClient";

export const CLOUD_TABLES = {
  quotes: "quotes",
  jobs: "jobs",
  inventoryItems: "inventory_items",
  inventoryLogs: "inventory_logs",
  customers: "customers",
  expenses: "expenses",
  scheduleItems: "schedule_items",
  automationRules: "automation_rules",
  templates: "templates",
  settings: "app_settings",
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeRecord(record) {
  return {
    id: record.id || crypto.randomUUID(),
    payload: record,
    updated_at: record.updatedAt || record.updated_at || nowIso(),
  };
}

export async function pushCollectionToCloud(tableName, records = []) {
  const supabase = requireSupabase();
  const rows = records.map(normalizeRecord);

  if (rows.length === 0) {
    return { tableName, pushed: 0, message: "No records to push." };
  }

  const { error } = await supabase.from(tableName).upsert(rows, {
    onConflict: "id",
  });

  if (error) throw error;

  return {
    tableName,
    pushed: rows.length,
    message: `Pushed ${rows.length} records to ${tableName}.`,
  };
}

export async function pullCollectionFromCloud(tableName) {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from(tableName)
    .select("id,payload,updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    ...(row.payload || {}),
    id: row.payload?.id || row.id,
    cloudUpdatedAt: row.updated_at,
  }));
}

export async function pushSettingsToCloud(settings = {}) {
  const supabase = requireSupabase();

  const { error } = await supabase.from(CLOUD_TABLES.settings).upsert(
    {
      id: "main",
      payload: settings,
      updated_at: nowIso(),
    },
    { onConflict: "id" }
  );

  if (error) throw error;

  return {
    tableName: CLOUD_TABLES.settings,
    pushed: 1,
    message: "Settings pushed to cloud.",
  };
}

export async function pullSettingsFromCloud() {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from(CLOUD_TABLES.settings)
    .select("payload,updated_at")
    .eq("id", "main")
    .maybeSingle();

  if (error) throw error;

  return data?.payload || null;
}

export async function pushAllLocalDataToCloud({
  quotes = [],
  jobs = [],
  inventoryItems = [],
  inventoryLogs = [],
  manualCustomers = [],
  expenses = [],
  scheduleItems = [],
  automationRules = [],
  templates = [],
  settings = null,
}) {
  const results = [];

  results.push(await pushCollectionToCloud(CLOUD_TABLES.quotes, quotes));
  results.push(await pushCollectionToCloud(CLOUD_TABLES.jobs, jobs));
  results.push(await pushCollectionToCloud(CLOUD_TABLES.inventoryItems, inventoryItems));
  results.push(await pushCollectionToCloud(CLOUD_TABLES.inventoryLogs, inventoryLogs));
  results.push(await pushCollectionToCloud(CLOUD_TABLES.customers, manualCustomers));
  results.push(await pushCollectionToCloud(CLOUD_TABLES.expenses, expenses));
  results.push(await pushCollectionToCloud(CLOUD_TABLES.scheduleItems, scheduleItems));
  results.push(await pushCollectionToCloud(CLOUD_TABLES.automationRules, automationRules));
  results.push(await pushCollectionToCloud(CLOUD_TABLES.templates, templates));

  if (settings) results.push(await pushSettingsToCloud(settings));

  return results;
}

export async function pullAllCloudData() {
  const [
    quotes,
    jobs,
    inventoryItems,
    inventoryLogs,
    manualCustomers,
    expenses,
    scheduleItems,
    automationRules,
    templates,
    settings,
  ] = await Promise.all([
    pullCollectionFromCloud(CLOUD_TABLES.quotes),
    pullCollectionFromCloud(CLOUD_TABLES.jobs),
    pullCollectionFromCloud(CLOUD_TABLES.inventoryItems),
    pullCollectionFromCloud(CLOUD_TABLES.inventoryLogs),
    pullCollectionFromCloud(CLOUD_TABLES.customers),
    pullCollectionFromCloud(CLOUD_TABLES.expenses),
    pullCollectionFromCloud(CLOUD_TABLES.scheduleItems),
    pullCollectionFromCloud(CLOUD_TABLES.automationRules),
    pullCollectionFromCloud(CLOUD_TABLES.templates),
    pullSettingsFromCloud(),
  ]);

  return {
    quotes,
    jobs,
    inventoryItems,
    inventoryLogs,
    manualCustomers,
    expenses,
    scheduleItems,
    automationRules,
    templates,
    settings,
  };
}
