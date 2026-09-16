# Candidate Submission — Gushwork Customer Prototype

## Problem I chose to solve

The transcript does not primarily describe a scheduling problem or a need for a large CRM. Denise is losing jobs because inbound requests are scattered across phone calls, website emails, texts, referrals and a notebook, and follow-up depends on memory.

Her desired product is stated directly: she wants to know **who she needs to call today** and **where each job is at**.

I therefore built a lightweight follow-up operating system rather than a generic field-service platform.

## What I built

**ServiceFlow** has three functional areas:

### Overview 
An action queue of customers who are due or overdue for follow-up, plus a simple view of the whole pipeline.

### AI Intake
A JavaScript + LLM workflow that converts an unstructured phone note, website form or text message into a structured service request. The result is reviewed before it becomes a job.

### All Jobs
A searchable pipeline across:

**New → Quote Needed → Awaiting Approval → Scheduled → Done**

## Why I used an LLM

The scattered intake channels create unstructured text. That is a good LLM problem.

For example, this customer message:

> “Marco from Northside Pizza called. Their walk-in freezer is completely down and food is starting to soften...”

can be converted into fields such as company, caller, phone, equipment, issue and urgency without making Denise manually retype everything.

The LLM also drafts follow-up messages from the current job context.

I intentionally did **not** use AI for deterministic business logic. Dates, overdue status, job stages, counts and transitions are handled in JavaScript. The system also requires human review before saving an AI-extracted job.

## Demo data

The prototype ships with 10 realistic service requests covering:

- walk-in freezers and coolers
- ice machines
- refrigerated display cases
- restaurant, grocery and warehouse customers
- urgent equipment-down scenarios
- overdue quotes
- approvals
- scheduled work
- completed work

Three raw-message examples are included specifically for the AI intake demo.

## Technical implementation

- Vanilla JavaScript frontend
- Node.js JavaScript backend
- OpenAI Responses API
- Structured JSON schema for intake extraction
- API key remains server-side
- Browser localStorage for prototype data persistence
- Offline/demo fallback when no API key is configured

## Scope decisions

I did not build technician route optimization, accounting, invoicing, inventory or a large dispatch calendar because Denise explicitly said those were secondary.

The MVP tests the smallest workflow likely to prevent the stated `$2,000` lost-job scenario.

## Success criteria

Denise should be able to open one screen in the morning and answer in under a minute:

- Who is waiting on me?
- Who is overdue for a call?
- Which customers are waiting on a quote?
- Which quotes are waiting for approval?
- What is scheduled?
- Is anything at risk of slipping?

The business objective is **fewer dropped requests and faster follow-up**, not “more software.”
