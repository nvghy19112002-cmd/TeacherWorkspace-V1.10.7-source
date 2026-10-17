# M4 — Academic Desktop Studio

Shared light/dark design tokens, expandable saved navigation, saved startup screen and
keyboard/pointer resizable library/reader panels. The paginated bank renders a bounded
window of rows; selection, reading and search retain the existing question IDs.

AI classification now has a dedicated workspace alongside the existing batch dialog.
Teachers can filter low-confidence results, inspect history, export actual scan reports
and reject a proposal with a recorded reason. Rejected proposals cannot be batch-applied
or replaced silently by an older proposal. Unsaved review edits guard navigation.

Settings has eleven groups with working controls, separated key/model diagnostics,
cache controls and redacted diagnostic export. Only the existing real Gemini adapter
is presented. General settings persists the startup screen and restores layout defaults.

Validation: npm run check passed (244 unit tests before the added rejection regression,
14 release tests, lint, TypeScript, production build). Five related Playwright tests passed;
one additional layout test passed, exercising persisted rail/widths, virtual scrolling
to row 50 and the standalone AI workspace. Its screenshot was visually inspected.
The additional rejection regression is included in subsequent full checks.
