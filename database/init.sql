-- 计数器表结构与首次初始化。
-- 可重复执行：表已存在时跳过；计数记录已存在时不覆盖。
CREATE TABLE IF NOT EXISTS counter (
    id    INTEGER PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
);

INSERT INTO counter (id, value)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;
