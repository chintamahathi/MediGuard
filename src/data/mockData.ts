import { subDays, format, subHours } from 'date-fns';

const patient1Id = 'mock_patient_1';
const patient2Id = 'mock_patient_2';

export const MOCK_DATA = {
  users: [
    { id: patient1Id, name: 'John Doe', email: 'john@example.com', role: 'patient' },
    { id: patient2Id, name: 'Jane Smith', email: 'jane@example.com', role: 'patient' },
    { id: 'mock_caregiver_1', name: 'Sarah Wilson', email: 'sarah@example.com', role: 'caregiver', patientId: patient1Id }
  ],
  medicines: [
    { id: 'med_1', patientId: patient1Id, name: 'Atorvastatin', dosage: '20mg', times: ['08:00', '20:00'], frequency: 'twice daily', notes: 'Cholesterol management' },
    { id: 'med_2', patientId: patient1Id, name: 'Lisinopril', dosage: '10mg', times: ['09:00'], frequency: 'once daily', notes: 'Blood pressure' },
    { id: 'med_3', patientId: patient1Id, name: 'Vitamin D3', dosage: '1000 IU', times: ['08:00'], frequency: 'once daily', notes: 'Bone health' },
    { id: 'med_4', patientId: patient2Id, name: 'Amoxicillin', dosage: '250mg', times: ['08:00', '14:00', '20:00'], frequency: 'three times daily', notes: 'Antibiotic course' },
    { id: 'med_5', patientId: patient2Id, name: 'Metformin', dosage: '500mg', times: ['09:00', '21:00'], frequency: 'twice daily', notes: 'Blood sugar' }
  ],
  generateLogs: (patientId: string, medicineList: any[]) => {
    const logs = [];
    const statuses = ['taken', 'taken', 'taken', 'missed', 'taken', 'taken']; // Realsitic bias towards taken
    
    for (let i = 0; i < 7; i++) {
        const date = subDays(new Date(), i);
        const dateStr = format(date, 'yyyy-MM-dd');
        
        medicineList.filter(m => m.patientId === patientId).forEach(med => {
            med.times.forEach((time: string) => {
                const status = statuses[Math.floor(Math.random() * statuses.length)];
                const logId = `${med.id}-${dateStr}-${time.replace(':', '')}`;
                
                logs.push({
                    id: logId,
                    patientId,
                    medicineId: med.id,
                    medicineName: med.name,
                    status,
                    scheduledTime: `${dateStr}T${time}:00`,
                    confirmedTime: status === 'taken' ? subHours(new Date(`${dateStr}T${time}:00`), -Math.random()).toISOString() : null,
                });
            });
        });
    }
    return logs;
  },
  deviceData: (patientId: string) => ({
    patientId,
    isBoxOpen: false,
    lastWeight: 42.5,
    batteryLevel: 88,
    lastSync: new Date().toISOString(),
    isFalling: false
  }),
  notifications: (patientId: string) => [
    { id: 'not_1', type: 'reminder', message: 'Time for Atorvastatin (20mg)', timestamp: subHours(new Date(), 1).toISOString() },
    { id: 'not_2', type: 'alert', message: 'Missed dose: Lisinopril yesterday', timestamp: subDays(new Date(), 1).toISOString() },
    { id: 'not_3', type: 'fall', message: 'Potential fall detected - checked and cleared', timestamp: subDays(new Date(), 2).toISOString() }
  ]
};
