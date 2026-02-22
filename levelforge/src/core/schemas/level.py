"""
LevelForge core schemas - Level model.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class Genre(str, Enum):
    """Game genre."""
    PLATFORMER = "platformer"
    PUZZLE = "puzzle"
    SHOOTER = "shooter"
    TOP_DOWN_RPG = "top_down_rpg"
    DUNGEON_CRAWLER = "dungeon_crawler"


class LevelType(str, Enum):
    """Level structure type."""
    LINEAR = "linear"
    METROIDVANIA = "metroidvania"


class Difficulty(str, Enum):
    """Difficulty preset."""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EXPERT = "expert"


class Level(BaseModel):
    """Main level data structure."""
    version: str = Field(default="1.0", description="Schema version")
    genre: Genre = Field(default=Genre.PLATFORMER, description="Game genre")
    type: LevelType = Field(default=LevelType.LINEAR, description="Level structure type")
    theme: str = Field(default="default", description="Visual theme")
    difficulty: Difficulty = Field(default=Difficulty.MEDIUM, description="Difficulty level")
    
    # Player capabilities reference
    player_capabilities: Optional[str] = Field(default=None, description="Reference to player capabilities ID")
    
    # Level content
    platforms: list = Field(default_factory=list, description="Platform objects")
    entities: list = Field(default_factory=list, description="Game entities")
    
    # Goals (for metroidvania)
    goals: list = Field(default_factory=list, description="Level objectives")
    gates: list = Field(default_factory=list, description="Gates and locks")
    regions: list = Field(default_factory=list, description="Level regions")
    
    # Metadata
    metadata: dict = Field(default_factory=dict, description="Additional metadata")
    
    class Config:
        use_enum_values = True
