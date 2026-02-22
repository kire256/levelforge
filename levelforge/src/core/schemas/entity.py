"""
LevelForge core schemas - Entity model.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class EntityType(str, Enum):
    """Types of entities in a level."""
    # Player
    PLAYER_SPAWN = "player_spawn"
    
    # Goals
    GOAL = "goal"
    EXIT = "exit"
    
    # Collectibles
    COIN = "coin"
    KEY = "key"
    GEM = "gem"
    POWERUP = "powerup"
    
    # Enemies
    ENEMY_BASIC = "enemy_basic"
    ENEMY_FLYING = "enemy_flying"
    ENEMY_PATROL = "enemy_patrol"
    BOSS = "boss"
    
    # Interactive
    DOOR = "door"
    SWITCH = "switch"
    PRESSURE_PLATE = "pressure_plate"
    SAVE_POINT = "save_point"
    
    # Hazards
    SPIKE = "spike"
    LAVA = "lava"
    ACID = "acid"
    
    # Environment
    WATER = "water"
    LADDER = "ladder"
    PLATFORM_MOVING = "platform_moving"


class Entity(BaseModel):
    """A game entity in the level."""
    id: str = Field(default="", description="Unique identifier")
    type: EntityType = Field(description="Entity type")
    x: float = Field(description="X position in pixels")
    y: float = Field(description="Y position in pixels")
    width: float = Field(default=32.0, description="Width in pixels")
    height: float = Field(default=32.0, description="Height in pixels")
    
    # Entity-specific data
    properties: dict = Field(default_factory=dict, description="Additional properties")
    
    # For enemies
    patrol_range: Optional[tuple[float, float]] = Field(default=None, description="Patrol X range")
    behavior: str = Field(default="static", description="Enemy behavior")
    
    # For collectibles
    item_id: Optional[str] = Field(default=None, description="Item identifier")
    
    # For gates/doors
    requires_item: Optional[str] = Field(default=None, description="Required item ID")
    requires_ability: Optional[str] = Field(default=None, description="Required ability")
    leads_to: Optional[str] = Field(default=None, description="Destination/goal ID")
    
    class Config:
        use_enum_values = True
