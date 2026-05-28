#include <M5Unified.h>

void setup() {
  auto config = M5.config();
  M5.begin(config);
  M5.Display.setRotation(1);
  M5.Display.fillScreen(TFT_BLACK);
  M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);
  M5.Display.setTextSize(2);
  M5.Display.setCursor(16, 24);
  M5.Display.println("Cycling Animation");
  M5.Display.setTextSize(1);
  M5.Display.setCursor(16, 64);
  M5.Display.println("M5Stack Basic v2.7");
  M5.Display.setCursor(16, 88);
  M5.Display.println("Waiting for animation spec...");
}

void loop() {
  M5.update();
  delay(16);
}
