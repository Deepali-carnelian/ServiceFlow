# Submission Notes

## Product decision

The customer-facing scope follows Denise's explicit requirement: **who needs attention today, and where does every job stand?**

The product therefore stays one-screen-first. Earlier broad field-service modules were removed because they increased onboarding surface without sharpening that need.

## Reconciling the multi-source / CRM feedback

Multiple lead sources still require CRM-like behavior, but that does not require exposing a large CRM UI. Website, email and SMS are normalized behind the scenes into the same service-job record Denise sees.

Calling is embedded in the job itself rather than exposed as another navigation module. The job drawer contains a keypad/dialer workflow. The prototype simulates phone audio, captures a transcript, summarizes it server-side and automatically updates supported job fields.

That gives the system:

- connected mailbox intake,
- website and SMS intake,
- one canonical job record,
- customer/job history,
- embedded calling,
- transcript-to-job updates,
- next-action and follow-up calculation,

without asking Denise to administer a traditional sales CRM.

## Upcoming modules

- invoicing/accounting,
- delivery milestones,
- route optimization,
- inventory,
- separate CRM/customer navigation,
- separate inbox navigation,
- separate calls navigation,
- operations-console UI.
