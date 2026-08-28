import { supabase } from '@/lib/supabase';

export async function logAuditEvent(
  businessId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes?: Record<string, any>
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('audit_logs').insert({
      business_id: businessId,
      user_id: user?.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      changes,
      ip_address: 'browser',
      user_agent: navigator.userAgent,
    });
  } catch (error) {
    console.error('Error logging audit event:', error);
  }
}
