import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / "screen_preview.html"


class PreviewContractTest(unittest.TestCase):
    def source(self):
        return PREVIEW.read_text(encoding="utf-8")

    def test_preview_uses_larger_base_and_double_slider_growth(self):
        text = self.source()
        self.assertIn("BASE_RADIUS_MULTIPLIER = 3", text)
        self.assertIn("SLIDER_GROWTH_MULTIPLIER = 4", text)
        self.assertIn("displayRadius", text)

    def test_preview_uses_local_jelly_contact_deformation(self):
        text = self.source()
        self.assertIn("drawJellyContactPair", text)
        self.assertIn("contactDepth", text)
        self.assertIn("contactNormal", text)
        self.assertIn("jellyBoundary", text)
        self.assertIn("deformNearContact", text)
        self.assertNotIn("sharedBoundaryX", text)

    def test_preview_keeps_balls_fixed_at_screen_edges(self):
        text = self.source()
        self.assertIn("const rotationAngle = 0", text)
        self.assertIn("SCREEN_CENTER_X - EDGE_DISTANCE", text)
        self.assertIn("SCREEN_CENTER_X + EDGE_DISTANCE", text)
        self.assertNotIn("const rotationAngle = animatedT * 0.00035", text)

    def test_preview_has_congratulations_circle_animation(self):
        text = self.source()
        self.assertIn("congratulationsButton", text)
        self.assertIn("toggleCongratulationsAnimation", text)
        self.assertIn("drawCongratulationsAnimation", text)
        self.assertIn("celebrationParticles", text)
        self.assertIn("drawGifStyleCircle", text)
        self.assertIn("drawRadialStripeRing", text)
        self.assertIn("drawDottedRing", text)
        self.assertIn("entering", text)
        self.assertIn("holding", text)
        self.assertIn("exiting", text)

    def test_preview_congratulations_uses_half_white_overlay(self):
        text = self.source()
        self.assertIn("0.5 * gather", text)
        self.assertNotIn("0.94 * gather", text)

    def test_preview_maps_ayellow_cadence_to_ball_sizes(self):
        text = self.source()
        self.assertIn("AYELLOW_GATEWAY_URL", text)
        self.assertIn("new WebSocket(AYELLOW_GATEWAY_URL)", text)
        self.assertIn("cadenceRpmToRadius", text)
        self.assertIn("payload.riders.user1.cadenceRpm", text)
        self.assertIn("payload.riders.user2.cadenceRpm", text)
        self.assertIn("radiusMapping", text)
        self.assertIn("payload.radiusMapping", text)
        self.assertIn("radiusMapping.maxRpm - radiusMapping.minRpm", text)
        self.assertNotIn("cadenceRpm / 30", text)
        self.assertNotIn("cadenceRpm / 120", text)

    def test_preview_uses_ayellow_animation_signal_for_congratulations(self):
        text = self.source()
        self.assertIn("payload.animation.congratulations", text)
        self.assertIn("applyCongratulationsSignal", text)
        self.assertIn("applyStage4VideoSignal", text)
        self.assertIn("#F4D070", text)
        self.assertIn("drawProgressBackground", text)
        self.assertIn("stage4Video", text)
        self.assertIn("140deace81fac3f5ac60c60542b7616b.mjpeg", text)
        self.assertIn("#FF8812", text)
        self.assertIn("#9ED9D3", text)


if __name__ == "__main__":
    unittest.main()
