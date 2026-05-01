CREATE TABLE `ad_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(255) NOT NULL,
	`telegram_id` bigint NOT NULL,
	`used` enum('true','false') NOT NULL DEFAULT 'false',
	`invalid` enum('true','false') NOT NULL DEFAULT 'false',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ad_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `ad_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `telegram_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegram_id` bigint NOT NULL,
	`username` varchar(255),
	`first_name` varchar(255),
	`last_name` varchar(255),
	`photo_url` text,
	`balance` bigint NOT NULL DEFAULT 0,
	`total_earned` bigint NOT NULL DEFAULT 0,
	`today_ads` int NOT NULL DEFAULT 0,
	`today_ads_date` varchar(10) DEFAULT '',
	`spins_left` int NOT NULL DEFAULT 5,
	`spins_date` varchar(10) DEFAULT '',
	`last_ad_time` timestamp,
	`completed_tasks` text,
	`referred_by` bigint,
	`referral_code` varchar(32),
	`is_banned` enum('true','false') NOT NULL DEFAULT 'false',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_users_telegram_id_unique` UNIQUE(`telegram_id`),
	CONSTRAINT `telegram_users_referral_code_unique` UNIQUE(`referral_code`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegram_id` bigint NOT NULL,
	`type` enum('ad','spin','withdraw','task','bonus','referral') NOT NULL,
	`points` bigint NOT NULL,
	`metadata` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `withdrawals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegram_id` bigint NOT NULL,
	`amount` bigint NOT NULL,
	`stars` int NOT NULL,
	`method` varchar(50) DEFAULT 'telegram_stars',
	`status` enum('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
	`processed_at` timestamp,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `withdrawals_id` PRIMARY KEY(`id`)
);
