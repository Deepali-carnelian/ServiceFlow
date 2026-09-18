# Architecture

## Design principle

The customer-facing product stays one screen. Integration and reliability complexity sits behind it.

```text
Website form ─ webhook ─┐
SMS ────────── webhook ─┼──> Intake normalizer ──> Canonical job store ──> TODAY screen
Email ───────── IMAP ───┤         │                       │
Manual request ─────────┘         ├─ dedupe                ├─ current state
                                  ├─ Gemini/fallback       ├─ next action
                                  ├─ customer match        └─ follow-up date
                                  └─ follow-up match

TODAY screen ──> Job drawer ──> Embedded demo dialer ──> transcript
                                                       │
                                                       ▼
                                             Gemini/fallback summary
                                                       │
                                                       ▼
                                             update SAME job record
```

## Canonical job model

- customer / company / phone / email,
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

## Reliability choices

- Duplicate webhook/email/SMS delivery is idempotent by source ID.
- Explicit follow-up messages are merged into an existing open job only when the customer identity matches and there is exactly one candidate open job; ambiguous cases create a new record instead of guessing.
- Gemini unavailable or invalid → deterministic JavaScript fallback.
- Lower-confidence but plausible service request → visible as `New` with a review next action.
- Email not configured → website/SMS/manual paths remain usable.
- Port 3000 occupied → server tries subsequent ports.

## Call-transcript behavior

The keypad/dialer is embedded in the job. Telephone audio is simulated for the prototype; transcript processing is a real server endpoint. Transcript analysis cannot silently mark work complete, move a job backward, or invent a price, diagnosis, technician availability or appointment.

## Production hardening

A production deployment would add authentication/authorization, a transactional database, secrets management, verified Twilio signatures, durable background queues, observability and a real telephony provider. Those are deployment concerns rather than additional customer-facing modules.
