# ServiceFlow — JavaScript + LLM Functional Prototype

ServiceFlow is a focused prototype for the commercial company in the Client's customer call.

The product is built around the two questions Denise explicitly said she needs answered every morning:

1. **Who do I need to call today?**
2. **Where is each job at?**

The prototype uses JavaScript for the application and workflow logic, and an LLM for the parts that are genuinely unstructured: turning messy calls/texts/emails into structured job records and drafting customer follow-ups.

## Stack

- Frontend: vanilla HTML/CSS/JavaScript
- Backend: Node.js JavaScript (`server.js`)
- Data: browser `localStorage` for prototype persistence
- LLM: OpenAI Responses API using `Gemini models`
- No framework or npm dependencies required

## What works

### 1. Morning follow-up dashboard

- Automatically shows open jobs due or overdue for follow-up.
- Urgent issues are pushed to the top.
- Tracks the pipeline:
  - New
  - Quote Needed
  - Awaiting Approval
  - Scheduled
  - Done
- Shows open jobs, quote backlog and estimated open-job value.

### 2. AI Intake

The **AI Intake** screen accepts unstructured customer requests such as:

> Marco from Northside Pizza called. Their walk-in freezer is completely down and food is starting to soften. He said call him back at 555-018-7732. They need someone today if possible.

The backend sends this to the LLM and asks for structured fields:

- customer
- company
- phone
- source
- equipment
- issue
- priority
- short summary
- suggested pipeline status
- suggested follow-up timing

The UI deliberately requires a human review step before creating the job.

### 3. AI follow-up drafting

Open any job and click **Draft follow-up**.

The LLM writes a short customer SMS based on the current job state while being explicitly told not to invent:

- pricing
- technician arrival times
- completed work
- guarantees
- commitments

### 4. Demo mode

The application includes:

- 10 realistic refrigeration service jobs
- emergency and normal-priority requests
- every pipeline stage
- overdue and due-today follow-ups
- 3 sample raw customer messages for AI intake

If no API key is configured, the same UI still works using a deterministic local fallback. This makes the prototype easy to demonstrate without exposing credentials. The UI clearly labels this as **AI demo mode**.

## Run it

Node.js 18+ is required.

**Windows:** double-click `start.bat`. It starts the local server and opens the prototype in your browser.

Or run manually:

```bash
node server.js
```

Then open:

```text
http://localhost:3000
```

No `npm install` is necessary.

You can also run:

```bash
npm start
```

## Enable the live LLM

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Add your OpenAI API key:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6-luna
PORT=3000
```

Restart the server. The badge in the header changes from **AI demo mode** to **Live LLM**.

The API key stays in the Node backend. It is never placed in browser JavaScript.

## Demo flow for the interview

1. Start on **Today**.
2. Show that overdue and urgent jobs are automatically surfaced.
3. Open Casa Verde Restaurant and explain why a `$2,000` freezer job cannot depend on Denise remembering a notebook entry.
4. Go to **AI Intake**.
5. Click **Emergency call** and then **Extract with AI**.
6. Show the structured request and the human-review step.
7. Click **Create job from reviewed result**.
8. The new job now appears in the dashboard/pipeline.
9. Open an existing **Awaiting Approval** job and click **Draft follow-up**.
10. Show how AI helps with the unstructured work while the pipeline, follow-up dates and state changes remain normal deterministic application logic.

## Why the LLM is used here

Using an LLM to decide everything would make this prototype worse.

The reliable workflow rules are ordinary JavaScript:

- when a follow-up is due
- which jobs are overdue
- pipeline state
- status transitions
- counts and job value
- saving records

The LLM is used only where language understanding/generation adds value:

- extracting fields from messy inbound communication
- recognizing urgency from customer language
- summarizing the request
- drafting a follow-up message

This keeps the prototype useful even if the LLM is unavailable.

## Production next steps

1. Website form → automatically create an intake item.
2. Shared inbox → LLM extracts service requests from emails.
3. SMS / missed-call provider → automatically capture texts and calls.
4. Daily 7 AM digest: customers Denise needs to contact today.
5. 48-hour no-contact reminder.
6. Only after the follow-up leak is solved: technician scheduling and dispatch.

## Product principle

**Capture every request once, then make the next action impossible to forget.**


## Editable human review

The AI intake result is deliberately not saved directly. Every extracted field is editable in the Human Review panel before a job is created, including customer, business, phone, source, equipment, priority, stage, follow-up timing, estimated value, summary and issue. The final job is built from the reviewed form values rather than the raw LLM response.


## Latest fixes

- Fixed the product-tour stacking bug: highlighted content no longer covers the tour card.
- Human Review tour step highlights only the compact heading area.
- Added **Edit details** to every job popup.
- Customer/job edits include customer name, business, phone, source, equipment, priority, value, follow-up date, issue and notes.
- Job stage remains controlled independently by the workflow track.
