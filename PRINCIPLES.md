# Universal Build Principles — James Hallonquist

Last updated: 2026-04-27

These principles apply across all projects, not just the CRM. They reflect recurring feedback patterns and how James wants software built.

---

## 1. Search Autocomplete is the Default for Person Fields
Any field that references a person should be a live search dropdown, not a plain text input. If it could reference existing data, it should pull from existing data.

## 2. Smart Defaults, Always Overridable
Pre-fill obvious defaults (logged-in user, today's date, last selection) — but never lock a field. The user should always be able to override without friction.

## 3. Language Reflects Culture, Not Tech
Terminology is intentional and mirrors how the organization actually speaks. Never use developer/platform language in the UI. When naming something new, match the ministry/business vocabulary or ask first.

## 4. Every Outbound Email Gets the Brand Treatment
No platform default emails. Every email should have: a branded header, a personal greeting with the recipient's name, a clear action button, a link to the live site, and a clean footer. Show a draft for approval before deploying any new email template.

## 5. Show Drafts for Visual Changes Before Deploying
For any significant UI, email template, or new page — render a preview and get approval first. It saves a round trip and keeps surprises out of production.

## 6. Small Copy Changes Ship Immediately
One-line label or wording changes need no confirmation — just do it and deploy. The pattern is: short direct instruction → done in one shot.

## 7. Lists and Filters Should Cover All Dimensions Upfront
When building any list view, think through every dimension a user might want to slice by and build them all in — don't make them ask for each filter one at a time.

## 8. Auth Flows Need End-to-End Infrastructure Before Anyone Logs In
User login is never just "turn on auth." Before a real person touches the app, four things must exist:
1. A production Site URL set in the auth platform — never localhost
2. An `/auth/callback` route that exchanges tokens for sessions
3. A set-password page so invited users can actually create credentials
4. A "Forgot password" link on the login page so users can self-serve without admin intervention

Invite emails and reset emails are different flows — a user who already exists can't be re-invited, they need a reset. Test the full login journey end-to-end before handing access to anyone.
