#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include "I2Cdev.h"
#include "MPU6050.h"
#include <ESPmDNS.h>  // ✅ mDNS

const int LED_PIN = 2;
const char* WIFI_SSID = "SMS Tecnologia";
const char* WIFI_PASS = "23pipocas";
const char* SERVER_URL = "http://173.21.101.62:8080";  // IP e porta corretos

const int SAMPLE_RATE = 200;
const int NUM_SAMPLES = 200;
const int I2C_SDA = 21, I2C_SCL = 22;
const float ACC_SCALE = 16384.0;

MPU6050 mpu(0x68);
HTTPClient http;

int16_t ax, ay, az;
int16_t gx, gy, gz;

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
    Serial.println("Inicializando MPU6050...");

    mpu.initialize();
    if (!mpu.testConnection()) {
        Serial.println("Erro: MPU6050 não encontrado.");
        while (1) blinkLED(3, 200);
    } else {
        Serial.println("MPU6050 OK.");
    }

    blinkLED(2, 100);

    WiFi.mode(WIFI_STA);
    WiFi.setHostname("sensor_tremores-01");  // ✅ Hostname
    WiFi.begin(WIFI_SSID, WIFI_PASS);

    Serial.print("Conectando ao WiFi");
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

        // ✅ Inicia o mDNS com o mesmo nome
        if (!MDNS.begin("sensor_tremores-01")) {
            Serial.println("Erro ao iniciar mDNS");
        } else {
            Serial.println("mDNS iniciado: sensor_tremores-01.local");
        }
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
    DynamicJsonDocument json(JSON_OBJECT_SIZE(4) + 2 * JSON_ARRAY_SIZE(NUM_SAMPLES));

    // Leitura dos valores do sensor
    mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);

    // Conversão para unidades g com maior precisão
    float gx_val = ax / ACC_SCALE;
    float gy_val = ay / ACC_SCALE;
    float gz_val = az / ACC_SCALE;

    // Calcula a magnitude da aceleração no plano XY
    float acceleration_xy = sqrt(gx_val * gx_val + gy_val * gy_val);

    // Prepara o JSON com os valores
    json["ax"] = gx_val;
    json["ay"] = gy_val;
    json["az"] = gz_val;
    json["acceleration_xy"] = acceleration_xy;

    // Mostra os valores no monitor serial com maior precisão
    Serial.printf("Valores do Sensor:\n");
    Serial.printf("X: %.6f g\n", gx_val);
    Serial.printf("Y: %.6f g\n", gy_val);
    Serial.printf("Z: %.6f g\n", gz_val);
    Serial.printf("ACC_XY: %.6f g\n\n", acceleration_xy);

    digitalWrite(LED_PIN, HIGH);
    sendData(json);
    digitalWrite(LED_PIN, LOW);

    delay(100); // Delay para estabilização
}