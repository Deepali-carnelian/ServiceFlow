# ServiceFlow — Submission Build

ServiceFlow is a focused service follow-up CRM built around one operational need: **see what needs attention today and where every active job stands.**

The customer-facing product stays intentionally small. Multi-channel intake, AI extraction and call-transcript processing sit behind the workflow instead of becoming extra screens the operator has to manage.

## What the operator sees

One screen contains:

- **Today's action list** — due and overdue follow-ups, with urgent work surfaced first.
- **All active jobs** — current status, next action and due date.
- **Editable job drawer** — contact details, issue, notes, status, priority, follow-up and activity history.
- **Embedded Call customer flow** — keypad/dialer, simulated call transcript and transcript-to-job updates.
- **Quick request capture** — a minimal fallback for phone/referral requests entered manually.

Status model:

`New → Waiting on Quote → Waiting on Yes → Needs Scheduling → Scheduled → Done`

Deliberately not included: invoicing, accounting, route optimization, inventory, delivery tracking, a separate CRM navigation tree, a separate inbox product, or a technician-management suite.

## Multi-channel intake

Email, website forms and SMS normalize into the same job model automatically.

The inbound pipeline performs:

1. source normalization,
2. duplicate protection using source IDs,
3. Gemini extraction when configured, with deterministic JavaScript fallback,
4. urgency and next-action selection,
5. customer matching by email/phone,
6. conservative matching of explicit follow-ups to a single existing open job,
7. automatic job creation when the message represents a new request,
8. persistence to the same one-screen list.

The mailbox connector uses **IMAP/SMTP App Password authentication** and does not require a Google Cloud project.

## Calling

Click **Call customer** inside a job. The prototype demonstrates the call workflow with a keypad and a scripted demo conversation; real telephone audio is intentionally not claimed.

The transcript is sent to a server-side summarizer:

- Gemini when configured,
- deterministic JavaScript fallback otherwise.

Only transcript-supported information can update the record. The system does not invent prices, diagnoses, technician availability or appointment promises.

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

The server starts on `http://localhost:3000`. If the port is occupied, it tries the next available port.

## Optional live integrations

Copy `.env.example` to `.env` and add only the credentials you want to use. The submission ZIP contains **no secrets** and works without external credentials.

See `INTEGRATIONS.md` for Gmail/IMAP, website webhook and Twilio-compatible SMS setup.

## Validate before a demo

```bash
npm test
```

The test suite validates syntax, the focused UI contract, call-summary behavior, automated website/SMS intake, duplicate protection, follow-up matching, email parsing and IMAP/SMTP architecture.
