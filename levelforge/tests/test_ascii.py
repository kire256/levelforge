"""
Tests for LevelForge ASCII visualizer.
"""

import pytest
from levelforge.src.ui.preview.ascii_renderer import (
    ASCIIVisualizer,
    RenderOptions,
    render_level,
)


class TestASCIIVisualizer:
    """Tests for ASCIIVisualizer."""
    
    def test_render_empty_platform(self):
        """Test rendering a level with no platforms."""
        level = {"platforms": [], "entities": []}
        visualizer = ASCIIVisualizer()
        result = visualizer.render(level)
        
        assert "No platforms" in result
    
    def test_render_platformer_level(self):
        """Test rendering a basic platformer level."""
        level = {
            "genre": "platformer",
            "difficulty": "medium",
            "platforms": [
                {"x": 0, "y": 480, "width": 100, "height": 20},
                {"x": 50, "y": 400, "width": 80, "height": 15},
            ],
            "entities": [
                {"type": "player_spawn", "x": 20, "y": 450},
                {"type": "goal", "x": 90, "y": 350},
            ]
        }
        
        visualizer = ASCIIVisualizer()
        result = visualizer.render(level)
        
        # Should contain platform characters
        assert "█" in result
        # Should have border
        assert result.startswith("█")
    
    def test_render_compact(self):
        """Test compact rendering."""
        level = {
            "genre": "platformer",
            "difficulty": "easy",
            "platforms": [
                {"x": 0, "y": 480, "width": 100, "height": 20},
                {"x": 50, "y": 400, "width": 80, "height": 15},
            ],
            "entities": [
                {"type": "player_spawn", "x": 20, "y": 450},
                {"type": "coin", "x": 60, "y": 380},
            ]
        }
        
        visualizer = ASCIIVisualizer()
        result = visualizer.render_compact(level)
        
        assert "PLATFORMER" in result
        assert "EASY" in result
        assert "Platforms (2)" in result
        assert "Entities (2)" in result
    
    def test_render_options(self):
        """Test custom render options."""
        level = {
            "platforms": [{"x": 0, "y": 480, "width": 100, "height": 20}],
            "entities": []
        }
        
        options = RenderOptions(width=40, height=20, scale=0.5)
        visualizer = ASCIIVisualizer(options)
        result = visualizer.render(level)
        
        # Should render with custom options
        assert "█" in result
    
    def test_entity_characters(self):
        """Test different entity types render correctly."""
        level = {
            "platforms": [{"x": 0, "y": 480, "width": 500, "height": 20}],
            "entities": [
                {"type": "player_spawn", "x": 50, "y": 450},
                {"type": "goal", "x": 450, "y": 100},
                {"type": "coin", "x": 200, "y": 400},
                {"type": "enemy_basic", "x": 300, "y": 450},
                {"type": "spike", "x": 350, "y": 470},
            ]
        }
        
        visualizer = ASCIIVisualizer()
        result = visualizer.render(level)
        
        # Check that entities are rendered
        assert "☺" in result  # player
        assert "⚑" in result  # goal
        assert "●" in result  # coin
        assert "☠" in result  # enemy
        assert "▲" in result  # spike
    
    def test_render_level_function(self):
        """Test convenience render_level function."""
        level = {
            "genre": "puzzle",
            "difficulty": "hard",
            "platforms": [{"x": 0, "y": 480, "width": 100, "height": 20}],
            "entities": [{"type": "player_spawn", "x": 50, "y": 450}]
        }
        
        result = render_level(level, compact=True)
        
        assert "PUZZLE" in result
        assert "HARD" in result
    
    def test_render_with_metadata(self):
        """Test that metadata is displayed in compact mode."""
        level = {
            "genre": "platformer",
            "difficulty": "medium",
            "platforms": [{"x": 0, "y": 480, "width": 100, "height": 20}],
            "entities": [],
            "metadata": {
                "difficulty_score": 7.5,
                "estimated_duration_seconds": 180
            }
        }
        
        result = render_level(level, compact=True)
        
        assert "Difficulty: 7.5/10" in result
        assert "Est. time: 3m 0s" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
