# M Practice Schema Artifacts

This folder contains two schema deliverables generated from the current codebase model layer:

1. `m-practice-v1.models.schema.json`
   - JSON Schema bundle (Draft 2020-12)
   - Mirrors current TypeScript interfaces for:
     - `Contact`
     - `ContactFilter`
     - `ContactListResponse`
     - `ServiceTemplateModel`
     - `ClientServiceEngagement`
     - `ClientDocument`
     - `CompaniesHouseProfileResponse`
     - `ClientProfile` (derived view model)

2. `m-practice-v1.postgres.sql`
   - PostgreSQL DDL migration draft
   - Normalized tables for contacts, service templates/tasks, client service engagements/tasks, and client documents
   - Optional Companies House snapshot cache table
   - Includes indexes and one annualized service value view

## Notes

- The app currently persists most data in localStorage/runtime storage during development.
- The SQL file is a migration target blueprint for production-grade relational persistence.
- If needed, the same model can be emitted as SQLite-specific DDL in a second draft.
