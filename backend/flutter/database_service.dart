import 'package:cloud_firestore/cloud_firestore.dart';

class DatabaseService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  // --- MEDICINES INVENTORY ---

  /// Stream list of active medicines for the patient
  Stream<QuerySnapshot<Map<String, dynamic>>> streamMedicines(String patientId) {
    return _db
        .collection('medicines')
        .where('userId', '==', patientId)
        .snapshots();
  }

  /// Add new medicine prescription
  Future<void> addMedicine({
    required String patientId,
    required String medicineName,
    required int compartmentNumber,
    required String scheduledTime, // "HH:MM" format
  }) async {
    final docRef = _db.collection('medicines').doc();
    await docRef.set({
      'medicineId': docRef.id,
      'userId': patientId,
      'medicineName': medicineName,
      'compartmentNumber': compartmentNumber,
      'scheduledTime': scheduledTime,
      'enabled': true,
      'createdAt': DateTime.now().toIso8601String(),
    });
  }

  /// Toggle medicine alert activation status
  Future<void> toggleMedicineEnabled(String medicineId, bool enabled) async {
    await _db.collection('medicines').doc(medicineId).update({
      'enabled': enabled,
    });
  }

  /// Remove prescription
  Future<void> deleteMedicine(String medicineId) async {
    await _db.collection('medicines').doc(medicineId).delete();
  }

  // --- ADHERENCE LOGS ---

  /// Stream patient logs
  Stream<QuerySnapshot<Map<String, dynamic>>> streamLogs(String patientId) {
    return _db
        .collection('medicine_logs')
        .where('userId', '==', patientId)
        .orderBy('scheduledTime', descending: true)
        .snapshots();
  }

  /// Mark log taken manually (from mobile app bypass)
  Future<void> markTakenManually(String logId, String userId, String medicineId, String medicineName) async {
    final nowStr = DateTime.now().toIso8601String();
    await _db.collection('medicine_logs').doc(logId).set({
      'logId': logId,
      'userId': userId,
      'medicineId': medicineId,
      'takenTime': nowStr,
      'status': 'Taken',
    }, SetOptions(merge: true));

    // Reset alert flags in device status
    await _db.collection('device_status').doc(userId).set({
      'buzzerStatus': false,
      'currentCompartment': 0,
      'lastSeen': nowStr,
    }, SetOptions(merge: true));
  }

  // --- DEVICE LIVE TELEMETRY ---

  /// Stream live box telemetry status (heartbeats, load cells, connectivity)
  Stream<DocumentSnapshot<Map<String, dynamic>>> streamDeviceStatus(String patientId) {
    return _db.collection('device_status').doc(patientId).snapshots();
  }

  // --- NOTIFICATIONS ---

  /// Stream real-time alerts
  Stream<QuerySnapshot<Map<String, dynamic>>> streamNotifications(String userId) {
    return _db
        .collection('notifications')
        .where('userId', '==', userId)
        .orderBy('timestamp', descending: true)
        .snapshots();
  }

  /// Mark single notification as read
  Future<void> markNotificationAsRead(String notificationId) async {
    await _db.collection('notifications').doc(notificationId).update({
      'read': true,
    });
  }
}
