// =============================================
//  AERIS Air Quality System — Node 3 v4
//  7-min boot: Warmup → Stabilize → Reading → LIVE
// =============================================
//
//  BOOT PHASES (7 min total):
//    0-3 min: WARMUP    — MQ heaters warming, PM/temp/UV available
//    3-5 min: STABILIZE — Ro calibrated, values settling (serial only)
//    5-7 min: READING   — stable hardware values (serial only)
//    7+ min:  LIVE      — DB push + website + OLED all active
//
//  SENSOR ACCURACY:
//    ADC eFuse calibration, trimmed mean filtering,
//    fresh Ro calibration, NO2 inverted polarity,
//    MQ temp/humidity correction, CO MEMS→MQ-7 fallback
//
//  PIN MAP:
//    ADC1: 34=Dust, 32=MQ-131, 35=MQ-7, 36=MQ-135, 33=UV
//    ADC2: 26=CO MEMS, 27=NO2 MEMS (WiFi pause)
//    Digital: 23=Rain(in), 25=Dust LED(out)
//    I2C: SDA=21, SCL=22 (SGP40, SHT31, SH1106)
// =============================================

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_SGP40.h>
#include <Adafruit_SHT31.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include "esp_wifi.h"
#include "esp_adc_cal.h"

// =============================================
//  WIFI CONFIG
// =============================================
const char* WIFI_SSID = "NOKIA 3310";
const char* WIFI_PASS = "123456789";
WebServer server(80);

// =============================================
//  AERIS BACKEND CONFIG
// =============================================
const char* AERIS_SERVER = "https://live-aeris.onrender.com";
const char* AERIS_API_KEY  = "aeris-dev-ingest-key-2026";
const char* AERIS_NODE_ID  = "ESP32_03";
unsigned long lastBackendPush = 0;
const unsigned long BACKEND_INTERVAL = 5000;

// =============================================
//  OLED — SH1106 1.3"
// =============================================
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
Adafruit_SH1106G display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// =============================================
//  SENSORS
// =============================================
Adafruit_SGP40  sgp;
Adafruit_SHT31  sht31;

// =============================================
//  PINS
// =============================================
#define DUST_LED_PIN    25
#define DUST_ANALOG_PIN 34
#define MQ131_PIN       32
#define MQ7_PIN         35
#define MQ135_PIN       36
#define UV_PIN          33
#define CO_MEMS_PIN     26
#define NO2_MEMS_PIN    27
#define RAIN_SENSOR_PIN 23
#define RAIN_DEBOUNCE_COUNT 3

// =============================================
//  FLAGS
// =============================================
bool hasOLED = false, hasSGP40 = false, hasSHT31 = false;
bool wifiConnected = false;

bool g_raining = false;
int  g_rain_count = 0;
float g_pm25_before_rain = 0;
float g_pm25_rain_delta  = 0;

// =============================================
//  ADC CALIBRATION (eFuse — ±1-2% accuracy)
// =============================================
static esp_adc_cal_characteristics_t adc1_chars;
static esp_adc_cal_characteristics_t adc2_chars;

// =============================================
//  CALIBRATION
// =============================================
const float DUST_CLEAN_VOLTAGE = 0.5;

const float MQ131_RL_KOHM = 10.0, MQ131_VCC = 5.0, MQ131_CLEAN_AIR_FACTOR = 15.0;
const float MQ7_RL_KOHM   = 10.0, MQ7_VCC   = 5.0, MQ7_CLEAN_AIR_FACTOR   = 27.5;
const float MQ135_RL_KOHM = 10.0, MQ135_VCC = 5.0, MQ135_CLEAN_AIR_FACTOR = 3.6;

const float SEN0564_RANGE = 1000.0;
const float SEN0574_RANGE = 10.0;
const float UV_SCALE      = 10.0;
const float MEMS_NOISE    = 0.08;  // Raised to reject midday thermal ADC drift

float MQ131_Ro = 0, MQ7_Ro = 0, MQ135_Ro = 0;
float CO_MEMS_BASELINE = 0, NO2_MEMS_BASELINE = 0;
bool  no2Inverted = false;

// Forward declaration (used by median filter)
void sortFloats(float* a, int n);

// =============================================
//  FILTER 1: MEDIAN (rolling 5-sample window)
//  Rejects outliers before EMA sees them
// =============================================
#define MED_WIN 5

struct MedianFilter {
  float buf[MED_WIN];
  int   idx;
  int   count;
};

MedianFilter mf_pm25 = {{0},0,0};
MedianFilter mf_mq131 = {{0},0,0};
MedianFilter mf_mq7   = {{0},0,0};
MedianFilter mf_mq135 = {{0},0,0};
MedianFilter mf_uv    = {{0},0,0};
MedianFilter mf_co_mems  = {{0},0,0};
MedianFilter mf_no2_mems = {{0},0,0};

float medianPush(MedianFilter &mf, float val) {
  mf.buf[mf.idx] = val;
  mf.idx = (mf.idx + 1) % MED_WIN;
  if (mf.count < MED_WIN) mf.count++;
  // Sort a copy to find median
  float tmp[MED_WIN];
  for (int i = 0; i < mf.count; i++) tmp[i] = mf.buf[i];
  sortFloats(tmp, mf.count);
  return tmp[mf.count / 2];
}

// =============================================
//  FILTER 2: EMA (exponential moving average)
//  Smooths median output over time
// =============================================
const float EMA_ALPHA = 0.2;

float pm25_ema    = -1;
float mq131Rs_ema = -1;
float mq7Rs_ema   = -1;
float mq135Rs_ema = -1;
float uv_ema      = -1;
float co_mems_ema = -1;
float no2_mems_ema = -1;

float applyEMA(float val, float prev) {
  if (prev < 0) return val;
  return EMA_ALPHA * val + (1.0 - EMA_ALPHA) * prev;
}

// =============================================
//  FILTER 3: DEADBAND (suppress jitter)
//  Global only updates if change > threshold
// =============================================
float deadband(float newVal, float oldVal, float threshold) {
  if (abs(newVal - oldVal) < threshold) return oldVal;
  return newVal;
}

// Per-sensor deadband thresholds (tuned to sensor resolution)
const float DB_PM25 = 0.5;    // ug/m3 — dust sensor noise floor
const float DB_O3   = 0.5;    // ppb
const float DB_CO   = 0.05;   // ppm
const float DB_NO2  = 1.0;    // ppb
const float DB_CO2  = 5.0;    // ppm
const float DB_UV   = 0.1;    // index
const float DB_TEMP = 0.1;    // C
const float DB_HUM  = 0.5;    // %
const int   DB_VOC  = 2;      // index
const int   DB_AQI  = 1;      // index

// =============================================
//  FILTER 4: DISPLAY RATE CONTROL (dirty flag)
//  OLED + Serial only redraw when data changes
// =============================================
bool displayDirty = true;  // force first draw

// =============================================
//  TIMING — 7-min boot sequence
// =============================================
unsigned long bootTime;

// Phase boundaries (cumulative from boot)
const unsigned long WARMUP_END     = 180000;  // 0-3 min: MQ heaters
const unsigned long STABILIZE_END  = 300000;  // 3-5 min: values settling
const unsigned long LIVE_START     = 420000;  // 5-7 min: reading, then LIVE

// Phase flags
bool warmedUp   = false;   // set at 3 min (Ro calibrated)
bool stabilized = false;   // set at 5 min
bool isLive     = false;   // set at 7 min (DB + website active)
int oledPage = 0;

unsigned long lastSensorRead = 0;
const unsigned long SENSOR_INTERVAL = 15000;   // read every 15 sec

unsigned long lastDisplayUpdate = 0;
const unsigned long DISPLAY_INTERVAL = 30000;  // show every 30 sec

unsigned long lastADC2Read = 0;
const unsigned long ADC2_INTERVAL = 30000;     // MEMS every 30 sec

uint16_t g_voc_lastgood = 0;

// =============================================
//  LATEST READINGS (shared with web server)
// =============================================
float g_pm25 = 0, g_o3 = 0, g_co = 0, g_no2_ppb = 0;
float g_co2 = 0, g_co_mq = 0, g_uv = 0;
float g_temp = 0, g_hum = 0;
uint16_t g_voc = 0;
int g_aqi = 0, g_aqi_pm = 0, g_aqi_o3 = 0, g_aqi_co = 0, g_aqi_no2 = 0;
float g_co_mems_v  = 0;
float g_no2_mems_v = 0;

// =============================================
//  HUMAN-READABLE STATUS TAGS
// =============================================

const char* pm25Tag(float v) {
  if (v <= 12)    return "GOOD";
  if (v <= 35.4)  return "OK";
  if (v <= 55.4)  return "POOR";
  if (v <= 150.4) return "BAD";
  if (v <= 250.4) return "V.BAD";
  return "TOXIC";
}
const char* pm25Tip(float v) {
  if (v <= 12)    return "Clean air, enjoy outdoors";
  if (v <= 35.4)  return "Acceptable for most people";
  if (v <= 55.4)  return "Sensitive groups take care";
  if (v <= 150.4) return "Limit outdoor activity";
  if (v <= 250.4) return "Avoid outdoor activity";
  return "Stay indoors, close windows!";
}

const char* o3Tag(float v) {
  if (v <= 54)  return "SAFE";
  if (v <= 70)  return "OK";
  if (v <= 85)  return "HIGH";
  if (v <= 105) return "BAD";
  return "TOXIC";
}
const char* o3Tip(float v) {
  if (v <= 54)  return "Normal level, no risk";
  if (v <= 70)  return "OK for most people";
  if (v <= 85)  return "Reduce outdoor exercise";
  if (v <= 105) return "Limit time outdoors";
  return "Avoid outdoor exposure!";
}

const char* coTag(float v) {
  if (v <= 4.4)  return "SAFE";
  if (v <= 9.4)  return "OK";
  if (v <= 15.4) return "HIGH";
  if (v <= 30.4) return "BAD";
  return "DANGER";
}
const char* coTip(float v) {
  if (v <= 4.4)  return "Safe, no risk";
  if (v <= 9.4)  return "Ventilate the room";
  if (v <= 15.4) return "Open windows now!";
  if (v <= 30.4) return "Leave the area!";
  return "DANGER - evacuate immediately!";
}

const char* no2Tag(float v) {
  if (v <= 53)  return "SAFE";
  if (v <= 100) return "OK";
  if (v <= 360) return "HIGH";
  if (v <= 649) return "BAD";
  return "TOXIC";
}
const char* no2Tip(float v) {
  if (v <= 53)  return "Clean, well below limits";
  if (v <= 100) return "Acceptable level";
  if (v <= 360) return "Ventilate the area";
  return "Limit your exposure";
}

const char* co2Tag(float v) {
  if (v <= 600)  return "FRESH";
  if (v <= 1000) return "OK";
  if (v <= 1500) return "STUFFY";
  if (v <= 2000) return "POOR";
  return "BAD";
}
const char* co2Tip(float v) {
  if (v <= 600)  return "Fresh air, good ventilation";
  if (v <= 1000) return "Normal indoor air";
  if (v <= 1500) return "Room feels stuffy, open window";
  if (v <= 2000) return "Drowsiness possible, ventilate";
  return "Poor air! Open windows now";
}

const char* vocTag(int v) {
  if (v <= 100) return "CLEAN";
  if (v <= 200) return "OK";
  if (v <= 300) return "SMELL";
  if (v <= 400) return "BAD";
  return "V.BAD";
}
const char* vocTip(int v) {
  if (v <= 100) return "No odors or fumes";
  if (v <= 200) return "Normal activity detected";
  if (v <= 300) return "Noticeable odor, ventilate";
  if (v <= 400) return "Strong fumes, open windows!";
  return "Heavy pollution, leave area!";
}

const char* uvTag(float v) {
  if (v < 3)  return "LOW";
  if (v < 6)  return "MID";
  if (v < 8)  return "HIGH";
  if (v < 11) return "V.HIGH";
  return "EXTRM";
}
const char* uvTip(float v) {
  if (v < 3)  return "No protection needed";
  if (v < 6)  return "Wear sunscreen outdoors";
  if (v < 8)  return "Hat + sunscreen recommended";
  if (v < 11) return "Avoid midday sun";
  return "Stay in shade!";
}

const char* tempTag(float v) {
  if (v < 18) return "COLD";
  if (v < 22) return "COOL";
  if (v < 28) return "COMFY";
  if (v < 35) return "WARM";
  return "HOT";
}

const char* humTag(float v) {
  if (v < 25) return "DRY";
  if (v < 30) return "LOW";
  if (v < 60) return "COMFY";
  if (v < 80) return "HUMID";
  return "WET";
}

const char* aqiAdvice(int a) {
  if (a <= 50)  return "Great air! Enjoy outdoor activities.";
  if (a <= 100) return "Acceptable. Sensitive people take care.";
  if (a <= 150) return "Sensitive groups reduce outdoor time.";
  if (a <= 200) return "Everyone limit outdoor activity.";
  if (a <= 300) return "Health alert! Avoid going outside.";
  return "EMERGENCY! Stay indoors, seal windows!";
}

String aqiLabel(int a) {
  if (a <= 50)  return "GOOD";
  if (a <= 100) return "MODERATE";
  if (a <= 150) return "UNHLTHY-S";
  if (a <= 200) return "UNHEALTHY";
  if (a <= 300) return "V.UNHLTHY";
  return "HAZARDOUS";
}

String aqiColor(int a) {
  if (a <= 50)  return "#00e400";
  if (a <= 100) return "#ffff00";
  if (a <= 150) return "#ff7e00";
  if (a <= 200) return "#ff0000";
  if (a <= 300) return "#8f3f97";
  return "#7e0023";
}

// =============================================
//  ADC HELPERS — Calibrated + Trimmed Mean
// =============================================

void sortFloats(float* a, int n) {
  for (int i = 0; i < n-1; i++)
    for (int j = i+1; j < n; j++)
      if (a[j] < a[i]) { float t = a[i]; a[i] = a[j]; a[j] = t; }
}

float readV_ADC1(int pin, int n) {
  if (n > 50) n = 50;
  float buf[50];
  for (int i = 0; i < n; i++) {
    buf[i] = esp_adc_cal_raw_to_voltage(analogRead(pin), &adc1_chars) / 1000.0;
    delayMicroseconds(200);
  }
  sortFloats(buf, n);
  int lo = n / 5, hi = n - lo;
  float s = 0;
  for (int i = lo; i < hi; i++) s += buf[i];
  return s / (hi - lo);
}

float readV_ADC2(int pin, int n) {
  if (n > 50) n = 50;
  float buf[50];
  for (int i = 0; i < n; i++) {
    buf[i] = esp_adc_cal_raw_to_voltage(analogRead(pin), &adc2_chars) / 1000.0;
    delayMicroseconds(200);
  }
  sortFloats(buf, n);
  int lo = n / 5, hi = n - lo;
  float s = 0;
  for (int i = lo; i < hi; i++) s += buf[i];
  return s / (hi - lo);
}

// =============================================
//  SENSOR READS
// =============================================

float readDustPM25() {
  float buf[10];
  for (int i = 0; i < 10; i++) {
    digitalWrite(DUST_LED_PIN, LOW);
    delayMicroseconds(280);
    buf[i] = esp_adc_cal_raw_to_voltage(analogRead(DUST_ANALOG_PIN), &adc1_chars) / 1000.0;
    delayMicroseconds(40);
    digitalWrite(DUST_LED_PIN, HIGH);
    delayMicroseconds(9680);
  }
  sortFloats(buf, 10);
  float s = 0;
  for (int i = 2; i < 8; i++) s += buf[i];
  float pm = (s / 6.0 - DUST_CLEAN_VOLTAGE) * 200.0;
  return max(pm, 0.0f);
}

float readMQResistance(int pin, float rl, float vcc) {
  float v = readV_ADC1(pin, 50);
  if (v < 0.01) v = 0.01;
  if (v > 3.2) v = 3.2;
  return rl * ((vcc / v) - 1.0);
}

float readUVIndex() {
  float v = readV_ADC1(UV_PIN, 20);
  float idx = v * UV_SCALE;
  return (idx < 0.1) ? 0 : idx;
}

// =============================================
//  GOOGLE DNS
// =============================================
void applyGoogleDNS() {
  IPAddress dns1(8, 8, 8, 8);
  IPAddress dns2(8, 8, 4, 4);
  WiFi.config(WiFi.localIP(), WiFi.gatewayIP(), WiFi.subnetMask(), dns1, dns2);
}

// =============================================
//  ADC2 — WIFI PAUSE FOR MEMS
// =============================================

void readADC2Sensors() {
  esp_wifi_stop();
  delay(50);

  float co_v  = readV_ADC2(CO_MEMS_PIN, 30);
  float no2_v = readV_ADC2(NO2_MEMS_PIN, 30);

  esp_wifi_start();
  delay(100);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(200);
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    applyGoogleDNS();
  } else {
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    int r = 0;
    while (WiFi.status() != WL_CONNECTED && r < 20) { delay(250); r++; }
    if (WiFi.status() == WL_CONNECTED) applyGoogleDNS();
  }

  // Recover I2C after WiFi stop/start (can glitch shared bus)
  Wire.begin(21, 22);
  Wire.setClock(100000);

  float co_med  = medianPush(mf_co_mems, co_v);
  float no2_med = medianPush(mf_no2_mems, no2_v);
  co_mems_ema  = applyEMA(co_med, co_mems_ema);
  no2_mems_ema = applyEMA(no2_med, no2_mems_ema);
  g_co_mems_v  = (co_mems_ema >= 0) ? co_mems_ema : co_v;
  g_no2_mems_v = (no2_mems_ema >= 0) ? no2_mems_ema : no2_v;
}

// =============================================
//  MQ TEMP/HUMIDITY CORRECTION
// =============================================
float mqCorrection(float t, float h) {
  if (t == 0 && h == 0) return 1.0;
  // FIXED: 25C baseline (Indian climate), gentler curve to prevent midday math explosions
  float tc = 1.0 + 0.008 * (25.0 - t);
  float hc = 1.0 + 0.003 * (50.0 - h);
  return constrain(tc * hc, 0.8, 1.2);  // Tight bounds — max ±20% correction
}

// =============================================
//  GAS CONVERSIONS
// =============================================

float ozonePPB(float r) {
  if (r < 0.1) return 0;
  return constrain(316.2 * pow(r, -1.661), 0, 120);
}

float coPPM_MQ(float r) {
  if (r < 0.1) return 0;
  return constrain(100.0 * pow(r, -1.53), 0, 50);
}

float mq135CO2(float r) {
  if (r < 0.1) return 400;
  return constrain(1000.0 * pow(r, -0.715), 400, 5000);
}

float coPPM_MEMS(float v) {
  if (CO_MEMS_BASELINE >= 3.2) return 0;
  float d = v - CO_MEMS_BASELINE;
  if (d < MEMS_NOISE) return 0;
  return constrain(d / (3.3 - CO_MEMS_BASELINE) * SEN0564_RANGE, 0, 50);
}

float no2PPB_MEMS(float v) {
  float d, rng;
  if (no2Inverted) {
    d = NO2_MEMS_BASELINE - v;
    rng = NO2_MEMS_BASELINE;
  } else {
    d = v - NO2_MEMS_BASELINE;
    rng = 3.3 - NO2_MEMS_BASELINE;
  }
  if (d < 0.10 || rng < 0.1) return 0;  // noise floor for NO2 (ADC2 pin 27 noisy)
  d = d - 0.10;                         // subtract noise floor so clean air reads ~0
  float ppm = constrain(d / rng * SEN0574_RANGE, 0, SEN0574_RANGE);
  float ppb = ppm * 1000.0;
  return constrain(ppb, 0, 2049);  // cap at AQI table max (2049 ppb)
}

// =============================================
//  AQI CALCULATIONS
// =============================================

int aqiCalc(float v, float bp[][4], int n) {
  for (int i = 0; i < n; i++)
    if (v <= bp[i][1])
      return (int)((bp[i][3]-bp[i][2])/(bp[i][1]-bp[i][0])*(v-bp[i][0])+bp[i][2]);
  return 500;
}

int aqiFromPM25(float v) {
  float bp[][4] = {{0,12,0,50},{12.1,35.4,51,100},{35.5,55.4,101,150},
    {55.5,150.4,151,200},{150.5,250.4,201,300},{250.5,350.4,301,400},{350.5,500.4,401,500}};
  return aqiCalc(constrain(v,0,500.4), bp, 7);
}

int aqiFromO3(float v) {
  // EPA standard 8-hour O3 breakpoints (ppb), extended with 1-hour for high values
  float bp[][4] = {{0,54,0,50},{55,70,51,100},{71,85,101,150},
    {86,105,151,200},{106,200,201,300},{201,404,301,400},{405,604,401,500}};
  return aqiCalc(constrain(v,0,604), bp, 7);
}

int aqiFromCO(float v) {
  float bp[][4] = {{0,4.4,0,50},{4.5,9.4,51,100},{9.5,12.4,101,150},
    {12.5,15.4,151,200},{15.5,30.4,201,300},{30.5,40.4,301,400},{40.5,50.4,401,500}};
  return aqiCalc(constrain(v,0,50.4), bp, 7);
}

int aqiFromNO2(float v) {
  float bp[][4] = {{0,53,0,50},{54,100,51,100},{101,360,101,150},
    {361,649,151,200},{650,1249,201,300},{1250,1649,301,400},{1650,2049,401,500}};
  return aqiCalc(constrain(v,0,2049), bp, 7);
}

// =============================================
//  WEB SERVER — JSON DATA
// =============================================

void handleData() {
  String json = "{";
  json += "\"ready\":" + String(isLive ? "true" : "false") + ",";
  json += "\"pm25\":" + String(g_pm25, 1) + ",";
  json += "\"o3\":" + String(g_o3, 1) + ",";
  json += "\"co\":" + String(g_co, 2) + ",";
  json += "\"no2\":" + String(g_no2_ppb, 0) + ",";
  json += "\"co2\":" + String(g_co2, 0) + ",";
  json += "\"co_mq\":" + String(g_co_mq, 2) + ",";
  json += "\"voc\":" + String(g_voc) + ",";
  json += "\"uv\":" + String(g_uv, 1) + ",";
  json += "\"temp\":" + String(g_temp, 1) + ",";
  json += "\"hum\":" + String(g_hum, 1) + ",";
  json += "\"aqi\":" + String(g_aqi) + ",";
  json += "\"aqi_pm\":" + String(g_aqi_pm) + ",";
  json += "\"aqi_o3\":" + String(g_aqi_o3) + ",";
  json += "\"aqi_co\":" + String(g_aqi_co) + ",";
  json += "\"aqi_no2\":" + String(g_aqi_no2) + ",";
  json += "\"co_mems_v\":" + String(g_co_mems_v, 3) + ",";
  json += "\"no2_mems_v\":" + String(g_no2_mems_v, 3) + ",";
  json += "\"rain\":" + String(g_raining ? "true" : "false") + ",";
  json += "\"pm25_rain_delta\":" + String(g_pm25_rain_delta, 1) + ",";
  json += "\"pm25_tag\":\"" + String(pm25Tag(g_pm25)) + "\",";
  json += "\"o3_tag\":\"" + String(o3Tag(g_o3)) + "\",";
  json += "\"co_tag\":\"" + String(coTag(g_co)) + "\",";
  json += "\"no2_tag\":\"" + String(no2Tag(g_no2_ppb)) + "\",";
  json += "\"co2_tag\":\"" + String(co2Tag(g_co2)) + "\",";
  json += "\"voc_tag\":\"" + String(vocTag(g_voc)) + "\",";
  json += "\"uv_tag\":\"" + String(uvTag(g_uv)) + "\",";
  json += "\"label\":\"" + aqiLabel(g_aqi) + "\",";
  json += "\"color\":\"" + aqiColor(g_aqi) + "\"";
  json += "}";
  server.send(200, "application/json", json);
}

// =============================================
//  WEB SERVER — MAIN PAGE
// =============================================

void handleRoot() {
  String html = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AERIS Air Quality</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,sans-serif;background:#1a1a2e;color:#eee;padding:12px;min-height:100vh}
h1{text-align:center;font-size:22px;margin:8px 0;color:#fff}
.sub{text-align:center;font-size:11px;color:#888;margin-bottom:12px}
.aqi-box{text-align:center;padding:18px;border-radius:16px;margin:0 auto 14px;max-width:340px}
.aqi-num{font-size:64px;font-weight:bold}
.aqi-lbl{font-size:18px;margin-top:4px;font-weight:600}
.aqi-sub{font-size:11px;margin-top:8px;color:rgba(255,255,255,0.7)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:340px;margin:0 auto}
.card{background:#16213e;border-radius:12px;padding:12px;text-align:center}
.card .lbl{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px}
.card .val{font-size:26px;font-weight:bold;margin:4px 0;color:#fff}
.card .unit{font-size:11px;color:#aaa}
.card.wide{grid-column:span 2}
.tag{font-size:10px;font-weight:bold;padding:2px 8px;border-radius:8px;display:inline-block;margin-top:4px}
.tg{background:#00e400;color:#000}.ty{background:#ffff00;color:#000}.to{background:#ff7e00;color:#fff}.tr{background:#ff0000;color:#fff}
.g{color:#00e400}.y{color:#ffff00}.o{color:#ff7e00}.r{color:#ff0000}.p{color:#8f3f97}.m{color:#7e0023}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:4px;background:#0f0;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
#warmupOverlay{position:fixed;top:0;left:0;width:100%;height:100%;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:100}
#warmupOverlay h2{font-size:28px;margin-bottom:12px}
#warmupOverlay p{color:#888;font-size:14px;margin:6px 0}
.bar-outer{width:240px;height:14px;background:#16213e;border-radius:7px;margin:16px 0;overflow:hidden}
.bar-inner{height:100%;background:#00e400;border-radius:7px;transition:width 1s}
</style>
</head>
<body>

<div id="warmupOverlay">
  <h2>AERIS</h2>
  <p id="wpPhase">Warming up sensors...</p>
  <div class="bar-outer"><div class="bar-inner" id="wpBar" style="width:0%"></div></div>
  <p id="wpTime" style="color:#555">Please wait ~7 min</p>
  <p style="color:#444;font-size:11px;margin-top:20px">Sensors need time to stabilize</p>
</div>

<h1>AERIS</h1>
<p class="sub"><span class="dot"></span> Live Air Quality Monitor v4</p>

<div class="aqi-box" id="aqiBox">
  <div class="aqi-num" id="aqiNum">--</div>
  <div class="aqi-lbl" id="aqiLbl">Loading...</div>
  <div class="aqi-sub" id="aqiSub"></div>
</div>

<div class="grid">
  <div class="card"><div class="lbl">PM2.5</div><div class="val" id="pm25">--</div><div class="unit">ug/m3</div><div class="tag" id="pm25t"></div></div>
  <div class="card"><div class="lbl">Ozone</div><div class="val" id="o3">--</div><div class="unit">ppb</div><div class="tag" id="o3t"></div></div>
  <div class="card"><div class="lbl">CO</div><div class="val" id="co">--</div><div class="unit">ppm</div><div class="tag" id="cot"></div></div>
  <div class="card"><div class="lbl">NO2</div><div class="val" id="no2">--</div><div class="unit">ppb</div><div class="tag" id="no2t"></div></div>
  <div class="card"><div class="lbl">CO2 eq</div><div class="val" id="co2">--</div><div class="unit">ppm</div><div class="tag" id="co2t"></div></div>
  <div class="card"><div class="lbl">VOC Index</div><div class="val" id="voc">--</div><div class="unit">&nbsp;</div><div class="tag" id="voct"></div></div>
  <div class="card"><div class="lbl">Temperature</div><div class="val" id="temp">--</div><div class="unit">&deg;C</div></div>
  <div class="card"><div class="lbl">Humidity</div><div class="val" id="hum">--</div><div class="unit">%</div></div>
  <div class="card"><div class="lbl">UV Index</div><div class="val" id="uv">--</div><div class="unit">&nbsp;</div><div class="tag" id="uvt"></div></div>
  <div class="card"><div class="lbl">CO (MQ-7)</div><div class="val" id="comq">--</div><div class="unit">ppm ref</div></div>
  <div class="card wide" id="rainCard" style="display:none;background:#0a2540"><div class="lbl">Rain Status</div><div class="val" id="rainVal" style="color:#38bdf8">--</div><div class="unit" id="rainDelta"></div></div>
</div>

<script>
function cls(aqi){
  if(aqi<=50)return'g';if(aqi<=100)return'y';if(aqi<=150)return'o';
  if(aqi<=200)return'r';if(aqi<=300)return'p';return'm';
}
function tc(tag){
  if(['GOOD','SAFE','FRESH','CLEAN','LOW'].includes(tag))return'tg';
  if(['OK','MID'].includes(tag))return'ty';
  if(['POOR','HIGH','STUFFY','SMELL'].includes(tag))return'to';
  return'tr';
}
function st(id,tag){var e=document.getElementById(id);if(e&&tag){e.textContent=tag;e.className='tag '+tc(tag);}}
var bootMs=Date.now();
function update(){
  fetch('/data').then(r=>r.json()).then(d=>{
    var ov=document.getElementById('warmupOverlay');
    if(!d.ready){
      ov.style.display='flex';
      var sec=Math.floor((Date.now()-bootMs)/1000);
      var pct=Math.min(Math.floor(sec/420*100),99);
      document.getElementById('wpBar').style.width=pct+'%';
      var left=Math.max(420-sec,0);
      var m=Math.floor(left/60),s=left%60;
      document.getElementById('wpTime').textContent='Live in '+m+'m '+s+'s';
      if(sec<180)document.getElementById('wpPhase').textContent='Phase 1/3: Warming up sensors...';
      else if(sec<300)document.getElementById('wpPhase').textContent='Phase 2/3: Stabilizing readings...';
      else document.getElementById('wpPhase').textContent='Phase 3/3: Confirming stable values...';
      return;
    }
    ov.style.display='none';
    document.getElementById('aqiNum').textContent=d.aqi;
    document.getElementById('aqiNum').className='aqi-num '+cls(d.aqi);
    document.getElementById('aqiLbl').textContent=d.label;
    document.getElementById('aqiBox').style.background=d.color+'33';
    document.getElementById('aqiBox').style.border='2px solid '+d.color;
    document.getElementById('aqiSub').textContent='PM='+d.aqi_pm+' O3='+d.aqi_o3+' CO='+d.aqi_co+' NO2='+d.aqi_no2;
    document.getElementById('pm25').textContent=d.pm25;
    document.getElementById('o3').textContent=d.o3;
    document.getElementById('co').textContent=d.co;
    document.getElementById('no2').textContent=d.no2;
    document.getElementById('co2').textContent=d.co2;
    document.getElementById('voc').textContent=d.voc;
    document.getElementById('temp').textContent=d.temp;
    document.getElementById('hum').textContent=d.hum;
    document.getElementById('uv').textContent=d.uv;
    document.getElementById('comq').textContent=d.co_mq;
    st('pm25t',d.pm25_tag);st('o3t',d.o3_tag);st('cot',d.co_tag);
    st('no2t',d.no2_tag);st('co2t',d.co2_tag);st('voct',d.voc_tag);st('uvt',d.uv_tag);
    var rc=document.getElementById('rainCard');
    if(d.rain){rc.style.display='';document.getElementById('rainVal').textContent='RAINING';document.getElementById('rainDelta').textContent='PM2.5 reduced by '+d.pm25_rain_delta+' ug/m3';}
    else{rc.style.display='none';}
  }).catch(e=>console.log('fetch error'));
}
update();setInterval(update,5000);
</script>

</body>
</html>
)rawliteral";

  server.send(200, "text/html", html);
}

// =============================================
//  OLED PAGES
// =============================================

void drawOLED_AQI() {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  display.setTextSize(1);
  display.setCursor(30, 0);
  display.print("AIR QUALITY");

  display.setTextSize(3);
  String aq = String(g_aqi);
  int x = 64 - (aq.length() * 9);
  display.setCursor(x, 12);
  display.print(g_aqi);

  display.setTextSize(1);
  String lbl = aqiLabel(g_aqi);
  display.setCursor(64 - lbl.length() * 3, 38);
  display.print(lbl);

  display.drawRect(4, 48, 120, 6, SH110X_WHITE);
  int fill = map(constrain(g_aqi, 0, 500), 0, 500, 0, 116);
  if (fill > 0) display.fillRect(6, 50, fill, 2, SH110X_WHITE);

  display.setCursor(0, 57);
  display.print("PM:");  display.print(g_aqi_pm);
  display.print(" O3:"); display.print(g_aqi_o3);
  display.print(" CO:"); display.print(g_aqi_co);
  display.print(" NO:"); display.print(g_aqi_no2);
  display.display();
}

void drawOLED_Gases1() {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  display.setTextSize(1);
  display.setCursor(0, 1);   display.print("PM25");
  display.setTextSize(2);
  display.setCursor(30, 0);  display.print(g_pm25, 0);
  display.setTextSize(1);
  display.setCursor(98, 5);  display.print("ug/m3");

  display.setCursor(0, 19);  display.print("O3");
  display.setTextSize(2);
  display.setCursor(30, 18); display.print(g_o3, 1);
  display.setTextSize(1);
  display.setCursor(98, 23); display.print("ppb");

  display.setCursor(0, 37);  display.print("CO");
  display.setTextSize(2);
  display.setCursor(30, 36); display.print(g_co, 1);
  display.setTextSize(1);
  display.setCursor(98, 41); display.print("ppm");

  display.drawLine(0, 52, 127, 52, SH110X_WHITE);
  display.setCursor(0, 56);
  display.print("AQI:");  display.print(g_aqi);
  display.print(" [");    display.print(aqiLabel(g_aqi));
  display.print("]");
  display.display();
}

void drawOLED_Gases2() {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  display.setTextSize(1);
  display.setCursor(0, 1);   display.print("NO2");
  display.setTextSize(2);
  display.setCursor(30, 0);  display.print(g_no2_ppb, 0);
  display.setTextSize(1);
  display.setCursor(98, 5);  display.print("ppb");

  display.setCursor(0, 19);  display.print("CO2");
  display.setTextSize(2);
  display.setCursor(30, 18); display.print(g_co2, 0);
  display.setTextSize(1);
  display.setCursor(98, 23); display.print("ppm");

  display.setCursor(0, 37);  display.print("VOC");
  display.setTextSize(2);
  display.setCursor(30, 36);
  if (g_voc > 0) display.print(g_voc);
  else display.print("--");
  display.setTextSize(1);
  display.setCursor(98, 41); display.print("idx");

  display.drawLine(0, 52, 127, 52, SH110X_WHITE);
  display.setCursor(0, 56);
  display.print("AQI:");  display.print(g_aqi);
  display.print(" [");    display.print(aqiLabel(g_aqi));
  display.print("]");
  display.display();
}

void drawOLED_Env() {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  display.setTextSize(1);
  display.setCursor(0, 1);   display.print("TEMP");
  display.setTextSize(2);
  display.setCursor(30, 0);  display.print(g_temp, 1);
  display.setTextSize(1);
  display.setCursor(98, 5);  display.print("C");

  display.setCursor(0, 19);  display.print("HUM");
  display.setTextSize(2);
  display.setCursor(30, 18); display.print(g_hum, 0);
  display.setTextSize(1);
  display.setCursor(98, 23); display.print("%");

  display.setCursor(0, 37);  display.print("UV");
  display.setTextSize(2);
  display.setCursor(30, 36); display.print(g_uv, 1);
  display.setTextSize(1);
  display.setCursor(98, 41); display.print("idx");

  display.drawLine(0, 52, 127, 52, SH110X_WHITE);
  display.setCursor(0, 56);
  display.print("AQI:");  display.print(g_aqi);
  display.print(" [");    display.print(aqiLabel(g_aqi));
  display.print("]");
  display.display();
}

void drawOLED_Rain() {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  if (g_raining) {
    display.setTextSize(1);
    display.setCursor(10, 0);  display.print("~~ RAIN DETECTED ~~");
    display.setTextSize(2);
    display.setCursor(10, 14); display.print("RAINING");
    display.setTextSize(1);
    display.setCursor(0, 34);  display.print("PM2.5 now: ");
    display.print(g_pm25, 1);  display.print(" ug/m3");
    if (g_pm25_rain_delta > 0) {
      display.setCursor(0, 44);
      display.print("Reduced: -");
      display.print(g_pm25_rain_delta, 1);
      display.print(" ug/m3");
    }
  } else {
    display.setTextSize(1);
    display.setCursor(20, 0);  display.print("RAIN SENSOR");
    display.setTextSize(2);
    display.setCursor(20, 16); display.print("DRY");
    display.setTextSize(1);
    display.setCursor(0, 38);  display.print("PM2.5: ");
    display.print(g_pm25, 1);  display.print(" ug/m3");
  }

  display.drawLine(0, 52, 127, 52, SH110X_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 56);
  display.print("AQI:");  display.print(g_aqi);
  display.print(" [");    display.print(aqiLabel(g_aqi));
  display.print("]");
  display.display();
}

void drawWarmup(int pct, float temp, float hum) {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  display.setTextSize(2);
  display.setCursor(20, 0);  display.print("AERIS");

  display.setTextSize(1);
  display.setCursor(10, 22);
  display.print("Warming: ");
  display.print(pct);
  display.print("%");

  display.drawRect(4, 34, 120, 10, SH110X_WHITE);
  int fill = (pct * 116) / 100;
  if (fill > 0) display.fillRect(6, 36, fill, 6, SH110X_WHITE);

  display.setCursor(0, 48);
  display.print("T:");  display.print(temp, 1);
  display.print("C H:"); display.print(hum, 0);
  display.print("%");

  display.setCursor(0, 57);
  display.print("PM2.5: "); display.print(g_pm25, 1);
  display.print(" ug/m3");
  display.display();
}

void drawStabilize(int pct) {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  display.setTextSize(2);
  display.setCursor(20, 0);  display.print("AERIS");

  display.setTextSize(1);
  display.setCursor(5, 22);
  display.print("Stabilizing: ");
  display.print(pct);
  display.print("%");

  display.drawRect(4, 34, 120, 10, SH110X_WHITE);
  int fill = (pct * 116) / 100;
  if (fill > 0) display.fillRect(6, 36, fill, 6, SH110X_WHITE);

  display.setCursor(0, 48);
  display.print("AQI: ");
  display.print(g_aqi);
  display.print("  [");
  display.print(aqiLabel(g_aqi));
  display.print("]");

  display.setCursor(0, 57);
  display.print("Values settling...");
  display.display();
}

void drawReading(int pct) {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  display.setTextSize(2);
  display.setCursor(20, 0);  display.print("AERIS");

  display.setTextSize(1);
  display.setCursor(5, 22);
  display.print("Reading: ");
  display.print(pct);
  display.print("%");

  display.drawRect(4, 34, 120, 10, SH110X_WHITE);
  int fill = (pct * 116) / 100;
  if (fill > 0) display.fillRect(6, 36, fill, 6, SH110X_WHITE);

  display.setCursor(0, 48);
  display.print("AQI: ");
  display.print(g_aqi);
  display.print("  [");
  display.print(aqiLabel(g_aqi));
  display.print("]");

  display.setCursor(0, 57);
  display.print("Going live soon...");
  display.display();
}

void drawWifiInfo(String ip) {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(2);
  display.setCursor(20, 0);  display.print("AERIS");
  display.setTextSize(1);
  display.setCursor(0, 17);  display.print("Node: "); display.print(AERIS_NODE_ID);
  display.setCursor(0, 30);  display.print("WiFi OK  IP:");
  display.setCursor(0, 44);  display.print(ip);
  display.display();
}

// =============================================
//  I2C BUS RESET
// =============================================
void resetI2CBus() {
  Wire.end();
  delay(50);
  pinMode(22, OUTPUT);
  pinMode(21, INPUT_PULLUP);
  for (int i = 0; i < 16; i++) {
    digitalWrite(22, LOW);  delayMicroseconds(5);
    digitalWrite(22, HIGH); delayMicroseconds(5);
  }
  Wire.begin(21, 22);
  Wire.setClock(100000);
  delay(50);
}

// =============================================
//  PUSH TO AERIS BACKEND (only when LIVE)
// =============================================
void pushToBackend() {
  if (!wifiConnected || !isLive) return;

  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(3000);
    if (WiFi.status() != WL_CONNECTED) return;
    applyGoogleDNS();
  }

  WiFiClientSecure client;
  client.setInsecure();
  client.setHandshakeTimeout(10);

  HTTPClient http;
  String url = String(AERIS_SERVER) + "/api/v1/ingest";

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-KEY", AERIS_API_KEY);
  http.setTimeout(10000);

  // Flat JSON — matches backend controller destructuring:
  // { node_id, pm25, co, o3, nox, voc, temperature, humidity, oxygen, pressure }
  String json = "{";
  json += "\"node_id\":\"" + String(AERIS_NODE_ID) + "\",";
  json += "\"pm25\":" + String(g_pm25, 2) + ",";
  json += "\"co\":" + String(g_co, 2) + ",";
  json += "\"o3\":" + String(g_o3, 2) + ",";           // ppb
  json += "\"nox\":" + String(g_no2_ppb, 2) + ",";     // ppb — backend column is 'nox'
  json += "\"voc\":" + String(g_voc) + ",";             // SGP40 VOC index
  json += "\"temperature\":" + String(g_temp, 2) + ",";
  json += "\"humidity\":" + String(g_hum, 2) + ",";
  json += "\"rain\":" + String(g_raining ? "true" : "false") + ",";
  json += "\"pm25_rain_delta\":" + String(g_pm25_rain_delta, 2);
  json += "}";

  int httpCode = http.POST(json);

  if (httpCode == 201)     Serial.println("  [BACKEND] OK");
  else if (httpCode > 0) { Serial.print("  [BACKEND] HTTP "); Serial.println(httpCode); }
  else                   { Serial.print("  [BACKEND] FAIL: "); Serial.println(http.errorToString(httpCode)); }

  http.end();
}

// =============================================
//  SETUP
// =============================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println(">>> AERIS BOOTING...");
  Serial.flush();
  delay(200);

  Serial.println();
  Serial.println("==========================================");
  Serial.println("   AERIS Air Quality Monitor v4");
  Serial.print  ("   Node: ");
  Serial.println(AERIS_NODE_ID);
  Serial.println("   7-min boot: Warmup > Stabilize > Read");
  Serial.println("==========================================");
  Serial.println();

  // ADC eFuse calibration
  Serial.print("[ADC] eFuse calibrating... ");
  esp_adc_cal_characterize(ADC_UNIT_1, ADC_ATTEN_DB_11, ADC_WIDTH_BIT_12, 1100, &adc1_chars);
  esp_adc_cal_characterize(ADC_UNIT_2, ADC_ATTEN_DB_11, ADC_WIDTH_BIT_12, 1100, &adc2_chars);
  Serial.println("OK");

  // Rain sensor
  pinMode(RAIN_SENSOR_PIN, INPUT_PULLUP);

  // Analog pins
  pinMode(DUST_LED_PIN, OUTPUT);
  digitalWrite(DUST_LED_PIN, HIGH);
  analogSetPinAttenuation(DUST_ANALOG_PIN, ADC_11db);
  analogSetPinAttenuation(MQ131_PIN, ADC_11db);
  analogSetPinAttenuation(MQ7_PIN, ADC_11db);
  analogSetPinAttenuation(MQ135_PIN, ADC_11db);
  analogSetPinAttenuation(UV_PIN, ADC_11db);
  analogSetPinAttenuation(CO_MEMS_PIN, ADC_11db);
  analogSetPinAttenuation(NO2_MEMS_PIN, ADC_11db);

  // MEMS baselines BEFORE WiFi — 100-sample median
  Serial.println("[MEMS] Reading baselines (100 samples)...");
  float co_b[100], no2_b[100];
  for (int i = 0; i < 100; i++) {
    co_b[i]  = esp_adc_cal_raw_to_voltage(analogRead(CO_MEMS_PIN), &adc2_chars) / 1000.0;
    no2_b[i] = esp_adc_cal_raw_to_voltage(analogRead(NO2_MEMS_PIN), &adc2_chars) / 1000.0;
    delay(20);
  }
  sortFloats(co_b, 100);
  sortFloats(no2_b, 100);
  CO_MEMS_BASELINE  = co_b[50];
  NO2_MEMS_BASELINE = no2_b[50];
  no2Inverted = (NO2_MEMS_BASELINE > 2.5);
  g_co_mems_v  = CO_MEMS_BASELINE;
  g_no2_mems_v = NO2_MEMS_BASELINE;

  Serial.print("  CO  baseline: "); Serial.print(CO_MEMS_BASELINE, 3); Serial.println(" V");
  Serial.print("  NO2 baseline: "); Serial.print(NO2_MEMS_BASELINE, 3);
  Serial.println(no2Inverted ? " V (INVERTED)" : " V");

  // I2C
  Wire.begin(21, 22);
  Wire.setClock(100000);
  delay(100);

  int devCount = 0;
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) devCount++;
  }
  if (devCount < 3) { resetI2CBus(); delay(200); }

  // OLED
  if (display.begin(0x3C, true)) {
    hasOLED = true;
    display.clearDisplay(); display.display();
  }
  delay(100);

  // SHT31
  if (sht31.begin(0x44)) hasSHT31 = true;
  else if (sht31.begin(0x45)) hasSHT31 = true;
  delay(100);

  // SGP40
  if (sgp.begin()) hasSGP40 = true;
  else { resetI2CBus(); delay(200); if (sgp.begin()) hasSGP40 = true; }
  delay(100);

  Serial.print("  OLED:  "); Serial.println(hasOLED  ? "OK" : "MISSING");
  Serial.print("  SHT31: "); Serial.println(hasSHT31 ? "OK" : "MISSING");
  Serial.print("  SGP40: "); Serial.println(hasSGP40 ? "OK" : "MISSING");

  // WiFi
  Serial.print("[WIFI] Connecting to ");
  Serial.print(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASS);

  if (hasOLED) {
    display.clearDisplay();
    display.setTextColor(SH110X_WHITE);
    display.setTextSize(2); display.setCursor(20, 0);  display.print("AERIS");
    display.setTextSize(1);
    display.setCursor(0, 18); display.print("Node: "); display.print(AERIS_NODE_ID);
    display.setCursor(0, 32); display.print("Connecting WiFi...");
    display.setCursor(0, 46); display.print(WIFI_SSID);
    display.display();
  }

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500); Serial.print("."); attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println(" OK!");
    Serial.print("  IP: "); Serial.println(WiFi.localIP());

    IPAddress dns1(8, 8, 8, 8);
    IPAddress dns2(8, 8, 4, 4);
    WiFi.config(WiFi.localIP(), WiFi.gatewayIP(), WiFi.subnetMask(), dns1, dns2);

    server.on("/", handleRoot);
    server.on("/data", handleData);
    server.begin();

    if (hasOLED) { drawWifiInfo(WiFi.localIP().toString()); delay(3000); }
  } else {
    Serial.println(" FAILED");
  }

  bootTime = millis();
  lastDisplayUpdate = millis() - DISPLAY_INTERVAL;

  Serial.println();
  Serial.println("  BOOT SEQUENCE (7 min):");
  Serial.println("    Phase 1: 0-3 min  — Warming up MQ heaters");
  Serial.println("    Phase 2: 3-5 min  — Calibrate + stabilize");
  Serial.println("    Phase 3: 5-7 min  — Reading stable values");
  Serial.println("    After 7 min       — LIVE (DB + website)");
  Serial.println();
  Serial.println("  PM2.5, Temp, Humidity, UV available immediately.");
  Serial.println("  Gas readings start at Phase 2.");
  Serial.println();
}

// =============================================
//  MAIN LOOP
// =============================================
void loop() {
  // Web server always responsive (shows warmup screen before live)
  if (wifiConnected && WiFi.status() == WL_CONNECTED)
    server.handleClient();

  unsigned long now = millis();

  // ---- Sensor read every 15 seconds ----
  if (now - lastSensorRead < SENSOR_INTERVAL) return;
  lastSensorRead = now;
  unsigned long elapsed = now - bootTime;

  // ---- Read ADC1 sensors (Median → EMA pipeline) ----
  float pm_raw = readDustPM25();
  float pm_med = medianPush(mf_pm25, pm_raw);
  pm25_ema = applyEMA(pm_med, pm25_ema);

  float rs131 = readMQResistance(MQ131_PIN, MQ131_RL_KOHM, MQ131_VCC);
  float rs131_med = medianPush(mf_mq131, rs131);
  mq131Rs_ema = applyEMA(rs131_med, mq131Rs_ema);
  float rs7 = readMQResistance(MQ7_PIN, MQ7_RL_KOHM, MQ7_VCC);
  float rs7_med = medianPush(mf_mq7, rs7);
  mq7Rs_ema = applyEMA(rs7_med, mq7Rs_ema);
  float rs135 = readMQResistance(MQ135_PIN, MQ135_RL_KOHM, MQ135_VCC);
  float rs135_med = medianPush(mf_mq135, rs135);
  mq135Rs_ema = applyEMA(rs135_med, mq135Rs_ema);

  float uv_raw = readUVIndex();
  float uv_med = medianPush(mf_uv, uv_raw);
  uv_ema = applyEMA(uv_med, uv_ema);

  // ---- Read I2C sensors ----
  float temperature = 0, humidity = 0;
  if (hasSHT31) {
    temperature = sht31.readTemperature();
    humidity    = sht31.readHumidity();
    if (isnan(temperature)) temperature = 0;
    if (isnan(humidity))    humidity = 0;
  }

  uint16_t vocIndex = 0;
  if (hasSGP40) {
    uint16_t r = (hasSHT31 && temperature > 0)
      ? sgp.measureVocIndex(temperature, humidity)
      : sgp.measureVocIndex();
    if (r > 0) { vocIndex = r; g_voc_lastgood = r; }
    else vocIndex = g_voc_lastgood;
  }

  // ---- Read MEMS via WiFi pause (even during warmup) ----
  if (now - lastADC2Read >= ADC2_INTERVAL) {
    lastADC2Read = now;
    if (wifiConnected) {
      readADC2Sensors();
    } else {
      float cv = readV_ADC2(CO_MEMS_PIN, 30);
      float nv = readV_ADC2(NO2_MEMS_PIN, 30);
      float cv_med = medianPush(mf_co_mems, cv);
      float nv_med = medianPush(mf_no2_mems, nv);
      co_mems_ema  = applyEMA(cv_med, co_mems_ema);
      no2_mems_ema = applyEMA(nv_med, no2_mems_ema);
      g_co_mems_v  = (co_mems_ema >= 0) ? co_mems_ema : cv;
      g_no2_mems_v = (no2_mems_ema >= 0) ? no2_mems_ema : nv;
    }

    // DYNAMIC BASELINE TRACKING — adapts to thermal drift over time
    // If current voltage drops below baseline, slowly pull baseline down
    if (g_co_mems_v < CO_MEMS_BASELINE - 0.01) {
      CO_MEMS_BASELINE = CO_MEMS_BASELINE * 0.999 + g_co_mems_v * 0.001;
    }
    if (!no2Inverted && g_no2_mems_v < NO2_MEMS_BASELINE - 0.01) {
      NO2_MEMS_BASELINE = NO2_MEMS_BASELINE * 0.999 + g_no2_mems_v * 0.001;
    }
  }

  // ---- Rain Detection (debounced) ----
  bool wasRaining = g_raining;
  bool pinLow = (digitalRead(RAIN_SENSOR_PIN) == LOW);
  if (pinLow) g_rain_count = min(g_rain_count + 1, RAIN_DEBOUNCE_COUNT + 1);
  else        g_rain_count = max(g_rain_count - 1, 0);
  g_raining = (g_rain_count >= RAIN_DEBOUNCE_COUNT);

  if (g_raining && !wasRaining) {
    g_pm25_before_rain = pm25_ema >= 0 ? pm25_ema : 0;
    g_pm25_rain_delta = 0;
  }
  if (g_raining && g_pm25_before_rain > 0) {
    float currentPM = pm25_ema >= 0 ? pm25_ema : 0;
    g_pm25_rain_delta = g_pm25_before_rain - currentPM;
    if (g_pm25_rain_delta < 0) g_pm25_rain_delta = 0;
  }

  // Update basic globals with deadband (suppress jitter)
  float new_pm25 = deadband(pm25_ema, g_pm25, DB_PM25);
  float new_uv   = deadband(uv_ema, g_uv, DB_UV);
  float new_temp  = deadband(temperature, g_temp, DB_TEMP);
  float new_hum   = deadband(humidity, g_hum, DB_HUM);
  int   new_voc   = (abs((int)vocIndex - (int)g_voc) >= DB_VOC) ? vocIndex : g_voc;

  if (new_pm25 != g_pm25 || new_uv != g_uv || new_temp != g_temp ||
      new_hum != g_hum || new_voc != g_voc) {
    displayDirty = true;
  }
  g_pm25 = new_pm25; g_uv = new_uv;
  g_temp = new_temp; g_hum = new_hum; g_voc = new_voc;

  // ================================================================
  //  PHASE 1: WARMUP (0-3 min) — MQ heaters warming
  // ================================================================
  if (!warmedUp && elapsed < WARMUP_END) {
    int pct = (elapsed * 100) / WARMUP_END;

    g_aqi_pm = aqiFromPM25(g_pm25);
    g_aqi = g_aqi_pm;

    if (now - lastDisplayUpdate >= DISPLAY_INTERVAL) {
      lastDisplayUpdate = now;

      Serial.println("========== PHASE 1: WARMING UP ==========");
      Serial.print("  Progress: "); Serial.print(pct); Serial.println("%");
      Serial.println();
      Serial.print("  PM2.5:     "); Serial.print(g_pm25, 1);  Serial.println(" ug/m3");
      Serial.print("  Temp:      "); Serial.print(temperature, 1); Serial.println(" C");
      Serial.print("  Humidity:  "); Serial.print(humidity, 1); Serial.println(" %");
      Serial.print("  UV:        "); Serial.print(g_uv, 1); Serial.println(" idx");
      if (vocIndex > 0) {
        Serial.print("  VOC:       "); Serial.print(vocIndex); Serial.println(" idx");
      }
      Serial.println();
      int minLeft = (WARMUP_END - elapsed) / 60000 + 1;
      Serial.print("  Gas sensors ready in ~"); Serial.print(minLeft); Serial.println(" min");
      Serial.print("  System goes LIVE in ~"); Serial.print((LIVE_START - elapsed) / 60000 + 1); Serial.println(" min");
      Serial.println("==========================================");
      Serial.println();

      if (hasOLED) drawWarmup(pct, temperature, humidity);
    }
    return;
  }

  // ---- Calibrate Ro ONCE at 3 min (fresh reading) ----
  if (!warmedUp) {
    warmedUp = true;

    float r1 = readMQResistance(MQ131_PIN, MQ131_RL_KOHM, MQ131_VCC);
    float r7 = readMQResistance(MQ7_PIN,   MQ7_RL_KOHM,   MQ7_VCC);
    float r3 = readMQResistance(MQ135_PIN, MQ135_RL_KOHM, MQ135_VCC);

    MQ131_Ro = r1 / MQ131_CLEAN_AIR_FACTOR;
    MQ7_Ro   = r7 / MQ7_CLEAN_AIR_FACTOR;
    MQ135_Ro = r3 / MQ135_CLEAN_AIR_FACTOR;
    if (MQ131_Ro < 0.1) MQ131_Ro = 1.0;
    if (MQ7_Ro   < 0.1) MQ7_Ro   = 1.0;
    if (MQ135_Ro < 0.1) MQ135_Ro = 1.0;

    mq131Rs_ema = r1;
    mq7Rs_ema   = r7;
    mq135Rs_ema = r3;

    Serial.println("=========================================");
    Serial.println("  Ro CALIBRATED — entering stabilization");
    Serial.print("  MQ-131  Ro = "); Serial.print(MQ131_Ro, 1); Serial.println("k");
    Serial.print("  MQ-7   Ro = ");  Serial.print(MQ7_Ro, 1);   Serial.println("k");
    Serial.print("  MQ-135  Ro = "); Serial.print(MQ135_Ro, 1); Serial.println("k");
    Serial.println("=========================================");
    Serial.println();

    lastDisplayUpdate = now;
  }

  // ---- Calculate gas values (Phase 2+ onwards) ----
  float corr = mqCorrection(temperature, humidity);

  float o3_ratio  = (MQ131_Ro > 0.1) ? (mq131Rs_ema * corr / MQ131_Ro) : 0.0;
  float co_ratio  = (MQ7_Ro   > 0.1) ? (mq7Rs_ema   * corr / MQ7_Ro)   : 0.0;
  float co2_ratio = (MQ135_Ro > 0.1) ? (mq135Rs_ema * corr / MQ135_Ro) : 0.0;

  float o3_ppb    = ozonePPB(o3_ratio);
  float co_mq_ppm = coPPM_MQ(co_ratio);
  float co2_ppm   = mq135CO2(co2_ratio);
  float co_mems   = coPPM_MEMS(g_co_mems_v);
  float no2_ppb   = no2PPB_MEMS(g_no2_mems_v);
  float co_best   = (co_mems > 0) ? co_mems : co_mq_ppm;

  int aqi_pm  = aqiFromPM25(g_pm25);
  int aqi_o3  = aqiFromO3(o3_ppb);
  int aqi_co  = aqiFromCO(co_best);
  int aqi_no2 = aqiFromNO2(no2_ppb);
  int totalAQI = max(max(aqi_pm, aqi_o3), max(aqi_co, aqi_no2));

  // Update gas globals with deadband (suppress jitter)
  float new_o3  = deadband(o3_ppb, g_o3, DB_O3);
  float new_co  = deadband(co_best, g_co, DB_CO);
  float new_no2 = deadband(no2_ppb, g_no2_ppb, DB_NO2);
  float new_co2 = deadband(co2_ppm, g_co2, DB_CO2);

  if (new_o3 != g_o3 || new_co != g_co || new_no2 != g_no2_ppb || new_co2 != g_co2) {
    displayDirty = true;
  }

  g_o3 = new_o3; g_co = new_co; g_co_mq = co_mq_ppm;
  g_no2_ppb = new_no2; g_co2 = new_co2;

  // NaN / bounds cleanup
  if (isnan(g_pm25) || g_pm25 < 0) g_pm25 = 0;
  if (isnan(g_o3) || g_o3 < 0) g_o3 = 0;
  if (isnan(g_co) || g_co < 0) g_co = 0;
  if (isnan(g_no2_ppb) || g_no2_ppb < 0) g_no2_ppb = 0;
  if (isnan(g_co2) || g_co2 < 0) g_co2 = 400;
  if (isnan(g_uv) || g_uv < 0) g_uv = 0;
  if (g_pm25 < 2) g_pm25 = 0;
  if (g_no2_ppb < 10) g_no2_ppb = 0;
  if (g_co < 0.2) g_co = 0;
  if (no2_ppb > 1500) { no2_ppb = 1500; g_no2_ppb = 1500; }
  if (g_pm25 > 500) g_pm25 = 500;

  // AQI with deadband
  int new_aqi = (abs(totalAQI - g_aqi) >= DB_AQI) ? totalAQI : g_aqi;
  if (new_aqi != g_aqi) displayDirty = true;
  g_aqi = new_aqi; g_aqi_pm = aqi_pm; g_aqi_o3 = aqi_o3;
  g_aqi_co = aqi_co; g_aqi_no2 = aqi_no2;

  // ================================================================
  //  PHASE 2: STABILIZING (3-5 min) — values settling, serial only
  // ================================================================
  if (!stabilized && elapsed < STABILIZE_END) {
    int pct = ((elapsed - WARMUP_END) * 100) / (STABILIZE_END - WARMUP_END);

    if (now - lastDisplayUpdate >= DISPLAY_INTERVAL) {
      lastDisplayUpdate = now;

      Serial.println("======== PHASE 2: STABILIZING (serial only) ========");
      Serial.print("  Progress: "); Serial.print(pct); Serial.println("%");
      Serial.print("  Values settling — NOT sent to DB or website yet");
      Serial.println();
      Serial.println();

      Serial.print("  PM2.5     "); Serial.print(g_pm25, 1);
      Serial.print(" ug/m3    ["); Serial.print(pm25Tag(g_pm25)); Serial.println("]");
      Serial.print("  Ozone      "); Serial.print(o3_ppb, 1);
      Serial.print(" ppb      ["); Serial.print(o3Tag(o3_ppb)); Serial.println("]");
      Serial.print("  CO         "); Serial.print(co_best, 2);
      Serial.print(" ppm      ["); Serial.print(coTag(co_best)); Serial.println("]");
      Serial.print("  NO2         "); Serial.print(no2_ppb, 0);
      Serial.print(" ppb      ["); Serial.print(no2Tag(no2_ppb)); Serial.println("]");
      Serial.print("  CO2        "); Serial.print(co2_ppm, 0);
      Serial.print(" ppm      ["); Serial.print(co2Tag(co2_ppm)); Serial.println("]");
      Serial.print("  VOC        "); Serial.print(vocIndex);
      Serial.print("           ["); Serial.print(vocTag(vocIndex)); Serial.println("]");
      Serial.print("  Temp      "); Serial.print(temperature, 1);
      Serial.print(" C        ["); Serial.print(tempTag(temperature)); Serial.println("]");
      Serial.print("  Humidity  "); Serial.print(humidity, 1);
      Serial.print(" %        ["); Serial.print(humTag(humidity)); Serial.println("]");
      Serial.print("  UV         "); Serial.print(g_uv, 1);
      Serial.print("          ["); Serial.print(uvTag(g_uv)); Serial.println("]");
      Serial.println();
      Serial.print("  AQI: "); Serial.print(totalAQI);
      Serial.print("  ["); Serial.print(aqiLabel(totalAQI)); Serial.println("]");
      Serial.print("  LIVE in ~"); Serial.print((LIVE_START - elapsed) / 60000 + 1); Serial.println(" min");
      Serial.println("====================================================");
      Serial.println();

      if (hasOLED) drawStabilize(pct);
    }
    return;
  }

  // Mark stabilized
  if (!stabilized) {
    stabilized = true;
    Serial.println("=========================================");
    Serial.println("  STABILIZED — entering reading phase");
    Serial.println("=========================================");
    Serial.println();
    lastDisplayUpdate = now;
  }

  // ================================================================
  //  PHASE 3: READING (5-7 min) — serial + OLED, no DB/website
  // ================================================================
  if (!isLive && elapsed < LIVE_START) {
    int pct = ((elapsed - STABILIZE_END) * 100) / (LIVE_START - STABILIZE_END);

    if (now - lastDisplayUpdate >= DISPLAY_INTERVAL) {
      lastDisplayUpdate = now;

      int secLeft = (LIVE_START - elapsed) / 1000;

      Serial.println("======== PHASE 3: READING SENSORS (serial + OLED) ========");
      Serial.print("  Progress: "); Serial.print(pct); Serial.println("%");
      Serial.print("  Going LIVE in "); Serial.print(secLeft); Serial.println(" sec");
      Serial.println("  Stable hardware values — DB + website activate after this");
      Serial.println();

      Serial.print("  PM2.5     "); Serial.print(g_pm25, 1);
      Serial.print(" ug/m3    ["); Serial.print(pm25Tag(g_pm25));
      Serial.print("]  "); Serial.println(pm25Tip(g_pm25));
      Serial.print("  Ozone      "); Serial.print(o3_ppb, 1);
      Serial.print(" ppb      ["); Serial.print(o3Tag(o3_ppb));
      Serial.print("]  "); Serial.println(o3Tip(o3_ppb));
      Serial.print("  CO         "); Serial.print(co_best, 2);
      Serial.print(" ppm      ["); Serial.print(coTag(co_best));
      Serial.print("]  "); Serial.println(coTip(co_best));
      Serial.print("  NO2         "); Serial.print(no2_ppb, 0);
      Serial.print(" ppb      ["); Serial.print(no2Tag(no2_ppb));
      Serial.print("]  "); Serial.println(no2Tip(no2_ppb));
      Serial.print("  CO2        "); Serial.print(co2_ppm, 0);
      Serial.print(" ppm      ["); Serial.print(co2Tag(co2_ppm));
      Serial.print("]  "); Serial.println(co2Tip(co2_ppm));
      Serial.print("  VOC        "); Serial.print(vocIndex);
      Serial.print("           ["); Serial.print(vocTag(vocIndex));
      Serial.print("]  "); Serial.println(vocTip(vocIndex));
      Serial.print("  Temp      "); Serial.print(temperature, 1);
      Serial.print(" C        ["); Serial.print(tempTag(temperature)); Serial.println("]");
      Serial.print("  Humidity  "); Serial.print(humidity, 1);
      Serial.print(" %        ["); Serial.print(humTag(humidity)); Serial.println("]");
      Serial.print("  UV         "); Serial.print(g_uv, 1);
      Serial.print("          ["); Serial.print(uvTag(g_uv));
      Serial.print("]  "); Serial.println(uvTip(g_uv));
      Serial.print("  Rain:      "); Serial.println(g_raining ? "YES" : "No");
      Serial.println();
      Serial.print("  AQI: "); Serial.print(totalAQI);
      Serial.print("  ["); Serial.print(aqiLabel(totalAQI)); Serial.println("]");
      Serial.print("  AQI breakdown: PM="); Serial.print(aqi_pm);
      Serial.print("  O3="); Serial.print(aqi_o3);
      Serial.print("  CO="); Serial.print(aqi_co);
      Serial.print("  NO2="); Serial.println(aqi_no2);
      Serial.println("=========================================================");
      Serial.println();

      // OLED shows real sensor pages during Phase 3
      if (hasOLED) {
        switch (oledPage) {
          case 0: drawOLED_AQI();    break;
          case 1: drawOLED_Gases1(); break;
          case 2: drawOLED_Gases2(); break;
          case 3: drawOLED_Env();    break;
        }
        oledPage = (oledPage + 1) % 4;
      }
    }
    return;
  }

  // ================================================================
  //  PHASE 4: LIVE (7+ min) — everything active
  // ================================================================

  if (!isLive) {
    isLive = true;
    Serial.println();
    Serial.println("*************************************************");
    Serial.println("*                                               *");
    Serial.println("*         AERIS IS NOW LIVE!                    *");
    Serial.println("*                                               *");
    Serial.println("*   DB push: ACTIVE                             *");
    Serial.println("*   Website: ACTIVE                             *");
    Serial.println("*   OLED:    ACTIVE                             *");
    Serial.println("*   Serial:  ACTIVE                             *");
    Serial.println("*                                               *");
    Serial.println("*************************************************");
    Serial.println();
    lastDisplayUpdate = now;
    lastBackendPush = now;
  }

  // ---- Push to AERIS Backend ----
  if (wifiConnected && millis() - lastBackendPush >= BACKEND_INTERVAL) {
    lastBackendPush = millis();
    pushToBackend();
  }

  // ---- Display every 30 sec (only if data changed) ----
  if (now - lastDisplayUpdate < DISPLAY_INTERVAL) return;
  if (!displayDirty) return;
  lastDisplayUpdate = now;
  displayDirty = false;

  // ---- Serial Report (LIVE) ----
  Serial.println("========== AERIS AIR QUALITY REPORT [LIVE] ==========");
  Serial.println();
  Serial.print("  OVERALL AQI: ");
  Serial.print(g_aqi);
  Serial.print("  -  ");
  Serial.println(aqiLabel(g_aqi));
  Serial.print("  ");
  Serial.println(aqiAdvice(g_aqi));
  Serial.println();

  Serial.println("  ---- WHAT YOU'RE BREATHING ----");

  Serial.print("  PM2.5     "); Serial.print(g_pm25, 1);
  Serial.print(" ug/m3    ["); Serial.print(pm25Tag(g_pm25));
  Serial.print("]  "); Serial.println(pm25Tip(g_pm25));

  Serial.print("  Ozone      "); Serial.print(o3_ppb, 1);
  Serial.print(" ppb      ["); Serial.print(o3Tag(o3_ppb));
  Serial.print("]  "); Serial.println(o3Tip(o3_ppb));

  Serial.print("  CO         "); Serial.print(co_best, 2);
  Serial.print(" ppm      ["); Serial.print(coTag(co_best));
  Serial.print("]  "); Serial.println(coTip(co_best));

  Serial.print("  NO2         "); Serial.print(no2_ppb, 0);
  Serial.print(" ppb      ["); Serial.print(no2Tag(no2_ppb));
  Serial.print("]  "); Serial.println(no2Tip(no2_ppb));

  Serial.print("  CO2        "); Serial.print(co2_ppm, 0);
  Serial.print(" ppm      ["); Serial.print(co2Tag(co2_ppm));
  Serial.print("]  "); Serial.println(co2Tip(co2_ppm));

  Serial.print("  VOC        "); Serial.print(vocIndex);
  Serial.print("           ["); Serial.print(vocTag(vocIndex));
  Serial.print("]  "); Serial.println(vocTip(vocIndex));

  Serial.println();
  Serial.println("  ---- ENVIRONMENT ----");

  Serial.print("  Temp      "); Serial.print(temperature, 1);
  Serial.print(" C        ["); Serial.print(tempTag(temperature)); Serial.println("]");

  Serial.print("  Humidity  "); Serial.print(humidity, 1);
  Serial.print(" %        ["); Serial.print(humTag(humidity)); Serial.println("]");

  Serial.print("  UV Index   "); Serial.print(g_uv, 1);
  Serial.print("          ["); Serial.print(uvTag(g_uv));
  Serial.print("]  "); Serial.println(uvTip(g_uv));

  Serial.print("  Rain:      "); Serial.println(g_raining ? "YES - Raining" : "No");
  if (g_raining && g_pm25_rain_delta > 0) {
    Serial.print("  PM2.5 drop: -"); Serial.print(g_pm25_rain_delta, 1);
    Serial.println(" ug/m3 (rain effect)");
  }

  Serial.println();
  Serial.print("  AQI breakdown: PM="); Serial.print(aqi_pm);
  Serial.print("  O3="); Serial.print(aqi_o3);
  Serial.print("  CO="); Serial.print(aqi_co);
  Serial.print("  NO2="); Serial.println(aqi_no2);

  if (wifiConnected) {
    Serial.print("  Dashboard: http://");
    Serial.println(WiFi.localIP());
  }
  Serial.println("=====================================================");
  Serial.println();

  // ---- OLED pages (only in LIVE mode) ----
  if (hasOLED) {
    switch (oledPage) {
      case 0: drawOLED_AQI();    break;
      case 1: drawOLED_Gases1(); break;
      case 2: drawOLED_Gases2(); break;
      case 3: drawOLED_Env();    break;
      case 4: drawOLED_Rain();   break;
    }
    oledPage = (oledPage + 1) % 5;
  }
}
