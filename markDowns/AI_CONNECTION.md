# AI Connection Overview

This document explains how the OpenAI integration works in the Construction Reports app.

## Overview

The app uses **OpenAI GPT-4o** for two main features:
1. **Sabey AI Chat** - Interactive Q&A about projects
2. **Executive Summary** - AI-generated weekly summaries

## Setup

### Environment Variable
You need to set `OPENAI_API_KEY` in your `.env` file:

```bash
OPENAI_API_KEY=sk-your-api-key-here
```

Get your API key from: https://platform.openai.com/api-keys

## Architecture

### 1. OpenAI Client Initialization

All AI features use a shared client initialization pattern:

```typescript
// From: app/api/ai-chat/route.ts, app/api/reports/executive-summary/route.ts

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({ apiKey })
}
```

### 2. Sabey AI Chat (`/api/ai-chat`)

**Location:** `app/api/ai-chat/route.ts`

**How it works:**
1. Receives a user question and project data from the frontend
2. Builds a context string with all project information:
   - Project names, codes, regions
   - Budgets, EAC, variance
   - Latest report data (work performed, safety, trade workers)
3. Creates a prompt with instructions for the AI
4. Calls OpenAI GPT-4o with:
   - Model: `gpt-4o`
   - Max tokens: 500
   - Temperature: 0.3 (lower = more consistent)
5. Returns the AI's answer

**Example Request:**
```json
{
  "question": "What project has the biggest budget?",
  "projects": [...project data...],
  "weekEnding": "2025-11-07"
}
```

**Example Response:**
```json
{
  "answer": "The project with the biggest budget is **ASH A 11 01 25**..."
}
```

**Frontend Usage:**
- Component: `components/ai-chat.tsx`
- Sends POST to `/api/ai-chat`
- Displays response with markdown formatting

### 3. Executive Summary (`/api/reports/executive-summary`)

**Location:** `app/api/reports/executive-summary/route.ts`

**How it works:**
1. Fetches all projects from database with latest reports
2. Builds a report text with project details:
   - Region, project name, dates
   - Budget, EAC, variance
   - Work performed, safety info
3. Creates a prompt asking for executive summary by region
4. Calls OpenAI GPT-4o with:
   - Model: `gpt-4o`
   - Max tokens: 1000
   - Temperature: 0.3
5. Returns HTML-formatted summary

**Example Response:**
```json
{
  "summary": "<b>SDC Ashburn:</b> Projects in this region are generally on schedule..."
}
```

**Frontend Usage:**
- Component: `components/executive-summary.tsx`
- Sends POST to `/api/reports/executive-summary`
- Displays HTML summary when expanded

### 4. Test Endpoint (`/api/test-openai`)

**Location:** `app/api/test-openai/route.ts`

**Purpose:** Simple test to verify OpenAI connection works

**Usage:**
```bash
curl http://localhost:3000/api/test-openai
```

**Response:**
```json
{
  "success": true,
  "message": "Hello! How can I assist you today?",
  "test": "OpenAI connection is working!"
}
```

## Data Flow

### Sabey AI Chat Flow:
```
User types question
    ↓
components/ai-chat.tsx sends POST to /api/ai-chat
    ↓
API builds context from project data
    ↓
API creates prompt with instructions
    ↓
OpenAI GPT-4o processes request
    ↓
API returns answer
    ↓
Frontend displays formatted response (markdown)
```

### Executive Summary Flow:
```
User clicks "Executive Summary" expand button
    ↓
components/executive-summary.tsx sends POST to /api/reports/executive-summary
    ↓
API fetches all projects from database
    ↓
API builds report text
    ↓
OpenAI GPT-4o generates summary
    ↓
API returns HTML summary
    ↓
Frontend displays HTML summary
```

## Configuration

### Model Settings

Both endpoints use:
- **Model:** `gpt-4o` (OpenAI's latest model)
- **Temperature:** `0.3` (lower = more consistent, factual responses)
- **Max Tokens:** 
  - Chat: 500 (shorter responses)
  - Executive Summary: 1000 (longer summaries)

### Prompt Engineering

**Chat Prompt:**
- Includes all project data as context
- Instructions for markdown formatting
- Guidelines for project name formatting
- Budget/variance interpretation rules

**Executive Summary Prompt:**
- Instructions for region-by-region summaries
- Format requirements (HTML with bold region names)
- Guidelines for critical path activities
- Emphasis on factual, non-speculative content

## Error Handling

Both endpoints handle errors gracefully:
- Missing API key → Returns error message
- OpenAI API errors → Logs error, returns user-friendly message
- Network errors → Caught and returned as JSON error

## Security

- API key stored in environment variable (never in code)
- Auth checks (bypassed in dev mode with `BYPASS_AUTH=true`)
- Executive Summary restricted to ADMIN, PM, EXECUTIVE roles
- Input validation on all requests

## Testing

1. **Test OpenAI Connection:**
   ```bash
   curl http://localhost:3000/api/test-openai
   ```

2. **Test Chat (from browser console):**
   ```javascript
   fetch('/api/ai-chat', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       question: 'What is the biggest project?',
       projects: [],
       weekEnding: '2025-11-07'
     })
   }).then(r => r.json()).then(console.log)
   ```

3. **Test Executive Summary:**
   - Navigate to `/reports/weekly-summary`
   - Click "Executive Summary (AI generated) [+]" button
   - Summary will be generated on first expand

## Cost Considerations

- GPT-4o pricing: ~$2.50 per 1M input tokens, ~$10 per 1M output tokens
- Chat requests: ~500-1000 tokens per request
- Executive Summary: ~2000-3000 tokens per request
- Typical usage: Very low cost for weekly summaries

## Troubleshooting

**Error: "OPENAI_API_KEY is not configured"**
- Add `OPENAI_API_KEY=sk-...` to your `.env` file
- Restart the dev server

**Error: "Failed to connect to OpenAI"**
- Check your API key is valid
- Check your OpenAI account has credits
- Check network connectivity

**Slow responses:**
- GPT-4o is fast but can take 2-5 seconds for complex queries
- Executive summaries may take 5-10 seconds (more data)

