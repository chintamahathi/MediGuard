import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  // Stream of auth state changes
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  User? get currentAuthUser => _auth.currentUser;

  /// User Registration
  Future<UserCredential> registerWithEmailAndPassword({
    required String email,
    required String password,
    required String name,
    required String role, // 'patient' or 'caregiver'
    String? patientId,
  }) async {
    try {
      UserCredential credential = await _auth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );

      final String uid = credential.user!.uid;

      // Initialize user profile in Firestore
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

  /// Password Reset link
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
