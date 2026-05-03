# NodeMCU (ESP8266) IoT Integration for MediGuard Smart

To connect your hardware to this application, use the following logic in your Arduino IDE.

## Hardware Components
- NodeMCU (ESP8266)
- Load Cell (HX711) for weight detection
- Magnetic Reed Switch (for box open detection)
- Buzzer + LED (for alerts)
- MPU6050 (Optional: for fall detection)

## Arduino Sketch (Conceptual)

```cpp
#include <ESP8266WiFi.h>
#include <FirebaseESP8266.h>
#include "HX711.h"

// Configuration
#define WIFI_SSID "YOUR_WIFI_NAME"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define FIREBASE_HOST "https://gen-lang-client-0074425365.firebaseio.com"
#define FIREBASE_AUTH "YOUR_AUTH_KEY"
#define PATIENT_ID "PASTE_YOUR_UID_HERE"

// Pins
const int LOADCELL_DOUT_PIN = D2;
const int LOADCELL_SCK_PIN = D3;
const int REED_SWITCH_PIN = D5;
const int BUZZER_PIN = D6;

HX711 scale;
FirebaseData firebaseData;

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  pinMode(REED_SWITCH_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);

  Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
}

void loop() {
  bool isBoxOpen = digitalRead(REED_SWITCH_PIN) == HIGH;
  float currentWeight = scale.get_units(5);
  
  // Sync to Firebase
  FirebaseJson json;
  json.set("isBoxOpen", isBoxOpen);
  json.set("lastWeight", currentWeight);
  json.set("lastHeartbeat", "SERVER_TIME"); // or use NTP client string
  
  if (Firebase.set(firebaseData, "/deviceStatus/" + String(PATIENT_ID), json)) {
    Serial.println("Synced successfully");
  }

  // Handle local alerts if server triggers buzzer (optional check)
  // if (Firebase.getBool(firebaseData, "/deviceStatus/" + String(PATIENT_ID) + "/shouldAlert")) { ... }

  delay(2000); 
}
```

## Security Note
This example uses the legacy Firebase Database Secrets. For production, it is recommended to use the **Firebase Admin SDK** or **Authentication tokens**. Since this is a specialized environment, please refer to the `DevicePanel` in the web application for your specific `PATIENT_ID`.
