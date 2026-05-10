# NodeMCU (ESP8266) IoT Integration for MediGuard Smart

To connect your hardware to this application, use the following logic in your Arduino IDE. This updated version uses the **MediGuard Smart Backend API** which handles auto-logging of medications and fall detection alerts.

## Hardware Components
- NodeMCU (ESP8266)
- Load Cell (HX711) for weight detection
- Magnetic Reed Switch (for box open detection)
- Buzzer + LED (for alerts)
- MPU6050 (Optional: for fall detection)

## Arduino Sketch (REST API Method)

```cpp
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include "HX711.h"

// Configuration
#define WIFI_SSID "YOUR_WIFI_NAME"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define API_URL "https://YOUR_APP_URL.run.app/api/iot/status"
#define PATIENT_ID "PASTE_YOUR_UID_HERE"

// Pins
const int LOADCELL_DOUT_PIN = D2;
const int LOADCELL_SCK_PIN = D3;
const int REED_SWITCH_PIN = D5;
const int BUZZER_PIN = D6;

HX711 scale;

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  pinMode(REED_SWITCH_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    bool isBoxOpen = digitalRead(REED_SWITCH_PIN) == HIGH;
    float currentWeight = scale.get_units(5);
    
    WiFiClient client;
    HTTPClient http;
    http.begin(client, API_URL);
    http.addHeader("Content-Type", "application/json");

    String payload = "{\"patientId\":\"" + String(PATIENT_ID) + "\",\"isBoxOpen\":" + (isBoxOpen ? "true" : "false") + ",\"lastWeight\":" + String(currentWeight) + "}";
    
    int httpCode = http.POST(payload);
    if (httpCode > 0) {
      Serial.println("API Updated: " + String(httpCode));
    }
    http.end();
  }
  delay(5000); 
}
```

## Security Note
This API endpoint uses your unique `PATIENT_ID` for identification. The backend logic automatically detects if the medicine box was opened and cross-references it with your medication schedule to log doses automatically.

## API Reference
- **POST** `/api/iot/status`: Updates hardware sensors and executes backend automation logic (auto-logging doses, fall detection).
- **GET** `/api/iot/config/:patientId`: Returns the current medication schedule for local hardware alerts.
