CREATE TABLE `agent_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'localtime')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now', 'localtime')) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `agent_conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_agent_tasks_conversation` ON `agent_tasks` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_tasks_user_status` ON `agent_tasks` (`user_id`,`status`);