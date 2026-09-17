#  Architecture

## Design principle

The customer-facing product stays one screen. Integration and reliability complexity sits behind it.

```text
Website form ─ webhook ─┐
SMS ────────── webhook ─┼──> Intake normalizer ──> Canonical job store ──> TODAY screen
Email ───────── IMAP ───┤         │                       │
Manual request ─────────┘         ├─ dedupe                ├─ current state
                                  ├─ Gemini/fallback       ├─ next action
                                  └─ customer match        └─ follow-up date

TODAY screen ──> Job drawer ──> Embedded dialer ──> transcript
                                                  │
                                                  ▼
                                        Gemini/fallback summary
                                                  │
                                                  ▼
                                        update SAME job record
```

## Canonical job model

- customer / company / phone,
- source,
- issue,
- priority,
- status,
- last contact,
- next follow-up,
- next action,
- activity history.

## Status model

`New → Waiting on Quote → Waiting on Yes → Needs Scheduling → Scheduled → Done`

## Call-transcript behavior

The dialer is embedded in the job. Phone audio is simulated for the prototype; transcript processing is an actual server endpoint. If Gemini is configured, the server asks Gemini for structured call facts. If Gemini is unavailable, deterministic JavaScript rules keep the demo functional.

The transcript may update the job only when supported by the conversation. The system does not silently mark a job done, invent a diagnosis, price, appointment or technician promise.

## Intake failure behavior

- Gemini unavailable → deterministic parser fallback.
- duplicate webhook/email/SMS → idempotent return, no second job.
- email not configured → website/SMS/manual flows still work.
- lower-confidence but plausible service request → surface it as New with a review next action.
- port 3000 occupied → try following ports.

## Production follow-ups

For production I would add authentication, a transactional database, verified Twilio signatures, secrets management, durable background jobs, observability and a real telephony provider for audio/recording/transcription. I would not add broader customer-facing modules until discovery justified them.
