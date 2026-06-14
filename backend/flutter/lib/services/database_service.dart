import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_database/firebase_database.dart';

class DatabaseService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final FirebaseDatabase _rtdb = FirebaseDatabase.instance;

  // --- MEDICINES MANAGEMENT (Firestore) ---

  /// Stream active medicines
  Stream<QuerySnapshot<Map<String, dynamic>>> streamMedicines(String userId) {
    return _db
        .collection('medicines')
        .where('userId', '==', userId)
        .snapshots();
  }

  /// Add new medicine schedule
  Future<void> addMedicine({
    required String userId,
    required String medicineName,
    required int compartmentNumber,
    required String scheduledTime, // "HH:MM"
  }) async {
    final docRef = _db.collection('medicines').doc();
    await docRef.set({
      'medicineId': docRef.id,
      'userId': userId,
      'medicineName': medicineName,
      'compartmentNumber': compartmentNumber,
      'scheduledTime': scheduledTime,
      'enabled': true,
      'createdAt': DateTime.now().toIso8601String(),
    });
  }

  /// Toggle medicine status
  Future<void> toggleMedicineEnabled(String medicineId, bool enabled) async {
    await _db.collection('medicines').doc(medicineId).update({
      'enabled': enabled,
    });
  }

  /// Delete medicine prescription
  Future<void> deleteMedicine(String medicineId) async {
    await _db.collection('medicines').doc(medicineId).delete();
  }

  // --- ADHERENCE LOGS (Firestore) ---

  /// Stream adherence logs
  Stream<QuerySnapshot<Map<String, dynamic>>> streamLogs(String userId) {
    return _db
        .collection('medicine_logs')
        .where('userId', '==', userId)
        .orderBy('scheduledTime', descending: true)
        .snapshots();
  }

  // --- DEVICE STATUS (Firestore & Realtime Database) ---

  /// Stream Firestore device telemetry status
  Stream<DocumentSnapshot<Map<String, dynamic>>> streamDeviceStatus(String userId) {
    return _db.collection('device_status').doc(userId).snapshots();
  }

  /// Stream Realtime Database alerts and heartbeats directly (Zero Polling)
  Stream<DatabaseEvent> streamRealtimeAlerts(String deviceId) {
    return _rtdb.ref('devices/$deviceId/alerts/current').onValue;
  }

  /// Stream Realtime Database telemetry (weight sensor) directly
  Stream<DatabaseEvent> streamRealtimeTelemetry(String deviceId) {
    return _rtdb.ref('devices/$deviceId/telemetry').onValue;
  }

  /// Stream Realtime Database heartbeat
  Stream<DatabaseEvent> streamRealtimeHeartbeat(String deviceId) {
    return _rtdb.ref('devices/$deviceId/heartbeat').onValue;
  }

  /// Remotely trigger/simulate an intake check or clear alarms
  Future<void> triggerAlertClear(String deviceId) async {
    await _rtdb.ref('devices/$deviceId/alerts/current').set({
      'activeCompartment': 0,
      'buzzerActive': false,
      'lcdMessage': 'Status: Secure',
      'medicineId': '',
      'scheduledTime': ''
    });
  }

  // --- NOTIFICATIONS (Firestore) ---

  /// Stream notification alerts history
  Stream<QuerySnapshot<Map<String, dynamic>>> streamNotifications(String userId) {
    return _db
        .collection('notifications')
        .where('userId', '==', userId)
        .orderBy('timestamp', descending: true)
        .snapshots();
  }

  /// Mark notification as read
  Future<void> markNotificationAsRead(String notificationId) async {
    await _db.collection('notifications').doc(notificationId).update({
      'read': true,
    });
  }
}
