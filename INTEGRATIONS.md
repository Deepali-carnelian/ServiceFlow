# Optional Automated Intake

These integrations are supporting infrastructure. The operator still works from the same service-job screen.

## Gmail / generic email — no Google Cloud project required

The prototype can poll a mailbox through IMAP and optionally send a generic acknowledgement through SMTP.

For Gmail, enable 2-Step Verification and create a Google App Password. Do not use the normal account password.

1. Copy `.env.example` to `.env`.
2. Set:

```env
EMAIL_USER=your-demo-mailbox@gmail.com
EMAIL_APP_PASSWORD=your_16_character_app_password
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
EMAIL_POLL_SECONDS=60
```

Keep `EMAIL_AUTO_ACKNOWLEDGE=false` unless you deliberately want the demo to send a generic receipt acknowledgement.

## Website form

POST JSON to:

```text
/api/integrations/website-lead
```

Example:

```json
{
  "id": "submission-123",
  "name": "Marco",
  "company": "Northside Pizza",
  "phone": "555-123-4567",
  "email": "marco@example.com",
  "message": "Our walk-in freezer is down and food is starting to thaw."
}
```

If `WEBSITE_WEBHOOK_SECRET` is configured, send the same value in the `x-serviceflow-secret` header.

## SMS / Twilio-compatible webhook

Point an inbound-message webhook to:

```text
/api/integrations/twilio/sms
```

The endpoint accepts Twilio-style form fields such as `MessageSid`, `From`, `To` and `Body`.

A local `localhost` server cannot receive public provider webhooks; use a deployment or tunnel for a live provider demo.

## Automation boundaries

Automation may:

- capture a request,
- extract supported customer/service details,
- identify urgent equipment-down requests,
- choose a simple next action,
- prevent duplicates,
- match an explicit follow-up to one unambiguous open job,
- create a new job when appropriate.

Automation must not invent:

- prices,
- diagnoses,
- arrival times,
- technician availability,
- completion status,
- guarantees.

## Embedded call transcript processing

The job drawer contains the dialer. The prototype simulates the conversation and POSTs the transcript to:

```text
/api/ai/call-summary
```

With Gemini configured, the backend returns structured transcript-supported changes. Without Gemini, deterministic JavaScript rules keep the demo functional. A production deployment would replace simulated audio with a telephony provider while keeping the same transcript-processing contract.
