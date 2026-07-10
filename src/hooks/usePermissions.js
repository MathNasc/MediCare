'use client';
// src/hooks/usePermissions.js
// Hook central de RBAC no cliente. Fornece o papel do usuário logado
// e uma função `can(permission)` para gating de UI.
// A validação definitiva sempre ocorre no Supabase (RLS + RPCs).

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { hasPermission, getRoleMeta, canEditDoseAsSelf } from '@/lib/permissions';

export function usePermissions() {
  const { user } = useApp();
  const role = user?.role || 'independente';

  return useMemo(() => ({
    role,
    roleMeta: getRoleMeta(role),
    can: (permission) => hasPermission(role, permission),
    canEditDose: (doseDateTime, performedBy) =>
      canEditDoseAsSelf(role, doseDateTime, performedBy, user?.id),
    isPatient:     role === 'paciente',
    isCaregiver:   role === 'cuidador',
    isIndependent: role === 'independente',
  }), [role, user?.id]);
}
