-- Sheet links live only in D1. Seed one row per batch with the workbook it used before this
-- migration; a link an admin already saved at /admin is kept (OR IGNORE on the primary key).
INSERT OR IGNORE INTO timetable_sheet_links (course, batch, spreadsheet_id, updated_at) VALUES
  ('BTech', '2026-30', '1o_sNayHt8v4WlyZUVcmPWhyjNQ6i8ONuX2zMo5czg0w', '2026-11-20T00:00:00.000Z'),
  ('BTech', '2025-29', '1iglizdY-oldwwrpBDBy84EEYwtNhnv6mKkf9mFP8NZw', '2026-11-20T00:00:00.000Z'),
  ('BTech', '2024-28', '1AviRCKbw1dOTh4WKnCXACr4qAgr8Nr4h6EhrRxyuBvc', '2026-11-20T00:00:00.000Z'),
  ('BTech', '2023-27', '1Wy0x2Gn-maOcdN3v4xFbatDzgEHZoqaVkpY9I2ui6fc', '2026-11-20T00:00:00.000Z'),
  ('MCA', '2026-28', '1iuT7IHBJ12mnlqwKIHZ_GgtQdV8G-TOfOKiBPIwCTb0', '2026-11-20T00:00:00.000Z');
