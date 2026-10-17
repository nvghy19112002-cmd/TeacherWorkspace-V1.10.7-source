# M5 — Exam Builder

A real matrix editor selects approved, undeleted questions by curriculum node, level
and question type. Up to 40 cells / 200 questions, deterministic seeded selection,
integer hundredths for points, explicit requested/available/selected/shortage counts.
Augmenting-path matching handles overlapping cells; UUIDs and exact canonical sources
cannot repeat in one paper. No automatic relaxation of the teacher's constraints.

Preview shows the actual selected sources, math, answer and native TeX compile action.
Saving recomputes the selection and refuses stale/insufficient previews. The transaction
stores exact question snapshots, points, matrix specification and seed, then increments
usage and locks question IDs. Later edits to the bank do not change the saved exam.
Saved matrices can be reused and drafts survive reopening. Unsaved drafts guard routing.
History is paginated; export produces ex_test source and answer comments from snapshots,
including points. It is source for an existing TeX project, requiring that project's
preamble and external files; it does not pretend to be a universally standalone PDF.

New migration 004 adds exams.matrix_json with an empty legacy default. Old migrations,
question identifiers and raw sources are unchanged. Browser and native codecs agree.

Validation: npm run check passed with 250 unit tests / 32 files, 14 release tests,
lint, TypeScript and production build. Five isolated native SQLite tests passed on
the unchanged database logic. Five new unit tests cover overlapping pools, shortages,
duplicate imports, stale snapshots, v3→v4 backup and reopen. Playwright passed the
full create/shortage/save/reopen/export-after-edit flow and dark 1024px layout; both
light/dark screenshots were visually reviewed. Complete Windows validation remains
the responsibility of the Windows workflow; Linux core tests do not establish it.
