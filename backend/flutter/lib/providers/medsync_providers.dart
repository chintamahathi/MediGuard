import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_database/firebase_database.dart';
import '../services/auth_service.dart';
import '../services/database_service.dart';
import '../services/notification_service.dart';

// --- SERVICE PROVIDERS ---

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});

final databaseServiceProvider = Provider<DatabaseService>((ref) {
  return DatabaseService();
});

final notificationServiceProvider = Provider<NotificationService>((ref) {
  return NotificationService();
});

// --- STATE STREAM PROVIDERS ---

/// Tracks the active user session state from Firebase Auth
final authStateProvider = StreamProvider<User?>((ref) {
  final authService = ref.watch(authServiceProvider);
  return authService.authStateChanges;
});

/// Fetches the user profile document from Firestore based on the current auth UID
final userProfileProvider = StreamProvider<DocumentSnapshot<Map<String, dynamic>>?>((ref) {
  final authState = ref.watch(authStateProvider).value;
  if (authState == null) return Stream.value(null);
  
  final authService = ref.watch(authServiceProvider);
  return authService.getUserProfileStream(authState.uid);
});

/// Reactive stream of medicines for the authenticated patient or patient linked to caregiver
final medicinesStreamProvider = StreamProvider<QuerySnapshot<Map<String, dynamic>>>((ref) {
  final userProfile = ref.watch(userProfileProvider).value;
  final dbService = ref.watch(databaseServiceProvider);

  if (userProfile == null || !userProfile.exists) {
    return const Stream.empty();
  }

  final data = userProfile.data()!;
  final String patientId = data['role'] == 'patient' ? data['userId'] : (data['patientId'] ?? '');

  if (patientId.isEmpty) return const Stream.empty();
  return dbService.streamMedicines(patientId);
});

/// Reactive stream of medicine logs (intakes)
final logsStreamProvider = StreamProvider<QuerySnapshot<Map<String, dynamic>>>((ref) {
  final userProfile = ref.watch(userProfileProvider).value;
  final dbService = ref.watch(databaseServiceProvider);

  if (userProfile == null || !userProfile.exists) {
    return const Stream.empty();
  }

  final data = userProfile.data()!;
  final String patientId = data['role'] == 'patient' ? data['userId'] : (data['patientId'] ?? '');

  if (patientId.isEmpty) return const Stream.empty();
  return dbService.streamLogs(patientId);
});

/// Streams device status telemetry from Firestore
final deviceStatusStreamProvider = StreamProvider<DocumentSnapshot<Map<String, dynamic>>>((ref) {
  final userProfile = ref.watch(userProfileProvider).value;
  final dbService = ref.watch(databaseServiceProvider);

  if (userProfile == null || !userProfile.exists) {
    return const Stream.empty();
  }

  final data = userProfile.data()!;
  final String patientId = data['role'] == 'patient' ? data['userId'] : (data['patientId'] ?? '');

  if (patientId.isEmpty) return const Stream.empty();
  return dbService.streamDeviceStatus(patientId);
});

/// Streams realtime device alert states directly from Firebase Realtime Database
final realtimeAlertsStreamProvider = StreamProvider.family<DatabaseEvent, String>((ref, deviceId) {
  final dbService = ref.watch(databaseServiceProvider);
  return dbService.streamRealtimeAlerts(deviceId);
});

/// Streams realtime device heartbeats directly from Firebase Realtime Database
final realtimeHeartbeatStreamProvider = StreamProvider.family<DatabaseEvent, String>((ref, deviceId) {
  final dbService = ref.watch(databaseServiceProvider);
  return dbService.streamRealtimeHeartbeat(deviceId);
});

/// Streams notifications history logs
final notificationsStreamProvider = StreamProvider<QuerySnapshot<Map<String, dynamic>>>((ref) {
  final authState = ref.watch(authStateProvider).value;
  final dbService = ref.watch(databaseServiceProvider);

  if (authState == null) return const Stream.empty();
  return dbService.streamNotifications(authState.uid);
});
