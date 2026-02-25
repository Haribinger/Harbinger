#!/usr/bin/env python3
"""
HexStrike Test Suite
Tests hexstrike_server.py and hexstrike_mcp.py for correctness
"""

import sys
import os
import unittest
from unittest.mock import Mock, patch, MagicMock
import json

# Add the current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

class TestHexStrikeServer(unittest.TestCase):
    """Test cases for hexstrike_server.py"""

    @classmethod
    def setUpClass(cls):
        """Set up test fixtures"""
        print("\n" + "="*60)
        print("Testing hexstrike_server.py")
        print("="*60)

    def test_01_imports(self):
        """Test that hexstrike_server can be imported"""
        try:
            import hexstrike_server
            self.assertTrue(True, "Import successful")
        except Exception as e:
            self.fail(f"Failed to import hexstrike_server: {e}")

    def test_02_modern_visual_engine(self):
        """Test ModernVisualEngine class exists and has required attributes"""
        import hexstrike_server as hs

        # Test COLORS dictionary exists
        self.assertIsInstance(hs.ModernVisualEngine.COLORS, dict)
        self.assertIn('MATRIX_GREEN', hs.ModernVisualEngine.COLORS)
        self.assertIn('HACKER_RED', hs.ModernVisualEngine.COLORS)

        # Test PROGRESS_STYLES
        self.assertIsInstance(hs.ModernVisualEngine.PROGRESS_STYLES, dict)
        self.assertIn('dots', hs.ModernVisualEngine.PROGRESS_STYLES)

    def test_03_banner_creation(self):
        """Test banner creation doesn't throw errors"""
        import hexstrike_server as hs

        try:
            banner = hs.ModernVisualEngine.create_banner()
            self.assertIsInstance(banner, str)
            self.assertIn('HexStrike', banner)
            self.assertIn('Harbinger', banner)
        except Exception as e:
            self.fail(f"Banner creation failed: {e}")

    def test_04_progress_bar(self):
        """Test progress bar creation"""
        import hexstrike_server as hs

        try:
            progress = hs.ModernVisualEngine.create_progress_bar(50, 100, tool="test")
            self.assertIsInstance(progress, str)
        except Exception as e:
            self.fail(f"Progress bar creation failed: {e}")

    def test_05_target_profile_dataclass(self):
        """Test TargetProfile dataclass"""
        import hexstrike_server as hs

        # TargetProfile requires a target argument
        profile = hs.TargetProfile(target="example.com")
        self.assertIsInstance(profile.to_dict(), dict)
        self.assertIn('target', profile.to_dict())
        self.assertEqual(profile.target, "example.com")

    def test_06_attack_chain(self):
        """Test AttackChain class"""
        import hexstrike_server as hs

        profile = hs.TargetProfile(target="example.com")
        chain = hs.AttackChain(profile)
        self.assertIsInstance(chain.to_dict(), dict)
        self.assertEqual(chain.target_profile.target, "example.com")

    def test_07_intelligent_decision_engine(self):
        """Test IntelligentDecisionEngine class"""
        import hexstrike_server as hs

        engine = hs.IntelligentDecisionEngine()
        self.assertTrue(hasattr(engine, 'analyze_target'))


class TestHexStrikeMCP(unittest.TestCase):
    """Test cases for hexstrike_mcp.py"""

    @classmethod
    def setUpClass(cls):
        """Set up test fixtures"""
        print("\n" + "="*60)
        print("Testing hexstrike_mcp.py")
        print("="*60)

    def test_01_imports(self):
        """Test that hexstrike_mcp can be imported"""
        try:
            import hexstrike_mcp
            self.assertTrue(True, "Import successful")
        except Exception as e:
            self.fail(f"Failed to import hexstrike_mcp: {e}")

    def test_02_hex_strike_colors(self):
        """Test HexStrikeColors class uses class attributes"""
        import hexstrike_mcp as hm

        # Colors are class attributes, not a dict
        self.assertTrue(hasattr(hm.HexStrikeColors, 'MATRIX_GREEN'))
        self.assertTrue(hasattr(hm.HexStrikeColors, 'HACKER_RED'))
        self.assertTrue(hasattr(hm.HexStrikeColors, 'SUCCESS'))
        self.assertTrue(hasattr(hm.HexStrikeColors, 'ERROR'))

    def test_03_hex_strike_client_init(self):
        """Test HexStrikeClient initialization"""
        import hexstrike_mcp as hm

        # Create client without connecting to real server
        with patch('requests.Session') as mock_session:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"status": "ok"}

            mock_session_instance = Mock()
            mock_session_instance.get.return_value = mock_response
            mock_session.return_value = mock_session_instance

            try:
                client = hm.HexStrikeClient("http://localhost:8888")
                self.assertEqual(client.server_url, "http://localhost:8888")
                self.assertEqual(client.timeout, 300)
            except Exception as e:
                self.fail(f"Client initialization failed: {e}")

    def test_04_hex_strike_client_methods(self):
        """Test HexStrikeClient has required methods"""
        import hexstrike_mcp as hm

        self.assertTrue(hasattr(hm.HexStrikeClient, 'safe_get'))
        self.assertTrue(hasattr(hm.HexStrikeClient, 'safe_post'))
        self.assertTrue(hasattr(hm.HexStrikeClient, 'execute_command'))
        self.assertTrue(hasattr(hm.HexStrikeClient, 'check_health'))


class TestIntegration(unittest.TestCase):
    """Integration tests between server and MCP"""

    @classmethod
    def setUpClass(cls):
        """Set up test fixtures"""
        print("\n" + "="*60)
        print("Running Integration Tests")
        print("="*60)

    def test_color_consistency(self):
        """Test that color schemes are consistent between files"""
        import hexstrike_server as hs
        import hexstrike_mcp as hm

        # Check common colors exist in both
        server_colors = hs.ModernVisualEngine.COLORS
        mcp_class = hm.HexStrikeColors

        common_colors = ['SUCCESS', 'ERROR', 'WARNING', 'INFO']
        for color in common_colors:
            self.assertIn(color, server_colors, f"{color} missing in server")
            self.assertTrue(hasattr(mcp_class, color), f"{color} missing in MCP")

    def test_color_values_match(self):
        """Test that color values match between server and MCP"""
        import hexstrike_server as hs
        import hexstrike_mcp as hm

        # Check specific colors match
        self.assertEqual(
            hs.ModernVisualEngine.COLORS['MATRIX_GREEN'],
            hm.HexStrikeColors.MATRIX_GREEN
        )
        self.assertEqual(
            hs.ModernVisualEngine.COLORS['HACKER_RED'],
            hm.HexStrikeColors.HACKER_RED
        )


def run_tests():
    """Run all tests with proper output"""
    print("\n" + "🧪" * 30)
    print("HexStrike Test Suite")
    print("🧪" * 30 + "\n")

    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Add test classes
    suite.addTests(loader.loadTestsFromTestCase(TestHexStrikeServer))
    suite.addTests(loader.loadTestsFromTestCase(TestHexStrikeMCP))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegration))

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Print summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Skipped: {len(result.skipped)}")

    if result.wasSuccessful():
        print("\n✅ All tests passed!")
        return 0
    else:
        print("\n❌ Some tests failed!")
        return 1


if __name__ == '__main__':
    sys.exit(run_tests())
