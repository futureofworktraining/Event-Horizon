/**
 * Database Migration Script
 *
 * Migrates ALL data from source Convex instance to target Convex instance.
 * Handles 17 tables + file storage with proper ID remapping.
 *
 * Usage:
 *   npx tsx scripts/migrate.ts
 *
 * Environment variables:
 *   SOURCE_CONVEX_URL - Source instance URL (default: http://127.0.0.1:3210)
 *   TARGET_CONVEX_URL - Target instance URL (required)
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { FunctionReference } from "convex/server";

// ============================================
// CONFIGURATION
// ============================================

const SOURCE_URL =
  process.env.SOURCE_CONVEX_URL || "http://127.0.0.1:3210";
const TARGET_URL = process.env.TARGET_CONVEX_URL;
const BATCH_SIZE = 20;
const FILE_CONCURRENCY = 5; // parallel file transfers

if (!TARGET_URL) {
  console.error("ERROR: TARGET_CONVEX_URL environment variable is required.");
  console.error("Usage: TARGET_CONVEX_URL=https://your-target.convex.cloud npx tsx scripts/migrate.ts");
  process.exit(1);
}

const source = new ConvexHttpClient(SOURCE_URL);
const target = new ConvexHttpClient(TARGET_URL);

// ============================================
// ID MAPPING STATE
// ============================================

// Maps: oldId (string) → newId (string)
const idMaps: Record<string, Map<string, string>> = {
  _storage: new Map(),
  settings: new Map(),
  prompts: new Map(),
  systemPrompts: new Map(),
  userPrompts: new Map(),
  jsonSchemas: new Map(),
  promptConfigurations: new Map(),
  workflows: new Map(),
  jobs: new Map(),
  processes: new Map(),
  steps: new Map(),
  processFlows: new Map(),
  documents: new Map(),
  agentSessions: new Map(),
  agentEvents: new Map(),
  analysisVersions: new Map(),
  workflowRuns: new Map(),
  apiLogs: new Map(),
};

// Track deferred job→process patches
const deferredJobProcessPatches: Array<{
  oldJobId: string;
  oldProcessId: string;
}> = [];

// Record counts for summary
const recordCounts: Record<string, { exported: number; imported: number }> = {};

// ============================================
// HELPERS
// ============================================

function remapId(
  table: string,
  oldId: string | undefined | null
): string | undefined {
  if (!oldId) return undefined;
  const map = idMaps[table];
  if (!map) {
    console.warn(`  WARNING: No ID map for table "${table}"`);
    return undefined;
  }
  const newId = map.get(oldId);
  if (!newId) {
    console.warn(
      `  WARNING: No mapping found for ${table} ID: ${oldId}`
    );
    return undefined;
  }
  return newId;
}

// Strip system fields that Convex auto-generates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripSystemFields(doc: any): any {
  const { _id, _creationTime, ...data } = doc;
  return data;
}

// Process records in batches
async function processBatches<T>(
  items: T[],
  batchSize: number,
  fn: (batch: T[]) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await fn(batch);
    if (items.length > batchSize) {
      process.stdout.write(
        `\r    Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`
      );
    }
  }
  if (items.length > batchSize) {
    process.stdout.write("\n");
  }
}

// Process items with concurrency limit
async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  const total = items.length;

  async function worker(): Promise<void> {
    while (nextIndex < total) {
      const index = nextIndex++;
      await fn(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () =>
    worker()
  );
  await Promise.all(workers);
}

function log(msg: string): void {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

// ============================================
// PHASE 0: FILE TRANSFER
// ============================================

async function transferFiles(): Promise<void> {
  log("PHASE 0: Transferring files from storage...");

  // Collect all storage IDs from all tables that reference _storage
  const storageIds = new Set<string>();

  // Export tables that have storage references to collect IDs
  const jobs = await source.query(api.migration.exportJobs);
  const steps = await source.query(api.migration.exportSteps);
  const documents = await source.query(api.migration.exportDocuments);

  for (const job of jobs) {
    if (job.videoStorageId) storageIds.add(job.videoStorageId);
  }
  for (const step of steps) {
    if (step.screenshotStorageId) storageIds.add(step.screenshotStorageId);
    if (step.overlayImageStorageId) storageIds.add(step.overlayImageStorageId);
  }
  for (const doc of documents) {
    if (doc.storageId) storageIds.add(doc.storageId);
  }

  const storageIdList = Array.from(storageIds);
  log(`  Found ${storageIdList.length} unique files to transfer`);

  if (storageIdList.length === 0) return;

  let transferred = 0;
  let failed = 0;

  await processWithConcurrency(
    storageIdList,
    FILE_CONCURRENCY,
    async (storageId, index) => {
      try {
        // Get signed URL from source
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const url = await source.query(api.migration.getFileUrl, {
          storageId: storageId as any,
        });

        if (!url) {
          console.warn(`  WARNING: No URL for storage ID ${storageId}`);
          failed++;
          return;
        }

        // Download and store in target via action
        const result = await target.action(
          api.migrationActions.downloadAndStoreFile,
          {
            url,
            oldStorageId: storageId,
          }
        );

        idMaps._storage.set(storageId, result.newStorageId);
        transferred++;

        if ((transferred + failed) % 10 === 0 || transferred + failed === storageIdList.length) {
          process.stdout.write(
            `\r  Files: ${transferred}/${storageIdList.length} transferred, ${failed} failed`
          );
        }
      } catch (err) {
        console.error(
          `\n  ERROR transferring file ${storageId}: ${err instanceof Error ? err.message : err}`
        );
        failed++;
      }
    }
  );

  process.stdout.write("\n");
  log(`  File transfer complete: ${transferred} transferred, ${failed} failed`);
  recordCounts["_storage"] = {
    exported: storageIdList.length,
    imported: transferred,
  };
}

// ============================================
// GENERIC TABLE MIGRATION
// ============================================

async function migrateTable(
  tableName: string,
  exportQuery: FunctionReference<"query">,
  importMutation: FunctionReference<"mutation">,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  remapFn?: (data: any) => any
): Promise<void> {
  log(`  Migrating ${tableName}...`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records: any[] = await source.query(exportQuery as any);
  recordCounts[tableName] = { exported: records.length, imported: 0 };

  if (records.length === 0) {
    log(`    ${tableName}: 0 records (empty)`);
    return;
  }

  await processBatches(records, BATCH_SIZE, async (batch) => {
    const preparedRecords = batch.map((record) => {
      const oldId = record._id as string;
      let data = stripSystemFields(record);

      if (remapFn) {
        data = remapFn(data);
      }

      return { oldId, data };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: Array<{ oldId: string; newId: string }> = await target.mutation(
      importMutation as any,
      { records: preparedRecords }
    );

    for (const result of results) {
      idMaps[tableName].set(result.oldId, result.newId);
    }

    recordCounts[tableName].imported += results.length;
  });

  log(`    ${tableName}: ${recordCounts[tableName].imported} records imported`);
}

// ============================================
// PHASE 1: INDEPENDENT TABLES
// ============================================

async function migrateIndependentTables(): Promise<void> {
  log("PHASE 1: Migrating independent tables...");

  await migrateTable("settings", api.migration.exportSettings, api.migration.importSettings);
  await migrateTable("prompts", api.migration.exportPrompts, api.migration.importPrompts);
  await migrateTable("systemPrompts", api.migration.exportSystemPrompts, api.migration.importSystemPrompts);
  await migrateTable("userPrompts", api.migration.exportUserPrompts, api.migration.importUserPrompts);
  await migrateTable("jsonSchemas", api.migration.exportJsonSchemas, api.migration.importJsonSchemas);
  await migrateTable("workflows", api.migration.exportWorkflows, api.migration.importWorkflows);
}

// ============================================
// PHASE 2: PROMPT CONFIGURATIONS
// ============================================

async function migratePromptConfigurations(): Promise<void> {
  log("PHASE 2: Migrating promptConfigurations...");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrateTable("promptConfigurations", api.migration.exportPromptConfigurations, api.migration.importPromptConfigurations, (data: any) => {
    data.systemPromptId = remapId("systemPrompts", data.systemPromptId);
    data.userPromptId = remapId("userPrompts", data.userPromptId);
    data.jsonSchemaId = remapId("jsonSchemas", data.jsonSchemaId);
    return data;
  });
}

// ============================================
// PHASE 3: JOBS (WITHOUT processId)
// ============================================

async function migrateJobs(): Promise<void> {
  log("PHASE 3: Migrating jobs (deferring processId)...");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrateTable("jobs", api.migration.exportJobs, api.migration.importJobs, (data: any) => {
    // Remap storage ID
    data.videoStorageId = remapId("_storage", data.videoStorageId);

    // Defer processId - store for Phase 6
    if (data.processId) {
      // We need to find the oldJobId for this record, but we don't have it here
      // Instead, we'll collect deferred patches from the raw export
      // Save the old processId and remove it from data
    }
    // We handle deferred patches separately
    delete data.processId;

    return data;
  });
}

async function collectDeferredJobPatches(): Promise<void> {
  // Re-export jobs to collect processId references
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobs: any[] = await source.query(api.migration.exportJobs as any);
  for (const job of jobs) {
    if (job.processId) {
      deferredJobProcessPatches.push({
        oldJobId: job._id as string,
        oldProcessId: job.processId as string,
      });
    }
  }
  log(`  Collected ${deferredJobProcessPatches.length} deferred job→process patches`);
}

// ============================================
// PHASE 4: PROCESSES (respecting hierarchy)
// ============================================

async function migrateProcesses(): Promise<void> {
  log("PHASE 4: Migrating processes...");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allProcesses: any[] = await source.query(api.migration.exportProcesses as any);
  recordCounts["processes"] = { exported: allProcesses.length, imported: 0 };

  if (allProcesses.length === 0) {
    log("    processes: 0 records (empty)");
    return;
  }

  // Phase 4a: Main processes (no parent)
  const mainProcesses = allProcesses.filter((p) => !p.parentProcessId);
  log(`  Phase 4a: ${mainProcesses.length} main processes (no parent)...`);

  await processBatches(mainProcesses, BATCH_SIZE, async (batch) => {
    const preparedRecords = batch.map((record) => {
      const oldId = record._id as string;
      const data = remapProcessData(stripSystemFields(record));
      return { oldId, data };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: Array<{ oldId: string; newId: string }> = await target.mutation(
      api.migration.importProcesses as any,
      { records: preparedRecords }
    );

    for (const result of results) {
      idMaps.processes.set(result.oldId, result.newId);
    }
    recordCounts["processes"].imported += results.length;
  });

  // Phase 4b: Subprocesses sorted by hierarchyLevel ascending
  const subprocesses = allProcesses
    .filter((p) => p.parentProcessId)
    .sort((a, b) => (a.hierarchyLevel || 2) - (b.hierarchyLevel || 2));

  if (subprocesses.length > 0) {
    log(`  Phase 4b: ${subprocesses.length} subprocesses (by hierarchy level)...`);

    await processBatches(subprocesses, BATCH_SIZE, async (batch) => {
      const preparedRecords = batch.map((record) => {
        const oldId = record._id as string;
        const data = remapProcessData(stripSystemFields(record));
        return { oldId, data };
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: Array<{ oldId: string; newId: string }> = await target.mutation(
        api.migration.importProcesses as any,
        { records: preparedRecords }
      );

      for (const result of results) {
        idMaps.processes.set(result.oldId, result.newId);
      }
      recordCounts["processes"].imported += results.length;
    });
  }

  log(`    processes: ${recordCounts["processes"].imported} records imported`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function remapProcessData(data: any): any {
  data.jobId = remapId("jobs", data.jobId);
  data.parentProcessId = remapId("processes", data.parentProcessId);
  data.promptConfigurationId = remapId("promptConfigurations", data.promptConfigurationId);
  data.systemPromptId = remapId("systemPrompts", data.systemPromptId);
  data.userPromptId = remapId("userPrompts", data.userPromptId);
  data.jsonSchemaId = remapId("jsonSchemas", data.jsonSchemaId);
  data.unifiedSystemPromptId = remapId("prompts", data.unifiedSystemPromptId);
  data.unifiedUserPromptId = remapId("prompts", data.unifiedUserPromptId);
  data.unifiedSchemaId = remapId("prompts", data.unifiedSchemaId);
  data.uiElementPromptId = remapId("prompts", data.uiElementPromptId);
  data.sensitiveInfoPromptId = remapId("prompts", data.sensitiveInfoPromptId);
  return data;
}

// ============================================
// PHASE 5: DEPENDENT TABLES
// ============================================

async function migrateDependentTables(): Promise<void> {
  log("PHASE 5: Migrating dependent tables...");

  // Steps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrateTable("steps", api.migration.exportSteps, api.migration.importSteps, (data: any) => {
    data.processId = remapId("processes", data.processId);
    data.screenshotStorageId = remapId("_storage", data.screenshotStorageId);
    data.overlayImageStorageId = remapId("_storage", data.overlayImageStorageId);
    return data;
  });

  // Process Flows
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrateTable("processFlows", api.migration.exportProcessFlows, api.migration.importProcessFlows, (data: any) => {
    data.processId = remapId("processes", data.processId);
    // Remap subprocessId in nodes if it matches a process ID
    if (data.nodes && Array.isArray(data.nodes)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.nodes = data.nodes.map((node: any) => {
        if (node.subprocessId) {
          const remapped = remapId("processes", node.subprocessId);
          if (remapped) {
            node.subprocessId = remapped;
          }
        }
        return node;
      });
    }
    return data;
  });

  // Documents
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrateTable("documents", api.migration.exportDocuments, api.migration.importDocuments, (data: any) => {
    data.processId = remapId("processes", data.processId);
    data.storageId = remapId("_storage", data.storageId);
    return data;
  });

  // Agent Sessions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrateTable("agentSessions", api.migration.exportAgentSessions, api.migration.importAgentSessions, (data: any) => {
    data.jobId = remapId("jobs", data.jobId);
    return data;
  });

  // Agent Events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrateTable("agentEvents", api.migration.exportAgentEvents, api.migration.importAgentEvents, (data: any) => {
    data.jobId = remapId("jobs", data.jobId);
    return data;
  });

  // Analysis Versions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrateTable("analysisVersions", api.migration.exportAnalysisVersions, api.migration.importAnalysisVersions, (data: any) => {
    data.jobId = remapId("jobs", data.jobId);
    return data;
  });

  // Workflow Runs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrateTable("workflowRuns", api.migration.exportWorkflowRuns, api.migration.importWorkflowRuns, (data: any) => {
    data.workflowId = remapId("workflows", data.workflowId);
    data.processId = remapId("processes", data.processId);
    data.jobId = remapId("jobs", data.jobId);
    return data;
  });

  // API Logs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrateTable("apiLogs", api.migration.exportApiLogs, api.migration.importApiLogs, (data: any) => {
    data.processId = remapId("processes", data.processId);
    return data;
  });
}

// ============================================
// PHASE 6: PATCH JOB → PROCESS REFERENCES
// ============================================

async function patchJobProcessIds(): Promise<void> {
  log("PHASE 6: Patching job → process references...");

  if (deferredJobProcessPatches.length === 0) {
    log("  No patches needed");
    return;
  }

  const patches: Array<{ jobId: string; processId: string }> = [];

  for (const { oldJobId, oldProcessId } of deferredJobProcessPatches) {
    const newJobId = remapId("jobs", oldJobId);
    const newProcessId = remapId("processes", oldProcessId);

    if (newJobId && newProcessId) {
      patches.push({ jobId: newJobId, processId: newProcessId });
    } else {
      console.warn(
        `  WARNING: Could not remap patch - job: ${oldJobId} → ${newJobId}, process: ${oldProcessId} → ${newProcessId}`
      );
    }
  }

  // Batch the patches
  await processBatches(patches, BATCH_SIZE, async (batch) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await target.mutation(api.migration.patchJobProcessId as any, {
      patches: batch,
    });
  });

  log(`  Patched ${patches.length} jobs with processId`);
}

// ============================================
// SUMMARY
// ============================================

function printSummary(): void {
  console.log("\n" + "=".repeat(60));
  console.log("MIGRATION SUMMARY");
  console.log("=".repeat(60));
  console.log(
    `${"Table".padEnd(25)} ${"Exported".padStart(10)} ${"Imported".padStart(10)}`
  );
  console.log("-".repeat(47));

  let totalExported = 0;
  let totalImported = 0;

  for (const [table, counts] of Object.entries(recordCounts)) {
    console.log(
      `${table.padEnd(25)} ${String(counts.exported).padStart(10)} ${String(counts.imported).padStart(10)}`
    );
    totalExported += counts.exported;
    totalImported += counts.imported;
  }

  console.log("-".repeat(47));
  console.log(
    `${"TOTAL".padEnd(25)} ${String(totalExported).padStart(10)} ${String(totalImported).padStart(10)}`
  );
  console.log("=".repeat(60));
}

// ============================================
// MAIN
// ============================================

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("CONVEX DATABASE MIGRATION");
  console.log("=".repeat(60));
  console.log(`Source: ${SOURCE_URL}`);
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`File concurrency: ${FILE_CONCURRENCY}`);
  console.log("");

  const startTime = Date.now();

  try {
    // Phase 0: Transfer files
    await transferFiles();

    // Phase 1: Independent tables
    await migrateIndependentTables();

    // Phase 2: Prompt configurations (depend on Phase 1)
    await migratePromptConfigurations();

    // Phase 3: Jobs without processId + collect deferred patches
    await collectDeferredJobPatches();
    await migrateJobs();

    // Phase 4: Processes (main first, then subprocesses by hierarchy)
    await migrateProcesses();

    // Phase 5: All dependent tables
    await migrateDependentTables();

    // Phase 6: Fix circular job → process references
    await patchJobProcessIds();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Migration completed in ${elapsed}s`);
  } catch (err) {
    console.error("\nMIGRATION FAILED:", err);
    process.exit(1);
  }

  printSummary();
}

main();
