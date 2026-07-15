CREATE TABLE `import_account_mappings` (
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`role` text NOT NULL,
	`source_account_key` text NOT NULL,
	`account_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'localtime')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now', 'localtime')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_import_account_mappings_lookup` ON `import_account_mappings` (`user_id`,`source`,`role`,`source_account_key`);--> statement-breakpoint
CREATE INDEX `idx_import_account_mappings_account` ON `import_account_mappings` (`account_id`);--> statement-breakpoint
CREATE TABLE `import_category_mappings` (
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`item_type` text NOT NULL,
	`source_category` text NOT NULL,
	`category_id` text NOT NULL,
	`sub_category_id` text,
	`created_at` text DEFAULT (datetime('now', 'localtime')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now', 'localtime')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sub_category_id`) REFERENCES `sub_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_import_category_mappings_lookup` ON `import_category_mappings` (`user_id`,`source`,`item_type`,`source_category`);--> statement-breakpoint
CREATE INDEX `idx_import_category_mappings_category` ON `import_category_mappings` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_import_category_mappings_sub_category` ON `import_category_mappings` (`sub_category_id`);--> statement-breakpoint
CREATE TABLE `transaction_import_refs` (
	`transaction_id` text NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'localtime')) NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_transaction_import_refs_external` ON `transaction_import_refs` (`user_id`,`source`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_import_refs_transaction` ON `transaction_import_refs` (`transaction_id`);
