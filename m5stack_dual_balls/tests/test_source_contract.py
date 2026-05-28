import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKETCH = ROOT / "m5stack_dual_balls" / "m5stack_dual_balls.ino"
FIRMWARE = ROOT / "src" / "main.cpp"
PLATFORMIO = ROOT / "platformio.ini"
PREVIEW = ROOT / "screen_preview.html"


class SketchContractTest(unittest.TestCase):
    def source(self):
        return SKETCH.read_text(encoding="utf-8")

    def test_sketch_exists(self):
        self.assertTrue(SKETCH.exists())

    def test_exposes_wifi_web_slider_controls(self):
        text = self.source()
        self.assertIn("WiFi.softAP", text)
        self.assertIn("WebServer server", text)
        self.assertIn("input type='range'", text)
        self.assertIn("setBall", text)

    def test_has_two_independent_size_parameters(self):
        text = self.source()
        self.assertIn("gameRadius", text)
        self.assertIn("connectivityRadius", text)
        self.assertIn("ball=game", text)
        self.assertIn("ball=connectivity", text)

    def test_draws_reference_inspired_balls(self):
        text = self.source()
        self.assertIn("drawGameBall", text)
        self.assertIn("drawConnectivityBall", text)
        self.assertIn("fillCircle", text)
        self.assertIn("drawEllipse", text)

    def test_firmware_uses_preview_jelly_style(self):
        text = FIRMWARE.read_text(encoding="utf-8")
        self.assertIn("BASE_RADIUS_MULTIPLIER", text)
        self.assertIn("SLIDER_GROWTH_MULTIPLIER", text)
        self.assertIn("drawJellyContactPair", text)
        self.assertIn("deformNearContact", text)
        self.assertIn("const float rotationAngle = 0.0f", text)
        self.assertNotIn("float rotationAngle = animatedT * 0.00035f", text)
        self.assertNotIn("drawString(\"3x base", text)

    def test_firmware_uses_fast_m5stack_drawing_path(self):
        text = FIRMWARE.read_text(encoding="utf-8")
        self.assertIn("FRAME_INTERVAL_MS", text)
        self.assertIn("buildJellyBoundary", text)
        self.assertIn("fillJellyPolygon", text)
        self.assertIn("drawFastContactCurve", text)
        self.assertNotIn("insideJellyBoundary", text)
        self.assertNotIn("fillEllipse((int)cut.x", text)

    def test_firmware_page_starts_both_sliders_equal(self):
        text = FIRMWARE.read_text(encoding="utf-8")
        self.assertIn("const int HOME_RADIUS = 23", text)
        self.assertIn("int gameRadius = HOME_RADIUS", text)
        self.assertIn("int connectivityRadius = HOME_RADIUS", text)

    def test_firmware_has_congratulations_toggle_animation(self):
        text = FIRMWARE.read_text(encoding="utf-8")
        self.assertIn("toggleCongratulations", text)
        self.assertIn("handleToggleCongratulations", text)
        self.assertIn("drawCongratulationsAnimation", text)
        self.assertIn("drawRadialStripeRing", text)
        self.assertIn("drawDottedRing", text)
        self.assertIn("drawWedgeRing", text)
        self.assertIn("CONGRATULATIONS", text)

    def test_firmware_congratulations_uses_half_white_overlay(self):
        text = FIRMWARE.read_text(encoding="utf-8")
        self.assertIn("drawHalfWhiteOverlay", text)
        self.assertNotIn("fillScreen(WHITE)", text)

    def test_firmware_batches_lcd_frame_writes(self):
        text = FIRMWARE.read_text(encoding="utf-8")
        self.assertIn("M5.Lcd.startWrite();", text)
        self.assertIn("M5.Lcd.endWrite();", text)

    def test_firmware_has_sticks3_build_target(self):
        text = FIRMWARE.read_text(encoding="utf-8")
        platformio = PLATFORMIO.read_text(encoding="utf-8")
        self.assertIn("[env:m5stick-s3]", platformio)
        self.assertIn("board = m5stack-stamps3", platformio)
        self.assertIn("upload_port = COM10", platformio)
        self.assertIn("m5stack/M5Unified", platformio)
        self.assertIn("-DM5STICK_S3_TARGET", platformio)
        self.assertIn("#ifdef M5STICK_S3_TARGET", text)
        self.assertIn("#include <M5Unified.h>", text)
        self.assertIn("const int SCREEN_WIDTH = 128", text)
        self.assertIn("const int SCREEN_HEIGHT = 128", text)
        self.assertIn("SCREEN_WIDTH / 2.0f", text)
        self.assertIn("SCREEN_HEIGHT / 2.0f", text)

    def test_firmware_reads_ayellow_websocket_cadence(self):
        text = FIRMWARE.read_text(encoding="utf-8")
        self.assertIn("#include <WebSocketsClient.h>", text)
        self.assertIn("WebSocketsClient ayellowSocket", text)
        self.assertIn("WiFi.mode(WIFI_STA)", text)
        self.assertIn("WiFi.begin(wifiSsid, wifiPassword)", text)
        self.assertIn("ayellowSocket.begin(ayellowHost, ayellowPort, \"/\")", text)
        self.assertIn("ayellowSocket.loop()", text)
        self.assertIn("cadenceRpmToRadius", text)
        self.assertIn("payload.riders.user1.cadenceRpm", text)
        self.assertIn("payload.riders.user2.cadenceRpm", text)
        self.assertIn("while (cadenceIndex < payload.length() && payload.charAt(cadenceIndex) == ' ')", text)
        self.assertIn("mappingMinRpm", text)
        self.assertIn("mappingMaxRpm", text)
        self.assertIn("mappingMinRadius", text)
        self.assertIn("mappingMaxRadius", text)
        self.assertIn("extractJsonNumber(payload, \"maxRpm\"", text)
        self.assertNotIn("cadenceRpm > 30.0f", text)
        self.assertNotIn("cadenceRpm / 30.0f", text)
        self.assertNotIn("cadenceRpm > 120.0f", text)
        self.assertNotIn("cadenceRpm / 120.0f", text)

    def test_firmware_uses_ayellow_animation_signal_for_congratulations(self):
        text = FIRMWARE.read_text(encoding="utf-8")
        self.assertIn("payload.animation.congratulations", text)
        self.assertIn("applyCongratulationsSignal", text)
        self.assertIn("applyStage4VideoSignal", text)
        self.assertIn("stageProgress", text)
        self.assertIn("drawProgressBackground", text)
        self.assertIn("0xF68E", text)
        self.assertIn("drawStage4LoopFrame", text)
        self.assertIn("if (stage4VideoMode && ayellowStage == 4)", text)
        self.assertIn("stage4VideoMode = stage4Video == \"playing\" && ayellowStage == 4", text)
        self.assertIn("0xFC42", text)
        self.assertIn("0x9ED9", text)
        self.assertIn("resetM5StackAnimationState", text)
        self.assertIn("M5.BtnA.wasPressed()", text)
        self.assertIn("jumpToAyellowStage", text)

    def test_firmware_streams_stage4_mjpeg_from_spiffs(self):
        text = FIRMWARE.read_text(encoding="utf-8")
        platformio = PLATFORMIO.read_text(encoding="utf-8")
        self.assertIn("#include \"FS.h\"", text)
        self.assertIn("#include \"SPIFFS.h\"", text)
        self.assertIn("const char *STAGE4_MJPEG_PATH = \"/stage4.mjpeg\"", text)
        self.assertIn("SPIFFS.begin(true)", text)
        self.assertIn("File stage4MjpegFile", text)
        self.assertIn("drawNextStage4MjpegFrame", text)
        self.assertIn("M5.Lcd.drawJpg(stage4JpegBuffer", text)
        self.assertIn("board_build.filesystem = spiffs", platformio)

    def test_firmware_countdown_progress_is_not_overwritten(self):
        text = FIRMWARE.read_text(encoding="utf-8")
        self.assertIn("bool hasCountdownSignal =", text)
        self.assertIn("applyStage0CountdownSignal(nextCountdownRemainingSeconds)", text)
        self.assertIn("if (extractJsonNumber(payload, \"progress\", nextProgress) && !localResetHold && !hasCountdownSignal)", text)

    def test_preview_removes_top_caption(self):
        text = PREVIEW.read_text(encoding="utf-8")
        self.assertNotIn("3x base / 4x slider growth / squeezed overlap", text)


if __name__ == "__main__":
    unittest.main()
