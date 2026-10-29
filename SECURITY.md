# Security policy

Aayam is open source under AGPL-3.0. Please report a vulnerability in private so students and faculty are not put at risk while it is fixed.

## Report a vulnerability

Open a private advisory: [github.com/Kv-404/Aayam/security/advisories/new](https://github.com/Kv-404/Aayam/security/advisories/new)

Do not file a public GitHub issue, and do not post the details in a pull request. Include what you found, how to reproduce it, and the effect. Leave out live PINs, session tokens, database URLs, and other secrets.

## In scope

- Faculty sign-in and session handling
- Student batch PIN verification
- Anything that exposes a secret, another batch, or another teacher's view
- A parser or sync bug that shows the wrong cohort's classes as if they were authorised

## Out of scope

- The timetable sheet itself. It is a public Google Sheet shared for viewing.
- Missing rate limits on a page that does not expose private data
- Issues in a modified copy you host yourself

## Response

The maintainer will acknowledge a report and follow up with a fix or a reason it is not a vulnerability. Please give a reasonable window before any public write-up.
