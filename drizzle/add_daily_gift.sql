-- Add last_daily_gift column to telegram_users
ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS last_daily_gift varchar(100) DEFAULT NULL;

-- Update transactions type enum to include daily_gift
-- Note: MySQL requires full column redefinition for enum changes
ALTER TABLE transactions MODIFY COLUMN type enum('ad','spin','withdraw','task','bonus','referral','daily_gift') NOT NULL;
