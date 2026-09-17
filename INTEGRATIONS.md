# Optional Automated Intake

These integrations are **supporting infrastructure**, not additional Denise-facing modules.

## Gmail / generic email — no Google Cloud project

The prototype can poll a mailbox using IMAP and optionally send a safe acknowledgement using SMTP.

For Gmail, enable 2-Step Verification and create a Google App Password. Do not use your normal Gmail password.

Copy `.env.example` to `.env` and set:

```env
EMAIL_USER=your-demo-mailbox@gmail.com
EMAIL_APP_PASSWORD=your_16_character_app_password
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
EMAIL_POLL_SECONDS=60
```

Leave `EMAIL_AUTO_ACKNOWLEDGE=false` unless you deliberately want the prototype to send a generic receipt acknowledgement.

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

When `WEBSITE_WEBHOOK_SECRET` is configured, send the same value in the `x-serviceflow-secret` header.

## SMS / Twilio-compatible webhook

Point the inbound-message webhook to:

```text
/api/integrations/twilio/sms
```

The prototype accepts Twilio-style form fields such as `MessageSid`, `From`, `To` and `Body`.

## What automation is allowed to do

It may:
- capture the request,
- extract supported customer/service details,
- identify urgent equipment-down requests,
- choose a simple next action,
- prevent duplicates,
- create the job automatically; uncertain service requests are marked for review on the same screen.

It must not invent:
- prices,
- diagnoses,
- arrival times,
- technician availability,
- completion status,
- guarantees.


## Embedded call transcript processing

The customer-facing job drawer contains the dialer. The prototype simulates the audio/conversation, then POSTs the transcript to:

```text
/api/ai/call-summary
```

With Gemini configured, the backend returns structured transcript-supported changes. Without Gemini, a deterministic JavaScript fallback keeps the demo functional. A production deployment would replace the simulated audio with a telephony provider and feed its transcript into the same endpoint.
