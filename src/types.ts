export type UserRole = 'patient' | 'caregiver';

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  patientId?: string; // If role is caregiver, which patient are they watching?
  createdAt: string;
}

export interface Medicine {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  frequency: string;
  times: string[]; // ['08:00', '20:00']
  duration?: string;
  notes?: string;
  isVerified?: boolean; // For AI extracted data
  lastUpdatedBy?: string;
  lastUpdatedByName?: string;
  lastUpdatedAt?: string;
  createdAt: string;
}

export interface IntakeLog {
  id: string;
  patientId: string;
  medicineId: string;
  medicineName: string;
  status: 'taken' | 'skipped' | 'missed' | 'pending';
  scheduledTime: string; // ISO string
  confirmedTime?: string; // ISO string
  method?: 'manual' | 'iot';
}

export interface DeviceStatus {
  patientId: string;
  isBoxOpen: boolean;
  lastWeight: number;
  lastHeartbeat: string;
  batteryLevel: number;
  isFalling: boolean;
}

export interface AppState {
  user: UserProfile | null;
  medicines: Medicine[];
  logs: IntakeLog[];
  deviceStatus: DeviceStatus | null;
}
