#include <M5Stack.h>
#include <WiFi.h>
#include <WebServer.h>

const char *apSsid = "M5Stack-Balls";
const char *apPassword = "12345678";

WebServer server(80);

int gameRadius = 46;
int connectivityRadius = 46;

const int gameX = 84;
const int gameY = 106;
const int connectivityX = 236;
const int connectivityY = 106;

String pageHtml() {
  String html = "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<style>body{font-family:Arial,sans-serif;background:#111;color:white;margin:24px}label{display:block;margin-top:24px}.v{font-size:28px;margin-left:8px}input{width:100%}.card{max-width:560px;margin:auto}</style>";
  html += "</head><body><div class='card'><h1>M5Stack Balls</h1>";
  html += "<label>Game 球大小 <span id='gameValue' class='v'>" + String(gameRadius) + "</span></label>";
  html += "<input type='range' min='22' max='66' value='" + String(gameRadius) + "' oninput=\"setGame(this.value)\">";
  html += "<label>Connectivity 球大小 <span id='connectivityValue' class='v'>" + String(connectivityRadius) + "</span></label>";
  html += "<input type='range' min='22' max='66' value='" + String(connectivityRadius) + "' oninput=\"setConnectivity(this.value)\">";
  html += "<p>连接 Wi-Fi：M5Stack-Balls，密码：12345678；浏览器打开 http://192.168.4.1</p>";
  html += "<script>function setBall(ball,value,path){document.getElementById(ball+'Value').textContent=value;fetch(path+value)}function setGame(value){setBall('game',value,'/set?ball=game&value=')}function setConnectivity(value){setBall('connectivity',value,'/set?ball=connectivity&value=')}</script>";
  html += "</div></body></html>";
  return html;
}

void drawLabels() {
  M5.Lcd.setTextDatum(MC_DATUM);
  M5.Lcd.setTextColor(WHITE, BLACK);
  M5.Lcd.drawString("Game", gameX, 186, 2);
  M5.Lcd.drawString("Connectivity", connectivityX, 186, 2);
  M5.Lcd.drawString("WiFi: M5Stack-Balls  http://192.168.4.1", 160, 222, 2);
}

void drawGameBall(int x, int y, int radius) {
  M5.Lcd.fillCircle(x, y, radius, 0xAFE5);
  M5.Lcd.drawCircle(x, y, radius, 0xAFE5);

  int step = max(9, radius / 4);
  int dotRadius = max(2, radius / 18);
  for (int py = y - radius + step; py <= y + radius - step; py += step) {
    for (int px = x - radius + step; px <= x + radius - step; px += step) {
      int ox = ((py / step) % 2) * (step / 2);
      int dx = px + ox - x;
      int dy = py - y;
      if (dx * dx + dy * dy < (radius - dotRadius - 2) * (radius - dotRadius - 2)) {
        M5.Lcd.fillCircle(px + ox, py, dotRadius, BLACK);
      }
    }
  }
}

void drawConnectivityBall(int x, int y, int radius) {
  M5.Lcd.fillCircle(x, y, radius, 0x1C9F);
  M5.Lcd.drawCircle(x, y, radius, 0x1C9F);

  uint16_t lineColor = 0xF9B6;
  for (int i = -radius + 8; i <= radius - 8; i += max(9, radius / 5)) {
    int w = sqrt((float)(radius * radius - i * i));
    M5.Lcd.drawEllipse(x, y + i, w, max(5, radius / 8), lineColor);
  }

  for (int i = 0; i < 6; i++) {
    float angle = i * 0.55;
    int x1 = x + cos(angle) * radius * 0.9;
    int y1 = y - radius + 6 + i * radius / 3;
    int x2 = x - cos(angle) * radius * 0.9;
    int y2 = y + radius - 6 - i * radius / 3;
    M5.Lcd.drawLine(x1, y1, x2, y2, lineColor);
  }
}

void drawBalls() {
  M5.Lcd.fillScreen(BLACK);
  drawGameBall(gameX, gameY, gameRadius);
  drawConnectivityBall(connectivityX, connectivityY, connectivityRadius);
  drawLabels();
}

int boundedRadius(String value) {
  int radius = value.toInt();
  if (radius < 22) return 22;
  if (radius > 66) return 66;
  return radius;
}

void handleRoot() {
  server.send(200, "text/html", pageHtml());
}

void handleSetBall() {
  String ball = server.arg("ball");
  int radius = boundedRadius(server.arg("value"));

  if (ball == "game") {
    gameRadius = radius;
  } else if (ball == "connectivity") {
    connectivityRadius = radius;
  }

  drawBalls();
  server.send(200, "text/plain", "ok");
}

void setup() {
  M5.begin();
  M5.Power.begin();
  M5.Lcd.setRotation(1);
  M5.Lcd.fillScreen(BLACK);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(apSsid, apPassword);

  server.on("/", handleRoot);
  server.on("/set", handleSetBall);
  server.begin();

  drawBalls();
}

void loop() {
  server.handleClient();
  M5.update();
}
