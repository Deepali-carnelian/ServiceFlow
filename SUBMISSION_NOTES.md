# Submission Notes

## Product decision

The build follows the core discovery requirement: **show what needs attention today and where every active job stands.**

The product therefore stays one-screen-first. Broader field-service features were deliberately excluded because they increase onboarding surface without sharpening that immediate problem.

## Why there is CRM behavior without a large CRM UI

Multiple lead sources still require a canonical record and history. Email, website and SMS requests are therefore normalized behind the scenes into the same service-job model shown on the main screen.

The implementation includes:

- automatic multi-channel intake,
- idempotent duplicate protection,
- customer matching,
- conservative follow-up-to-open-job matching,
- an editable service-job record,
- activity history,
- embedded calling,
- transcript-to-job updates,
- next-action and follow-up calculation.

The operator does not have to administer separate inbox, CRM, call-center or operations-console products.

## Prototype boundaries

- The keypad/call experience is a **demo telephony workflow**; it does not place a real phone call.
- Transcript processing is a real server-side flow and works with Gemini or a deterministic fallback.
- Gmail/IMAP, website and SMS connectors are implementation-ready, but live third-party connectivity depends on credentials/environment setup.
- The submission intentionally contains no secrets.

## Future  scope

- invoicing/accounting,
- delivery milestones,
- route optimization,
- inventory,
- broad dispatch/technician management,
- separate CRM/inbox/calls navigation,
- production authentication and database infrastructure.
