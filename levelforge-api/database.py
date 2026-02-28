"""
Database models and operations for LevelForge.
"""
import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "levelforge.db"


def init_db():
    """Initialize the database with required tables."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            tile_size INTEGER DEFAULT 32,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS levels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            genre TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            level_type TEXT NOT NULL,
            theme TEXT,
            level_data TEXT NOT NULL,
            version INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
    """)
    
    # Custom entity types per project
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS entity_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            emoji TEXT DEFAULT '📦',
            color TEXT DEFAULT '#6366f1',
            description TEXT,
            placement_rules TEXT,
            behavior TEXT,
            collision_type TEXT DEFAULT 'neutral',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
    """)
    
    # Tile types for tilemaps (project-level)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tile_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#808080',
            description TEXT,
            collision_type TEXT DEFAULT 'solid',
            friction REAL DEFAULT 1.0,
            damage INTEGER DEFAULT 0,
            category TEXT DEFAULT 'terrain',
            metadata TEXT DEFAULT '{}',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
    """)
    
    conn.commit()
    conn.close()


def get_connection():
    """Get a database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# Project operations
def create_project(name: str, description: str = None) -> int:
    """Create a new project."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    cursor.execute(
        "INSERT INTO projects (name, description, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (name, description, now, now)
    )
    project_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return project_id


def get_projects() -> list:
    """Get all projects."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, description, created_at, updated_at FROM projects ORDER BY updated_at DESC")
    projects = cursor.fetchall()
    conn.close()
    return projects


def get_project(project_id: int) -> dict:
    """Get a single project by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, description, tile_size, created_at, updated_at FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"id": row[0], "name": row[1], "description": row[2], "tile_size": row[3], "created_at": row[4], "updated_at": row[5]}
    return None


def update_project(project_id: int, name: str = None, description: str = None) -> bool:
    """Update a project."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    if name:
        cursor.execute("UPDATE projects SET name = ?, updated_at = ? WHERE id = ?", (name, now, project_id))
    if description is not None:
        cursor.execute("UPDATE projects SET description = ?, updated_at = ? WHERE id = ?", (description, now, project_id))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success


def delete_project(project_id: int) -> bool:
    """Delete a project and all its levels."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success


# Level operations
def create_level(project_id: int, name: str, genre: str, difficulty: str, level_type: str, 
                 theme: str, level_data: str) -> int:
    """Create a new level in a project."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    cursor.execute("""
        INSERT INTO levels (project_id, name, genre, difficulty, level_type, theme, level_data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (project_id, name, genre, difficulty, level_type, theme, level_data, now, now))
    
    level_id = cursor.lastrowid
    cursor.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))
    
    conn.commit()
    conn.close()
    return level_id


def get_levels(project_id: int) -> list:
    """Get all levels in a project."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, genre, difficulty, level_type, theme, level_data, version, created_at, updated_at
        FROM levels WHERE project_id = ? ORDER BY updated_at DESC
    """, (project_id,))
    levels = cursor.fetchall()
    conn.close()
    return levels


def get_level(level_id: int) -> dict:
    """Get a single level by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, project_id, name, genre, difficulty, level_type, theme, level_data, version, created_at, updated_at
        FROM levels WHERE id = ?
    """, (level_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "id": row[0], "project_id": row[1], "name": row[2], "genre": row[3],
            "difficulty": row[4], "level_type": row[5], "theme": row[6],
            "level_data": row[7], "version": row[8], "created_at": row[9], "updated_at": row[10]
        }
    return None


def update_level(level_id: int, level_data: str) -> bool:
    """Update a level's data and increment version."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    cursor.execute("SELECT version, project_id FROM levels WHERE id = ?", (level_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
    
    new_version = row[0] + 1
    project_id = row[1]
    
    cursor.execute("""
        UPDATE levels SET level_data = ?, version = ?, updated_at = ? WHERE id = ?
    """, (level_data, new_version, now, level_id))
    cursor.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))
    
    conn.commit()
    conn.close()
    return True


def rename_level(level_id: int, name: str) -> bool:
    """Rename a level and bump updated_at."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()

    cursor.execute("SELECT project_id FROM levels WHERE id = ?", (level_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False

    project_id = row[0]
    cursor.execute("UPDATE levels SET name = ?, updated_at = ? WHERE id = ?", (name, now, level_id))
    cursor.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))

    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success


def delete_level(level_id: int) -> bool:
    """Delete a level."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT project_id FROM levels WHERE id = ?", (level_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False

    project_id = row[0]
    cursor.execute("DELETE FROM levels WHERE id = ?", (level_id,))
    now = datetime.now().isoformat()
    cursor.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))

    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success


# Entity Type operations
def create_entity_type(
    project_id: int,
    name: str,
    emoji: str = '📦',
    color: str = '#6366f1',
    description: str = None,
    placement_rules: str = None,
    behavior: str = None,
    collision_type: str = 'neutral',
    metadata_fields: str = '[]'
) -> int:
    """Create a new entity type for a project."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    cursor.execute("""
        INSERT INTO entity_types 
        (project_id, name, emoji, color, description, placement_rules, behavior, collision_type, metadata_fields, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (project_id, name, emoji, color, description, placement_rules, behavior, collision_type, metadata_fields, now, now))
    
    entity_type_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return entity_type_id


def get_entity_types(project_id: int) -> list:
    """Get all entity types for a project."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, project_id, name, emoji, color, description, placement_rules, behavior, collision_type, metadata_fields, created_at, updated_at
        FROM entity_types WHERE project_id = ? ORDER BY name
    """, (project_id,))
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r[0], "project_id": r[1], "name": r[2], "emoji": r[3], "color": r[4],
            "description": r[5], "placement_rules": r[6], "behavior": r[7], "collision_type": r[8],
            "metadata_fields": r[9], "created_at": r[10], "updated_at": r[11]
        }
        for r in rows
    ]


def get_entity_type(entity_type_id: int) -> dict:
    """Get a single entity type by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, project_id, name, emoji, color, description, placement_rules, behavior, collision_type, metadata_fields, created_at, updated_at
        FROM entity_types WHERE id = ?
    """, (entity_type_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "id": row[0], "project_id": row[1], "name": row[2], "emoji": row[3], "color": row[4],
            "description": row[5], "placement_rules": row[6], "behavior": row[7], "collision_type": row[8],
            "metadata_fields": row[9], "created_at": row[10], "updated_at": row[11]
        }
    return None


def update_entity_type(
    entity_type_id: int,
    name: str = None,
    emoji: str = None,
    color: str = None,
    description: str = None,
    placement_rules: str = None,
    behavior: str = None,
    collision_type: str = None,
    metadata_fields: str = None
) -> bool:
    """Update an entity type."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    updates = []
    params = []
    if name is not None:
        updates.append("name = ?")
        params.append(name)
    if emoji is not None:
        updates.append("emoji = ?")
        params.append(emoji)
    if color is not None:
        updates.append("color = ?")
        params.append(color)
    if description is not None:
        updates.append("description = ?")
        params.append(description)
    if placement_rules is not None:
        updates.append("placement_rules = ?")
        params.append(placement_rules)
    if behavior is not None:
        updates.append("behavior = ?")
        params.append(behavior)
    if collision_type is not None:
        updates.append("collision_type = ?")
        params.append(collision_type)
    if metadata_fields is not None:
        updates.append("metadata_fields = ?")
        params.append(metadata_fields)
    
    if not updates:
        return False
    
    updates.append("updated_at = ?")
    params.append(now)
    params.append(entity_type_id)
    
    cursor.execute(f"UPDATE entity_types SET {', '.join(updates)} WHERE id = ?", params)
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success


def delete_entity_type(entity_type_id: int) -> bool:
    """Delete an entity type."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM entity_types WHERE id = ?", (entity_type_id,))
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success


# Tile Type operations
def create_tile_type(
    project_id: int,
    name: str,
    color: str = '#808080',
    description: str = None,
    collision_type: str = 'solid',
    friction: float = 1.0,
    damage: int = 0,
    category: str = 'terrain',
    metadata: str = '{}'
) -> int:
    """Create a new tile type for a project."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    cursor.execute("""
        INSERT INTO tile_types 
        (project_id, name, color, description, collision_type, friction, damage, category, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (project_id, name, color, description, collision_type, friction, damage, category, metadata, now, now))
    
    tile_type_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return tile_type_id


def get_tile_types(project_id: int) -> list:
    """Get all tile types for a project."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, project_id, name, color, description, collision_type, friction, damage, category, metadata, created_at, updated_at
        FROM tile_types WHERE project_id = ? ORDER BY category, name
    """, (project_id,))
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r[0], "project_id": r[1], "name": r[2], "color": r[3],
            "description": r[4], "collision_type": r[5], "friction": r[6],
            "damage": r[7], "category": r[8], "metadata": r[9],
            "created_at": r[10], "updated_at": r[11]
        }
        for r in rows
    ]


def get_tile_type(tile_type_id: int) -> dict:
    """Get a single tile type by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, project_id, name, color, description, collision_type, friction, damage, category, metadata, created_at, updated_at
        FROM tile_types WHERE id = ?
    """, (tile_type_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "id": row[0], "project_id": row[1], "name": row[2], "color": row[3],
            "description": row[4], "collision_type": row[5], "friction": row[6],
            "damage": row[7], "category": row[8], "metadata": row[9],
            "created_at": row[10], "updated_at": row[11]
        }
    return None


def update_tile_type(
    tile_type_id: int,
    name: str = None,
    color: str = None,
    description: str = None,
    collision_type: str = None,
    friction: float = None,
    damage: int = None,
    category: str = None,
    metadata: str = None
) -> bool:
    """Update a tile type."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    updates = []
    params = []
    if name is not None:
        updates.append("name = ?")
        params.append(name)
    if color is not None:
        updates.append("color = ?")
        params.append(color)
    if description is not None:
        updates.append("description = ?")
        params.append(description)
    if collision_type is not None:
        updates.append("collision_type = ?")
        params.append(collision_type)
    if friction is not None:
        updates.append("friction = ?")
        params.append(friction)
    if damage is not None:
        updates.append("damage = ?")
        params.append(damage)
    if category is not None:
        updates.append("category = ?")
        params.append(category)
    if metadata is not None:
        updates.append("metadata = ?")
        params.append(metadata)
    
    if not updates:
        return False
    
    updates.append("updated_at = ?")
    params.append(now)
    params.append(tile_type_id)
    
    cursor.execute(f"UPDATE tile_types SET {', '.join(updates)} WHERE id = ?", params)
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success


def delete_tile_type(tile_type_id: int) -> bool:
    """Delete a tile type."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tile_types WHERE id = ?", (tile_type_id,))
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success


def update_project_tile_size(project_id: int, tile_size: int) -> bool:
    """Update a project's tile size."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    cursor.execute("UPDATE projects SET tile_size = ?, updated_at = ? WHERE id = ?", (tile_size, now, project_id))
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success


# Initialize on import
init_db()
