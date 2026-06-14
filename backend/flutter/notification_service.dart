import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_tts/flutter_tts.dart';

class NotificationService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifs = FlutterLocalNotificationsPlugin();
  final FlutterTts _tts = FlutterTts();

  /// Initialize Push Messaging & Text-to-Speech
  Future<void> initialize(String userId) async {
    // 1. Request notifications permissions (iOS/Android 13+)
    await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // 2. Subscribe to user-specific topic to receive targeted FCM alerts
    await _fcm.subscribeToTopic('user-$userId');
    print('Subscribed to FCM topic: user-$userId');

    // 3. Configure Local Notifications setup
    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const DarwinInitializationSettings iosSettings = DarwinInitializationSettings();
    const InitializationSettings initSettings =
        InitializationSettings(android: androidSettings, iOS: iosSettings);

    await _localNotifs.initialize(initSettings);

    // 4. Set up TTS language defaults
    await _tts.setLanguage('en-US');
    await _tts.setSpeechRate(0.5);

    // 5. Register foreground messaging listener
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('Foreground notification arrived: ${message.notification?.title}');
      
      // Trigger local popup alert banner
      _showLocalNotification(message);

      // Trigger Text-to-Speech voice reminders based on payload details
      _triggerVoiceSynthesis(message);
    });
  }

  /// Trigger local popup alert banner
  Future<void> _showLocalNotification(RemoteMessage message) async {
    const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
      'medsync_reminder_channel',
      'MedSync Reminders',
      channelDescription: 'Alerts and triggers for smart medicine compartments',
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
    );
    const DarwinNotificationDetails iosDetails = DarwinNotificationDetails();
    const NotificationDetails platformDetails =
        NotificationDetails(android: androidDetails, iOS: iosDetails);

    await _localNotifs.show(
      message.hashCode,
      message.notification?.title ?? 'MedSync Alert',
      message.notification?.body ?? '',
      platformDetails,
    );
  }

  /// Trigger Text-to-Speech voice reminders based on notification payload titles
  Future<void> _triggerVoiceSynthesis(RemoteMessage message) async {
    final title = message.notification?.title ?? '';

    if (title.contains('Reminder')) {
      // Speak reminder prompt
      await _tts.speak('Please take your medicine.');
    } else if (title.contains('Taken')) {
      // Speak confirmation prompt
      await _tts.speak('Medicine successfully taken.');
    } else if (title.contains('Missed')) {
      // Speak missed dose prompt
      await _tts.speak('You missed your scheduled medicine.');
    }
  }

  /// Clean up subscriptions on user logout
  Future<void> unsubscribe(String userId) async {
    await _fcm.unsubscribeFromTopic('user-$userId');
    print('Unsubscribed from FCM topic: user-$userId');
  }
}
