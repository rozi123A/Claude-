-- Tasks system migration
  CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    channel_username VARCHAR(255) NOT NULL,
    channel_id VARCHAR(100),
    type VARCHAR(20) NOT NULL DEFAULT 'channel',
    points_min INTEGER NOT NULL DEFAULT 1,
    points_max INTEGER NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_tasks (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    task_id INTEGER NOT NULL,
    points_earned INTEGER NOT NULL,
    completed_at TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE(telegram_id, task_id)
  );

  CREATE INDEX IF NOT EXISTS idx_user_tasks_tgid ON user_tasks(telegram_id);
  