"""
LevelForge schema validation utilities.
"""

from typing import Any, Dict, List
from pydantic import ValidationError


class SchemaValidator:
    """Validates level data against schemas."""
    
    @staticmethod
    def validate_level(data: Dict[str, Any]) -> tuple[bool, List[str]]:
        """Validate level data and return errors if any."""
        errors = []
        
        # Check required fields
        required = ["version", "genre", "type", "platforms", "entities"]
        for field in required:
            if field not in data:
                errors.append(f"Missing required field: {field}")
        
        # Validate platforms
        if "platforms" in data:
            for i, platform in enumerate(data["platforms"]):
                plat_errors = SchemaValidator._validate_platform(platform, i)
                errors.extend(plat_errors)
        
        # Validate entities
        if "entities" in data:
            for i, entity in enumerate(data["entities"]):
                ent_errors = SchemaValidator._validate_entity(entity, i)
                errors.extend(ent_errors)
        
        # Validate goals (for metroidvania)
        if data.get("type") == "metroidvania":
            goal_errors = SchemaValidator._validate_goals(data)
            errors.extend(goal_errors)
        
        return len(errors) == 0, errors
    
    @staticmethod
    def _validate_platform(platform: Dict, index: int) -> List[str]:
        """Validate a single platform."""
        errors = []
        prefix = f"platforms[{index}]"
        
        # Required fields
        if "x" not in platform:
            errors.append(f"{prefix}: missing x position")
        if "y" not in platform:
            errors.append(f"{prefix}: missing y position")
        if "width" not in platform:
            errors.append(f"{prefix}: missing width")
        
        # Validate ranges
        if "x" in platform and platform["x"] < 0:
            errors.append(f"{prefix}: x must be non-negative")
        if "y" in platform and platform["y"] < 0:
            errors.append(f"{prefix}: y must be non-negative")
        if "width" in platform and platform["width"] <= 0:
            errors.append(f"{prefix}: width must be positive")
        
        return errors
    
    @staticmethod
    def _validate_entity(entity: Dict, index: int) -> List[str]:
        """Validate a single entity."""
        errors = []
        prefix = f"entities[{index}]"
        
        # Required fields
        if "type" not in entity:
            errors.append(f"{prefix}: missing type")
        if "x" not in entity:
            errors.append(f"{prefix}: missing x position")
        if "y" not in entity:
            errors.append(f"{prefix}: missing y position")
        
        return errors
    
    @staticmethod
    def _validate_goals(level: Dict) -> List[str]:
        """Validate metroidvania goals and gating."""
        errors = []
        
        # Check for player spawn
        has_spawn = any(
            e.get("type") == "player_spawn" 
            for e in level.get("entities", [])
        )
        if not has_spawn:
            errors.append("Missing player spawn point")
        
        # Check for at least one goal
        goals = level.get("goals", [])
        if not goals:
            errors.append("Metroidvania level must have at least one goal")
        
        # Validate gate references
        gates = level.get("gates", [])
        gate_ids = {g.get("id") for g in gates if g.get("id")}
        
        for gate in gates:
            if gate.get("requires_item"):
                # Check item exists
                items = [e.get("item_id") for e in level.get("entities", [])]
                if gate["requires_item"] not in items:
                    errors.append(f"Gate '{gate.get('id')}' requires item '{gate['requires_item']}' that doesn't exist")
        
        return errors
    
    @staticmethod
    def validate_player_capabilities(data: Dict) -> tuple[bool, List[str]]:
        """Validate player capabilities configuration."""
        errors = []
        
        # Validate physics ranges
        physics = data.get("physics", {})
        
        if physics.get("gravity", 0) <= 0:
            errors.append("gravity must be positive")
        if physics.get("max_horizontal_speed", 0) <= 0:
            errors.append("max_horizontal_speed must be positive")
        if physics.get("jump_height", 0) <= 0:
            errors.append("jump_height must be positive")
        
        # Validate factors are in range
        for field in ["air_control", "coyote_time", "jump_buffer"]:
            value = physics.get(field, 0)
            if field in ["air_control"] and not (0 <= value <= 1):
                errors.append(f"{field} must be between 0 and 1")
        
        return len(errors) == 0, errors


def validate_and_parse(data: Dict, schema_class):
    """Validate data against a Pydantic schema and return parsed result."""
    try:
        return schema_class(**data), []
    except ValidationError as e:
        return None, [str(err) for err in e.errors()]
