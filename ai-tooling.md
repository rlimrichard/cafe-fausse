# AI Tooling Used in Café Fausse

## Overview

AI-assisted development was used throughout the full lifecycle of this project —
from initial scaffolding to production deployment. The developer defined the
product requirements, made all design decisions, reviewed every change, and
performed final validation. AI handled the translation of those decisions into
working code, configuration, and documentation.

---

## Tools Used

### Claude Code (Anthropic) — Richard Lim

**Model:** Claude Sonnet 4.6, accessed via the Claude Code CLI.

Claude Code was used as the primary development tool for this project. It
operates directly inside the project directory, reads and writes files, runs
shell commands, and maintains context across a full session.

#### What it was used for

- **Full-stack scaffolding** — generating the initial project structure, Vite
  config, Flask app skeleton, PostgreSQL schema, and all seed content from the
  SRS specification.
- **Feature development** — implementing every page (Home, Menu, Reservations,
  About, Gallery) and the full admin dashboard including bulk reservation
  management, a live log panel, a database table viewer, and visitor analytics.
- **Incremental enhancements** — adding features one at a time on request:
  email notifications for reservation accept/deny, past-date validation on the
  booking form, gallery lightbox with keyboard and arrow navigation, optional
  phone number on reservations, and the reservation lookup by email.
- **Bug fixing** — diagnosing and resolving production issues, including a blank
  page caused by `crypto.randomUUID()` not being available over plain HTTP, a
  stale Flask process not picking up `.env` changes, and nginx not serving the
  app via the server's IP address.
- **Deployment** — writing the systemd service unit, nginx configuration files
  (domain and IP), SELinux commands for Oracle Linux 9, and deploying to Oracle
  Cloud via rsync and scp since git was not installed on the server.
- **Code documentation** — adding inline comments and docstrings across the
  Flask backend and React frontend, and writing and maintaining `README.md`.

#### What worked well

**Full-stack coherence.** Holding the entire codebase in context meant that
changes spanning multiple files — a new API endpoint, its frontend integration,
and the corresponding admin UI — were implemented consistently in a single
exchange without drift between layers.

**Incremental feature building.** Requesting one feature at a time and having
it immediately integrated into existing code worked smoothly. Each change was
scoped, reviewable, and testable before moving on.

**Debugging from error output.** When production bugs appeared, Claude Code
could reason about the root cause from an error message or stack trace alone
and produce a correct fix without needing to reproduce the issue locally — for
example, identifying that `crypto.randomUUID()` is unavailable in non-secure
(HTTP) browser contexts and replacing it with a `Math.random()` fallback.

**Deployment scripting.** Generating nginx configs, systemd service files, and
OS-specific commands (SELinux, firewall rules) for an unfamiliar environment
(Oracle Linux 9 on OCI) saved significant time compared to consulting
documentation manually.

**Documentation quality.** Generated comments and docstrings were purposeful —
explaining *why* rather than restating *what* — for example, annotating that
email errors must not roll back a saved reservation, or that UUID filenames are
used for uploads to prevent path-traversal attacks.

#### What didn't work as well

**UI/UX iteration.** Visual and layout adjustments required multiple back-and-
forth exchanges because the assistant cannot see the rendered result. Describing
what was observed in the browser and iterating from there was slower than direct
visual manipulation.

**Context limits on long sessions.** The session eventually exceeded the
context window, requiring a compacted summary to continue. Some fine-grained
detail from early in the session was lost, and the follow-up session had to
re-read files to verify current state before proceeding safely.

**Verifying production state.** Claude Code can run local commands but cannot
directly observe the live server. Confirming that a deployment had taken effect,
or that the correct version of a file was running in production, required the
developer to run SSH commands manually and share the output.

**Predicting visual output.** For frontend work, the assistant produces
syntactically correct and logically sound code but cannot pre-validate how it
will render. Testing the UI — including responsive layout and edge cases —
remained entirely the developer's responsibility.

---

## Security and credential practices

No private SSH keys, database passwords, admin passwords, or SMTP credentials
are committed to the repository. All sensitive values are stored in a
server-side `.env` file excluded from git via `.gitignore`. Documentation uses
placeholders rather than real credentials.

---

## Human ownership and review

The developer remains responsible for:

- Defining product requirements and approving all code changes before they are
  committed or deployed.
- Validating restaurant content (hours, prices, contact details) against the
  SRS specification.
- Testing the running application in a browser and on mobile devices.
- Maintaining production access, credentials, backups, and security posture.
