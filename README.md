# ServiceFlow Focus — FDE Final

ServiceFlow is intentionally narrow for Denise, the owner of a small commercial refrigeration repair company.

Her explicit requirement is the product boundary: **wake up and know who to call today and where each job is at.** Multiple lead sources and calling are handled as supporting capabilities around that one workflow, not as extra products she has to learn.

## What the operator sees

One screen contains:

- **Today's action list** — overdue and due-today follow-ups, prioritized automatically.
- **All active jobs** — current state, next action and due date for every open job.
- **Job drawer** — contact details, activity history and simple operational outcomes.
- **Embedded Call customer flow** — keypad/dialer, simulated call transcript, and transcript-to-job updates.
- **Quick request capture** — a minimal fallback for calls/referrals that still arrive manually.

Status model:

`New → Waiting on Quote → Waiting on Yes → Needs Scheduling → Scheduled → Done`

There is no separate CRM navigation, inbox product, call-center module, invoice module, delivery tracker or technician calendar.

## Multiple lead sources without extra customer surface area

Email, website forms and SMS normalize into the same job model automatically. Denise does not manage another inbox.

The inbound pipeline performs:

1. source normalization,
2. duplicate protection using source IDs,
3. Gemini extraction when configured (deterministic parser fallback otherwise),
4. urgency and next-action selection,
5. customer matching by email/phone,
6. automatic job creation,
7. persistence to the same one-screen list.

The mailbox connector uses **IMAP/SMTP App Password authentication** and does not require a Google Cloud project.

## Calling without creating another product

Click **Call customer** inside a job. The embedded dialer demonstrates the customer-call workflow. Phone audio itself is simulated in this prototype. The resulting transcript is sent to a server-side summarizer:

- live Gemini when configured,
- deterministic JavaScript fallback otherwise.

Only transcript-supported facts may update:

- issue context,
- priority,
- job status when the customer's intent is explicit,
- next action,
- next follow-up,
- activity history.

It never invents price, diagnosis, technician availability or appointment promises.

## Deliberately out of scope

- invoicing and accounting,
- route optimization,
- inventory,
- delivery/service milestone tracking,
- a separate customer CRM,
- a separate operations console,
- a separate technician scheduler.

Those may become later products only if customer discovery justifies them.

## Run

Requires Node.js 18+.

### Windows
Double-click `start.bat`.

### macOS / Linux
```bash
chmod +x start.sh
./start.sh
```

Or:
```bash
npm start
```

The server starts on `http://localhost:3000`. If that port is occupied it tries the next available port.

## Validate before the demo

```bash
npm test
```

The smoke test checks the one-screen scope, embedded dialer/transcript summarization, job-state workflow, automated website/SMS intake, duplicate protection, email parsing and IMAP/SMTP connector architecture.

See `DEMO_SCRIPT.md`, `FDE_ARCHITECTURE.md` and `INTEGRATIONS.md` before the interview.
