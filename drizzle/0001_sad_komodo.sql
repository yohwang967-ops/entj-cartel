CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`member` text NOT NULL,
	`group_id` text NOT NULL,
	FOREIGN KEY (`member`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `club_items` (
	`id` text PRIMARY KEY NOT NULL,
	`author` text NOT NULL,
	`kind` text NOT NULL,
	`topic` text NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`author`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
