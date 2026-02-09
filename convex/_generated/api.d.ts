/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentAnalyze from "../agentAnalyze.js";
import type * as agentEvents from "../agentEvents.js";
import type * as agentLoop from "../agentLoop.js";
import type * as agentMutations from "../agentMutations.js";
import type * as agentQueries from "../agentQueries.js";
import type * as agentSessions from "../agentSessions.js";
import type * as agentTools from "../agentTools.js";
import type * as analysisPrompts from "../analysisPrompts.js";
import type * as analysisVersions from "../analysisVersions.js";
import type * as analyze from "../analyze.js";
import type * as apiLogs from "../apiLogs.js";
import type * as boundingBoxOverlay from "../boundingBoxOverlay.js";
import type * as boundingBoxQueries from "../boundingBoxQueries.js";
import type * as boundingBoxes from "../boundingBoxes.js";
import type * as debug_db from "../debug_db.js";
import type * as documents from "../documents.js";
import type * as exportPdd from "../exportPdd.js";
import type * as flows from "../flows.js";
import type * as geminiApi from "../geminiApi.js";
import type * as internal_ from "../internal.js";
import type * as jobs from "../jobs.js";
import type * as migration from "../migration.js";
import type * as migrationActions from "../migrationActions.js";
import type * as migrations from "../migrations.js";
import type * as processDataHandler from "../processDataHandler.js";
import type * as processes from "../processes.js";
import type * as prompts from "../prompts.js";
import type * as prompts_index from "../prompts/index.js";
import type * as prompts_jsonSchema from "../prompts/jsonSchema.js";
import type * as prompts_systemPrompt from "../prompts/systemPrompt.js";
import type * as prompts_userPrompt from "../prompts/userPrompt.js";
import type * as reanalyze from "../reanalyze.js";
import type * as runWorkflow from "../runWorkflow.js";
import type * as seedPrompts from "../seedPrompts.js";
import type * as sensitiveInfoDetection from "../sensitiveInfoDetection.js";
import type * as settings from "../settings.js";
import type * as settingsActions from "../settingsActions.js";
import type * as steps from "../steps.js";
import type * as stepsActions from "../stepsActions.js";
import type * as testAction from "../testAction.js";
import type * as testQuery from "../testQuery.js";
import type * as types from "../types.js";
import type * as unifiedPrompts from "../unifiedPrompts.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentAnalyze: typeof agentAnalyze;
  agentEvents: typeof agentEvents;
  agentLoop: typeof agentLoop;
  agentMutations: typeof agentMutations;
  agentQueries: typeof agentQueries;
  agentSessions: typeof agentSessions;
  agentTools: typeof agentTools;
  analysisPrompts: typeof analysisPrompts;
  analysisVersions: typeof analysisVersions;
  analyze: typeof analyze;
  apiLogs: typeof apiLogs;
  boundingBoxOverlay: typeof boundingBoxOverlay;
  boundingBoxQueries: typeof boundingBoxQueries;
  boundingBoxes: typeof boundingBoxes;
  debug_db: typeof debug_db;
  documents: typeof documents;
  exportPdd: typeof exportPdd;
  flows: typeof flows;
  geminiApi: typeof geminiApi;
  internal: typeof internal_;
  jobs: typeof jobs;
  migration: typeof migration;
  migrationActions: typeof migrationActions;
  migrations: typeof migrations;
  processDataHandler: typeof processDataHandler;
  processes: typeof processes;
  prompts: typeof prompts;
  "prompts/index": typeof prompts_index;
  "prompts/jsonSchema": typeof prompts_jsonSchema;
  "prompts/systemPrompt": typeof prompts_systemPrompt;
  "prompts/userPrompt": typeof prompts_userPrompt;
  reanalyze: typeof reanalyze;
  runWorkflow: typeof runWorkflow;
  seedPrompts: typeof seedPrompts;
  sensitiveInfoDetection: typeof sensitiveInfoDetection;
  settings: typeof settings;
  settingsActions: typeof settingsActions;
  steps: typeof steps;
  stepsActions: typeof stepsActions;
  testAction: typeof testAction;
  testQuery: typeof testQuery;
  types: typeof types;
  unifiedPrompts: typeof unifiedPrompts;
  workflows: typeof workflows;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
