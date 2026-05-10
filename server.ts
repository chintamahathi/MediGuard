import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));

// Initialize Firebase Admin
// In AI Studio environment, for the default database, we use the firestoreDatabaseId from config
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

// Access the specific database
const db = admin.firestore();
// Use the specific database ID if it's not "(default)"
const firestore = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
  ? (admin as any).firestore(firebaseConfig.firestoreDatabaseId)
  : db;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- IoT API ENDPOINTS ---

  /**
   * Hardware updates status
   * POST /api/iot/status
   */
  app.post("/api/iot/status", async (req, res) => {
    const { patientId, isBoxOpen, lastWeight, batteryLevel, isFalling } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: "patientId is required" });
    }

    try {
      const deviceRef = firestore.collection("deviceStatus").doc(patientId);
      const snap = await deviceRef.get();
      const prevStatus = snap.exists ? snap.data() : null;

      const newStatus = {
        patientId,
        isBoxOpen: isBoxOpen ?? prevStatus?.isBoxOpen ?? false,
        lastWeight: lastWeight ?? prevStatus?.lastWeight ?? 0,
        batteryLevel: batteryLevel ?? prevStatus?.batteryLevel ?? 100,
        isFalling: isFalling ?? prevStatus?.isFalling ?? false,
        lastHeartbeat: new Date().toISOString(),
        status: 'connected'
      };

      await deviceRef.set(newStatus, { merge: true });

      // --- LOGIC: STOCK MONITORING (Refill Alert) ---
      // Threshold: 2.0g (approx 4-5 tablets)
      if (lastWeight !== undefined && lastWeight < 2.0 && (prevStatus?.lastWeight >= 2.0 || !prevStatus)) {
        const notifId = `refill-${patientId}-${Date.now()}`;
        await firestore.collection("notifications").doc(notifId).set({
          id: notifId,
          patientId,
          type: 'warning',
          message: "Medicine stock low (threshold < 2g). Refill required.",
          timestamp: new Date().toISOString()
        });
      }

      // --- LOGIC: MEDICATION INTAKE (Detection) ---
      if (isBoxOpen === true && prevStatus?.isBoxOpen === false) {
        console.log(`[IoT] Box opened for ${patientId}. Checking schedule...`);
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        const medsSnap = await firestore.collection("medicines")
          .where("patientId", "==", patientId)
          .get();
        
        const meds = medsSnap.docs.map(d => d.data());
        
        for (const med of meds) {
          for (const time of med.times) {
            const scheduledTimeStr = `${todayStr}T${time}:00`;
            const scheduledTime = new Date(scheduledTimeStr);
            const diffMinutes = Math.abs(now.getTime() - scheduledTime.getTime()) / (1000 * 60);
            
            if (diffMinutes <= 120) { // 2 hour window
              const logId = `${med.id}-${todayStr}-${time.replace(':', '')}`;
              const logSnap = await firestore.collection("logs").doc(logId).get();
              
              if (!logSnap.exists || logSnap.data()?.status !== 'taken') {
                await firestore.collection("logs").doc(logId).set({
                  id: logId,
                  patientId,
                  medicineId: med.id,
                  medicineName: med.name,
                  status: 'taken',
                  scheduledTime: scheduledTimeStr,
                  confirmedTime: now.toISOString(),
                  method: 'iot',
                  weightDelta: (prevStatus?.lastWeight || 0) - lastWeight
                });

                await firestore.collection("notifications").doc(`notif-${logId}`).set({
                  id: `notif-${logId}`,
                  patientId,
                  type: 'success',
                  message: `Intake confirmed: ${med.name}.`,
                  timestamp: now.toISOString()
                });
                break;
              }
            }
          }
        }
      }

      // --- LOGIC: FALL DETECTION ---
      if (isFalling === true && prevStatus?.isFalling !== true) {
        const notifId = `emg-${patientId}-${Date.now()}`;
        await firestore.collection("notifications").doc(notifId).set({
          id: notifId,
          patientId,
          type: 'error',
          message: `URGENT: Fall detected! Emergency contact notified.`,
          timestamp: new Date().toISOString(),
          isEmergency: true
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("IoT API Error:", error);
      res.status(500).json({ error: "Internal sensor sync failure" });
    }
  });

  /**
   * Fetch device configuration and schedule for hardware
   * GET /api/iot/config/:patientId
   */
  app.get("/api/iot/config/:patientId", async (req, res) => {
    const { patientId } = req.params;
    try {
      const medsSnap = await firestore.collection("medicines")
        .where("patientId", "==", patientId)
        .get();
      
      const meds = medsSnap.docs.map(d => ({
        name: d.data().name,
        dosage: d.data().dosage,
        times: d.data().times
      }));

      res.json({
        patientId,
        medicines: meds,
        serverTime: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] MediGuard Smart Backend running on http://localhost:${PORT}`);
  });
}

startServer();
