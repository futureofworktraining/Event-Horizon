// User prompt for video analysis
// V2 - FLOWCHART-ENABLED (Default)

export const USER_PROMPT = `Analyze this screen recording video and generate a complete Process Design Document (PDD) with FLOWCHART structure in JSON format.

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
