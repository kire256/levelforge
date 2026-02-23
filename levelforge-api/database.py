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
    cursor.execute("SELECT id, name, description, created_at, updated_at FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"id": row[0], "name": row[1], "description": row[2], "created_at": row[3], "updated_at": row[4]}
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
        SELECT id, name, genre, difficulty, level_type, theme, version, created_at, updated_at
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


def delete_level(level_id: int) -> bool:
    """Delete a level."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM levels WHERE id = ?", (level_id,))
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success


# Initialize on import
init_db()
