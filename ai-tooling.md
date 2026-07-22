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


### Codex (ChatGPT 5.6 Terra) used by Moe Khan:

Richard+Claude built the 1st MVP. 
Moe+Codex collaborated itiretively leveraging a common repo in git. 

Since Codex cam in after MVP code was built -here is how it tackeled comping up to speed and started making changes:  
Review the existing full-stack project and identify the React frontend, Flask API, PostgreSQL schema, and production deployment structure.
Implement and refine public pages, including the menu, reservation flow, About page, Gallery, navigation, footer, and responsive styling.
Build administrative capabilities for menu management, reservations, newsletter subscribers, visitor insights, database views, and an accepted reservation calendar.
Improve backend behavior, including repeat-customer reservations, visitor tracking, email notifications, and newsletter confirmation handling.
Produce deployment and operational documentation.
AI-generated visual content (menu items). 
AI image generation was used to create restaurant-themed visual assets where requested, including founder portraits, menu-related imagery, and a staff group image. Supplied project images were also incorporated into the Gallery.

These visuals support the demonstration restaurant concept and should be replaced or supplemented with licensed, authentic photography before use by a real business.

Quality checks and deployment support
AI assisted with routine engineering checks, such as:

Python syntax compilation for backend changes.
Production frontend builds with Vite.
HTTP checks against deployed pages.
Review of live visitor flows, including navigation, mobile layout, reservation behavior, and email delivery diagnostics.
Git commits and pushes after the requested changes were validated.
Deployment to the OCI server through the existing deployment workflow.
Email and credential safeguards
AI helped configure application email using the restaurant Gmail account and a Gmail App Password stored only in the protected server environment file.

No private SSH keys, Gmail App Passwords, database passwords, or admin passwords are committed to the repository. Documentation uses placeholders instead of real credentials, and sensitive values should continue to be managed through protected server configuration or another approved secret management system.

Human ownership and review
AI suggestions and generated output require owner review. The project owner remains responsible for:

Choosing product requirements and approving code changes.
Validating restaurant information, contact details, prices, availability, and legal/business content.
Reviewing generated images and copy for brand suitability and licensing.
Maintaining production access, credentials, backups, and security posture.

