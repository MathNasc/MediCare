export type UserRole = 'cuidador' | 'paciente' | 'independente';

export interface UserSession {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
  accessToken?: string;
}

export interface PatientSummary {
  id: string;
  nome: string;
  social_name?: string;
  email?: string;
  foto_url?: string;
  blood_type?: string;
  meds_count: number;
  adherence_rate?: number;
  relationship_label?: string;
  pending_doses_count: number;
  next_appointment?: string;
}

export interface AdministrationItem {
  id: string;
  patient_id: string;
  patient_name: string;
  med_id: string;
  med_name: string;
  dosage: string;
  hora: string;
  date: string;
  status: 'pending' | 'confirmed' | 'missed' | 'late';
  performed_by_name?: string;
  is_retroactive?: boolean;
}

export interface AppointmentItem {
  id: string;
  patient_id: string;
  patient_name: string;
  type: 'consulta' | 'exame' | 'procedimento' | 'outro';
  title: string;
  date: string;
  time?: string;
  doctor?: string;
  location?: string;
}
