ALTER TYPE "public"."payment_status" ADD VALUE 'cancelled' BEFORE 'initiation_failed';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider" text DEFAULT 'daraja' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "currency" text DEFAULT 'KES' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "account_reference" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_transaction_id" text;--> statement-breakpoint
CREATE INDEX "payments_provider_transaction_idx" ON "payments" USING btree ("provider","provider_transaction_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_account_reference_unique" UNIQUE("account_reference");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_provider_transaction_id_unique" UNIQUE("provider_transaction_id");