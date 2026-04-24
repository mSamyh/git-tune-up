import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export type AuditAction =
  | "request_status_change"
  | "request_delete"
  | "donor_role_grant"
  | "donor_role_revoke"
  | "voucher_delete"
  | "merchant_create"
  | "merchant_delete"
  | "hospital_create"
  | "hospital_delete"
  | "donation_delete"
  | "settings_update";

export type AuditEntity =
  | "blood_request"
  | "user_role"
  | "voucher"
  | "merchant"
  | "hospital"
  | "donation"
  | "settings";

interface LogParams {
  action: AuditAction;
  entityType: AuditEntity;
  entityId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append an entry to the admin audit log.
 * Silent on error — audit logging must never break the user flow.
 */
export const auditLog = async ({
  action,
  entityType,
  entityId,
  before,
  after,
  metadata,
}: LogParams): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("admin_audit_log").insert([{
      actor_user_id: user.id,
      actor_email: user.email,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      before_data: (before ?? null) as never,
      after_data: (after ?? null) as never,
      metadata: (metadata ?? null) as never,
    }]);
  } catch (err) {
    logger.error("[audit] failed to write audit log", err);
  }
};
