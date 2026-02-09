// Prompt selection and re-exports
// NOTE: File-based prompts are kept as backup only - all runtime prompts come from database
// Individual prompts are stored in the ./prompts/ folder

// Re-export prompts (V2 Flowchart - Default)
export {
  SYSTEM_PROMPT,
  USER_PROMPT,
  JSON_SCHEMA,
  type PromptSet,
  getPrompts,
} from "./prompts/index";

import {
  SYSTEM_PROMPT,
  USER_PROMPT,
  JSON_SCHEMA,
  type PromptSet,
} from "./prompts/index";

/**
 * Get the default prompts (V2 Flowchart-enabled)
 * NOTE: This is for backup/reference only. Runtime prompts come from database.
 */
export function getDefaultPrompts(): PromptSet {
  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    jsonSchema: JSON_SCHEMA,
  };
}
