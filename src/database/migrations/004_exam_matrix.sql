-- Existing exams remain valid; matrix-created exams retain their exact input specification.
ALTER TABLE exams ADD COLUMN matrix_json TEXT NOT NULL DEFAULT '';
