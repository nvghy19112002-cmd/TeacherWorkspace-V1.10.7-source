-- FTS4 is supported by both the shipped sql.js WASM and bundled native SQLite.
-- This index is derived; original question sources and the shipped migrations remain unchanged.
CREATE VIRTUAL TABLE question_search USING fts4(content, tokenize=unicode61 'remove_diacritics=2');
INSERT INTO question_search(docid, content)
SELECT rowid, replace(replace(raw_source || ' ' || answer || ' ' || solution || ' ' || source || ' ' || tags || ' ' || coalesce(display_id, '') || ' ' || classification_code, 'đ', 'd'), 'Đ', 'D') FROM questions;
CREATE TRIGGER question_search_insert AFTER INSERT ON questions BEGIN
  INSERT INTO question_search(docid, content) VALUES (NEW.rowid, replace(replace(NEW.raw_source || ' ' || NEW.answer || ' ' || NEW.solution || ' ' || NEW.source || ' ' || NEW.tags || ' ' || coalesce(NEW.display_id, '') || ' ' || NEW.classification_code, 'đ', 'd'), 'Đ', 'D'));
END;
CREATE TRIGGER question_search_delete AFTER DELETE ON questions BEGIN
  DELETE FROM question_search WHERE docid = OLD.rowid;
END;
CREATE TRIGGER question_search_update AFTER UPDATE OF raw_source, answer, solution, source, tags, display_id, classification_code ON questions BEGIN
  DELETE FROM question_search WHERE docid = OLD.rowid;
  INSERT INTO question_search(docid, content) VALUES (NEW.rowid, replace(replace(NEW.raw_source || ' ' || NEW.answer || ' ' || NEW.solution || ' ' || NEW.source || ' ' || NEW.tags || ' ' || coalesce(NEW.display_id, '') || ' ' || NEW.classification_code, 'đ', 'd'), 'Đ', 'D'));
END;
CREATE INDEX idx_questions_active_updated ON questions(deleted_at, updated_at DESC, id);
CREATE INDEX idx_questions_active_source ON questions(deleted_at, source, id);
-- JSON question tags remain the compatibility source; normalized definitions/links are synchronized.
INSERT OR IGNORE INTO question_tags(id, name, color, created_at)
SELECT lower(hex(randomblob(16))), j.value, '', q.created_at FROM questions q, json_each(q.tags) j;
INSERT OR IGNORE INTO question_tag_links(question_id, tag_id)
SELECT q.id, t.id FROM questions q, json_each(q.tags) j JOIN question_tags t ON t.name=j.value;
CREATE TRIGGER question_tag_links_insert AFTER INSERT ON questions BEGIN
  INSERT OR IGNORE INTO question_tag_links(question_id, tag_id) SELECT NEW.id, t.id FROM json_each(NEW.tags) j JOIN question_tags t ON t.name=j.value;
END;
CREATE TRIGGER question_tag_links_update AFTER UPDATE OF tags ON questions BEGIN
  DELETE FROM question_tag_links WHERE question_id=NEW.id;
  INSERT OR IGNORE INTO question_tag_links(question_id, tag_id) SELECT NEW.id, t.id FROM json_each(NEW.tags) j JOIN question_tags t ON t.name=j.value;
END;
CREATE TRIGGER question_tag_definition_insert AFTER INSERT ON question_tags BEGIN
  INSERT OR IGNORE INTO question_tag_links(question_id, tag_id) SELECT q.id, NEW.id FROM questions q, json_each(q.tags) j WHERE j.value=NEW.name;
END;
CREATE TRIGGER question_tag_definition_update AFTER UPDATE OF name ON question_tags BEGIN
  DELETE FROM question_tag_links WHERE tag_id=NEW.id;
  INSERT OR IGNORE INTO question_tag_links(question_id, tag_id) SELECT q.id, NEW.id FROM questions q, json_each(q.tags) j WHERE j.value=NEW.name;
END;
