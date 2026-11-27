ALTER TABLE "text_override" DROP CONSTRAINT "text_override_kind_check";--> statement-breakpoint
ALTER TABLE "text_preview" DROP CONSTRAINT "text_preview_kind_check";--> statement-breakpoint
ALTER TABLE "text_version" DROP CONSTRAINT "text_version_kind_check";--> statement-breakpoint
ALTER TABLE "text_override" ADD CONSTRAINT "text_override_kind_check" CHECK ("text_override"."kind" in ('landing', 'app', 'meanings', 'terms', 'privacy', 'guidelines'));--> statement-breakpoint
ALTER TABLE "text_preview" ADD CONSTRAINT "text_preview_kind_check" CHECK ("text_preview"."kind" in ('landing', 'app', 'meanings', 'terms', 'privacy', 'guidelines'));--> statement-breakpoint
ALTER TABLE "text_version" ADD CONSTRAINT "text_version_kind_check" CHECK ("text_version"."kind" in ('landing', 'app', 'meanings', 'terms', 'privacy', 'guidelines'));