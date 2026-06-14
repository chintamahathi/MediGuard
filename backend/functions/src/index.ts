import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onValueWritten } from 'firebase-functions/v2/database';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const rtdb = admin.database();

/**
 * 1. pushNotificationService
 * Triggers when a new document is added to /notifications in Firestore.
 * Dispatches FCM push notifications in real time.
 */
export const pushNotificationService = onDocumentCreated('notifications/{notificationId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const { userId, title, message } = data;
  const payload = {
    notification: {
      title: title,
      body: message,
    },
    topic: `user-${userId}`,
  };

  try {
    await admin.messaging().send(payload);
    console.log(`[FCM] Notification successfully sent to user-${userId}`);
  } catch (err) {
    console.error(`[FCM] Error dispatching push to user-${userId}:`, err);
  }
});

/**
 * Helper: Log notifications to history database
 */
async function triggerNotification(userId: string, title: string, message: string) {
  const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  await db.collection('notifications').doc(notificationId).set({
    notificationId,
    userId,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
  });
}

/**
 * 2. scheduleReminder
 * Cron checker running every minute. Queries schedules and pushes real-time alert data directly
 * to the ESP32 via Firebase Realtime Database.
 */
export const scheduleReminder = onSchedule('every 1 minutes', async (event) => {
  const now = new Date();
  
  try {
    const usersSnap = await db.collection('users').get();

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;

      // Sync timezone offsets
      const tzOffset = userData.timezoneOffset ?? 0; // minutes
      const localTime = new Date(now.getTime() + tzOffset * 60000);
      const localHHMM = `${localTime.getUTCHours().toString().padStart(2, '0')}:${localTime.getUTCMinutes().toString().padStart(2, '0')}`;
      const todayStr = localTime.toISOString().split('T')[0];

      // Retrieve device linked to user
      const devSnap = await db.collection('devices').where('userId', '==', userId).limit(1).get();
      if (devSnap.empty) continue;
      
      const deviceId = devSnap.docs[0].id;

      // Query active medicines
      const medsSnap = await db.collection('medicines')
        .where('userId', '==', userId)
        .where('enabled', '==', true)
        .get();

      for (const medDoc of medsSnap.docs) {
        const medData = medDoc.data();
        const medicineId = medDoc.id;
        const compNo = medData.compartmentNumber;
        const scheduledTimeStr = medData.scheduledTime; // "HH:MM"

        if (localHHMM === scheduledTimeStr) {
          const logId = `${medicineId}-${todayStr}`;
          const logRef = db.collection('medicine_logs').doc(logId);
          const logSnap = await logRef.get();

          if (!logSnap.exists) {
            // Log pending state
            await logRef.set({
              logId,
              userId,
              medicineId,
              scheduledTime: `${todayStr}T${scheduledTimeStr}:00`,
              takenTime: null,
              status: 'Pending',
            });

            // Write active alarm state directly to RTDB (ESP32 is listening in real time)
            await rtdb.ref(`devices/${deviceId}/alerts/current`).set({
              activeCompartment: compNo,
              buzzerActive: true,
              lcdMessage: `Take ${medData.medicineName}`,
              medicineId: medicineId,
              scheduledTime: `${todayStr}T${scheduledTimeStr}:00`
            });

            // Update local Firestore device_status
            await db.collection('device_status').doc(userId).set({
              userId,
              currentCompartment: compNo,
              buzzerStatus: true,
              ledStatus: [compNo === 1, compNo === 2, compNo === 3],
              lastSeen: new Date().toISOString(),
            }, { merge: true });

            // Trigger FCM reminder
            await triggerNotification(userId, 'Medicine Reminder', `Please take your medicine: ${medData.medicineName}.`);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error scanning reminder paths:', error);
  }
});

/**
 * 3. medicineTaken
 * Triggered on RTDB weight updates or logs queue writes.
 * Processes weight reduction events, logs them, and clears the alert states.
 */
export const medicineTaken = onValueWritten('devices/{deviceId}/telemetry/weight', async (event) => {
  const deviceId = event.params.deviceId;
  const currentWeight = event.data.after.val() as number;
  const prevWeight = event.data.before.val() as number;

  if (currentWeight === null || prevWeight === null) return;

  // Verify weight drop indicating pill removal (delta >= 2g)
  const delta = prevWeight - currentWeight;
  if (delta < 2.0) return;

  try {
    // 1. Fetch current active alert from RTDB
    const alertSnap = await rtdb.ref(`devices/${deviceId}/alerts/current`).get();
    if (!alertSnap.exists()) return;

    const alertData = alertSnap.val();
    const { medicineId } = alertData;

    // Retrieve userId from devices mapping
    const devDoc = await db.collection('devices').doc(deviceId).get();
    if (!devDoc.exists) return;

    const userId = devDoc.data()?.userId;
    if (!userId) return;

    const nowStr = new Date().toISOString();
    const dateToday = nowStr.split('T')[0];

    // 2. Set Firestore Log status to Taken
    const logId = `${medicineId}-${dateToday}`;
    await db.collection('medicine_logs').doc(logId).set({
      logId,
      userId,
      medicineId,
      takenTime: nowStr,
      status: 'Taken',
    }, { merge: true });

    // 3. Clear RTDB alerts immediately
    await rtdb.ref(`devices/${deviceId}/alerts/current`).set({
      activeCompartment: 0,
      buzzerActive: false,
      lcdMessage: 'Status: Secure',
      medicineId: '',
      scheduledTime: ''
    });

    // 4. Update Firestore device_status
    await db.collection('device_status').doc(userId).set({
      currentCompartment: 0,
      buzzerStatus: false,
      ledStatus: [false, false, false],
      weightValue: currentWeight,
      lastSeen: nowStr,
    }, { merge: true });

    // 5. Trigger FCM confirmation
    await triggerNotification(userId, 'Medicine Taken', 'Medicine taken successfully.');
  } catch (error) {
    console.error('[Taken Engine] Error logging intake:', error);
  }
});

/**
 * 3b. offlineLogSyncProcessor
 * Processes queued events uploaded by ESP32 once connectivity is restored.
 */
export const offlineLogSyncProcessor = onValueWritten('devices/{deviceId}/logs_queue/{eventId}', async (event) => {
  const deviceId = event.params.deviceId;
  const logEvent = event.data.after.val();

  if (!logEvent) return; // Deleted

  try {
    const devDoc = await db.collection('devices').doc(deviceId).get();
    if (!devDoc.exists) return;

    const userId = devDoc.data()?.userId;
    if (!userId) return;

    const { medicineId, timestamp } = logEvent;

    // Process queued offline intake log
    const dateStr = timestamp.split('T')[0];
    const logId = `${medicineId}-${dateStr}`;

    await db.collection('medicine_logs').doc(logId).set({
      logId,
      userId,
      medicineId,
      takenTime: timestamp,
      status: 'Taken',
    }, { merge: true });

    // Remove event from RTDB queue once successfully processed in Firestore
    await rtdb.ref(`devices/${deviceId}/logs_queue/${event.params.eventId}`).remove();

    console.log(`[Offline Sync] Logged synced log: ${logId}`);
  } catch (err) {
    console.error('[Offline Sync] Error syncing logs:', err);
  }
});

/**
 * 4. missedDoseProcessor
 * Scans Firestore pending logs. If current user local time exceeds scheduled dose time
 * by more than the configured grace threshold, flips status to "Missed" and turns off alarms.
 */
export const missedDoseProcessor = onSchedule('every 5 minutes', async (event) => {
  const now = new Date();

  try {
    const pendingLogsSnap = await db.collection('medicine_logs')
      .where('status', '==', 'Pending')
      .get();

    for (const logDoc of pendingLogsSnap.docs) {
      const logData = logDoc.data();
      const scheduledTime = new Date(logData.scheduledTime);

      const diffMins = Math.floor((now.getTime() - scheduledTime.getTime()) / 60000);

      // Verify against user grace period
      const userDoc = await db.collection('users').doc(logData.userId).get();
      const gracePeriod = userDoc.data()?.gracePeriodMinutes ?? 30;

      if (diffMins >= gracePeriod) {
        const userId = logData.userId;

        // Mark Missed in Firestore
        await logDoc.ref.update({ status: 'Missed' });

        // Clear alerts on RTDB
        const devSnap = await db.collection('devices').where('userId', '==', userId).limit(1).get();
        if (!devSnap.empty) {
          const deviceId = devSnap.docs[0].id;
          await rtdb.ref(`devices/${deviceId}/alerts/current`).set({
            activeCompartment: 0,
            buzzerActive: false,
            lcdMessage: 'Alert: Missed Dose',
            medicineId: '',
            scheduledTime: ''
          });
        }

        // Reset device status
        await db.collection('device_status').doc(userId).set({
          currentCompartment: 0,
          buzzerStatus: false,
          ledStatus: [false, false, false],
          lastSeen: new Date().toISOString(),
        }, { merge: true });

        // Trigger FCM notification
        await triggerNotification(userId, 'Missed Dose', 'You missed your scheduled medicine.');
      }
    }
  } catch (error) {
    console.error('[Missed Engine] Error processing missed log checks:', error);
  }
});

/**
 * 5. deviceOfflineDetector
 * Monitors ESP32 heartbeat logs.
 * If no heartbeat is written to RTDB /devices/{id}/heartbeat/timestamp for 2 minutes,
 * switches connection state and dispatches warning notification.
 */
export const deviceOfflineDetector = onSchedule('every 2 minutes', async (event) => {
  const now = new Date();
  
  try {
    const devicesSnap = await db.collection('devices').get();

    for (const devDoc of devicesSnap.docs) {
      const deviceId = devDoc.id;
      const userId = devDoc.data().userId;

      // Read heartbeat status from RTDB
      const heartbeatSnap = await rtdb.ref(`devices/${deviceId}/heartbeat`).get();
      if (!heartbeatSnap.exists()) continue;

      const heartbeat = heartbeatSnap.val();
      const lastSeen = new Date(heartbeat.timestamp);

      const diffSecs = Math.floor((now.getTime() - lastSeen.getTime()) / 1000);

      // Offline threshold: 2 minutes (120 seconds)
      if (diffSecs > 120 && devDoc.data().online !== false) {
        console.log(`Device offline detected: ${deviceId}. Last seen ${diffSecs}s ago.`);

        // Update online status in Firestore
        await devDoc.ref.update({ online: false });
        await db.collection('device_status').doc(userId).update({
          esp32Connected: false,
        });

        // Trigger disconnected alerts
        await triggerNotification(userId, 'Device Offline', 'MediGuard device disconnected.');
      }
    }
  } catch (error) {
    console.error('[Offline Monitor] Error executing health verification:', error);
  }
});
