// =============================================
//  AERIS Air Quality System — Node 3
//  All sensors reading correctly with ADC2/WiFi fix
// =============================================
//
//  KEY FIX: ESP32 ADC2 pins (GPIO 0,2,4,12-15,25-27) cannot be read
//  while WiFi is active. CO MEMS (pin 26) and NO2 MEMS (pin 27) are
//  ADC2 channels, so they always read 0 with WiFi on.
//
//  Solution: Periodically pause WiFi, read ADC2 pins, then reconnect.
//  ADC1 pins (GPIO 32-36,39) work fine with WiFi.
//
//  PIN MAP:
//    ADC1 (always works):
//      34 = Dust sensor analog (PM2.5)
//      32 = MQ-131 (Ozone)
//      35 = MQ-7 (CO reference)
//      36 = MQ-135 (CO2/VOC)
//      33 = UV sensor
//    ADC2 (needs WiFi pause):
//      26 = CO MEMS (SEN0564)
//      27 = NO2 MEMS (SEN0574)
//    Digital input:
//      23 = Rain detection sensor (LOW = rain)
//    Digital output:
//      25 = Dust sensor LED
//    I2C (SDA=21, SCL=22):
//      SGP40 (VOC), SHT31 (Temp/Hum), SH1106 OLED
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
// ADC1 pins (work with WiFi)
#define DUST_LED_PIN    25   // Digital output
#define DUST_ANALOG_PIN 34   // ADC1_CH6
#define MQ131_PIN       32   // ADC1_CH4 — Ozone
#define MQ7_PIN         35   // ADC1_CH7 — CO (MQ)
#define MQ135_PIN       36   // ADC1_CH0 — CO2/Air quality
#define UV_PIN          33   // ADC1_CH5 — UV index

// ADC2 pins (BLOCKED by WiFi — need special handling)
#define CO_MEMS_PIN     26   // ADC2_CH9 — SEN0564 CO
#define NO2_MEMS_PIN    27   // ADC2_CH7 — SEN0574 NO2

// Rain detection sensor (digital input — LOW when water detected)
#define RAIN_SENSOR_PIN 23

// =============================================
//  SENSOR FLAGS
// =============================================
bool hasOLED  = false;
bool hasSGP40 = false;
bool hasSHT31 = false;
bool wifiConnected = false;

// Rain detection state
bool g_raining = false;
float g_pm25_before_rain = 0;   // PM2.5 snapshot when rain started
float g_pm25_rain_delta  = 0;   // reduction in PM2.5 during rain

// =============================================
//  CALIBRATION
// =============================================
const float DUST_CLEAN_VOLTAGE     = 0.5;

const float MQ131_RL_KOHM          = 10.0;
const float MQ131_VCC              = 5.0;
const float MQ131_CLEAN_AIR_FACTOR = 15.0;

const float MQ7_RL_KOHM            = 10.0;
const float MQ7_VCC                = 5.0;
const float MQ7_CLEAN_AIR_FACTOR   = 27.5;

const float MQ135_RL_KOHM          = 10.0;
const float MQ135_VCC              = 5.0;
const float MQ135_CLEAN_AIR_FACTOR = 3.6;

const float SEN0564_RANGE          = 1000.0;  // CO full scale ppm
const float SEN0574_RANGE          = 10.0;     // NO2 full scale ppm
const float UV_SCALE               = 10.0;

float MQ131_Ro = 0;
float MQ7_Ro   = 0;
float MQ135_Ro = 0;

float CO_MEMS_BASELINE  = 0;
float NO2_MEMS_BASELINE = 0;
bool  memsCalibrated    = false;

// =============================================
//  SMOOTHING (EMA)
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
//  STATE
// =============================================
unsigned long bootTime;
const unsigned long WARMUP_MS = 120000;
bool warmedUp = false;
int oledPage  = 0;

unsigned long lastSensorRead = 0;
const unsigned long SENSOR_INTERVAL = 5000;

// ADC2 read timer — read every 15 seconds (WiFi pause is brief)
unsigned long lastADC2Read = 0;
const unsigned long ADC2_INTERVAL = 15000;

// =============================================
//  LATEST READINGS (shared with web server)
// =============================================
float g_pm25 = 0, g_o3 = 0, g_co = 0, g_no2_ppb = 0;
float g_co2 = 0, g_co_mq = 0, g_uv = 0;
float g_temp = 0, g_hum = 0;
uint16_t g_voc = 0;
int g_aqi = 0, g_aqi_pm = 0, g_aqi_o3 = 0, g_aqi_co = 0, g_aqi_no2 = 0;

// Raw ADC2 voltages (updated when WiFi is paused)
float g_co_mems_v  = 0;
float g_no2_mems_v = 0;

// Last-known-good values (retain last valid non-zero reading)
float    g_co_lastgood  = 0;
float    g_no2_lastgood = 0;
uint16_t g_voc_lastgood = 0;

// =============================================
//  SENSOR READS
// =============================================

float readDustPM25() {
  long total = 0;
  for (int i = 0; i < 10; i++) {
    digitalWrite(DUST_LED_PIN, LOW);
    delayMicroseconds(280);
    total += analogRead(DUST_ANALOG_PIN);
    delayMicroseconds(40);
    digitalWrite(DUST_LED_PIN, HIGH);
    delayMicroseconds(9680);
  }
  float voltage = (total / 10.0) * (3.3 / 4095.0);
  float pm = (voltage - DUST_CLEAN_VOLTAGE) * 200.0;
  if (pm < 0) pm = 0;
  return pm;
}

float readMQResistance(int pin, float rl, float vcc) {
  long total = 0;
  for (int i = 0; i < 50; i++) {
    total += analogRead(pin);
    delayMicroseconds(200);
  }
  float voltage = (total / 50.0) * (3.3 / 4095.0);
  if (voltage < 0.005) voltage = 0.005;
  return rl * ((vcc / voltage) - 1.0);
}

// Read ADC2 pin — only call when WiFi is paused!
float readADC2Voltage(int pin) {
  long total = 0;
  for (int i = 0; i < 30; i++) {
    total += analogRead(pin);
    delayMicroseconds(100);
  }
  return (total / 30.0) * (3.3 / 4095.0);
}

float readUVIndex() {
  long total = 0;
  for (int i = 0; i < 20; i++) {
    total += analogRead(UV_PIN);
    delayMicroseconds(100);
  }
  float voltage = (total / 20.0) * (3.3 / 4095.0);
  float idx = voltage * UV_SCALE;
  if (idx < 0.1) idx = 0;
  return idx;
}

// =============================================
//  GOOGLE DNS — re-apply after any WiFi reconnect
// =============================================
void applyGoogleDNS() {
  IPAddress dns1(8, 8, 8, 8);
  IPAddress dns2(8, 8, 4, 4);
  WiFi.config(WiFi.localIP(), WiFi.gatewayIP(), WiFi.subnetMask(), dns1, dns2);
  Serial.println("[WIFI] DNS re-applied (8.8.8.8)");
}

// =============================================
//  ADC2 READING WITH WIFI PAUSE
// =============================================
// Briefly stops WiFi, reads CO MEMS & NO2 MEMS,
// then restarts WiFi. Takes ~2-4 seconds total.
// =============================================

void readADC2Sensors() {
  Serial.println("[ADC2] Pausing WiFi to read CO/NO2 MEMS sensors...");

  // Stop WiFi radio (keeps credentials, fast restart)
  esp_wifi_stop();
  delay(50);

  // Now ADC2 pins are readable
  float co_v  = readADC2Voltage(CO_MEMS_PIN);
  float no2_v = readADC2Voltage(NO2_MEMS_PIN);

  // Restart WiFi radio
  esp_wifi_start();
  delay(100);

  // Wait for reconnection (usually < 2 seconds)
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(200);
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    applyGoogleDNS();  // Re-apply DNS after reconnect
    Serial.print("[ADC2] WiFi restored. CO_V=");
    Serial.print(co_v, 3);
    Serial.print("  NO2_V=");
    Serial.println(no2_v, 3);
  } else {
    Serial.println("[ADC2] WiFi reconnect failed — will retry next cycle");
    // Try full reconnect
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 20) {
      delay(250);
      retries++;
    }
    if (WiFi.status() == WL_CONNECTED) {
      applyGoogleDNS();  // Re-apply DNS after reconnect
      Serial.println("[ADC2] WiFi reconnected on retry");
    }
  }

  // Apply EMA smoothing
  co_mems_ema  = applyEMA(co_v, co_mems_ema);
  no2_mems_ema = applyEMA(no2_v, no2_mems_ema);

  // Store for use in calculations
  g_co_mems_v  = (co_mems_ema >= 0) ? co_mems_ema : co_v;
  g_no2_mems_v = (no2_mems_ema >= 0) ? no2_mems_ema : no2_v;
}

// =============================================
//  GAS CONVERSIONS
// =============================================

float ozonePPB(float r) {
  if (r < 0.01) return 1000;
  return constrain(316.2 * pow(r, -1.661), 0, 1000);
}

float coPPM_MQ(float r) {
  if (r < 0.01) return 10000;
  return constrain(100.0 * pow(r, -1.53), 0, 10000);
}

float mq135CO2(float r) {
  if (r < 0.01) return 5000;
  return constrain(1000.0 * pow(r, -0.715), 0, 5000);
}

// Convert CO MEMS voltage to ppm (SEN0564)
float coPPM_MEMS(float voltage) {
  if (!memsCalibrated) return 0;
  if (voltage <= CO_MEMS_BASELINE) return 0;
  if (CO_MEMS_BASELINE >= 3.2) return 0;
  float ppm = (voltage - CO_MEMS_BASELINE) / (3.3 - CO_MEMS_BASELINE) * SEN0564_RANGE;
  return constrain(ppm, 0, 100);  // Backend Zod caps at 100
}

// Convert NO2 MEMS voltage to ppb (SEN0574)
float no2PPB_MEMS(float voltage) {
  if (!memsCalibrated) return 0;
  if (voltage <= NO2_MEMS_BASELINE) return 0;
  if (NO2_MEMS_BASELINE >= 3.2) return 0;
  float ppm = (voltage - NO2_MEMS_BASELINE) / (3.3 - NO2_MEMS_BASELINE) * SEN0574_RANGE;
  return constrain(ppm, 0, 10) * 1000.0;  // ppm -> ppb
}

// =============================================
//  AQI CALCULATIONS
// =============================================

int aqiFromPM25(float pm) {
  float bp[][4] = {
    {0.0,12.0,0,50},{12.1,35.4,51,100},{35.5,55.4,101,150},
    {55.5,150.4,151,200},{150.5,250.4,201,300},{250.5,350.4,301,400},
    {350.5,500.4,401,500}
  };
  pm = constrain(pm, 0, 500.4);
  for (int i = 0; i < 7; i++)
    if (pm <= bp[i][1])
      return (int)((bp[i][3]-bp[i][2])/(bp[i][1]-bp[i][0])*(pm-bp[i][0])+bp[i][2]);
  return 500;
}

int aqiFromO3(float ppb) {
  float bp[][4] = {
    {0,54,0,50},{55,124,51,100},{125,164,101,150},
    {165,204,151,200},{205,404,201,300},{405,504,301,400},
    {505,604,401,500}
  };
  ppb = constrain(ppb, 0, 604);
  for (int i = 0; i < 7; i++)
    if (ppb <= bp[i][1])
      return (int)((bp[i][3]-bp[i][2])/(bp[i][1]-bp[i][0])*(ppb-bp[i][0])+bp[i][2]);
  return 500;
}

int aqiFromCO(float ppm) {
  float bp[][4] = {
    {0.0,4.4,0,50},{4.5,9.4,51,100},{9.5,12.4,101,150},
    {12.5,15.4,151,200},{15.5,30.4,201,300},{30.5,40.4,301,400},
    {40.5,50.4,401,500}
  };
  ppm = constrain(ppm, 0, 50.4);
  for (int i = 0; i < 7; i++)
    if (ppm <= bp[i][1])
      return (int)((bp[i][3]-bp[i][2])/(bp[i][1]-bp[i][0])*(ppm-bp[i][0])+bp[i][2]);
  return 500;
}

int aqiFromNO2(float ppb) {
  float bp[][4] = {
    {0,53,0,50},{54,100,51,100},{101,360,101,150},
    {361,649,151,200},{650,1249,201,300},{1250,1649,301,400},
    {1650,2049,401,500}
  };
  ppb = constrain(ppb, 0, 2049);
  for (int i = 0; i < 7; i++)
    if (ppb <= bp[i][1])
      return (int)((bp[i][3]-bp[i][2])/(bp[i][1]-bp[i][0])*(ppb-bp[i][0])+bp[i][2]);
  return 500;
}

String aqiLabel(int aqi) {
  if (aqi <=  50) return "GOOD";
  if (aqi <= 100) return "MODERATE";
  if (aqi <= 150) return "UNHLTHY-S";
  if (aqi <= 200) return "UNHEALTHY";
  if (aqi <= 300) return "V.UNHLTHY";
  return "HAZARDOUS";
}

String aqiColor(int aqi) {
  if (aqi <=  50) return "#00e400";
  if (aqi <= 100) return "#ffff00";
  if (aqi <= 150) return "#ff7e00";
  if (aqi <= 200) return "#ff0000";
  if (aqi <= 300) return "#8f3f97";
  return "#7e0023";
}

// =============================================
//  WEB SERVER — JSON DATA ENDPOINT
// =============================================

void handleData() {
  String json = "{";
  json += "\"pm25\":" + String(g_pm25, 1) + ",";
  json += "\"o3\":" + String(g_o3, 1) + ",";
  json += "\"co\":" + String(g_co, 2) + ",";
  json += "\"no2\":" + String(g_no2_ppb, 0) + ",";
  json += "\"co2\":" + String(g_co2, 0) + ",";
  json += "\"co_mq\":" + String(g_co_mq, 1) + ",";
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
.g{color:#00e400}.y{color:#ffff00}.o{color:#ff7e00}.r{color:#ff0000}.p{color:#8f3f97}.m{color:#7e0023}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:4px;background:#0f0;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
</style>
</head>
<body>

<h1>AERIS</h1>
<p class="sub"><span class="dot"></span> Live Air Quality Monitor - Node 3</p>

<div class="aqi-box" id="aqiBox">
  <div class="aqi-num" id="aqiNum">--</div>
  <div class="aqi-lbl" id="aqiLbl">Loading...</div>
  <div class="aqi-sub" id="aqiSub"></div>
</div>

<div class="grid">
  <div class="card"><div class="lbl">PM2.5</div><div class="val" id="pm25">--</div><div class="unit">ug/m3</div></div>
  <div class="card"><div class="lbl">Ozone</div><div class="val" id="o3">--</div><div class="unit">ppb</div></div>
  <div class="card"><div class="lbl">CO</div><div class="val" id="co">--</div><div class="unit">ppm</div></div>
  <div class="card"><div class="lbl">NO2</div><div class="val" id="no2">--</div><div class="unit">ppb</div></div>
  <div class="card"><div class="lbl">CO2 eq</div><div class="val" id="co2">--</div><div class="unit">ppm</div></div>
  <div class="card"><div class="lbl">VOC Index</div><div class="val" id="voc">--</div><div class="unit">&nbsp;</div></div>
  <div class="card"><div class="lbl">Temperature</div><div class="val" id="temp">--</div><div class="unit">&deg;C</div></div>
  <div class="card"><div class="lbl">Humidity</div><div class="val" id="hum">--</div><div class="unit">%</div></div>
  <div class="card"><div class="lbl">UV Index</div><div class="val" id="uv">--</div><div class="unit">&nbsp;</div></div>
  <div class="card"><div class="lbl">CO (MQ-7)</div><div class="val" id="comq">--</div><div class="unit">ppm ref</div></div>
  <div class="card wide" id="rainCard" style="display:none;background:#0a2540"><div class="lbl">Rain Status</div><div class="val" id="rainVal" style="color:#38bdf8">--</div><div class="unit" id="rainDelta"></div></div>
</div>

<script>
function cls(aqi){
  if(aqi<=50)return'g';if(aqi<=100)return'y';if(aqi<=150)return'o';
  if(aqi<=200)return'r';if(aqi<=300)return'p';return'm';
}
function update(){
  fetch('/data').then(r=>r.json()).then(d=>{
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
    var rc=document.getElementById('rainCard');
    if(d.rain){rc.style.display='';document.getElementById('rainVal').textContent='RAINING';document.getElementById('rainDelta').textContent='PM2.5 reduced by '+d.pm25_rain_delta+' ug/m3';}
    else{rc.style.display='none';}
  }).catch(e=>console.log('fetch error'));
}
update();
setInterval(update,5000);
</script>

</body>
</html>
)rawliteral";

  server.send(200, "text/html", html);
}

// =============================================
//  OLED PAGES
// =============================================

void drawPage0(float pm25, float o3, float co, int aqi) {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  display.setTextSize(1);
  display.setCursor(0, 1);
  display.print("PM25");
  display.setTextSize(2);
  display.setCursor(32, 0);
  display.print(pm25, 0);
  display.setTextSize(1);
  display.setCursor(92, 5);
  display.print("ug/m3");

  display.setCursor(0, 19);
  display.print("O3");
  display.setTextSize(2);
  display.setCursor(32, 18);
  display.print(o3, 1);
  display.setTextSize(1);
  display.setCursor(104, 23);
  display.print("ppb");

  display.setCursor(0, 37);
  display.print("CO");
  display.setTextSize(2);
  display.setCursor(32, 36);
  display.print(co, 1);
  display.setTextSize(1);
  display.setCursor(104, 41);
  display.print("ppm");

  display.drawLine(0, 52, 127, 52, SH110X_WHITE);
  display.setCursor(0, 56);
  display.print("AQI: ");
  display.print(aqi);
  display.print(" [");
  display.print(aqiLabel(aqi));
  display.print("]");

  display.display();
}

void drawPage1(float no2, float co2, int voc, int aqi) {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  display.setTextSize(1);
  display.setCursor(0, 1);
  display.print("NO2");
  display.setTextSize(2);
  display.setCursor(32, 0);
  display.print(no2, 0);
  display.setTextSize(1);
  display.setCursor(104, 5);
  display.print("ppb");

  display.setCursor(0, 19);
  display.print("CO2");
  display.setTextSize(2);
  display.setCursor(32, 18);
  display.print(co2, 0);
  display.setTextSize(1);
  display.setCursor(104, 23);
  display.print("ppm");

  display.setCursor(0, 37);
  display.print("VOC");
  display.setTextSize(2);
  display.setCursor(32, 36);
  if (hasSGP40) display.print(voc);
  else display.print("--");

  display.drawLine(0, 52, 127, 52, SH110X_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 56);
  display.print("AQI: ");
  display.print(aqi);
  display.print(" [");
  display.print(aqiLabel(aqi));
  display.print("]");

  display.display();
}

void drawPage2(float temp, float hum, float uv, int aqi) {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  display.setTextSize(1);
  display.setCursor(0, 1);
  display.print("TEMP");
  display.setTextSize(2);
  display.setCursor(32, 0);
  display.print(temp, 1);
  display.setTextSize(1);
  display.setCursor(110, 5);
  display.print("C");

  display.setCursor(0, 19);
  display.print("HUM");
  display.setTextSize(2);
  display.setCursor(32, 18);
  display.print(hum, 0);
  display.setTextSize(1);
  display.setCursor(104, 23);
  display.print("%");

  display.setCursor(0, 37);
  display.print("UV");
  display.setTextSize(2);
  display.setCursor(32, 36);
  display.print(uv, 1);

  display.drawLine(0, 52, 127, 52, SH110X_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 56);
  display.print("AQI: ");
  display.print(aqi);
  display.print(" [");
  display.print(aqiLabel(aqi));
  display.print("]");

  display.display();
}

void drawPage3Rain(float pm25, int aqi) {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  if (g_raining) {
    display.setTextSize(1);
    display.setCursor(10, 0);
    display.print("~~ RAIN DETECTED ~~");

    display.setTextSize(2);
    display.setCursor(10, 14);
    display.print("RAINING");

    display.setTextSize(1);
    display.setCursor(0, 34);
    display.print("PM2.5 now: ");
    display.print(pm25, 1);
    display.print(" ug/m3");

    if (g_pm25_rain_delta > 0) {
      display.setCursor(0, 44);
      display.print("Reduced: -");
      display.print(g_pm25_rain_delta, 1);
      display.print(" ug/m3");
    }
  } else {
    display.setTextSize(1);
    display.setCursor(20, 0);
    display.print("RAIN SENSOR");

    display.setTextSize(2);
    display.setCursor(20, 16);
    display.print("DRY");

    display.setTextSize(1);
    display.setCursor(0, 38);
    display.print("PM2.5: ");
    display.print(pm25, 1);
    display.print(" ug/m3");
  }

  display.drawLine(0, 52, 127, 52, SH110X_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 56);
  display.print("AQI: ");
  display.print(aqi);
  display.print(" [");
  display.print(aqiLabel(aqi));
  display.print("]");

  display.display();
}

void drawWarmup(int pct, float temp, float hum) {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  display.setTextSize(2);
  display.setCursor(20, 0);
  display.print("AERIS");

  display.setTextSize(1);
  display.setCursor(10, 22);
  display.print("Warming up: ");
  display.print(pct);
  display.print("%");

  display.drawRect(4, 36, 120, 12, SH110X_WHITE);
  int fill = (pct * 116) / 100;
  if (fill > 0) display.fillRect(6, 38, fill, 8, SH110X_WHITE);

  display.setCursor(0, 54);
  display.print("T:");
  display.print(temp, 1);
  display.print("C  H:");
  display.print(hum, 0);
  display.print("%");

  display.display();
}

void drawWifiInfo(String ip) {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  display.setTextSize(2);
  display.setCursor(20, 0);
  display.print("AERIS");

  display.setTextSize(1);
  display.setCursor(0, 22);
  display.print("WiFi: Connected");

  display.setCursor(0, 38);
  display.print("Open in browser:");

  display.setTextSize(1);
  display.setCursor(0, 52);
  display.print("http://");
  display.print(ip);

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
    digitalWrite(22, LOW);
    delayMicroseconds(5);
    digitalWrite(22, HIGH);
    delayMicroseconds(5);
  }
  Wire.begin(21, 22);
  Wire.setClock(100000);
  delay(50);
}

// =============================================
//  PUSH TO AERIS BACKEND
// =============================================
void pushToBackend() {
  if (!wifiConnected) {
    Serial.println("[BACKEND] Skipped — WiFi not connected");
    return;
  }

  // Check if WiFi is actually still connected
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[BACKEND] WiFi lost — attempting reconnect...");
    WiFi.reconnect();
    delay(3000);
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[BACKEND] Reconnect failed — skipping push");
      return;
    }
    applyGoogleDNS();
    Serial.println("[BACKEND] WiFi reconnected!");
  }

  WiFiClientSecure client;
  client.setInsecure();
  client.setHandshakeTimeout(10);

  HTTPClient http;

  String url = String(AERIS_SERVER) + "/api/v1/ingest";

  Serial.print("[BACKEND] Pushing to: ");
  Serial.println(url);
  Serial.print("[BACKEND] Free heap: ");
  Serial.println(ESP.getFreeHeap());

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-KEY", AERIS_API_KEY);
  http.setTimeout(10000);

  // Build JSON payload — all sensor data
  // Backend expects: o3 in ppm (0-1), co in ppm (0-100)
  String json = "{";
  json += "\"node_id\":\"" + String(AERIS_NODE_ID) + "\",";
  json += "\"sensors\":{";
  json += "\"pm25\":" + String(g_pm25, 2) + ",";
  json += "\"co\":" + String(g_co, 2) + ",";
  json += "\"o3\":" + String(g_o3 / 1000.0, 6) + ",";
  json += "\"no2\":" + String(g_no2_ppb, 2) + ",";
  json += "\"voc_index\":" + String(g_voc);
  json += "},";
  json += "\"environment\":{";
  json += "\"temperature\":" + String(g_temp, 2) + ",";
  json += "\"humidity\":" + String(g_hum, 2) + ",";
  json += "\"rain\":" + String(g_raining ? "true" : "false") + ",";
  json += "\"pm25_rain_delta\":" + String(g_pm25_rain_delta, 2);
  json += "}";
  json += "}";

  Serial.print("[BACKEND] Payload: ");
  Serial.println(json);

  int httpCode = http.POST(json);

  if (httpCode == 201) {
    String response = http.getString();
    Serial.println("[BACKEND] OK — Telemetry pushed successfully");
    Serial.print("[BACKEND] Response: ");
    Serial.println(response);
  } else if (httpCode > 0) {
    Serial.print("[BACKEND] ERROR HTTP ");
    Serial.print(httpCode);
    Serial.print(": ");
    Serial.println(http.getString());
  } else {
    Serial.print("[BACKEND] FAILED: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

// =============================================
//  SETUP
// =============================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("==============================");
  Serial.println("   AERIS Air Quality System");
  Serial.println("   Improved v2 (ADC2 fix)");
  Serial.println("==============================");
  Serial.println();

  // Rain sensor (digital input — module outputs HIGH when water detected)
  pinMode(RAIN_SENSOR_PIN, INPUT);

  // Analog pins (ADC1 — always work)
  pinMode(DUST_LED_PIN, OUTPUT);
  digitalWrite(DUST_LED_PIN, HIGH);
  analogSetPinAttenuation(DUST_ANALOG_PIN, ADC_11db);
  analogSetPinAttenuation(MQ131_PIN, ADC_11db);
  analogSetPinAttenuation(MQ7_PIN, ADC_11db);
  analogSetPinAttenuation(MQ135_PIN, ADC_11db);
  analogSetPinAttenuation(UV_PIN, ADC_11db);

  // ADC2 pins — set attenuation before WiFi starts
  analogSetPinAttenuation(CO_MEMS_PIN, ADC_11db);
  analogSetPinAttenuation(NO2_MEMS_PIN, ADC_11db);

  // Read ADC2 baseline BEFORE WiFi starts (critical!)
  Serial.println("[INIT] Reading ADC2 baselines before WiFi...");
  float co_pre  = readADC2Voltage(CO_MEMS_PIN);
  float no2_pre = readADC2Voltage(NO2_MEMS_PIN);
  Serial.print("[INIT] Pre-WiFi CO_V=");
  Serial.print(co_pre, 3);
  Serial.print("  NO2_V=");
  Serial.println(no2_pre, 3);
  g_co_mems_v  = co_pre;
  g_no2_mems_v = no2_pre;

  Serial.println("[OK] Analog pins ready");

  // I2C
  Wire.begin(21, 22);
  Wire.setClock(100000);
  delay(100);
  Serial.println("[OK] I2C bus ready");

  // I2C scan
  Serial.println("[INFO] I2C scan:");
  int devCount = 0;
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print("  0x");
      if (addr < 16) Serial.print("0");
      Serial.print(addr, HEX);
      if (addr == 0x3C) Serial.print(" (OLED)");
      if (addr == 0x44 || addr == 0x45) Serial.print(" (SHT31)");
      if (addr == 0x59) Serial.print(" (SGP40)");
      Serial.println();
      devCount++;
    }
  }
  Serial.println();

  if (devCount < 3) {
    resetI2CBus();
    delay(200);
  }

  // OLED
  Serial.print("[INIT] OLED ... ");
  if (display.begin(0x3C, true)) {
    hasOLED = true;
    display.clearDisplay();
    display.display();
    Serial.println("OK");
  } else {
    Serial.println("FAILED");
  }
  delay(100);

  // SHT31
  Serial.print("[INIT] SHT31 ... ");
  if (sht31.begin(0x44)) {
    hasSHT31 = true;
    Serial.println("OK");
  } else if (sht31.begin(0x45)) {
    hasSHT31 = true;
    Serial.println("OK at 0x45");
  } else {
    Serial.println("FAILED");
  }
  delay(100);

  // SGP40
  Serial.print("[INIT] SGP40 ... ");
  if (sgp.begin()) {
    hasSGP40 = true;
    Serial.println("OK");
  } else {
    resetI2CBus();
    delay(200);
    if (sgp.begin()) {
      hasSGP40 = true;
      Serial.println("OK (retry)");
    } else {
      Serial.println("FAILED");
    }
  }
  delay(100);

  // ---- WiFi ----
  Serial.print("[WIFI] Connecting to ");
  Serial.print(WIFI_SSID);
  Serial.print(" ");

  WiFi.begin(WIFI_SSID, WIFI_PASS);

  if (hasOLED) {
    display.clearDisplay();
    display.setTextColor(SH110X_WHITE);
    display.setTextSize(2);
    display.setCursor(20, 0);
    display.print("AERIS");
    display.setTextSize(1);
    display.setCursor(0, 25);
    display.print("Connecting WiFi...");
    display.setCursor(0, 40);
    display.print(WIFI_SSID);
    display.display();
  }

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println();
    Serial.print("[WIFI] Connected! IP: ");
    Serial.println(WiFi.localIP());

    // Use Google DNS — mobile hotspots often have broken DNS
    IPAddress dns1(8, 8, 8, 8);
    IPAddress dns2(8, 8, 4, 4);
    WiFi.config(WiFi.localIP(), WiFi.gatewayIP(), WiFi.subnetMask(), dns1, dns2);
    Serial.println("[WIFI] DNS set to 8.8.8.8 / 8.8.4.4");

    // Start local web server
    server.on("/", handleRoot);
    server.on("/data", handleData);
    server.begin();
    Serial.println("[WEB] Local server started on port 80");

    Serial.print("[BACKEND] Target: ");
    Serial.println(AERIS_SERVER);

    if (hasOLED) {
      drawWifiInfo(WiFi.localIP().toString());
      delay(3000);
    }

  } else {
    Serial.println();
    Serial.println("[WIFI] FAILED - continuing without network");
  }

  Serial.println();
  Serial.println("+---------- STATUS ----------+");
  Serial.print("| OLED:     "); Serial.println(hasOLED  ? "OK            |" : "MISSING       |");
  Serial.print("| SHT31:    "); Serial.println(hasSHT31 ? "OK            |" : "MISSING       |");
  Serial.print("| SGP40:    "); Serial.println(hasSGP40 ? "OK            |" : "MISSING       |");
  Serial.print("| WiFi:     "); Serial.println(wifiConnected ? "OK            |" : "FAILED        |");
  if (wifiConnected) {
    Serial.print("| IP:       ");
    Serial.print(WiFi.localIP());
    Serial.println("   |");
    Serial.print("| Backend:  ");
    Serial.print(AERIS_SERVER);
    Serial.println(" |");
  }
  Serial.print("| CO MEMS:  pin ");
  Serial.print(CO_MEMS_PIN);
  Serial.println(" (ADC2)    |");
  Serial.print("| NO2 MEMS: pin ");
  Serial.print(NO2_MEMS_PIN);
  Serial.println(" (ADC2)    |");
  Serial.print("| Rain:     pin ");
  Serial.print(RAIN_SENSOR_PIN);
  Serial.println(" (Digital) |");
  Serial.println("+----------------------------+");
  Serial.println();

  bootTime = millis();
  Serial.println("[INFO] Warming up MQ sensors (2 min)...");
  Serial.println("[INFO] ADC2 sensors (CO/NO2 MEMS) read every 15s via WiFi pause");
  Serial.println();
}

// =============================================
//  MAIN LOOP (non-blocking)
// =============================================
void loop() {
  // Always handle local web requests
  if (wifiConnected && WiFi.status() == WL_CONNECTED) {
    server.handleClient();
  }

  // Read sensors every 5 seconds
  unsigned long now = millis();
  if (now - lastSensorRead < SENSOR_INTERVAL) {
    return;
  }
  lastSensorRead = now;

  unsigned long elapsed = now - bootTime;

  // ---- Read ADC1 sensors (always work with WiFi) ----

  float pm25_raw = readDustPM25();
  pm25_ema = applyEMA(pm25_raw, pm25_ema);

  float mq131_rs = readMQResistance(MQ131_PIN, MQ131_RL_KOHM, MQ131_VCC);
  mq131Rs_ema = applyEMA(mq131_rs, mq131Rs_ema);

  float mq7_rs = readMQResistance(MQ7_PIN, MQ7_RL_KOHM, MQ7_VCC);
  mq7Rs_ema = applyEMA(mq7_rs, mq7Rs_ema);

  float mq135_rs = readMQResistance(MQ135_PIN, MQ135_RL_KOHM, MQ135_VCC);
  mq135Rs_ema = applyEMA(mq135_rs, mq135Rs_ema);

  float uvIdx_raw = readUVIndex();
  uv_ema = applyEMA(uvIdx_raw, uv_ema);

  uint16_t vocIndex = 0;
  float temperature = 0;
  float humidity    = 0;

  if (hasSGP40) {
    uint16_t rawVoc = 0;
    if (hasSHT31) {
      // Use temp/humidity compensation for better VOC accuracy
      float t = sht31.readTemperature();
      float h = sht31.readHumidity();
      if (!isnan(t) && !isnan(h)) {
        rawVoc = sgp.measureVocIndex(t, h);
      } else {
        rawVoc = sgp.measureVocIndex();
      }
    } else {
      rawVoc = sgp.measureVocIndex();
    }
    // Keep last valid VOC when SGP40 returns 0 (I2C glitch or warmup)
    if (rawVoc > 0) {
      vocIndex = rawVoc;
      g_voc_lastgood = rawVoc;
    } else {
      vocIndex = g_voc_lastgood;
    }
  }
  if (hasSHT31) {
    temperature = sht31.readTemperature();
    humidity    = sht31.readHumidity();
    if (isnan(temperature)) temperature = 0;
    if (isnan(humidity))    humidity = 0;
  }

  // ---- Read ADC2 sensors (CO/NO2 MEMS) via WiFi pause ----
  if (wifiConnected && warmedUp && (now - lastADC2Read >= ADC2_INTERVAL)) {
    lastADC2Read = now;
    readADC2Sensors();
  }

  // ---- Rain Detection ----
  bool wasRaining = g_raining;
  g_raining = (digitalRead(RAIN_SENSOR_PIN) == HIGH);  // HIGH = water detected

  if (g_raining && !wasRaining) {
    // Rain just started — snapshot current PM2.5
    g_pm25_before_rain = pm25_ema >= 0 ? pm25_ema : 0;
    g_pm25_rain_delta = 0;
    Serial.println("[RAIN] Rain detected! Tracking PM2.5 reduction...");
  }
  if (g_raining && g_pm25_before_rain > 0) {
    float currentPM = pm25_ema >= 0 ? pm25_ema : 0;
    g_pm25_rain_delta = g_pm25_before_rain - currentPM;
    if (g_pm25_rain_delta < 0) g_pm25_rain_delta = 0;
  }
  if (!g_raining && wasRaining) {
    Serial.print("[RAIN] Rain stopped. Total PM2.5 reduction: ");
    Serial.print(g_pm25_rain_delta, 1);
    Serial.println(" ug/m3");
  }

  // ---- Warm-up ----

  if (!warmedUp && elapsed < WARMUP_MS) {
    int pct = (elapsed * 100) / WARMUP_MS;
    Serial.print("[WARMUP ");
    Serial.print(pct);
    Serial.print("%] MQ131=");
    Serial.print(mq131Rs_ema, 0);
    Serial.print("k  MQ7=");
    Serial.print(mq7Rs_ema, 0);
    Serial.print("k  CO_V=");
    Serial.print(g_co_mems_v, 3);
    Serial.print("  NO2_V=");
    Serial.print(g_no2_mems_v, 3);
    Serial.println();

    if (hasOLED) drawWarmup(pct, temperature, humidity);
    return;
  }

  // ---- Calibrate once (after warmup) ----

  if (!warmedUp) {
    warmedUp = true;
    MQ131_Ro = mq131Rs_ema / MQ131_CLEAN_AIR_FACTOR;
    MQ7_Ro   = mq7Rs_ema   / MQ7_CLEAN_AIR_FACTOR;
    MQ135_Ro = mq135Rs_ema / MQ135_CLEAN_AIR_FACTOR;

    // Calibrate MEMS baselines — do one fresh ADC2 read
    // Use 95% of clean-air voltage as baseline → headroom for natural fluctuation
    Serial.println("[CAL] Reading ADC2 for MEMS baseline calibration...");
    readADC2Sensors();
    CO_MEMS_BASELINE  = g_co_mems_v * 0.95;
    NO2_MEMS_BASELINE = g_no2_mems_v * 0.95;
    memsCalibrated = true;

    Serial.println("-------- Calibration --------");
    Serial.print("  MQ-131  Ro = "); Serial.print(MQ131_Ro, 1); Serial.println("k");
    Serial.print("  MQ-7   Ro = "); Serial.print(MQ7_Ro, 1); Serial.println("k");
    Serial.print("  MQ-135  Ro = "); Serial.print(MQ135_Ro, 1); Serial.println("k");
    Serial.print("  CO  baseline = "); Serial.print(CO_MEMS_BASELINE, 3); Serial.println("V");
    Serial.print("  NO2 baseline = "); Serial.print(NO2_MEMS_BASELINE, 3); Serial.println("V");
    Serial.println("-----------------------------");
    Serial.println();
  }

  // ---- Calculate ----

  float pm25       = pm25_ema;
  float o3_ppb     = ozonePPB(mq131Rs_ema / MQ131_Ro);
  float co_mq_ppm  = coPPM_MQ(mq7Rs_ema / MQ7_Ro);
  float co2_ppm    = mq135CO2(mq135Rs_ema / MQ135_Ro);
  float uvIdx      = uv_ema;

  // CO from MEMS sensor (ADC2 — uses cached voltage from last WiFi-pause read)
  float co_raw = coPPM_MEMS(g_co_mems_v);
  if (co_raw > 0) g_co_lastgood = co_raw;
  float co_ppm = (co_raw > 0) ? co_raw : g_co_lastgood;

  // NO2 from MEMS sensor (ADC2 — uses cached voltage)
  float no2_raw = no2PPB_MEMS(g_no2_mems_v);
  if (no2_raw > 0) g_no2_lastgood = no2_raw;
  float no2_ppb = (no2_raw > 0) ? no2_raw : g_no2_lastgood;

  int aqi_pm  = aqiFromPM25(pm25);
  int aqi_o3  = aqiFromO3(o3_ppb);
  int aqi_co  = aqiFromCO(co_ppm);
  int aqi_no2 = aqiFromNO2(no2_ppb);
  int totalAQI = max(max(aqi_pm, aqi_o3), max(aqi_co, aqi_no2));

  // ---- Update global values for web server ----

  g_pm25 = pm25; g_o3 = o3_ppb; g_co = co_ppm; g_no2_ppb = no2_ppb;
  g_co2 = co2_ppm; g_co_mq = co_mq_ppm; g_voc = vocIndex;
  g_uv = uvIdx; g_temp = temperature; g_hum = humidity;
  g_aqi = totalAQI; g_aqi_pm = aqi_pm; g_aqi_o3 = aqi_o3;
  g_aqi_co = aqi_co; g_aqi_no2 = aqi_no2;

  // ---- Push to AERIS Backend ----
  if (wifiConnected && millis() - lastBackendPush >= BACKEND_INTERVAL) {
    lastBackendPush = millis();
    pushToBackend();
  }

  // ---- Serial ----

  Serial.println("============= AERIS AIR REPORT v2 =============");
  Serial.println();
  Serial.print("  PM2.5:      "); Serial.print(pm25, 1);
  Serial.print(" ug/m3     sub-AQI: "); Serial.println(aqi_pm);
  Serial.print("  Ozone:      "); Serial.print(o3_ppb, 1);
  Serial.print(" ppb        sub-AQI: "); Serial.println(aqi_o3);
  Serial.print("  CO (MEMS):  "); Serial.print(co_ppm, 2);
  Serial.print(" ppm        sub-AQI: "); Serial.println(aqi_co);
  Serial.print("  NO2 (MEMS): "); Serial.print(no2_ppb, 0);
  Serial.print(" ppb        sub-AQI: "); Serial.println(aqi_no2);
  Serial.print("  CO2-eq:     "); Serial.print(co2_ppm, 0); Serial.println(" ppm");
  Serial.print("  CO (MQ-7):  "); Serial.print(co_mq_ppm, 1); Serial.println(" ppm  [ref]");
  Serial.print("  VOC:        Index "); Serial.println(vocIndex);
  Serial.print("  UV Index:   "); Serial.println(uvIdx, 1);
  Serial.print("  Temp:       "); Serial.print(temperature, 1); Serial.println(" C");
  Serial.print("  Humidity:   "); Serial.print(humidity, 1); Serial.println(" %");
  Serial.println();
  Serial.print("  Rain:       "); Serial.println(g_raining ? "YES - Raining is happening" : "No");
  if (g_raining && g_pm25_rain_delta > 0) {
    Serial.print("  PM2.5 drop: -"); Serial.print(g_pm25_rain_delta, 1); Serial.println(" ug/m3 (rain effect)");
  }
  Serial.print("  MEMS raw:   CO_V="); Serial.print(g_co_mems_v, 3);
  Serial.print("  NO2_V="); Serial.println(g_no2_mems_v, 3);
  Serial.println();
  Serial.print("  >>> TOTAL AQI: "); Serial.print(totalAQI);
  Serial.print("  ["); Serial.print(aqiLabel(totalAQI)); Serial.println("]");
  Serial.print("      (PM="); Serial.print(aqi_pm);
  Serial.print(" O3="); Serial.print(aqi_o3);
  Serial.print(" CO="); Serial.print(aqi_co);
  Serial.print(" NO2="); Serial.print(aqi_no2);
  Serial.println(")");
  if (wifiConnected) {
    Serial.print("  [WEB] http://");
    Serial.println(WiFi.localIP());
  }
  Serial.println("=================================================");
  Serial.println();

  // ---- OLED ----

  if (hasOLED) {
    switch (oledPage) {
      case 0: drawPage0(pm25, o3_ppb, co_ppm, totalAQI);        break;
      case 1: drawPage1(no2_ppb, co2_ppm, vocIndex, totalAQI);   break;
      case 2: drawPage2(temperature, humidity, uvIdx, totalAQI);  break;
      case 3: drawPage3Rain(pm25, totalAQI);                      break;
    }
    oledPage = (oledPage + 1) % 4;
  }
}
