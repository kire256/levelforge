"""
LevelForge core schemas - Platform model.
"""

from pydantic import BaseModel, Field


class Platform(BaseModel):
    """A platform in the level."""
    id: str = Field(default="", description="Unique identifier")
    x: float = Field(description="X position in pixels")
    y: float = Field(description="Y position in pixels")
    width: float = Field(description="Width in pixels")
    height: float = Field(default=20.0, description="Height in pixels")
    
    # Visual
    tile_id: str = Field(default="", description="Tileset tile ID")
    color: str = Field(default="#8b4513", description="Fallback color")
    
    # Physics
    is_solid: bool = Field(default=True, description="Player can stand on this")
    is_hazard: bool = Field(default=False, description="Player dies on contact")
    bounce: float = Field(default=0.0, description="Bounce factor (0-1)")
    friction: float = Field(default=0.8, description="Friction coefficient")
