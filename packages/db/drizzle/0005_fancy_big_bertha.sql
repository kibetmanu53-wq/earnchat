ALTER TABLE "auth_tokens" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DELETE FROM "auth_tokens" WHERE "type" = 'verify_email';--> statement-breakpoint
DROP TYPE "public"."auth_token_type";--> statement-breakpoint
CREATE TYPE "public"."auth_token_type" AS ENUM('reset_password');--> statement-breakpoint
ALTER TABLE "auth_tokens" ALTER COLUMN "type" SET DATA TYPE "public"."auth_token_type" USING "type"::"public"."auth_token_type";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "email_verified_at";