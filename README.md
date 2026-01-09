# Video to PDD - Process Documentation Generator

Transform screen recordings into detailed Process Design Documents using AI.

## Features

- **Video Upload**: Drag-and-drop interface for uploading screen recordings (MP4, WebM, MOV, AVI)
- **AI Analysis**: Powered by Google Gemini 2.5 Flash for intelligent video understanding
- **Structured Output**: Generates detailed PDD documentation with:
  - Process metadata and descriptions
  - Applications used
  - Step-by-step actions with timestamps
  - UI element identification
  - Data information (with sensitive data masking)
  - Business rules and exceptions
- **JSON Export**: Export documentation in standard PDD JSON format
- **Real-time Updates**: See analysis progress in real-time

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React, TypeScript
- **Backend**: Convex (Database, File Storage, Serverless Functions)
- **AI**: Google Gemini 2.5 Flash
- **Styling**: Tailwind CSS, shadcn/ui

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- A Convex account (free at https://convex.dev)
- A Google AI API key (from https://aistudio.google.com/apikey)

### Installation

1. **Install dependencies**:
   ```bash
   cd video-to-pdd
   npm install
   ```

2. **Initialize Convex**:
   ```bash
   npx convex dev
   ```
   This will:
   - Create a Convex project (first time only)
   - Generate the `.env.local` file with your `NEXT_PUBLIC_CONVEX_URL`
   - Start the Convex development server

3. **Configure Gemini API Key**:
   - Go to your Convex dashboard (https://dashboard.convex.dev)
   - Select your project
   - Go to Settings > Environment Variables
   - Add `GEMINI_API_KEY` with your Google AI API key

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. Open http://localhost:3000 in your browser

### Running in Production

1. Deploy Convex:
   ```bash
   npx convex deploy
   ```

2. Build and start Next.js:
   ```bash
   npm run build
   npm start
   ```

## Usage

1. Navigate to the Upload page
2. Drag and drop a screen recording video (or click to browse)
3. Wait for the AI analysis to complete
4. View the generated PDD documentation
5. Export as JSON for use in RPA tools

## Project Structure

```
video-to-pdd/
├── src/
│   ├── app/                 # Next.js pages
│   │   ├── page.tsx         # Home page
│   │   ├── upload/          # Upload page
│   │   └── process/[id]/    # Process results page
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── pdd/             # PDD display components
│   │   ├── Header.tsx
│   │   ├── VideoUploader.tsx
│   │   └── JobsList.tsx
│   └── lib/                 # Utilities
├── convex/
│   ├── schema.ts            # Database schema
│   ├── jobs.ts              # Job mutations/queries
│   ├── processes.ts         # Process queries
│   ├── analyze.ts           # Gemini analysis action
│   ├── prompts.ts           # AI prompts
│   └── types.ts             # TypeScript types
└── package.json
```

## PDD Output Schema

The generated PDD follows a standard schema with:

- **process_metadata**: Name, description, duration, applications used
- **steps[]**: Array of process steps with:
  - `step_number`, `timestamp`
  - `action_type`: ui_interaction, navigation, data_transfer, explanation, wait, validation
  - `specific_action`: click, type, navigate_to_url, etc.
  - `description`: What happens in this step
  - `ui_element`: Element name, type, location, identifiers
  - `data_info`: Value, type, source, sensitivity
  - `wait_condition`: Wait type, timeout
  - `automation_hint`: Tips for RPA implementation

## License

MIT
