// User prompt for video analysis
// V2 - FLOWCHART-ENABLED (Default)

export const USER_PROMPT = `Analyze this screen recording video and generate a complete Process Design Document (PDD) with FLOWCHART structure in JSON format.

Watch the entire video carefully FROM START TO FINISH and document every action in the EXACT chronological order it occurs:

1. **All User Actions** - clicks, typing, selections, scrolling, drag-drop
2. **All System Responses** - page loads, popups, notifications, errors
3. **Decision Points** - any branching logic, conditions, choices
4. **Waiting Periods** - loading, processing, delays
5. **Subprocesses** - ONLY if a sequence is clearly repeated or is an obvious standalone workflow
6. **Multiple Processes** - if video shows independent processes, separate them

For the FLOWCHART:
- Create START and END nodes
- Create ACTION nodes for each step
- Create DECISION nodes for any branching (if/else, success/failure)
- Create SUBPROCESS nodes only when clearly justified
- Connect all nodes with properly labeled EDGES
- Use "TAK"/"NIE" or "Yes"/"No" labels for decision edges

IMPORTANT RULES:
- Steps MUST be in exact chronological video order (step 1 = first action, step N = last action)
- Prefer a single flat process over splitting into subprocesses
- Every step must link to a flow node and vice versa — no orphans
- Verify your output before returning: correct order, no orphaned steps, complete flow connectivity

Return ONLY valid JSON matching the schema. Do not include markdown formatting or code blocks.`;
