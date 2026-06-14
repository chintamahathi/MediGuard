import express from 'express';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import deviceRouter from './routes/device.js';

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const firebaseConfigPath = path.join(process.cwd(), '..', 'firebase-applet-config.json');

  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  } else if (fs.existsSync(firebaseConfigPath)) {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    admin.initializeApp({
      projectId: config.projectId
    });
  } else {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0074425365'
    });
  }
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount API router
app.use('/api/device', deviceRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'online', 
    timestamp: new Date().toISOString() 
  });
});

export default app;
