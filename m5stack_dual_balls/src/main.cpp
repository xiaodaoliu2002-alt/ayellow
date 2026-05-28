#ifdef M5STICK_S3_TARGET
#include <M5Unified.h>
#else
#include <M5Stack.h>
#endif
#include "FS.h"
#include "SPIFFS.h"
#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsClient.h>
#include <math.h>

const char *wifiSsid = "YOUR_WIFI_SSID";
const char *wifiPassword = "YOUR_WIFI_PASSWORD";
const char *ayellowHost = "YOUR_COMPUTER_LAN_IP";
const uint16_t ayellowPort = 8765;

WebServer server(80);
WebSocketsClient ayellowSocket;
File stage4MjpegFile;

const char *STAGE4_MJPEG_PATH = "/stage4.mjpeg";
const size_t STAGE4_JPEG_BUFFER_SIZE = 90 * 1024;
uint8_t *stage4JpegBuffer = nullptr;

const int HOME_RADIUS = 23;
int gameRadius = HOME_RADIUS;
int connectivityRadius = HOME_RADIUS;
int animationSpeed = 45;
float stageProgress = 0.0f;
int ayellowStage = 1;
bool stage4VideoMode = false;
bool localResetHold = false;
float mappingMinRpm = 0.0f;
float mappingMaxRpm = 15.0f;
int mappingMinRadius = 11;
int mappingMaxRadius = 33;

#ifdef M5STICK_S3_TARGET
const int SCREEN_WIDTH = 128;
const int SCREEN_HEIGHT = 128;
const float VISUAL_SCALE = 0.48f;
const int FRAME_INTERVAL_MS = 130;
#else
const int SCREEN_WIDTH = 320;
const int SCREEN_HEIGHT = 240;
const float VISUAL_SCALE = 1.0f;
const int FRAME_INTERVAL_MS = 110;
#endif

const float SCREEN_CENTER_X = SCREEN_WIDTH / 2.0f;
const float SCREEN_CENTER_Y = SCREEN_HEIGHT / 2.0f;
const float BASE_RADIUS_MULTIPLIER = 3.0f * VISUAL_SCALE;
const float SLIDER_GROWTH_MULTIPLIER = 4.0f * VISUAL_SCALE;
const float EDGE_DISTANCE = SCREEN_WIDTH / 2.0f;
const int JELLY_POINTS = 48;
const int CELEBRATION_COUNT = 22;

enum CelebrationMode { CELEBRATION_IDLE, CELEBRATION_ENTERING, CELEBRATION_HOLDING, CELEBRATION_EXITING };

struct Vec2 {
  float x;
  float y;
};

struct Contact {
  float contactDepth;
  Vec2 contactNormal;
  Vec2 contactPoint;
};

struct CelebrationParticle {
  float startAngle;
  float startRadius;
  float clusterRadius;
  float clusterAngle;
  float radius;
  uint16_t color;
  uint16_t accent;
  uint8_t style;
  float spin;
};

CelebrationMode celebrationMode = CELEBRATION_IDLE;
unsigned long celebrationStartedAt = 0;
const unsigned long CELEBRATION_ENTER_MS = 900;
const unsigned long CELEBRATION_EXIT_MS = 780;

void drawBalls();

void applyCongratulationsSignal(const String &congratulations) {
  // payload.animation.congratulations
  if (congratulations == "playing" && (celebrationMode == CELEBRATION_IDLE || celebrationMode == CELEBRATION_EXITING)) {
    celebrationMode = CELEBRATION_ENTERING;
    celebrationStartedAt = millis();
  } else if (congratulations == "idle" && celebrationMode != CELEBRATION_IDLE && celebrationMode != CELEBRATION_EXITING) {
    celebrationMode = CELEBRATION_EXITING;
    celebrationStartedAt = millis();
  }
}

void resetM5StackAnimationState() {
  ayellowStage = 1;
  stageProgress = 0.0f;
  stage4VideoMode = false;
  if (celebrationMode != CELEBRATION_IDLE) {
    celebrationMode = CELEBRATION_EXITING;
    celebrationStartedAt = millis();
  }
}

void jumpToAyellowStage(int stage) {
  if (stage < 1 || stage > 4 || stage == ayellowStage) return;
  ayellowStage = stage;
  stageProgress = stage == 4 ? 1.0f : 0.0f;
  if (stage != 4) stage4VideoMode = false;
}

void applyStage4VideoSignal(const String &stage4Video) {
  stage4VideoMode = stage4Video == "playing" && ayellowStage == 4;
}

void applyStage0CountdownSignal(float countdownRemainingSeconds) {
  if (countdownRemainingSeconds > 0.0f) {
    stageProgress = max(0.0f, min(1.0f, 1.0f - countdownRemainingSeconds / 15.0f));
  }
}

const CelebrationParticle celebrationParticles[CELEBRATION_COUNT] = {
  {0.00f, 218, 8, 0.20f, 15, RED, WHITE, 0, 0.72f},
  {0.29f, 244, 12, 1.10f, 13, BLUE, WHITE, 1, 0.84f},
  {0.57f, 226, 18, 2.00f, 12, ORANGE, BLACK, 2, 0.78f},
  {0.86f, 252, 24, 3.00f, 17, YELLOW, RED, 3, 0.92f},
  {1.14f, 214, 15, 4.10f, 11, 0xF81F, WHITE, 0, 0.88f},
  {1.43f, 236, 28, 5.20f, 16, BLACK, WHITE, 0, 0.76f},
  {1.71f, 258, 20, 6.00f, 10, WHITE, BLACK, 1, 0.95f},
  {2.00f, 225, 10, 0.90f, 14, RED, WHITE, 2, 0.69f},
  {2.28f, 246, 26, 1.90f, 18, BLUE, BLACK, 3, 0.82f},
  {2.57f, 216, 16, 2.80f, 12, ORANGE, WHITE, 0, 0.90f},
  {2.86f, 255, 30, 3.70f, 15, YELLOW, BLUE, 1, 0.74f},
  {3.14f, 232, 22, 4.80f, 13, BLACK, WHITE, 0, 0.86f},
  {3.43f, 220, 13, 5.70f, 16, RED, WHITE, 3, 0.80f},
  {3.71f, 250, 25, 0.40f, 11, BLUE, WHITE, 2, 0.94f},
  {4.00f, 224, 18, 1.40f, 17, ORANGE, BLACK, 0, 0.70f},
  {4.28f, 242, 31, 2.50f, 12, WHITE, BLACK, 1, 0.89f},
  {4.57f, 218, 11, 3.40f, 15, 0xF81F, WHITE, 3, 0.77f},
  {4.86f, 256, 27, 4.40f, 13, BLACK, WHITE, 0, 0.93f},
  {5.14f, 230, 19, 5.40f, 18, RED, YELLOW, 2, 0.83f},
  {5.43f, 248, 14, 0.70f, 10, BLUE, WHITE, 1, 0.79f},
  {5.71f, 222, 23, 1.70f, 16, YELLOW, RED, 0, 0.91f},
  {6.00f, 240, 29, 2.70f, 12, ORANGE, WHITE, 3, 0.75f},
};

String pageHtml() {
  String html = "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<style>body{font-family:Arial,sans-serif;background:#111;color:white;margin:24px}label,button{display:block;margin-top:24px}.v{font-size:28px;margin-left:8px}input,button{width:100%}button{min-height:48px;border:0;border-radius:999px;font-weight:700;background:linear-gradient(135deg,#fff,#ff2323,#1678ff,#ffe900)}</style>";
  html += "</head><body><div class='card'><h1>M5Stack Balls</h1>";
  html += "<label>Game Ball Size <span id='gameValue' class='v'>" + String(gameRadius) + "</span></label>";
  html += "<input type='range' min='11' max='33' value='" + String(gameRadius) + "' oninput=\"setGame(this.value)\">";
  html += "<label>Connectivity Ball Size <span id='connectivityValue' class='v'>" + String(connectivityRadius) + "</span></label>";
  html += "<input type='range' min='11' max='33' value='" + String(connectivityRadius) + "' oninput=\"setConnectivity(this.value)\">";
  html += "<label>Animation Speed <span id='speedValue' class='v'>" + String(animationSpeed) + "</span></label>";
  html += "<input type='range' min='0' max='100' value='" + String(animationSpeed) + "' oninput=\"setSpeed(this.value)\">";
  html += "<button id='congratulationsButton' onclick=\"toggleCongratulations()\">Congratulations</button>";
  html += "<p>Connect Wi-Fi: M5Stack-Balls, password: 12345678; open http://192.168.4.1</p>";
  html += "<script>function setBall(ball,value,path){document.getElementById(ball+'Value').textContent=value;fetch(path+value)}function setGame(value){setBall('game',value,'/set?ball=game&value=')}function setConnectivity(value){setBall('connectivity',value,'/set?ball=connectivity&value=')}function setSpeed(value){document.getElementById('speedValue').textContent=value;fetch('/set?ball=speed&value='+value)}function toggleCongratulations(){fetch('/congratulations').then(r=>r.text()).then(t=>{document.getElementById('congratulationsButton').textContent=t==='holding'?'Exit Congratulations':'Congratulations'})}</script>";
  html += "</div></body></html>";
  return html;
}

float easeInOutCubic(float x) {
  if (x < 0.0f) return 0.0f;
  if (x > 1.0f) return 1.0f;
  return x < 0.5f ? 4.0f * x * x * x : 1.0f - powf(-2.0f * x + 2.0f, 3.0f) / 2.0f;
}

int sx(float x) { return (int)x; }
int sy(float y) { return (int)y; }
int sr(float value) { return max(1, (int)(value * VISUAL_SCALE)); }

float displayRadius(int value, int homeValue) {
  return homeValue * BASE_RADIUS_MULTIPLIER * 2.0f + (value - homeValue) * SLIDER_GROWTH_MULTIPLIER;
}

Vec2 rotateAroundCenter(float x, float y, float rotationAngle) {
  float dx = x - SCREEN_CENTER_X;
  float dy = y - SCREEN_CENTER_Y;
  return {
    SCREEN_CENTER_X + dx * cosf(rotationAngle) - dy * sinf(rotationAngle),
    SCREEN_CENTER_Y + dx * sinf(rotationAngle) + dy * cosf(rotationAngle),
  };
}

Contact contactGeometry(Vec2 leftCenter, Vec2 rightCenter, float leftRadius, float rightRadius) {
  float dx = rightCenter.x - leftCenter.x;
  float dy = rightCenter.y - leftCenter.y;
  float distance = sqrtf(dx * dx + dy * dy);
  Vec2 contactNormal = { dx / distance, dy / distance };
  float contactDepth = max(0.0f, leftRadius + rightRadius - distance);
  float contactDistance = (distance * distance + leftRadius * leftRadius - rightRadius * rightRadius) / (distance * 2.0f);
  return { contactDepth, contactNormal, { leftCenter.x + contactNormal.x * contactDistance, leftCenter.y + contactNormal.y * contactDistance } };
}

Vec2 deformNearContact(float rawX, float rawY, Vec2 center, float radius, Vec2 direction, Contact contact, float t) {
  if (contact.contactDepth <= 0.0f) return { rawX, rawY };

  Vec2 tangent = { -direction.y, direction.x };
  float localX = rawX - center.x;
  float localY = rawY - center.y;
  float front = localX * direction.x + localY * direction.y;
  float lateral = localX * tangent.x + localY * tangent.y;
  float contactWidth = max(16.0f, sqrtf(radius * contact.contactDepth) * 1.42f);
  float frontRange = max(10.0f, contact.contactDepth * 2.5f);
  float frontWeight = max(0.0f, 1.0f - fabsf(radius - front) / frontRange);
  float lateralWeight = max(0.0f, 1.0f - (lateral * lateral) / (contactWidth * contactWidth));
  float weight = frontWeight * lateralWeight;
  float squish = contact.contactDepth * 0.70f * weight;
  float wobble = sinf(lateral * 0.08f + t * 0.005f) * contact.contactDepth * 0.07f * weight;
  float sign = lateral < 0.0f ? -1.0f : 1.0f;
  float bulge = sinf(min(1.0f, fabsf(lateral) / contactWidth) * PI) * contact.contactDepth * 0.16f * frontWeight;
  return { rawX - direction.x * squish + tangent.x * wobble + tangent.x * sign * bulge, rawY - direction.y * squish + tangent.y * wobble + tangent.y * sign * bulge };
}

void buildJellyBoundary(Vec2 center, float radius, Vec2 direction, Contact contact, float rotationAngle, float t, Vec2 points[JELLY_POINTS]) {
  for (int i = 0; i < JELLY_POINTS; i++) {
    float a = (i / (float)JELLY_POINTS) * PI * 2.0f;
    Vec2 raw = { center.x + cosf(a) * radius, center.y + sinf(a) * radius };
    Vec2 deformed = deformNearContact(raw.x, raw.y, center, radius, direction, contact, t);
    points[i] = rotateAroundCenter(deformed.x, deformed.y, rotationAngle);
  }
}

void fillJellyPolygon(Vec2 center, Vec2 points[JELLY_POINTS], uint16_t fillColor, uint16_t strokeColor) {
  for (int i = 0; i < JELLY_POINTS; i++) {
    M5.Lcd.fillTriangle((int)center.x, (int)center.y, (int)points[i].x, (int)points[i].y, (int)points[(i + 1) % JELLY_POINTS].x, (int)points[(i + 1) % JELLY_POINTS].y, fillColor);
  }
  for (int i = 0; i < JELLY_POINTS; i++) {
    M5.Lcd.drawLine((int)points[i].x, (int)points[i].y, (int)points[(i + 1) % JELLY_POINTS].x, (int)points[(i + 1) % JELLY_POINTS].y, strokeColor);
  }
}

void drawGamePattern(Vec2 center, float radius, float rotationAngle, float t) {
  uint16_t lineColor = 0xFED9;
  for (int i = 0; i < 4; i++) {
    float yy = center.y + sinf(t * 0.0011f + i * 1.7f) * radius * 0.42f;
    Vec2 p = rotateAroundCenter(center.x, yy, rotationAngle);
    M5.Lcd.drawEllipse((int)p.x, (int)p.y, radius * (0.58f + i * 0.08f), max(4, (int)(radius * 0.13f)), lineColor);
  }
  for (int anchor = 0; anchor < 2; anchor++) {
    float baseY = center.y + radius * (anchor == 0 ? -0.52f : 0.55f);
    for (int ring = 0; ring < 4; ring++) {
      Vec2 p = rotateAroundCenter(center.x + sinf(t * 0.0011f + ring) * radius * 0.08f, baseY, rotationAngle);
      M5.Lcd.drawEllipse((int)p.x, (int)p.y, radius * (0.12f + ring * 0.08f), max(2, (int)(radius * (0.045f + ring * 0.028f))), lineColor);
    }
  }
}

void drawConnectivityPattern(Vec2 center, float radius, float rotationAngle, float t) {
  uint16_t lineColor = 0xFEFB;
  float spin = t * 0.0012f * (animationSpeed / 45.0f);
  for (float i = -radius + 12.0f; i <= radius - 12.0f; i += max(13.0f, radius / 4.0f)) {
    float w = sqrtf(max(0.0f, radius * radius - i * i));
    Vec2 p = rotateAroundCenter(center.x, center.y + i, rotationAngle);
    M5.Lcd.drawEllipse((int)p.x, (int)p.y, (int)w, max(4, (int)(radius / 10.0f)), lineColor);
  }
  for (int i = 0; i < 5; i++) {
    float offset = spin + i * 0.9f;
    Vec2 last = { 0, 0 };
    bool hasLast = false;
    for (float p = 0.0f; p <= 1.0f; p += 0.14f) {
      float yy = center.y - radius * 0.78f + p * radius * 1.56f;
      float xx = center.x + sinf(p * PI * 2.0f + offset) * radius * 0.66f;
      Vec2 point = rotateAroundCenter(xx, yy, rotationAngle);
      if (hasLast) M5.Lcd.drawLine((int)last.x, (int)last.y, (int)point.x, (int)point.y, lineColor);
      last = point;
      hasLast = true;
    }
  }
}

void drawJellyBall(Vec2 center, float radius, Vec2 direction, Contact contact, float rotationAngle, float t, uint16_t fillColor, uint16_t strokeColor, bool isGame) {
  Vec2 screenCenter = rotateAroundCenter(center.x, center.y, rotationAngle);
  Vec2 boundary[JELLY_POINTS];
  buildJellyBoundary(center, radius, direction, contact, rotationAngle, t, boundary);
  fillJellyPolygon(screenCenter, boundary, fillColor, strokeColor);
  if (isGame) drawGamePattern(center, radius, rotationAngle, t);
  else drawConnectivityPattern(center, radius, rotationAngle, t);
}

void drawFastContactCurve(Contact contact, float gameDisplayRadius, float connectivityDisplayRadius, float rotationAngle, float animatedT) {
  if (contact.contactDepth <= 0.0f) return;
  Vec2 tangent = { -contact.contactNormal.y, contact.contactNormal.x };
  float contactLength = sqrtf(min(gameDisplayRadius, connectivityDisplayRadius) * contact.contactDepth) * 1.15f;
  float wave = sinf(animatedT * 0.005f) * contact.contactDepth * 0.08f;
  Vec2 a = rotateAroundCenter(contact.contactPoint.x - tangent.x * contactLength, contact.contactPoint.y - tangent.y * contactLength, rotationAngle);
  Vec2 b = rotateAroundCenter(contact.contactPoint.x + contact.contactNormal.x * wave, contact.contactPoint.y + contact.contactNormal.y * wave, rotationAngle);
  Vec2 c = rotateAroundCenter(contact.contactPoint.x + tangent.x * contactLength, contact.contactPoint.y + tangent.y * contactLength, rotationAngle);
  Vec2 last = a;
  for (float p = 0.12f; p <= 1.0f; p += 0.12f) {
    float q = 1.0f - p;
    Vec2 point = { q * q * a.x + 2.0f * q * p * b.x + p * p * c.x, q * q * a.y + 2.0f * q * p * b.y + p * p * c.y };
    M5.Lcd.drawLine((int)last.x, (int)last.y, (int)point.x, (int)point.y, 0xBDF7);
    M5.Lcd.drawLine((int)last.x + 1, (int)last.y, (int)point.x + 1, (int)point.y, 0xBDF7);
    last = point;
  }
}

void drawJellyContactPair(float gameDisplayRadius, float connectivityDisplayRadius, float rotationAngle, float animatedT) {
  Vec2 leftCenter = { SCREEN_CENTER_X - EDGE_DISTANCE, SCREEN_CENTER_Y };
  Vec2 rightCenter = { SCREEN_CENTER_X + EDGE_DISTANCE, SCREEN_CENTER_Y };
  Contact contact = contactGeometry(leftCenter, rightCenter, gameDisplayRadius, connectivityDisplayRadius);
  Vec2 leftDirection = contact.contactNormal;
  Vec2 rightDirection = { -contact.contactNormal.x, -contact.contactNormal.y };
  drawJellyBall(leftCenter, gameDisplayRadius, leftDirection, contact, rotationAngle, animatedT, 0xFC42, 0xFED9, true);
  drawJellyBall(rightCenter, connectivityDisplayRadius, rightDirection, contact, rotationAngle, animatedT, 0x9ED9, 0xCFFB, false);
  drawFastContactCurve(contact, gameDisplayRadius, connectivityDisplayRadius, rotationAngle, animatedT);
}

void drawRadialStripeRing(int x, int y, int radius, float rotation, uint16_t color, uint16_t accent) {
  int segments = 18;
  for (int i = 0; i < segments; i += 2) {
    float a = rotation + i * PI * 2.0f / segments;
    float b = rotation + (i + 1) * PI * 2.0f / segments;
    M5.Lcd.fillTriangle(x, y, x + cosf(a) * radius, y + sinf(a) * radius, x + cosf(b) * radius, y + sinf(b) * radius, color);
  }
  M5.Lcd.fillCircle(x, y, radius * 0.42f, WHITE);
  M5.Lcd.drawCircle(x, y, radius, accent);
}

void drawDottedRing(int x, int y, int radius, float rotation, uint16_t color, uint16_t accent) {
  M5.Lcd.drawCircle(x, y, radius, color);
  M5.Lcd.drawCircle(x, y, radius - 2, color);
  for (int i = 0; i < 8; i++) {
    float a = rotation + i * PI * 2.0f / 8.0f;
    M5.Lcd.fillCircle(x + cosf(a) * radius * 0.45f, y + sinf(a) * radius * 0.45f, max(2, radius / 7), i % 2 ? accent : WHITE);
  }
}

void drawWedgeRing(int x, int y, int radius, float rotation, uint16_t color, uint16_t accent) {
  M5.Lcd.fillCircle(x, y, radius, color);
  for (int i = 0; i < 6; i += 2) {
    float a = rotation + i * PI * 2.0f / 6.0f;
    float b = rotation + (i + 1) * PI * 2.0f / 6.0f;
    M5.Lcd.fillTriangle(x, y, x + cosf(a) * radius, y + sinf(a) * radius, x + cosf(b) * radius, y + sinf(b) * radius, accent);
  }
  M5.Lcd.fillCircle(x, y, radius * 0.38f, WHITE);
}

void drawGifStyleCircle(const CelebrationParticle &particle, int x, int y, float scale, float rotation) {
  int radius = max(3, (int)(particle.radius * scale));
  if (particle.style == 0) drawRadialStripeRing(x, y, radius, rotation, particle.color, particle.accent);
  else if (particle.style == 1) drawDottedRing(x, y, radius, rotation, particle.color, particle.accent);
  else if (particle.style == 2) {
    M5.Lcd.fillCircle(x, y, radius, particle.color);
    M5.Lcd.fillCircle(x, y, radius * 0.55f, WHITE);
    M5.Lcd.drawCircle(x, y, radius, particle.accent);
  } else drawWedgeRing(x, y, radius, rotation, particle.color, particle.accent);
}

void drawHalfWhiteOverlay(float gather) {
  float coverage = 0.5f * gather;
  if (coverage <= 0.0f) return;
  int spacing = coverage >= 0.45f ? 2 : coverage >= 0.30f ? 3 : coverage >= 0.18f ? 4 : 6;
  for (int y = 0; y < SCREEN_HEIGHT; y += spacing) {
    M5.Lcd.drawFastHLine(0, y, SCREEN_WIDTH, WHITE);
  }
}

void drawCongratulationsAnimation() {
  if (celebrationMode == CELEBRATION_IDLE) return;

  unsigned long now = millis();
  unsigned long elapsed = now - celebrationStartedAt;
  float gather = 1.0f;
  if (celebrationMode == CELEBRATION_ENTERING) {
    gather = easeInOutCubic(elapsed / (float)CELEBRATION_ENTER_MS);
    if (elapsed >= CELEBRATION_ENTER_MS) celebrationMode = CELEBRATION_HOLDING;
  } else if (celebrationMode == CELEBRATION_HOLDING) {
    gather = 1.0f;
  } else if (celebrationMode == CELEBRATION_EXITING) {
    gather = 1.0f - easeInOutCubic(elapsed / (float)CELEBRATION_EXIT_MS);
    if (elapsed >= CELEBRATION_EXIT_MS) {
      celebrationMode = CELEBRATION_IDLE;
      drawBalls();
      return;
    }
  }

  drawBalls();
  drawHalfWhiteOverlay(gather);
  float spin = now * 0.0032f;
  for (int i = 0; i < CELEBRATION_COUNT; i++) {
    CelebrationParticle p = celebrationParticles[i];
    float orbitAngle = p.clusterAngle + spin * p.spin;
    float targetX = SCREEN_CENTER_X + cosf(orbitAngle) * p.clusterRadius;
    float targetY = SCREEN_CENTER_Y + sinf(orbitAngle) * p.clusterRadius * 0.82f;
    float startX = SCREEN_CENTER_X + cosf(p.startAngle) * p.startRadius;
    float startY = SCREEN_CENTER_Y + sinf(p.startAngle) * p.startRadius * 0.78f;
    int x = startX * (1.0f - gather) + targetX * gather;
    int y = startY * (1.0f - gather) + targetY * gather;
    float scale = 1.0f + gather * 0.55f + sinf(now * 0.006f + p.radius) * 0.08f;
    drawGifStyleCircle(p, x, y, scale, spin * p.spin + p.clusterAngle);
  }
  M5.Lcd.setTextDatum(MC_DATUM);
  M5.Lcd.setTextColor(BLACK, WHITE);
  M5.Lcd.drawString("CONGRATULATIONS", SCREEN_WIDTH / 2, (int)(SCREEN_HEIGHT * 0.74f), 1);
}

void drawLabels() {
  M5.Lcd.setTextDatum(MC_DATUM);
  M5.Lcd.setTextColor(WHITE, BLACK);
  M5.Lcd.drawString("Game", SCREEN_WIDTH * 0.18f, SCREEN_HEIGHT - 12, 1);
  M5.Lcd.drawString("Connectivity", SCREEN_WIDTH * 0.78f, SCREEN_HEIGHT - 12, 1);
}

void drawProgressBackground() {
  int progressHeight = (int)(SCREEN_HEIGHT * min(1.0f, max(0.0f, stageProgress)));
  if (progressHeight > 0) M5.Lcd.fillRect(0, SCREEN_HEIGHT - progressHeight, SCREEN_WIDTH, progressHeight, 0xF68E);
}

void drawStage4LoopFrame() {
  unsigned long now = millis();
  for (int y = 0; y < SCREEN_HEIGHT; y += 4) {
    uint16_t color = (y + (now / 18)) % 48 < 16 ? 0xF68E : ((y + (now / 22)) % 48 < 32 ? 0xFC42 : 0x9ED9);
    M5.Lcd.fillRect(0, y, SCREEN_WIDTH, 4, color);
  }
  for (int i = 0; i < 9; i++) {
    int radius = sr(22 + i * 18 + sinf(now * 0.004f + i) * 7);
    int start = (now / 12 + i * 23) % 360;
    for (int a = start; a < start + 220; a += 12) {
      float rad = a * PI / 180.0f;
      float next = (a + 10) * PI / 180.0f;
      M5.Lcd.drawLine(SCREEN_CENTER_X + cosf(rad) * radius, SCREEN_CENTER_Y + sinf(rad) * radius, SCREEN_CENTER_X + cosf(next) * radius, SCREEN_CENTER_Y + sinf(next) * radius, WHITE);
    }
  }
}

bool openStage4MjpegFile() {
  if (stage4MjpegFile) return true;
  stage4MjpegFile = SPIFFS.open(STAGE4_MJPEG_PATH, "r");
  return stage4MjpegFile;
}

bool ensureStage4JpegBuffer() {
  if (stage4JpegBuffer) return true;
  stage4JpegBuffer = (uint8_t *)malloc(STAGE4_JPEG_BUFFER_SIZE);
  return stage4JpegBuffer != nullptr;
}

bool readNextStage4JpegFrame(size_t &frameSize) {
  if (!ensureStage4JpegBuffer() || !openStage4MjpegFile()) return false;
  bool inFrame = false;
  int previous = -1;
  frameSize = 0;

  while (true) {
    if (!stage4MjpegFile.available()) {
      stage4MjpegFile.seek(0);
      previous = -1;
      if (!inFrame) continue;
      return false;
    }

    int current = stage4MjpegFile.read();
    if (current < 0) return false;

    if (!inFrame) {
      if (previous == 0xFF && current == 0xD8) {
        inFrame = true;
        stage4JpegBuffer[0] = 0xFF;
        stage4JpegBuffer[1] = 0xD8;
        frameSize = 2;
      }
    } else {
      if (frameSize >= STAGE4_JPEG_BUFFER_SIZE) return false;
      stage4JpegBuffer[frameSize++] = (uint8_t)current;
      if (previous == 0xFF && current == 0xD9) return true;
    }
    previous = current;
  }
}

bool drawNextStage4MjpegFrame() {
  size_t frameSize = 0;
  if (!readNextStage4JpegFrame(frameSize)) return false;
  M5.Lcd.drawJpg(stage4JpegBuffer, frameSize, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  return true;
}

void drawBalls() {
  if (stage4VideoMode && ayellowStage == 4) {
    if (!drawNextStage4MjpegFrame()) drawStage4LoopFrame();
    return;
  }
  float speedFactor = animationSpeed / 45.0f;
  float animatedT = millis() * speedFactor;
  float gamePulse = sinf(animatedT * 0.002f) * 2.0f;
  float connectivityPulse = cosf(animatedT * 0.0018f) * 2.0f;
  float gameDisplayRadius = displayRadius(gameRadius, HOME_RADIUS) + gamePulse;
  float connectivityDisplayRadius = displayRadius(connectivityRadius, HOME_RADIUS) + connectivityPulse;
  const float rotationAngle = 0.0f;
  M5.Lcd.fillScreen(BLACK);
  drawProgressBackground();
  drawJellyContactPair(gameDisplayRadius, connectivityDisplayRadius, rotationAngle, animatedT);
  drawLabels();
}

int boundedRadius(String value) {
  int radius = value.toInt();
  if (radius < 11) return 11;
  if (radius > 33) return 33;
  return radius;
}

int boundedSpeed(String value) {
  int speed = value.toInt();
  if (speed < 0) return 0;
  if (speed > 100) return 100;
  return speed;
}

int cadenceRpmToRadius(float cadenceRpm) {
  float rpmSpan = max(1.0f, mappingMaxRpm - mappingMinRpm);
  float t = (cadenceRpm - mappingMinRpm) / rpmSpan;
  if (t < 0.0f) t = 0.0f;
  if (t > 1.0f) t = 1.0f;
  return mappingMinRadius + roundf(t * (mappingMaxRadius - mappingMinRadius));
}

bool extractJsonNumber(const String &payload, const char *key, float &value) {
  String marker = String("\"") + key + "\":";
  int valueIndex = payload.indexOf(marker);
  if (valueIndex < 0) return false;
  valueIndex += marker.length();
  while (valueIndex < payload.length() && payload.charAt(valueIndex) == ' ') valueIndex++;
  int endIndex = valueIndex;
  while (endIndex < payload.length()) {
    char c = payload.charAt(endIndex);
    if (!((c >= '0' && c <= '9') || c == '.' || c == '-')) break;
    endIndex++;
  }
  value = payload.substring(valueIndex, endIndex).toFloat();
  return true;
}

bool extractJsonString(const String &payload, const char *key, String &value) {
  String marker = String("\"") + key + "\":";
  int valueIndex = payload.indexOf(marker);
  if (valueIndex < 0) return false;
  valueIndex += marker.length();
  while (valueIndex < payload.length() && payload.charAt(valueIndex) == ' ') valueIndex++;
  if (valueIndex >= payload.length() || payload.charAt(valueIndex) != '\"') return false;
  valueIndex++;
  int endIndex = payload.indexOf("\"", valueIndex);
  if (endIndex < 0) return false;
  value = payload.substring(valueIndex, endIndex);
  return true;
}

bool extractCadenceRpm(const String &payload, const char *riderId, float &cadenceRpm) {
  String marker = String("\"") + riderId + "\"";
  int riderIndex = payload.indexOf(marker);
  if (riderIndex < 0) return false;
  int cadenceIndex = payload.indexOf("\"cadenceRpm\":", riderIndex);
  if (cadenceIndex < 0) return false;
  cadenceIndex += 13;
  while (cadenceIndex < payload.length() && payload.charAt(cadenceIndex) == ' ') cadenceIndex++;
  int endIndex = cadenceIndex;
  while (endIndex < payload.length()) {
    char c = payload.charAt(endIndex);
    if (!((c >= '0' && c <= '9') || c == '.' || c == '-')) break;
    endIndex++;
  }
  cadenceRpm = payload.substring(cadenceIndex, endIndex).toFloat();
  return true;
}

void applyAyellowPayload(const String &payload) {
  // payload.riders.user1.cadenceRpm
  // payload.riders.user2.cadenceRpm
  float user1CadenceRpm;
  float user2CadenceRpm;
  float nextProgress;
  float nextStage;
  float nextCountdownRemainingSeconds;
  float nextMinRpm;
  float nextMaxRpm;
  float nextMinRadius;
  float nextMaxRadius;
  String congratulations;
  String stage4Video;
  if (extractCadenceRpm(payload, "user1", user1CadenceRpm)) gameRadius = cadenceRpmToRadius(user1CadenceRpm);
  if (extractCadenceRpm(payload, "user2", user2CadenceRpm)) connectivityRadius = cadenceRpmToRadius(user2CadenceRpm);
  if (extractJsonNumber(payload, "minRpm", nextMinRpm)) mappingMinRpm = nextMinRpm;
  if (extractJsonNumber(payload, "maxRpm", nextMaxRpm)) mappingMaxRpm = nextMaxRpm;
  if (extractJsonNumber(payload, "minRadius", nextMinRadius)) mappingMinRadius = (int)nextMinRadius;
  if (extractJsonNumber(payload, "maxRadius", nextMaxRadius)) mappingMaxRadius = (int)nextMaxRadius;
  bool hasCountdownSignal = extractJsonNumber(payload, "countdownRemainingSeconds", nextCountdownRemainingSeconds);
  if (hasCountdownSignal) applyStage0CountdownSignal(nextCountdownRemainingSeconds);
  if (extractJsonNumber(payload, "progress", nextProgress) && !localResetHold && !hasCountdownSignal) stageProgress = min(1.0f, max(0.0f, nextProgress));
  if (extractJsonNumber(payload, "stage", nextStage)) jumpToAyellowStage((int)nextStage);
  if (extractJsonString(payload, "congratulations", congratulations)) applyCongratulationsSignal(congratulations);
  if (extractJsonString(payload, "stage4Video", stage4Video)) applyStage4VideoSignal(stage4Video);
}

void handleAyellowSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  if (type != WStype_TEXT) return;
  String message;
  message.reserve(length);
  for (size_t i = 0; i < length; i++) message += (char)payload[i];
  applyAyellowPayload(message);
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSsid, wifiPassword);
  unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 12000) {
    delay(250);
    M5.update();
  }
}

void handleRoot() {
  server.send(200, "text/html", pageHtml());
}

void handleToggleCongratulations() {
  if (celebrationMode == CELEBRATION_IDLE || celebrationMode == CELEBRATION_EXITING) {
    celebrationMode = CELEBRATION_ENTERING;
    celebrationStartedAt = millis();
    server.send(200, "text/plain", "holding");
  } else {
    celebrationMode = CELEBRATION_EXITING;
    celebrationStartedAt = millis();
    server.send(200, "text/plain", "idle");
  }
}

void handleSetBall() {
  String ball = server.arg("ball");
  if (ball == "game") gameRadius = boundedRadius(server.arg("value"));
  else if (ball == "connectivity") connectivityRadius = boundedRadius(server.arg("value"));
  else if (ball == "speed") animationSpeed = boundedSpeed(server.arg("value"));
  if (celebrationMode == CELEBRATION_IDLE) drawBalls();
  server.send(200, "text/plain", "ok");
}

void setup() {
#ifdef M5STICK_S3_TARGET
  auto cfg = M5.config();
  M5.begin(cfg);
  M5.Display.setRotation(1);
#else
  M5.begin();
  M5.Power.begin();
  M5.Lcd.setRotation(1);
#endif
  SPIFFS.begin(true);
  M5.Lcd.fillScreen(BLACK);
  connectWiFi();
  ayellowSocket.begin(ayellowHost, ayellowPort, "/");
  ayellowSocket.onEvent(handleAyellowSocketEvent);
  ayellowSocket.setReconnectInterval(2000);
  server.on("/", handleRoot);
  server.on("/set", handleSetBall);
  server.on("/congratulations", handleToggleCongratulations);
  server.begin();
  drawBalls();
}

void loop() {
  server.handleClient();
  ayellowSocket.loop();
  M5.update();
  if (M5.BtnA.wasPressed()) resetM5StackAnimationState();

  static unsigned long lastFrame = 0;
  if (millis() - lastFrame > FRAME_INTERVAL_MS) {
    lastFrame = millis();
    M5.Lcd.startWrite();
    if (celebrationMode == CELEBRATION_IDLE) drawBalls();
    else drawCongratulationsAnimation();
    M5.Lcd.endWrite();
  }
}
