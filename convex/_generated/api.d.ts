/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analyze from "../analyze.js";
import type * as apiLogs from "../apiLogs.js";
import type * as boundingBoxOverlay from "../boundingBoxOverlay.js";
import type * as boundingBoxQueries from "../boundingBoxQueries.js";
import type * as boundingBoxes from "../boundingBoxes.js";
import type * as debug_db from "../debug_db.js";
import type * as exportPdd from "../exportPdd.js";
import type * as flows from "../flows.js";
import type * as geminiApi from "../geminiApi.js";
import type * as internal_ from "../internal.js";
import type * as jobs from "../jobs.js";
import type * as migrations from "../migrations.js";
import type * as processDataHandler from "../processDataHandler.js";
import type * as processes from "../processes.js";
import type * as prompts from "../prompts.js";
import type * as runWorkflow from "../runWorkflow.js";
import type * as sensitiveInfoDetection from "../sensitiveInfoDetection.js";
import type * as settings from "../settings.js";
import type * as settingsActions from "../settingsActions.js";
import type * as steps from "../steps.js";
import type * as stepsActions from "../stepsActions.js";
import type * as testAction from "../testAction.js";
import type * as testQuery from "../testQuery.js";
import type * as types from "../types.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analyze: typeof analyze;
  apiLogs: typeof apiLogs;
  boundingBoxOverlay: typeof boundingBoxOverlay;
  boundingBoxQueries: typeof boundingBoxQueries;
  boundingBoxes: typeof boundingBoxes;
  debug_db: typeof debug_db;
  exportPdd: typeof exportPdd;
  flows: typeof flows;
  geminiApi: typeof geminiApi;
  internal: typeof internal_;
  jobs: typeof jobs;
  migrations: typeof migrations;
  processDataHandler: typeof processDataHandler;
  processes: typeof processes;
  prompts: typeof prompts;
  runWorkflow: typeof runWorkflow;
  sensitiveInfoDetection: typeof sensitiveInfoDetection;
  settings: typeof settings;
  settingsActions: typeof settingsActions;
  steps: typeof steps;
  stepsActions: typeof stepsActions;
  testAction: typeof testAction;
  testQuery: typeof testQuery;
  types: typeof types;
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
