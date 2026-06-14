/**
 * MedSync Smart Medicine Box ESP32 Firmware
 * Dependencies:
 * - HX711 Arduino Library by Bogdan Necula
 * - ArduinoJson Library by Benoit Blanchon
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "HX711.h"

// --- CONFIGURATION ---
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

// Server API config
const char* API_BASE_URL = "http://YOUR_SERVER_IP:3001/api/device";
const char* DEVICE_TOKEN = "MEDSYNC_SECURE_ESP32_SECRET";
const char* USER_ID = "mock_patient_1"; // Link to the user profile

// Pin mappings
const int LED_COMP1 = 18;
const int LED_COMP2 = 19;
const int LED_COMP3 = 21;
const int BUZZER_PIN = 22;

// HX711 Load Cell Pins
const int DOUT_PIN = 23;
const int SCK_PIN = 25;

// Variables & Timers
HX711 scale;
float calibration_factor = 420.0; // Recalibrate with standard weights
float current_weight = 0.0;
float last_sent_weight = 0.0;

bool led_state[3] = {false, false, false};
bool buzzer_active = false;
int active_compartment = 0;

unsigned long last_heartbeat_time = 0;
unsigned long last_weight_time = 0;
unsigned long last_schedule_fetch = 0;

const unsigned long HEARTBEAT_INTERVAL = 30000; // 30 seconds
const unsigned long WEIGHT_INTERVAL = 10000;    // 10 seconds
const unsigned long SCHEDULE_INTERVAL = 600000;  // 10 minutes

void setup() {
  Serial.begin(115200);

  // Pin modes
  pinMode(LED_COMP1, OUTPUT);
  pinMode(LED_COMP2, OUTPUT);
  pinMode(LED_COMP3, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(LED_COMP1, LOW);
  digitalWrite(LED_COMP2, LOW);
  digitalWrite(LED_COMP3, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  // Load Cell initialization
  Serial.println("Initializing Load Cell (HX711)...");
  scale.begin(DOUT_PIN, SCK_PIN);
  scale.set_scale(calibration_factor);
  scale.tare(); // Zero out scale on start
  Serial.println("Load Cell tared and ready.");

  // Connect to Wi-Fi
  connectWiFi();
}

void loop() {
  // Ensure connectivity
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  unsigned long current_time = millis();

  // Read scale weight sensor
  current_weight = scale.get_units(5); // Average 5 readings
  if (current_weight < 0) current_weight = 0.0; // Clamp

  // 1. Send Weight Updates if change threshold > 1g
  if (current_time - last_weight_time >= WEIGHT_INTERVAL) {
    last_weight_time = current_time;
    if (abs(current_weight - last_sent_weight) >= 1.0) {
      sendWeight(current_weight);
      last_sent_weight = current_weight;
    }
  }

  // 2. Ticker: Send Heartbeat Status
  if (current_time - last_heartbeat_time >= HEARTBEAT_INTERVAL || last_heartbeat_time == 0) {
    last_heartbeat_time = current_time;
    sendHeartbeat();
  }

  // 3. Ticker: Sync Schedule data
  if (current_time - last_schedule_fetch >= SCHEDULE_INTERVAL || last_schedule_fetch == 0) {
    last_schedule_fetch = current_time;
    fetchSchedules();
  }

  // 4. Alert Output Logic
  manageAlertOutputs();

  // 5. Intake simulation check (if alert is active, and weight drops by > 2.0g)
  if (buzzer_active && active_compartment > 0) {
    // If weight drops significantly, consider compartment opened/med taken
    static float alert_start_weight = current_weight;
    if (alert_start_weight - current_weight >= 2.0) {
      Serial.println("Intake weight drop detected! Sending taken event.");
      sendMedicineTaken(active_compartment);
      
      // Stop local alert immediately to satisfy user
      buzzer_active = false;
      led_state[active_compartment - 1] = false;
      active_compartment = 0;
      alert_start_weight = current_weight;
    }
  } else {
    // Keep scale weight base updated when no alert is active
    // (So when alert starts, we have a clean reference weight)
    // alert_start_weight = current_weight;
  }

  delay(200);
}

// --- NETWORK OPERATIONS ---

void connectWiFi() {
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi Connected successfully.");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWi-Fi connection failed. Retrying in loop.");
  }
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(API_BASE_URL) + "/heartbeat";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);

  StaticJsonDocument<200> doc;
  doc["userId"] = USER_ID;
  doc["esp32Connected"] = true;
  doc["buzzerStatus"] = buzzer_active;
  
  JsonArray leds = doc.createNestedArray("ledStatus");
  leds.add(led_state[0]);
  leds.add(led_state[1]);
  leds.add(led_state[2]);

  String requestBody;
  serializeJson(doc, requestBody);

  int httpResponseCode = http.POST(requestBody);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("Heartbeat ACK: ");
    Serial.println(response);

    // Parse response to check for server override states
    StaticJsonDocument<200> respDoc;
    deserializeJson(respDoc, response);
    // If the server returns active alarm commands, update state
    if (respDoc.containsKey("ledStatus")) {
      led_state[0] = respDoc["ledStatus"][0];
      led_state[1] = respDoc["ledStatus"][1];
      led_state[2] = respDoc["ledStatus"][2];
    }
    if (respDoc.containsKey("buzzerStatus")) {
      buzzer_active = respDoc["buzzerStatus"];
    }
    if (respDoc.containsKey("currentCompartment")) {
      active_compartment = respDoc["currentCompartment"];
    }
  } else {
    Serial.print("Heartbeat Error code: ");
    Serial.println(httpResponseCode);
  }
  http.end();
}

void sendWeight(float weight) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(API_BASE_URL) + "/weight";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);

  StaticJsonDocument<128> doc;
  doc["userId"] = USER_ID;
  doc["weightValue"] = weight;

  String requestBody;
  serializeJson(doc, requestBody);

  int httpResponseCode = http.POST(requestBody);
  if (httpResponseCode > 0) {
    Serial.println("Weight upload successful.");
  } else {
    Serial.print("Weight upload error: ");
    Serial.println(httpResponseCode);
  }
  http.end();
}

void sendMedicineTaken(int compartment) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(API_BASE_URL) + "/medicine-taken";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);

  StaticJsonDocument<200> doc;
  doc["userId"] = USER_ID;
  doc["compartmentNumber"] = compartment;
  // For demonstration, map medicineId dynamically or fetch from local schedule cache
  doc["medicineId"] = "med_" + String(compartment);

  String requestBody;
  serializeJson(doc, requestBody);

  int httpResponseCode = http.POST(requestBody);
  if (httpResponseCode > 0) {
    Serial.println("Intake log registered.");
  } else {
    Serial.print("Intake registration error: ");
    Serial.println(httpResponseCode);
  }
  http.end();
}

void fetchSchedules() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(API_BASE_URL) + "/schedules?userId=" + String(USER_ID);
  http.begin(url);
  http.addHeader("x-device-token", DEVICE_TOKEN);

  int httpResponseCode = http.GET();
  if (httpResponseCode == 200) {
    String response = http.getString();
    Serial.println("Schedules synced:");
    Serial.println(response);
    
    // In a full implementation, store these schedules in EEPROM / Flash memory 
    // to check locally and display on LCD screen.
  } else {
    Serial.print("Schedules fetch error: ");
    Serial.println(httpResponseCode);
  }
  http.end();
}

// --- DEVICE MANAGEMENT ---

void manageAlertOutputs() {
  digitalWrite(LED_COMP1, led_state[0] ? HIGH : LOW);
  digitalWrite(LED_COMP2, led_state[1] ? HIGH : LOW);
  digitalWrite(LED_COMP3, led_state[2] ? HIGH : LOW);

  if (buzzer_active) {
    // Generate tone sound on buzzer
    tone(BUZZER_PIN, 1000); // 1 kHz frequency
  } else {
    noTone(BUZZER_PIN);
  }
}
