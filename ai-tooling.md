# AI Tooling Used in Café Fausse

## Overview

AI-assisted development was used as a collaborative implementation tool during
the evolution of Café Fausse. The project owner defined the features,
restaurant direction, and approval decisions; AI helped translate those
decisions into code, content, visual assets, testing, documentation, and
deployment steps.

## Development assistance

AI was used to help:

- Review the existing full-stack project and identify the React frontend,
  Flask API, PostgreSQL schema, and production deployment structure.
- Implement and refine public pages, including the menu, reservation flow,
  About page, Gallery, navigation, footer, and responsive styling.
- Build administrative capabilities for menu management, reservations,
  newsletter subscribers, visitor insights, database views, and an accepted
  reservation calendar.
- Improve backend behavior, including repeat-customer reservations, visitor
  tracking, email notifications, and newsletter confirmation handling.
- Produce deployment and operational documentation.

## AI-generated visual content

AI image generation was used to create restaurant-themed visual assets where
requested, including founder portraits, menu-related imagery, and a staff
group image. Supplied project images were also incorporated into the Gallery.

These visuals support the demonstration restaurant concept and should be
replaced or supplemented with licensed, authentic photography before use by a
real business.

## Quality checks and deployment support

AI assisted with routine engineering checks, such as:

- Python syntax compilation for backend changes.
- Production frontend builds with Vite.
- HTTP checks against deployed pages.
- Review of live visitor flows, including navigation, mobile layout,
  reservation behavior, and email delivery diagnostics.
- Git commits and pushes after the requested changes were validated.
- Deployment to the OCI server through the existing deployment workflow.

## Email and credential safeguards

AI helped configure application email using the restaurant Gmail account and
a Gmail App Password stored only in the protected server environment file.

No private SSH keys, Gmail App Passwords, database passwords, or admin
passwords are committed to the repository. Documentation uses placeholders
instead of real credentials, and sensitive values should continue to be
managed through protected server configuration or another approved secret
management system.

## Human ownership and review

AI suggestions and generated output require owner review. The project owner
remains responsible for:

- Choosing product requirements and approving code changes.
- Validating restaurant information, contact details, prices, availability,
  and legal/business content.
- Reviewing generated images and copy for brand suitability and licensing.
- Maintaining production access, credentials, backups, and security posture.

