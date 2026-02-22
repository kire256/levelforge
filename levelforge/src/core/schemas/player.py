"""
LevelForge core schemas - Player capabilities model.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class Ability(str, Enum):
    """Player abilities that can unlock gates."""
    DOUBLE_JUMP = "double_jump"
    WALL_JUMP = "wall_jump"
    DASH = "dash"
    GRAPPLE = "grapple"
    CROUCH = "crouch"
    GLIDE = "glide"
    SWIM = "swim"
    CLIMB = "climb"


class PhysicsParams(BaseModel):
    """Physics parameters for the player character."""
    gravity: float = Field(default=980.0, description="Gravity in pixels/s²")
    max_horizontal_speed: float = Field(default=300.0, description="Max horizontal speed in px/s")
    jump_height: float = Field(default=120.0, description="Max jump height in pixels")
    acceleration: float = Field(default=1000.0, description="Horizontal acceleration in px/s²")
    air_control: float = Field(default=0.8, description="Air control factor (0-1)")
    coyote_time: float = Field(default=0.1, description="Coyote time in seconds")
    jump_buffer: float = Field(default=0.1, description="Jump buffer time in seconds")


class PlayerCapabilities(BaseModel):
    """Defines what the player character can do."""
    id: str = Field(default="default", description="Unique identifier")
    name: str = Field(default="Default", description="Display name")
    
    # Abilities
    abilities: list[Ability] = Field(default_factory=list, description="Player abilities")
    
    # Physics
    physics: PhysicsParams = Field(default_factory=PhysicsParams, description="Physics parameters")
    
    # Combat (optional)
    has_attack: bool = Field(default=False, description="Player can attack enemies")
    attack_range: float = Field(default=50.0, description="Attack range in pixels")
    
    # Special
    can_save: bool = Field(default=True, description="Player can save/respawn")
    max_health: int = Field(default=3, description="Max health points")


class AbilityPreset(BaseModel):
    """Pre-built player capability templates."""
    id: str
    name: str
    description: str
    abilities: list[Ability]
    physics: PhysicsParams
    
    # Common presets
    @classmethod
    def mario_style(cls) -> "AbilityPreset":
        return cls(
            id="mario",
            name="Mario-style",
            description="Classic platformer - single jump, no special abilities",
            abilities=[],
            physics=PhysicsParams(
                gravity=980,
                max_horizontal_speed=300,
                jump_height=120,
                acceleration=1000,
                air_control=0.8,
                coyote_time=0.1,
                jump_buffer=0.1
            )
        )
    
    @classmethod
    def celeste_style(cls) -> "AbilityPreset":
        return cls(
            id="celeste",
            name="Celeste-style",
            description="Precision platformer - dash, wall jump, double jump",
            abilities=[Ability.DOUBLE_JUMP, Ability.WALL_JUMP, Ability.DASH],
            physics=PhysicsParams(
                gravity=800,
                max_horizontal_speed=350,
                jump_height=100,
                acceleration=1200,
                air_control=0.95,
                coyote_time=0.15,
                jump_buffer=0.15
            )
        )
    
    @classmethod
    def metroidvania_style(cls) -> "AbilityPreset":
        return cls(
            id="metroidvania",
            name="Metroidvania",
            description="Full abilities - dash, double jump, wall jump, grapple",
            abilities=[
                Ability.DOUBLE_JUMP,
                Ability.WALL_JUMP,
                Ability.DASH,
                Ability.GRAPPLE
            ],
            physics=PhysicsParams(
                gravity=900,
                max_horizontal_speed=320,
                jump_height=110,
                acceleration=1100,
                air_control=0.9,
                coyote_time=0.12,
                jump_buffer=0.12
            )
        )
