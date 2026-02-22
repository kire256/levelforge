"""
LevelForge schema validation tests.
"""

import pytest
from levelforge.src.core.schemas import Level, PlayerCapabilities, Platform, Entity, Genre, LevelType, Difficulty
from levelforge.src.core.validation.validator import SchemaValidator


class TestLevelSchema:
    """Tests for Level schema."""
    
    def test_basic_level_creation(self):
        """Test creating a basic level."""
        level = Level(
            genre=Genre.PLATFORMER,
            difficulty=Difficulty.MEDIUM,
            platforms=[
                Platform(x=0, y=480, width=500, height=30),
                Platform(x=50, y=400, width=120, height=15)
            ],
            entities=[
                Entity(type="player_spawn", x=50, y=450),
                Entity(type="goal", x=450, y=80)
            ]
        )
        
        assert level.genre == Genre.PLATFORMER
        assert level.difficulty == Difficulty.MEDIUM
        assert len(level.platforms) == 2
        assert len(level.entities) == 2
    
    def test_level_to_json(self):
        """Test JSON serialization."""
        level = Level(
            genre=Genre.PLATFORMER,
            platforms=[Platform(x=0, y=480, width=500, height=30)],
            entities=[Entity(type="player_spawn", x=50, y=450)]
        )
        
        json_data = level.model_dump()
        assert json_data["genre"] == "platformer"
        assert json_data["platforms"][0]["x"] == 0
    
    def test_metroidvania_level(self):
        """Test metroidvania level with goals and gates."""
        level = Level(
            genre=Genre.PLATFORMER,
            type=LevelType.METROIDVANIA,
            platforms=[Platform(x=0, y=480, width=500, height=30)],
            entities=[
                Entity(type="player_spawn", x=50, y=450),
                Entity(type="key", x=200, y=300, item_id="key_red"),
                Entity(type="door", x=400, y=200, requires_item="key_red")
            ],
            goals=[
                {"id": "exit_main", "type": "exit", "x": 450, "y": 100}
            ],
            gates=[
                {"id": "door_red", "type": "hard", "requires_item": "key_red", "position": {"x": 400, "y": 200}}
            ]
        )
        
        assert level.type == LevelType.METROIDVANIA
        assert len(level.goals) == 1
        assert len(level.gates) == 1


class TestPlayerCapabilities:
    """Tests for PlayerCapabilities schema."""
    
    def test_default_capabilities(self):
        """Test default player capabilities."""
        player = PlayerCapabilities()
        
        assert player.id == "default"
        assert len(player.abilities) == 0
        assert player.physics.gravity == 980.0
    
    def test_abilities_list(self):
        """Test setting player abilities."""
        player = PlayerCapabilities(
            abilities=["double_jump", "dash", "wall_jump"]
        )
        
        assert len(player.abilities) == 3
        assert "double_jump" in player.abilities
    
    def test_preset_capabilities(self):
        """Test using preset configurations."""
        from levelforge.src.core.schemas import AbilityPreset
        
        celeste = AbilityPreset.celeste_style()
        assert celeste.id == "celeste"
        assert "dash" in celeste.abilities
        assert celeste.physics.coyote_time == 0.15


class TestValidator:
    """Tests for SchemaValidator."""
    
    def test_validate_basic_level(self):
        """Test validation of valid level."""
        data = {
            "version": "1.0",
            "genre": "platformer",
            "type": "linear",
            "platforms": [
                {"x": 0, "y": 480, "width": 500, "height": 30}
            ],
            "entities": [
                {"type": "player_spawn", "x": 50, "y": 450},
                {"type": "goal", "x": 450, "y": 80}
            ]
        }
        
        is_valid, errors = SchemaValidator.validate_level(data)
        assert is_valid
        assert len(errors) == 0
    
    def test_validate_missing_fields(self):
        """Test validation catches missing fields."""
        data = {
            "genre": "platformer",
            "platforms": []
        }
        
        is_valid, errors = SchemaValidator.validate_level(data)
        assert not is_valid
        assert any("version" in e for e in errors)
    
    def test_validate_platform_errors(self):
        """Test platform validation errors."""
        data = {
            "version": "1.0",
            "genre": "platformer",
            "type": "linear",
            "platforms": [
                {"y": 480}  # Missing x and width
            ],
            "entities": []
        }
        
        is_valid, errors = SchemaValidator.validate_level(data)
        assert not is_valid
        assert any("x" in e for e in errors)
        assert any("width" in e for e in errors)
    
    def test_validate_player_capabilities(self):
        """Test player capabilities validation."""
        valid_data = {
            "id": "test",
            "physics": {
                "gravity": 980,
                "max_horizontal_speed": 300,
                "jump_height": 120
            }
        }
        
        is_valid, errors = SchemaValidator.validate_player_capabilities(valid_data)
        assert is_valid
        
        invalid_data = {
            "physics": {
                "gravity": -100  # Invalid
            }
        }
        
        is_valid, errors = SchemaValidator.validate_player_capabilities(invalid_data)
        assert not is_valid


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
