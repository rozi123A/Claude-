-- PostgreSQL fix: ensure nullable columns
ALTER TABLE telegram_users ALTER COLUMN today_ads_date DROP NOT NULL;
ALTER TABLE telegram_users ALTER COLUMN spins_date DROP NOT NULL;
ALTER TABLE telegram_users ALTER COLUMN last_ad_time DROP NOT NULL;
