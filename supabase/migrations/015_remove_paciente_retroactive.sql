-- Remove a permissão de edição de dose em 24h para o papel de paciente
DELETE FROM public.role_permissions WHERE role = 'paciente' AND permission = 'dose.edit_own_24h';

-- A RLS hist_update_24h_window continua lá, mas o paciente falhará na checagem public.has_permission('dose.edit_own_24h')
