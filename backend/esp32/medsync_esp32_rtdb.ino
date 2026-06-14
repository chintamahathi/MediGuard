/**
 * MedSync Real-Time Smart Medicine Box ESP32 Firmware
 * 
 * Hardware Layout:
 * - Compartment LEDs: GPIO 18, 19, 21 (Compartments 1, 2, 3)
 * - Buzzer: GPIO 22
 * - LCD 16x2 I2C: SDA=GPIO 21, SCL=GPIO 22 (Standard Wire pins or mapped)
 * - Load Cell HX711: DOUT=GPIO 23, SCK=GPIO 25
 * 
 * Libraries Required:
 * - Firebase ESP Client (Mobizt)
 * - HX711 (Bogdan Necula)
 * - LiquidCrystal_I2C (Frank de Brabander)
 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "HX711.h"
#include "LittleFS.h"
#include <time.h>

// --- HARDWARE CONFIG ---
#define LED_COMP1 18
#define LED_COMP2 19
#define LED_COMP3 26
#define BUZZER_PIN 22
#define DOUT_PIN 23
#define SCK_PIN 25

// --- WIFI & FIREBASE CONFIG ---
#define WIFI_SSID "YOUR_SSID"
#define WIFI_PASS "YOUR_WIFI_PASSWORD"
#define DATABASE_URL "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com/"
#define DATABASE_SECRET "YOUR_RTDB_DATABASE_SECRET" // For administrative auth on ESP32

#define DEVICE_ID "MEDSYNC_BOX_001"
#define FIRMWARE_VERSION "2.0.0"

// --- GLOBAL INSTANCES ---
LiquidCrystal_I2C lcd(0x27, 16, 2); // I2C address 0x27, 16 columns, 2 rows
HX711 scale;
FirebaseData fbStream;
FirebaseData fbData;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

// Scale calibration
float scale_calibration = 420.0;
float current_weight = 0.0;
float last_sent_weight = 0.0;

// Local Telemetry & Alert State
bool led_states[3] = {false, false, false};
bool buzzer_active = false;
int active_compartment = 0;
String active_medicine_id = "";
String active_scheduled_time = "";

// Timers
unsigned long last_heartbeat = 0;
unsigned long last_weight_read = 0;
unsigned long last_queue_sync = 0;
const unsigned long HEARTBEAT_INTERVAL = 30000; // 30s
const unsigned long WEIGHT_INTERVAL = 5000;      // 5s
const unsigned long QUEUE_SYNC_INTERVAL = 60000; // 60s

// Queue filename
const char* QUEUE_FILE = "/unsynced_logs.json";

void setup() {
  Serial.begin(115200);
  
  // Pins
  pinMode(LED_COMP1, OUTPUT);
  pinMode(LED_COMP2, OUTPUT);
  pinMode(LED_COMP3, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  digitalWrite(LED_COMP1, LOW);
  digitalWrite(LED_COMP2, LOW);
  digitalWrite(LED_COMP3, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  // LCD Init
  Wire.begin();
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("MedSync Active");
  lcd.setCursor(0, 1);
  lcd.print("Init WiFi...");

  // Load Cell
  scale.begin(DOUT_PIN, SCK_PIN);
  scale.set_scale(scale_calibration);
  scale.tare();

  // LittleFS Init
  if (!LittleFS.begin(true)) {
    Serial.println("LittleFS Mount Failed. Formatted.");
  }

  // Connect to Wi-Fi
  connectWiFi();

  // NTP Time configuration (Required for timestamps)
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.println("Syncing NTP Time...");
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    Serial.println("Time synced successfully.");
  }

  // Firebase Init
  fbConfig.database_url = DATABASE_URL;
  fbConfig.signer.tokens.legacy_token = DATABASE_SECRET;
  
  Firebase.reconnectWiFi(true);
  Firebase.begin(&fbConfig, &fbAuth);

  // Start Real-Time Stream Listener (No Polling)
  String streamPath = "/devices/" + String(DEVICE_ID) + "/alerts/current";
  if (!Firebase.RTDB.beginStream(&fbStream, streamPath)) {
    Serial.printf("RTDB Stream begin error: %s\n", fbStream.errorReason().c_str());
  }

  // Bind Stream Callback
  Firebase.RTDB.setStreamCallback(&fbStream, streamCallback, streamTimeoutCallback);
  
  lcd.clear();
  lcd.print("MedSync Ready");
}

void loop() {
  // Reconnection loops
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  unsigned long now = millis();

  // Read Load Cell
  current_weight = scale.get_units(5);
  if (current_weight < 0) current_weight = 0.0;

  // 1. Process local scale reads
  if (now - last_weight_read >= WEIGHT_INTERVAL) {
    last_weight_read = now;
    if (abs(current_weight - last_sent_weight) >= 1.0) {
      uploadWeight(current_weight);
      last_sent_weight = current_weight;
    }
  }

  // 2. Heartbeat Service (30s interval)
  if (now - last_heartbeat >= HEARTBEAT_INTERVAL || last_heartbeat == 0) {
    last_heartbeat = now;
    sendHeartbeat();
  }

  // 3. Sync offline queue logs (60s interval)
  if (now - last_queue_sync >= QUEUE_SYNC_INTERVAL) {
    last_queue_sync = now;
    syncOfflineQueue();
  }

  // 4. Update Alarm Output states
  updateOutputs();

  // 5. Weight Drop / Intake Event check
  if (buzzer_active && active_compartment > 0) {
    static float base_alert_weight = current_weight;
    if (base_alert_weight - current_weight >= 2.0) {
      Serial.println("Medicine removal detected via HX711!");
      triggerIntakeEvent(active_medicine_id, active_compartment);
      
      // Stop alert locally immediately
      buzzer_active = false;
      led_states[active_compartment - 1] = false;
      active_compartment = 0;
      active_medicine_id = "";
      base_alert_weight = current_weight;
    }
  } else {
    // base_alert_weight = current_weight;
  }

  delay(100);
}

// --- REAL-TIME DATABASE STREAM INTERCEPTOR ---

void streamCallback(FirebaseStream data) {
  Serial.println("Stream event triggered!");
  String path = data.dataPath();
  
  if (path == "/") {
    // Full JSON payload
    FirebaseJson &json = data.jsonObject();
    FirebaseJsonData activeCompVal, buzzerVal, lcdVal, medIdVal, schedTimeVal;
    
    json.get(activeCompVal, "activeCompartment");
    json.get(buzzerVal, "buzzerActive");
    json.get(lcdVal, "lcdMessage");
    json.get(medIdVal, "medicineId");
    json.get(schedTimeVal, "scheduledTime");

    if (activeCompVal.success) active_compartment = activeCompVal.intValue;
    if (buzzerVal.success) buzzer_active = buzzerVal.boolValue;
    
    if (lcdVal.success) {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("MedSync Alarm");
      lcd.setCursor(0, 1);
      lcd.print(lcdVal.stringValue);
    }
    
    if (medIdVal.success) active_medicine_id = medIdVal.stringValue;
    if (schedTimeVal.success) active_scheduled_time = schedTimeVal.stringValue;

    // Set LED states matching compartment index (1, 2, or 3)
    led_states[0] = (active_compartment == 1);
    led_states[1] = (active_compartment == 2);
    led_states[2] = (active_compartment == 3);
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Stream timed out, resuming...");
  }
}

// --- LOCAL DATA PERSISTENCE QUEUE (LittleFS) ---

String getTimestampString() {
  time_t nowTime;
  time(&nowTime);
  struct tm timeinfo;
  gmtime_r(&nowTime, &timeinfo);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

void queueLogLocally(String medicineId, int compartment) {
  Serial.println("Saving log to offline queue...");
  
  File file = LittleFS.open(QUEUE_FILE, "a"); // Append mode
  if (!file) {
    Serial.println("Error opening queue file.");
    return;
  }

  FirebaseJson json;
  json.add("medicineId", medicineId);
  json.add("compartmentNumber", compartment);
  json.add("timestamp", getTimestampString());

  String jsonStr;
  json.toString(jsonStr, false);
  
  file.println(jsonStr);
  file.close();
}

void syncOfflineQueue() {
  if (WiFi.status() != WL_CONNECTED || !Firebase.ready()) return;

  if (!LittleFS.exists(QUEUE_FILE)) return;

  File file = LittleFS.open(QUEUE_FILE, "r");
  if (!file) return;

  Serial.println("Syncing offline logs with database...");
  bool syncSuccess = true;

  while (file.available()) {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) continue;

    FirebaseJson json;
    json.setJsonData(line);
    
    // Push unique event entry into the RTDB queue path
    String pushPath = "/devices/" + String(DEVICE_ID) + "/logs_queue";
    if (!Firebase.RTDB.pushJSON(&fbData, pushPath, &json)) {
      Serial.printf("Push failed during sync: %s\n", fbData.errorReason().c_str());
      syncSuccess = false;
      break;
    }
  }
  file.close();

  // If sync succeeded completely, flush the queue
  if (syncSuccess) {
    LittleFS.remove(QUEUE_FILE);
    Serial.println("Offline log sync completed successfully.");
  }
}

// --- SYSTEM WRITE EVENTS ---

void triggerIntakeEvent(String medicineId, int compartment) {
  if (WiFi.status() == WL_CONNECTED && Firebase.ready()) {
    // Direct sync if connected
    String path = "/devices/" + String(DEVICE_ID) + "/telemetry/weight";
    Firebase.RTDB.setDoubleAsync(&fbData, path, current_weight);
    
    // Also push a taken log event
    FirebaseJson json;
    json.add("medicineId", medicineId);
    json.add("compartmentNumber", compartment);
    json.add("timestamp", getTimestampString());
    
    String pushPath = "/devices/" + String(DEVICE_ID) + "/logs_queue";
    Firebase.RTDB.pushJSON(&fbData, pushPath, &json);
  } else {
    // Queue locally if offline
    queueLogLocally(medicineId, compartment);
  }
}

void uploadWeight(float weight) {
  if (WiFi.status() != WL_CONNECTED || !Firebase.ready()) return;
  String path = "/devices/" + String(DEVICE_ID) + "/telemetry/weight";
  Firebase.RTDB.setDoubleAsync(&fbData, path, weight);
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED || !Firebase.ready()) return;

  String path = "/devices/" + String(DEVICE_ID) + "/heartbeat";
  FirebaseJson json;
  json.add("deviceId", DEVICE_ID);
  json.add("online", true);
  json.add("firmwareVersion", FIRMWARE_VERSION);
  json.add("wifiSignal", WiFi.RSSI());
  json.add("timestamp", getTimestampString());

  Firebase.RTDB.setJSONAsync(&fbData, path, &json);
}

// --- GENERAL HELPERS ---

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  
  Serial.print("Connecting WiFi to: ");
  Serial.println(WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int count = 0;
  while (WiFi.status() != WL_CONNECTED && count < 20) {
    delay(500);
    Serial.print(".");
    count++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected.");
    lcd.clear();
    lcd.print("WiFi Connected");
  } else {
    Serial.println("\nWiFi Connect Timeout.");
    lcd.clear();
    lcd.print("WiFi Offline");
  }
}

void updateOutputs() {
  digitalWrite(LED_COMP1, led_states[0] ? HIGH : LOW);
  digitalWrite(LED_COMP2, led_states[1] ? HIGH : LOW);
  digitalWrite(LED_COMP3, led_states[2] ? HIGH : LOW);

  if (buzzer_active) {
    tone(BUZZER_PIN, 1200); // sound at 1.2kHz
  } else {
    noTone(BUZZER_PIN);
  }
}
