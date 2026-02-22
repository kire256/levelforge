"""
LevelForge ASCII level visualizer.
"""

from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass


# ASCII art characters for different elements
CHAR_PLATFORM = "█"
CHAR_PLATFORM_TOP = "▀"
CHAR_GROUND = "▄"
CHAR_PLAYER = "☺"
CHAR_PLAYER_UP = "▲"
CHAR_GOAL = "⚑"
CHAR_COIN = "●"
CHAR_KEY = "⚷"
CHAR_DOOR = "▣"
CHAR_ENEMY = "☠"
CHAR_ENEMY_PATROL = "◊"
CHAR_ENEMY_FLYING = "✈"
CHAR_SPIKE = "▲"
CHAR_LAVA = "≡"
CHAR_WATER = "≈"
CHAR_POWERUP = "★"
CHAR_SAVE = "◉"
CHAR_SWITCH = "⊞"
CHAR_EMPTY = " "
CHAR_WALL = "█"


@dataclass
class RenderOptions:
    """Options for ASCII rendering."""
    width: int = 80
    height: int = 25
    scale: float = 1.0
    show_grid: bool = False
    show_coords: bool = False
    color: bool = False  # ANSI colors (not supported in all terminals)


class ASCIIVisualizer:
    """Renders levels as ASCII art."""
    
    def __init__(self, options: Optional[RenderOptions] = None):
        self.options = options or RenderOptions()
    
    def render(self, level: Dict[str, Any]) -> str:
        """
        Render a level as ASCII art.
        
        Args:
            level: Level data dictionary
            
        Returns:
            ASCII representation of the level
        """
        # Extract level dimensions
        platforms = level.get("platforms", [])
        entities = level.get("entities", [])
        
        if not platforms:
            return "No platforms in level"
        
        # Calculate bounds
        max_x = max(p.get("x", 0) + p.get("width", 0) for p in platforms)
        max_y = max(p.get("y", 0) + p.get("height", 20) for p in platforms)
        
        # Apply scale and bounds
        width = min(int(max_x * self.options.scale), self.options.width)
        height = min(int(max_y * self.options.scale), self.options.height)
        
        # Create grid
        grid = [[CHAR_EMPTY for _ in range(width)] for _ in range(height)]
        
        # Render platforms
        for platform in platforms:
            self._render_platform(grid, platform, height)
        
        # Render entities
        for entity in entities:
            self._render_entity(grid, entity, height)
        
        # Add border
        grid = self._add_border(grid)
        
        # Convert to string
        return self._grid_to_string(grid)
    
    def _render_platform(self, grid: List[List[str]], platform: Dict, height: int):
        """Render a single platform on the grid."""
        x = int(platform.get("x", 0) * self.options.scale)
        y = int(platform.get("y", 0) * self.options.scale)
        w = max(int(platform.get("width", 50) * self.options.scale), 1)
        h = max(int(platform.get("height", 20) * self.options.scale), 1)
        
        # Flip y (ASCII art has origin at top)
        y = height - 1 - y
        
        for dy in range(h):
            for dx in range(w):
                px, py = x + dx, y - dy
                if 0 <= px < len(grid[0]) and 0 <= py < height:
                    if dy == 0:
                        grid[py][px] = CHAR_PLATFORM_TOP
                    else:
                        grid[py][px] = CHAR_PLATFORM
    
    def _render_entity(self, grid: List[List[str]], entity: Dict, height: int):
        """Render a single entity on the grid."""
        entity_type = entity.get("type", "")
        x = int(entity.get("x", 0) * self.options.scale)
        y = int(entity.get("y", 0) * self.options.scale)
        
        # Flip y
        y = height - 1 - y
        
        if not (0 <= x < len(grid[0]) and 0 <= y < height):
            return
        
        # Select character based on entity type
        char = self._get_entity_char(entity_type)
        
        # Check if position is already occupied
        if grid[y][x] == CHAR_EMPTY:
            grid[y][x] = char
        else:
            # Try adjacent position
            for dx in [-1, 1]:
                nx = x + dx
                if 0 <= nx < len(grid[0]) and grid[y][nx] == CHAR_EMPTY:
                    grid[y][nx] = char
                    break
    
    def _get_entity_char(self, entity_type: str) -> str:
        """Get ASCII character for entity type."""
        char_map = {
            "player_spawn": CHAR_PLAYER,
            "goal": CHAR_GOAL,
            "exit": CHAR_GOAL,
            "coin": CHAR_COIN,
            "key": CHAR_KEY,
            "gem": CHAR_COIN,
            "enemy_basic": CHAR_ENEMY,
            "enemy_patrol": CHAR_ENEMY_PATROL,
            "enemy_flying": CHAR_ENEMY_FLYING,
            "boss": CHAR_ENEMY,
            "spike": CHAR_SPIKE,
            "lava": CHAR_LAVA,
            "water": CHAR_WATER,
            "powerup": CHAR_POWERUP,
            "save_point": CHAR_SAVE,
            "switch": CHAR_SWITCH,
            "door": CHAR_DOOR,
            "ability_pickup": CHAR_POWERUP,
        }
        return char_map.get(entity_type, "•")
    
    def _add_border(self, grid: List[List[str]]) -> List[List[str]]:
        """Add a border around the grid."""
        if not grid:
            return grid
        
        width = len(grid[0])
        height = len(grid)
        
        # Add top/bottom border
        border = [CHAR_WALL * (width + 2)]
        
        # Add side borders
        bordered = []
        for row in grid:
            bordered.append(CHAR_WALL + "".join(row) + CHAR_WALL)
        
        return border + bordered + border
    
    def _grid_to_string(self, grid: List[List[str]]) -> str:
        """Convert grid to string."""
        return "\n".join("".join(row) for row in grid)
    
    def render_compact(self, level: Dict[str, Any]) -> str:
        """
        Render a more compact ASCII representation.
        Shows platforms and key entities without full rendering.
        """
        platforms = level.get("platforms", [])
        entities = level.get("entities", [])
        
        if not platforms:
            return "No platforms in level"
        
        lines = []
        lines.append("=" * 50)
        lines.append(f"LEVEL: {level.get('genre', 'unknown').upper()} | {level.get('difficulty', 'medium').upper()}")
        if level.get("theme"):
            lines.append(f"Theme: {level['theme']}")
        lines.append("=" * 50)
        
        # Platforms summary
        lines.append(f"\nPlatforms ({len(platforms)}):")
        for i, p in enumerate(platforms[:10]):  # Show first 10
            lines.append(f"  [{i}] x:{p.get('x',0):4.0f} y:{p.get('y',0):4.0f} w:{p.get('width',50):4.0f}")
        if len(platforms) > 10:
            lines.append(f"  ... and {len(platforms) - 10} more")
        
        # Entities summary
        lines.append(f"\nEntities ({len(entities)}):")
        
        # Group by type
        by_type: Dict[str, List] = {}
        for e in entities:
            t = e.get("type", "unknown")
            by_type.setdefault(t, []).append(e)
        
        for etype, elist in by_type.items():
            lines.append(f"  {etype}: {len(elist)}")
        
        # Key positions
        spawns = [e for e in entities if e.get("type") == "player_spawn"]
        goals = [e for e in entities if e.get("type") in ("goal", "exit")]
        
        if spawns:
            lines.append(f"\nPlayer spawn: x:{spawns[0].get('x',0):.0f} y:{spawns[0].get('y',0):.0f}")
        if goals:
            for g in goals:
                lines.append(f"Goal: x:{g.get('x',0):.0f} y:{g.get('y',0):.0f}")
        
        # Metadata
        metadata = level.get("metadata", {})
        if metadata:
            lines.append("\n--- Stats ---")
            if "difficulty_score" in metadata:
                lines.append(f"Difficulty: {metadata['difficulty_score']}/10")
            if "estimated_duration_seconds" in metadata:
                secs = metadata["estimated_duration_seconds"]
                lines.append(f"Est. time: {secs//60}m {secs%60}s")
        
        lines.append("=" * 50)
        
        return "\n".join(lines)


def render_level(level: Dict[str, Any], compact: bool = False, **options) -> str:
    """
    Convenience function to render a level.
    
    Args:
        level: Level data dictionary
        compact: If True, render compact summary instead of full ASCII
        **options: Additional RenderOptions
        
    Returns:
        ASCII representation of the level
    """
    opts = RenderOptions(**options) if options else None
    visualizer = ASCIIVisualizer(opts)
    
    if compact:
        return visualizer.render_compact(level)
    return visualizer.render(level)


# Example usage
if __name__ == "__main__":
    # Test with sample level
    test_level = {
        "genre": "platformer",
        "difficulty": "medium",
        "theme": "castle",
        "platforms": [
            {"x": 0, "y": 480, "width": 500, "height": 30},
            {"x": 50, "y": 400, "width": 120, "height": 15},
            {"x": 200, "y": 350, "width": 100, "height": 15},
            {"x": 350, "y": 280, "width": 100, "height": 15},
            {"x": 150, "y": 200, "width": 120, "height": 15},
            {"x": 350, "y": 150, "width": 100, "height": 15},
        ],
        "entities": [
            {"type": "player_spawn", "x": 50, "y": 450},
            {"type": "coin", "x": 100, "y": 380},
            {"type": "coin", "x": 230, "y": 330},
            {"type": "enemy_patrol", "x": 220, "y": 330, "patrol_range": [200, 250]},
            {"type": "coin", "x": 180, "y": 180},
            {"type": "goal", "x": 380, "y": 120},
        ],
        "metadata": {
            "difficulty_score": 5.5,
            "estimated_duration_seconds": 120
        }
    }
    
    print("Full ASCII:")
    print(render_level(test_level))
    
    print("\n" + "=" * 50 + "\n")
    
    print("Compact:")
    print(render_level(test_level, compact=True))
