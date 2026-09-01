-- Enable RLS for all missing tables
ALTER TABLE IF EXISTS public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.health_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dose_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medication_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.custom_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.caregiver_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.caregiver_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.caregiver_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts when recreating
DROP POLICY IF EXISTS "documentos_access" ON public.documentos;
DROP POLICY IF EXISTS "fcm_tokens_access" ON public.fcm_tokens;
DROP POLICY IF EXISTS "notificacoes_access" ON public.notificacoes;
DROP POLICY IF EXISTS "notes_access" ON public.notes;
DROP POLICY IF EXISTS "health_events_access" ON public.health_events;
DROP POLICY IF EXISTS "dose_observations_access" ON public.dose_observations;
DROP POLICY IF EXISTS "medication_catalog_access" ON public.medication_catalog;
DROP POLICY IF EXISTS "custom_medications_access" ON public.custom_medications;
DROP POLICY IF EXISTS "caregiver_relationships_access" ON public.caregiver_relationships;
DROP POLICY IF EXISTS "caregiver_notes_access" ON public.caregiver_notes;
DROP POLICY IF EXISTS "caregiver_audit_log_access" ON public.caregiver_audit_log;
DROP POLICY IF EXISTS "roles_access" ON public.roles;
DROP POLICY IF EXISTS "role_permissions_access" ON public.role_permissions;
DROP POLICY IF EXISTS "audit_logs_access" ON public.audit_logs;
DROP POLICY IF EXISTS "stock_movements_access" ON public.stock_movements;
DROP POLICY IF EXISTS "notification_logs_access" ON public.notification_logs;

-- Re-create policies for each

-- Tables with `user_id` and caregiver access
CREATE POLICY "documentos_access" ON public.documentos FOR ALL TO authenticated USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM cuidadores WHERE cuidador_id = auth.uid() AND paciente_id = documentos.user_id AND status = 'ativo')
);
CREATE POLICY "fcm_tokens_access" ON public.fcm_tokens FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notificacoes_access" ON public.notificacoes FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "notes_access" ON public.notes FOR ALL TO authenticated USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM cuidadores WHERE cuidador_id = auth.uid() AND paciente_id = notes.user_id AND status = 'ativo')
);

CREATE POLICY "health_events_access" ON public.health_events FOR ALL TO authenticated USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM cuidadores WHERE cuidador_id = auth.uid() AND paciente_id = health_events.user_id AND status = 'ativo')
);

CREATE POLICY "dose_observations_access" ON public.dose_observations FOR ALL TO authenticated USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM cuidadores WHERE cuidador_id = auth.uid() AND paciente_id = dose_observations.user_id AND status = 'ativo')
);

-- Catalog is public to read for authenticated users
CREATE POLICY "medication_catalog_access" ON public.medication_catalog FOR SELECT TO authenticated USING (true);

-- Custom meds
CREATE POLICY "custom_medications_access" ON public.custom_medications FOR ALL TO authenticated USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM cuidadores WHERE cuidador_id = auth.uid() AND paciente_id = custom_medications.user_id AND status = 'ativo')
);

-- Caregiver Relationships
CREATE POLICY "caregiver_relationships_access" ON public.caregiver_relationships FOR ALL TO authenticated USING (
    auth.uid() = patient_id OR auth.uid() = caregiver_id
);

-- Caregiver Notes
CREATE POLICY "caregiver_notes_access" ON public.caregiver_notes FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM caregiver_relationships WHERE id = relationship_id AND (patient_id = auth.uid() OR caregiver_id = auth.uid()))
);

-- Caregiver Audit Log
CREATE POLICY "caregiver_audit_log_access" ON public.caregiver_audit_log FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM caregiver_relationships WHERE id = relationship_id AND (patient_id = auth.uid() OR caregiver_id = auth.uid()))
);

-- Roles and Permissions (read-only for authenticated)
CREATE POLICY "roles_access" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_access" ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- Audit Logs (patient_id)
CREATE POLICY "audit_logs_access" ON public.audit_logs FOR ALL TO authenticated USING (
    auth.uid() = patient_id OR EXISTS (SELECT 1 FROM cuidadores WHERE cuidador_id = auth.uid() AND paciente_id = audit_logs.patient_id AND status = 'ativo')
);

-- Stock Movements (join with medicamentos)
CREATE POLICY "stock_movements_access" ON public.stock_movements FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM medicamentos m 
        WHERE m.id = medication_id 
        AND (m.user_id = auth.uid() OR EXISTS (SELECT 1 FROM cuidadores WHERE cuidador_id = auth.uid() AND paciente_id = m.user_id AND status = 'ativo'))
    )
);

-- Notification Logs (user_id)
CREATE POLICY "notification_logs_access" ON public.notification_logs FOR ALL TO authenticated USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM cuidadores WHERE cuidador_id = auth.uid() AND paciente_id = notification_logs.user_id AND status = 'ativo')
);

