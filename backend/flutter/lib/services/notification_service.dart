import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_tts/flutter_tts.dart';

class NotificationService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifs = FlutterLocalNotificationsPlugin();
  final FlutterTts _tts = FlutterTts();

  /// Initialize FCM listeners and TTS audio
  Future<void> initialize(String userId) async {
    // Request permission (iOS/Android 13+)
    await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Subscribe to unique user push topic
    await _fcm.subscribeToTopic('user-$userId');
    print('[NotificationService] Registered topic user-$userId');

    // Local notifications initialization
    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const DarwinInitializationSettings iosSettings = DarwinInitializationSettings();
    const InitializationSettings initSettings =
        InitializationSettings(android: androidSettings, iOS: iosSettings);

    await _localNotifs.initialize(initSettings);

    // Text to Speech configs
    await _tts.setLanguage('en-US');
    await _tts.setSpeechRate(0.5);

    // Listen to foreground notifications
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('[NotificationService] Foreground message: ${message.notification?.title}');
      
      // Draw banner
      _showLocalNotification(message);

      // Synthesize audio
      _triggerVoiceSynthesis(message);
    });
  }

  /// Show standard notification banner
  Future<void> _showLocalNotification(RemoteMessage message) async {
    const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
      'medsync_alert_channel',
      'MedSync Alerts',
      channelDescription: 'Real-time alert notifications for compartments and schedules',
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
    );
    const DarwinNotificationDetails iosDetails = DarwinNotificationDetails();
    const NotificationDetails platformDetails =
        NotificationDetails(android: androidDetails, iOS: iosDetails);

    await _localNotifs.show(
      message.hashCode,
      message.notification?.title ?? 'MedSync Notification',
      message.notification?.body ?? '',
      platformDetails,
    );
  }

  /// Text-to-Speech synthesis triggers based on notification title
  Future<void> _triggerVoiceSynthesis(RemoteMessage message) async {
    final title = message.notification?.title ?? '';

    if (title.contains('Reminder')) {
      await _tts.speak('Please take your medicine.');
    } else if (title.contains('Taken')) {
      await _tts.speak('Medicine successfully taken.');
    } else if (title.contains('Missed')) {
      await _tts.speak('You missed your scheduled medicine.');
    } else if (title.contains('Offline') || title.contains('disconnected')) {
      await _tts.speak('Warning, medicine box is disconnected.');
    }
  }

  /// Unsubscribe on user logout
  Future<void> unsubscribe(String userId) async {
    await _fcm.unsubscribeFromTopic('user-$userId');
    print('[NotificationService] Unsubscribed from topic user-$userId');
  }
}
