import { Router, Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

const router = Router();

// Middleware: Simple authorization check for ESP32 devices
const deviceAuth = (req: Request, res: Response, next: NextFunction) => {
  const deviceToken = req.headers['x-device-token'] || req.query.deviceToken;
  const expectedToken = process.env.MEDSYNC_DEVICE_TOKEN || 'MEDSYNC_SECURE_ESP32_SECRET';
  
  if (deviceToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized device token' });
  }
  next();
};

// Apply auth middleware to all device routes
router.use(deviceAuth);

/**
 * POST /api/device/heartbeat
 * Receives: { userId: string, esp32Connected: boolean, buzzerStatus: boolean, ledStatus: boolean[] }
 */
router.post('/heartbeat', async (req: Request, res: Response) => {
  const { userId, esp32Connected, buzzerStatus, ledStatus } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const db = admin.firestore();
    const deviceRef = db.collection('device_status').doc(userId);

    const updatePayload = {
      userId,
      esp32Connected: esp32Connected ?? true,
      lastSeen: new Date().toISOString(),
      buzzerStatus: buzzerStatus ?? false,
      ledStatus: ledStatus ?? [false, false, false],
    };

    await deviceRef.set(updatePayload, { merge: true });

    return res.json({ success: true, timestamp: updatePayload.lastSeen });
  } catch (error: any) {
    console.error('Heartbeat Error:', error);
    return res.status(500).json({ error: 'Internal database update failed' });
  }
});

/**
 * POST /api/device/weight
 * Receives: { userId: string, weightValue: number }
 */
router.post('/weight', async (req: Request, res: Response) => {
  const { userId, weightValue } = req.body;

  if (!userId || weightValue === undefined) {
    return res.status(400).json({ error: 'userId and weightValue are required' });
  }

  try {
    const db = admin.firestore();
    const deviceRef = db.collection('device_status').doc(userId);

    await deviceRef.set({
      weightValue,
      lastSeen: new Date().toISOString()
    }, { merge: true });

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Weight Update Error:', error);
    return res.status(500).json({ error: 'Internal database update failed' });
  }
});

/**
 * POST /api/device/medicine-taken
 * Receives: { userId: string, medicineId: string, compartmentNumber: number }
 */
router.post('/medicine-taken', async (req: Request, res: Response) => {
  const { userId, medicineId, compartmentNumber } = req.body;

  if (!userId || !medicineId || !compartmentNumber) {
    return res.status(400).json({ error: 'userId, medicineId and compartmentNumber are required' });
  }

  try {
    const db = admin.firestore();
    const nowStr = new Date().toISOString();
    const dateToday = nowStr.split('T')[0];

    // 1. Create or update the intake log status to "Taken"
    const logId = `${medicineId}-${dateToday}`;
    const logRef = db.collection('medicine_logs').doc(logId);
    
    await logRef.set({
      logId,
      userId,
      medicineId,
      takenTime: nowStr,
      status: 'Taken'
    }, { merge: true });

    // 2. Turn off LED and Buzzer status for this compartment
    const deviceRef = db.collection('device_status').doc(userId);
    const deviceSnap = await deviceRef.get();
    let ledStatus = [false, false, false];

    if (deviceSnap.exists) {
      const data = deviceSnap.data();
      if (data?.ledStatus) {
        ledStatus = [...data.ledStatus];
      }
    }
    
    // Compartments are 1-indexed (1, 2, 3) -> map to array index (0, 1, 2)
    const compartmentIdx = compartmentNumber - 1;
    if (compartmentIdx >= 0 && compartmentIdx < ledStatus.length) {
      ledStatus[compartmentIdx] = false;
    }

    await deviceRef.set({
      ledStatus,
      buzzerStatus: false,
      currentCompartment: 0,
      lastSeen: nowStr
    }, { merge: true });

    // 3. Create push notification history
    const notificationId = `notif-taken-${logId}`;
    await db.collection('notifications').doc(notificationId).set({
      notificationId,
      userId,
      title: 'Medicine Taken',
      message: `Compartment ${compartmentNumber} medicine taken successfully.`,
      timestamp: nowStr,
      read: false
    });

    // 4. Send FCM Push Notification (Mock wrapper if not configured)
    try {
      const payload = {
        notification: {
          title: 'Medicine Taken',
          body: `Compartment ${compartmentNumber} medicine taken successfully.`,
        },
        topic: `user-${userId}`
      };
      await admin.messaging().send(payload);
      console.log('FCM Notification sent successfully.');
    } catch (fcmErr) {
      console.warn('FCM not fully configured or skipped:', fcmErr);
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Medicine-taken Error:', error);
    return res.status(500).json({ error: 'Internal database update failed' });
  }
});

/**
 * GET /api/device/schedules
 * Receives: query { userId: string }
 */
router.get('/schedules', async (req: Request, res: Response) => {
  const userId = req.query.userId as string;

  if (!userId) {
    return res.status(400).json({ error: 'userId query parameter is required' });
  }

  try {
    const db = admin.firestore();
    const medsSnap = await db.collection('medicines')
      .where('userId', '==', userId)
      .where('enabled', '==', true)
      .get();

    const schedules = medsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        medicineId: doc.id,
        medicineName: data.medicineName,
        compartmentNumber: data.compartmentNumber,
        scheduledTime: data.scheduledTime,
      };
    });

    return res.json({ userId, schedules });
  } catch (error: any) {
    console.error('Fetch Schedules Error:', error);
    return res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

export default router;
