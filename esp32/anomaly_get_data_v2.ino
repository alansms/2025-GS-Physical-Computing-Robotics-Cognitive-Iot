#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include "I2Cdev.h"
#include "MPU6050.h"
#include <Adafruit_BMP085.h>

const int LED_PIN = 2;
const char* WIFI_SSID = "SMS Tecnologia";
const char* WIFI_PASS = "23pipocas";
const char* SERVER_URL = "http://173.21.101.62:4242";

const int SAMPLE_RATE = 200;
const int NUM_SAMPLES = 200;
const int I2C_SDA = 21, I2C_SCL = 22;
const float ACC_SCALE = 16384.0;

MPU6050 mpu(0x68);
Adafruit_BMP085 bmp;
HTTPClient http;

int16_t ax, ay, az;
int16_t gx, gy, gz;
bool bmpOk = false;

void blinkLED(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(delayMs);
    digitalWrite(LED_PIN, LOW);
    delay(delayMs);
  }
}

void debugWiFiStatus() {
  wl_status_t status = WiFi.status();
  switch (status) {
    case WL_NO_SSID_AVAIL: Serial.println("WiFi: SSID não disponível"); break;
    case WL_CONNECT_FAILED: Serial.println("WiFi: Falha na conexão"); break;
    case WL_CONNECTION_LOST: Serial.println("WiFi: Conexão perdida"); break;
    case WL_DISCONNECTED: Serial.println("WiFi: Desconectado"); break;
    case WL_CONNECTED: Serial.println("WiFi: Conectado"); break;
    default: Serial.printf("WiFi: Status desconhecido (%d)\n", status); break;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);

  Wire.begin(I2C_SDA, I2C_SCL);
  delay(100);
  Serial.println("Inicializando sensores GY-87...");

  bmpOk = bmp.begin();
  if (!bmpOk) Serial.println("Aviso: BMP085 não encontrado.");
  else Serial.println("BMP085 OK.");

  mpu.initialize();
  if (!mpu.testConnection()) {
    Serial.println("Erro: MPU6050 não encontrado.");
    while (1) blinkLED(3, 200);
  } else {
    Serial.println("MPU6050 OK.");
  }

  blinkLED(2, 100);

  Serial.print("Conectando ao WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    Serial.print(".");
    blinkLED(1, 300);
    delay(300);
    debugWiFiStatus();
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nConectado! IP: %s\n", WiFi.localIP().toString().c_str());
    blinkLED(5, 50);
  } else {
    Serial.println("\nErro: WiFi não conectou.");
    while (1) blinkLED(10, 100);
  }
}

void sendData(JsonDocument& json) {
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  String jsonString;
  serializeJson(json, jsonString);
  int code = http.POST(jsonString);
  String resp = http.getString();
  Serial.printf("POST: %d | Resposta: %s\n", code, resp.c_str());
  http.end();
}

void loop() {
  DynamicJsonDocument json(JSON_OBJECT_SIZE(6) + 3 * JSON_ARRAY_SIZE(NUM_SAMPLES));
  JsonArray x_data = json.createNestedArray("x");
  JsonArray y_data = json.createNestedArray("y");
  JsonArray z_data = json.createNestedArray("z");

  for (int i = 0; i < NUM_SAMPLES; i++) {
    mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);

    // Convertendo para "g"
    float gx_val = ax / ACC_SCALE;
    float gy_val = ay / ACC_SCALE;
    float gz_val = az / ACC_SCALE;

    x_data.add(gx_val);
    y_data.add(gy_val);
    z_data.add(gz_val);

    if (i % 50 == 0) {
      Serial.printf("Sample %d: X:%.3f Y:%.3f Z:%.3f\n", i, gx_val, gy_val, gz_val);
    }

    delay(1000 / SAMPLE_RATE);
  }

  if (bmpOk) {
    json["temp"] = bmp.readTemperature();
    json["press"] = bmp.readPressure();
    json["alt"] = bmp.readAltitude();
  }

  digitalWrite(LED_PIN, HIGH);
  sendData(json);
  digitalWrite(LED_PIN, LOW);
  delay(100);
}