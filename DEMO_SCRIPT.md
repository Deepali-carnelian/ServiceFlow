# Demo Script — 5 minutes

## 1. Start from Denise's words

Open ServiceFlow and stay on the main screen.

Say: **"Denise asked for one screen showing who she needs to call today and where every job is at. I kept that as the UI boundary."**

Point to the action list and active-jobs table.

## 2. Explain the multi-source intake

Point to the automatic-intake note.

Say: **"Email, website and SMS are different sources, but Denise should not manage three inboxes. I normalize them into one job model and put the result on this screen."**

If asked, explain IMAP email polling, website/SMS webhooks, source-ID dedupe and Gemini/fallback extraction.

## 3. Show the CRM behavior without a CRM module

Open an urgent job. The drawer has customer context, status, next action and history.

Say: **"This is the CRM record, but I have exposed only the information Denise needs to act."**

## 4. Demonstrate the embedded dialer

Click **Call customer**. Show the keypad and phone number, then click **Start demo call**.

Explain: **"Phone audio is simulated for this prototype; the transcript-to-job workflow is the part I implemented."**

Let the transcript populate, then choose **End call & update job**.

Show that the system summarizes the conversation and automatically updates supported fields such as status, priority, next action and follow-up. Return to the job and show the call in History.

## 5. Show a simple operational outcome

Use **Quote sent** or **Customer said yes**. ServiceFlow advances the status and follow-up without opening another module. If a job needs scheduling, record the date/time in the same drawer.

## 6. Close on the scope decision

Say: **"I kept integrations and AI behind the workflow. I did not add invoicing, route optimization, delivery tracking or a broad CRM UI because Denise did not ask for them. The technical depth reduces her manual work without increasing her software burden."**
