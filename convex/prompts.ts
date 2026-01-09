// System prompt for Gemini to analyze screen recordings and generate PDD documentation
// V1 - Original linear flow (kept for backward compatibility)

export const SYSTEM_PROMPT = `You are an expert RPA (Robotic Process Automation) Business Analyst specializing in creating Process Design Documents (PDD) from screen recordings. Your task is to analyze a video of a business process and extract detailed, structured documentation that can be used for automation development.

## Documentation Standards

### Step Descriptions
- Every step description MUST start with either "User" or "System" to indicate who performs the action
- Use present tense action verbs (clicks, types, selects, navigates, verifies)
- Reference UI element names in single quotes (e.g., "User clicks 'Submit' button")
- Be specific about what happens, not vague

### UI Element Location Guidelines
Use a 9-zone grid to describe element positions:
- top_left, top_center, top_right
- middle_left, middle_center, middle_right
- bottom_left, bottom_center, bottom_right
- full_screen (for modals, overlays)

Location descriptions should be clear enough that someone could find the element (e.g., "In the navigation bar at top of page" or "Below the customer name field")

### Timestamp Format
Use MM:SS.s format (e.g., "00:05.2" for 5.2 seconds, "01:30.0" for 1 minute 30 seconds)

### Sensitive Data Handling
- Passwords: Show as "[MASKED]"
- Personal Identifiable Information (PII): Show as "[PII MASKED]"
- Credit card numbers: Show as "[CC MASKED]"
- SSN/Government IDs: Show as "[ID MASKED]"
- Always set isSensitive: true for these data types

### Action Types
Categorize each step into one of these action types:
1. ui_interaction - Direct interaction with UI elements (click, type, select, etc.)
2. navigation - Moving between pages, applications, tabs
3. data_transfer - Reading, copying, pasting, importing, exporting data
4. explanation - Business rules, decisions, notes that explain process logic
5. wait - Waiting for elements, pages, processes to complete
6. validation - Verifying elements exist, values are correct, states match expected

### Specific Actions
Choose the most appropriate specific action:
- UI Interaction: click, double_click, right_click, type, select, check, uncheck, drag_and_drop, scroll, hover
- Navigation: navigate_to_url, open_application, close_application, switch_tab, switch_window, go_back
- Data Transfer: read, copy, paste, download, upload, export, import
- Explanation: note, decision, business_rule, exception
- Wait: wait_for_element, wait_for_page, wait_for_process, wait_fixed_time
- Validation: verify_element, verify_value, verify_state

### UI Element Types
When identifying UI elements, use these types:
button, link, text_field, text_area, dropdown, combobox, checkbox, radio_button, toggle, slider, date_picker, time_picker, file_upload, menu, menu_item, tab, table, table_row, table_cell, tree_view, tree_node, list, list_item, card, modal, dialog, tooltip, notification, icon, image, label, heading, paragraph, breadcrumb, pagination, search_field, other

## Output Requirements
Return a complete PDDProcessDocumentation JSON object with:
1. process_metadata - Overall process information
2. steps - Array of detailed steps in chronological order

Be thorough - capture EVERY action the user takes, even small ones like scrolling or waiting for page loads. Include automation hints where helpful for developers implementing the RPA bot.`;

export const USER_PROMPT = `Analyze this screen recording video and generate a complete Process Design Document (PDD) in JSON format.

Watch the entire video carefully and document:
1. Every user action (clicks, typing, selections, scrolling)
2. Every system response (page loads, popups, notifications)
3. Any waiting periods or delays
4. Business rules or decision points observed
5. Applications used and screens navigated

Return ONLY valid JSON matching the PDDProcessDocumentation schema. Do not include any markdown formatting or code blocks - just the raw JSON object.`;

export const JSON_SCHEMA = {
  type: "object",
  properties: {
    process_metadata: {
      type: "object",
      properties: {
        process_name: { type: "string" },
        process_description: { type: "string" },
        recording_duration_seconds: { type: "number" },
        total_steps: { type: "number" },
        applications: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: {
                type: "string",
                enum: ["web_application", "desktop_application", "mobile_application", "terminal", "other"]
              },
              url: { type: "string" },
              version: { type: "string" }
            },
            required: ["name", "type"]
          }
        },
        business_rules_observed: {
          type: "array",
          items: { type: "string" }
        },
        exceptions_noted: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["process_name", "process_description", "recording_duration_seconds", "total_steps", "applications"]
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          step_number: { type: "number" },
          timestamp: { type: "string" },
          action_type: {
            type: "string",
            enum: ["ui_interaction", "navigation", "data_transfer", "explanation", "wait", "validation"]
          },
          specific_action: {
            type: "string",
            enum: [
              "click", "double_click", "right_click", "type", "select", "check", "uncheck",
              "drag_and_drop", "scroll", "hover", "navigate_to_url", "open_application",
              "close_application", "switch_tab", "switch_window", "go_back", "read", "copy",
              "paste", "download", "upload", "export", "import", "note", "decision",
              "business_rule", "exception", "wait_for_element", "wait_for_page",
              "wait_for_process", "wait_fixed_time", "verify_element", "verify_value", "verify_state"
            ]
          },
          description: { type: "string" },
          application: { type: "string" },
          screen_name: { type: "string" },
          screenshot_required: { type: "boolean" },
          ui_element: {
            type: "object",
            properties: {
              element_name: { type: "string" },
              element_type: {
                type: "string",
                enum: [
                  "button", "link", "text_field", "text_area", "dropdown", "combobox",
                  "checkbox", "radio_button", "toggle", "slider", "date_picker", "time_picker",
                  "file_upload", "menu", "menu_item", "tab", "table", "table_row", "table_cell",
                  "tree_view", "tree_node", "list", "list_item", "card", "modal", "dialog",
                  "tooltip", "notification", "icon", "image", "label", "heading", "paragraph",
                  "breadcrumb", "pagination", "search_field", "other"
                ]
              },
              location_description: { type: "string" },
              screen_region: {
                type: "string",
                enum: [
                  "top_left", "top_center", "top_right", "middle_left", "middle_center",
                  "middle_right", "bottom_left", "bottom_center", "bottom_right", "full_screen"
                ]
              },
              parent_element: { type: "string" },
              identifiers: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  class_name: { type: "string" },
                  xpath: { type: "string" },
                  accessibility_id: { type: "string" }
                }
              }
            },
            required: ["element_name", "element_type", "location_description", "screen_region"]
          },
          data_info: {
            type: "object",
            properties: {
              value: { type: "string" },
              data_type: {
                type: "string",
                enum: ["text", "number", "date", "datetime", "currency", "percentage", "boolean", "email", "phone", "url", "file", "password", "other"]
              },
              source: {
                type: "string",
                enum: ["user_input", "system_generated", "database", "external_api", "file_import", "calculation", "other"]
              },
              is_sensitive: { type: "boolean" },
              format: { type: "string" },
              validation_rules: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["value", "data_type", "source", "is_sensitive"]
          },
          wait_condition: {
            type: "object",
            properties: {
              wait_type: {
                type: "string",
                enum: ["page_load", "element_visible", "element_clickable", "api_response", "file_download", "animation_complete", "manual_trigger", "timeout", "other"]
              },
              description: { type: "string" },
              timeout_seconds: { type: "number" },
              retry_count: { type: "number" }
            },
            required: ["wait_type", "description"]
          },
          notes: { type: "string" },
          automation_hint: { type: "string" }
        },
        required: ["step_number", "timestamp", "action_type", "specific_action", "description", "application", "screen_name", "screenshot_required"]
      }
    }
  },
  required: ["process_metadata", "steps"]
};

// ============================================
// V2 - FLOWCHART-ENABLED PROMPTS
// ============================================

export const SYSTEM_PROMPT_V2 = `You are an expert RPA (Robotic Process Automation) Business Analyst specializing in creating Process Design Documents (PDD) from screen recordings. Your task is to analyze a video of a business process and extract detailed, structured documentation with FLOWCHART representation that can be used for automation development.

## Documentation Standards

### Step Descriptions
- Every step description MUST start with either "User" or "System" to indicate who performs the action
- Use present tense action verbs (clicks, types, selects, navigates, verifies)
- Reference UI element names in single quotes (e.g., "User clicks 'Submit' button")
- Be specific about what happens, not vague

### UI Element Location Guidelines
Use a 9-zone grid to describe element positions:
- top_left, top_center, top_right
- middle_left, middle_center, middle_right
- bottom_left, bottom_center, bottom_right
- full_screen (for modals, overlays)

### Timestamp Format
Use MM:SS.s format (e.g., "00:05.2" for 5.2 seconds, "01:30.0" for 1 minute 30 seconds)

### Sensitive Data Handling
- Passwords: Show as "[MASKED]"
- Personal Identifiable Information (PII): Show as "[PII MASKED]"
- Credit card numbers: Show as "[CC MASKED]"
- SSN/Government IDs: Show as "[ID MASKED]"
- Always set is_sensitive: true for these data types

## FLOWCHART STRUCTURE (CRITICAL)

You MUST analyze the video and produce a flowchart representation. The flowchart consists of NODES (steps and control points) and EDGES (connections between them).

### Node Types

1. **start** - Single entry point for each process
   - node_id: "start"
   - Every process must have exactly one start node

2. **end** - Exit points (can have multiple per process)
   - node_id: "end_success", "end_failure", "end_cancelled", etc.
   - end_type: "success" | "failure" | "cancelled" | "exception"
   - Use "success" for normal completion
   - Use "failure" for error conditions
   - Use "cancelled" for user cancellation
   - Use "exception" for unexpected errors

3. **action** - A step performed by user or system
   - node_id: "step_1", "step_2", etc. (must match step_number)
   - Links to a step via step_number field
   - flow_node_id in step should match this node_id

4. **decision** - Binary decision point (yes/no, true/false)
   - node_id: "decision_1", "decision_2", etc.
   - condition: The question being evaluated (e.g., "Is user logged in?")
   - condition_description: Detailed explanation
   - Has exactly TWO outgoing edges with labels like "TAK"/"NIE" or "Yes"/"No"

5. **switch** - Multi-way decision point (3+ options)
   - node_id: "switch_1", etc.
   - condition: The value being evaluated
   - Has 3 or more outgoing edges with different labels

6. **merge** - Where branches converge back
   - node_id: "merge_1", "merge_2", etc.
   - Use when multiple paths come together
   - Has multiple incoming edges, one outgoing edge

7. **subprocess** - Reference to a nested process
   - node_id: "subprocess_login", "subprocess_payment", etc.
   - subprocess_id: References the process_id of the child process
   - label: Display name for the subprocess

8. **loop_back** - Return to an earlier node (for retry logic)
   - node_id: "loop_1", etc.
   - The outgoing edge points back to an earlier node

### Edge Structure

Each edge connects two nodes:
- edge_id: Unique identifier (e.g., "edge_start_step1")
- from_node_id: Source node
- to_node_id: Target node
- label: Optional label (REQUIRED for decision/switch outgoing edges)
- condition: Optional logical condition
- edge_type: "normal" | "exception" | "timeout" | "loop"
- is_default: true for the default path from decision nodes

### Decision Point Detection

Create a DECISION node when you observe:
- Confirmation dialogs (Yes/No, OK/Cancel)
- Error messages that change the flow
- Validation results (valid/invalid)
- Login success/failure
- Data availability checks
- User choices between options

Example decision flow:
\`\`\`
step_2 → decision_1 → [TAK] → step_3a → merge_1 → step_4
                   → [NIE] → step_3b → merge_1
\`\`\`

### Subprocess Detection

Create a SUBPROCESS when you observe:
- A distinct, reusable sequence of steps (e.g., login, payment, search)
- A logical grouping that could be extracted and reused
- A section that appears multiple times in different contexts
- IMPORTANT: Maximum 5 levels of nesting allowed

For subprocesses:
- Create a separate process entry with parent_process_id set
- Reference it from the parent flow using subprocess node
- Assign a unique color_index (0-7) for visual distinction

### Multiple Processes

If the video shows multiple INDEPENDENT processes:
- Create separate process entries for each
- First process discovered should have is_main_process: true
- Set video_start_timestamp and video_end_timestamp for each
- Each process gets its own flow structure

## Action Types
1. ui_interaction - Direct interaction with UI elements
2. navigation - Moving between pages, applications, tabs
3. data_transfer - Reading, copying, pasting data
4. explanation - Business rules, decisions, notes
5. wait - Waiting for elements, pages, processes
6. validation - Verifying elements, values, states

## Specific Actions
- UI Interaction: click, double_click, right_click, type, select, check, uncheck, drag_and_drop, scroll, hover
- Navigation: navigate_to_url, open_application, close_application, switch_tab, switch_window, go_back
- Data Transfer: read, copy, paste, download, upload, export, import
- Explanation: note, decision, business_rule, exception
- Wait: wait_for_element, wait_for_page, wait_for_process, wait_fixed_time
- Validation: verify_element, verify_value, verify_state

## Output Requirements

Return a JSON object with:
1. processes[] - Array of all processes (main + subprocesses)
2. Each process contains:
   - process_id, process_name, process_description
   - parent_process_id (null for main process)
   - is_main_process (true for the primary process)
   - flow { nodes[], edges[] }
   - steps[] (with flow_node_id linking to nodes)
   - applications, business_rules_observed, exceptions_noted

Be thorough - capture EVERY action and create appropriate decision nodes for any branching logic observed.`;

export const USER_PROMPT_V2 = `Analyze this screen recording video and generate a complete Process Design Document (PDD) with FLOWCHART structure in JSON format.

Watch the entire video carefully and document:

1. **All User Actions** - clicks, typing, selections, scrolling, drag-drop
2. **All System Responses** - page loads, popups, notifications, errors
3. **Decision Points** - any branching logic, conditions, choices
4. **Waiting Periods** - loading, processing, delays
5. **Subprocesses** - distinct reusable sequences (login, payment, etc.)
6. **Multiple Processes** - if video shows independent processes, separate them

For the FLOWCHART:
- Create START and END nodes
- Create ACTION nodes for each step
- Create DECISION nodes for any branching (if/else, success/failure)
- Create SUBPROCESS nodes for distinct sequences
- Connect all nodes with properly labeled EDGES
- Use "TAK"/"NIE" or "Yes"/"No" labels for decision edges

Return ONLY valid JSON matching the schema. Do not include markdown formatting or code blocks.`;

export const JSON_SCHEMA_V2 = {
  type: "object",
  properties: {
    processes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          process_id: { type: "string" },
          process_name: { type: "string" },
          process_description: { type: "string" },
          recording_duration_seconds: { type: "number" },
          total_steps: { type: "number" },
          parent_process_id: { type: "string" },
          is_main_process: { type: "boolean" },
          video_start_timestamp: { type: "string" },
          video_end_timestamp: { type: "string" },
          applications: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                type: {
                  type: "string",
                  enum: ["web_application", "desktop_application", "mobile_application", "terminal", "other"]
                },
                url: { type: "string" },
                version: { type: "string" }
              },
              required: ["name", "type"]
            }
          },
          business_rules_observed: {
            type: "array",
            items: { type: "string" }
          },
          exceptions_noted: {
            type: "array",
            items: { type: "string" }
          },
          flow: {
            type: "object",
            properties: {
              nodes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    node_id: { type: "string" },
                    node_type: {
                      type: "string",
                      enum: ["start", "end", "action", "decision", "switch", "merge", "subprocess", "loop_back"]
                    },
                    step_number: { type: "number" },
                    condition: { type: "string" },
                    condition_description: { type: "string" },
                    subprocess_id: { type: "string" },
                    end_type: {
                      type: "string",
                      enum: ["success", "failure", "cancelled", "exception"]
                    },
                    label: { type: "string" }
                  },
                  required: ["node_id", "node_type"]
                }
              },
              edges: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    edge_id: { type: "string" },
                    from_node_id: { type: "string" },
                    to_node_id: { type: "string" },
                    label: { type: "string" },
                    condition: { type: "string" },
                    edge_type: {
                      type: "string",
                      enum: ["normal", "exception", "timeout", "loop"]
                    },
                    is_default: { type: "boolean" }
                  },
                  required: ["edge_id", "from_node_id", "to_node_id"]
                }
              }
            },
            required: ["nodes", "edges"]
          },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                step_number: { type: "number" },
                timestamp: { type: "string" },
                flow_node_id: { type: "string" },
                action_type: {
                  type: "string",
                  enum: ["ui_interaction", "navigation", "data_transfer", "explanation", "wait", "validation"]
                },
                specific_action: {
                  type: "string",
                  enum: [
                    "click", "double_click", "right_click", "type", "select", "check", "uncheck",
                    "drag_and_drop", "scroll", "hover", "navigate_to_url", "open_application",
                    "close_application", "switch_tab", "switch_window", "go_back", "read", "copy",
                    "paste", "download", "upload", "export", "import", "note", "decision",
                    "business_rule", "exception", "wait_for_element", "wait_for_page",
                    "wait_for_process", "wait_fixed_time", "verify_element", "verify_value", "verify_state"
                  ]
                },
                description: { type: "string" },
                application: { type: "string" },
                screen_name: { type: "string" },
                screenshot_required: { type: "boolean" },
                ui_element: {
                  type: "object",
                  properties: {
                    element_name: { type: "string" },
                    element_type: {
                      type: "string",
                      enum: [
                        "button", "link", "text_field", "text_area", "dropdown", "combobox",
                        "checkbox", "radio_button", "toggle", "slider", "date_picker", "time_picker",
                        "file_upload", "menu", "menu_item", "tab", "table", "table_row", "table_cell",
                        "tree_view", "tree_node", "list", "list_item", "card", "modal", "dialog",
                        "tooltip", "notification", "icon", "image", "label", "heading", "paragraph",
                        "breadcrumb", "pagination", "search_field", "other"
                      ]
                    },
                    location_description: { type: "string" },
                    screen_region: {
                      type: "string",
                      enum: [
                        "top_left", "top_center", "top_right", "middle_left", "middle_center",
                        "middle_right", "bottom_left", "bottom_center", "bottom_right", "full_screen"
                      ]
                    },
                    parent_element: { type: "string" },
                    identifiers: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        class_name: { type: "string" },
                        xpath: { type: "string" },
                        accessibility_id: { type: "string" }
                      }
                    }
                  },
                  required: ["element_name", "element_type", "location_description", "screen_region"]
                },
                data_info: {
                  type: "object",
                  properties: {
                    value: { type: "string" },
                    data_type: {
                      type: "string",
                      enum: ["text", "number", "date", "datetime", "currency", "percentage", "boolean", "email", "phone", "url", "file", "password", "other"]
                    },
                    source: {
                      type: "string",
                      enum: ["user_input", "system_generated", "database", "external_api", "file_import", "calculation", "other"]
                    },
                    is_sensitive: { type: "boolean" },
                    format: { type: "string" },
                    validation_rules: {
                      type: "array",
                      items: { type: "string" }
                    }
                  },
                  required: ["value", "data_type", "source", "is_sensitive"]
                },
                wait_condition: {
                  type: "object",
                  properties: {
                    wait_type: {
                      type: "string",
                      enum: ["page_load", "element_visible", "element_clickable", "api_response", "file_download", "animation_complete", "manual_trigger", "timeout", "other"]
                    },
                    description: { type: "string" },
                    timeout_seconds: { type: "number" },
                    retry_count: { type: "number" }
                  },
                  required: ["wait_type", "description"]
                },
                notes: { type: "string" },
                automation_hint: { type: "string" }
              },
              required: ["step_number", "timestamp", "flow_node_id", "action_type", "specific_action", "description", "application", "screen_name", "screenshot_required"]
            }
          }
        },
        required: ["process_id", "process_name", "process_description", "flow", "steps"]
      }
    }
  },
  required: ["processes"]
};
