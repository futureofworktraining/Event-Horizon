// Prompts index - Flowchart-enabled V2 (Default)
// These files serve as backup reference. Runtime prompts come from database.

export { SYSTEM_PROMPT } from "./systemPrompt";
export { USER_PROMPT } from "./userPrompt";
export { JSON_SCHEMA } from "./jsonSchema";

// Prompt set interface
export interface PromptSet {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: object;
}

// Import for getPrompts function
import { SYSTEM_PROMPT } from "./systemPrompt";
import { USER_PROMPT } from "./userPrompt";
import { JSON_SCHEMA } from "./jsonSchema";

// Get default prompts (V2 Flowchart)
export function getPrompts(): PromptSet {
  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    jsonSchema: JSON_SCHEMA,
  };
}
