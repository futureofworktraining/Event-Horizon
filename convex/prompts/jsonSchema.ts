// JSON Schema for PDD output
// V2 - FLOWCHART-ENABLED (Default)

export const JSON_SCHEMA = {
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
