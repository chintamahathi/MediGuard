import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  // Stream checking authentication state changes
  Stream<User?> get userStateStream => _auth.authStateChanges();

  // Get current auth user
  User? get currentAuthUser => _auth.currentUser;

  /// Register User (Patient/Caregiver)
  Future<UserCredential> registerWithEmailAndPassword({
    required String email,
    required String password,
    required String name,
    required String role, // 'patient' or 'caregiver'
    String? patientId,    // Link to watch (if role is caregiver)
  }) async {
    try {
      // 1. Create credential in Firebase Auth
      UserCredential credential = await _auth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );

      final String uid = credential.user!.uid;

      // 2. Create User profile record in Firestore
      await _db.collection('users').doc(uid).set({
        'userId': uid,
        'name': name,
        'email': email,
        'role': role,
        'patientId': role == 'caregiver' ? patientId : null,
        'createdAt': DateTime.now().toIso8601String(),
      });

      return credential;
    } catch (e) {
      print('Registration Service Error: $e');
      rethrow;
    }
  }

  /// Sign In with Email & Password
  Future<UserCredential> signInWithEmailAndPassword(
      String email, String password) async {
    try {
      return await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
    } catch (e) {
      print('Login Service Error: $e');
      rethrow;
    }
  }

  /// Password Reset Email Link
  Future<void> sendPasswordResetEmail(String email) async {
    try {
      await _auth.sendPasswordResetEmail(email: email);
    } catch (e) {
      print('Password Reset Service Error: $e');
      rethrow;
    }
  }

  /// Sign Out current session
  Future<void> signOut() async {
    try {
      await _auth.signOut();
    } catch (e) {
      print('Sign Out Service Error: $e');
      rethrow;
    }
  }

  /// Stream User Profile Document (Firestore)
  Stream<DocumentSnapshot<Map<String, dynamic>>> getUserProfileStream(String uid) {
    return _db.collection('users').doc(uid).snapshots();
  }
}
