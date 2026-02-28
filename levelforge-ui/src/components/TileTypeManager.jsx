import { useState, useEffect } from 'react'
import './TileTypeManager.css'

const COLLISION_TYPES = [
  { id: 'none', label: 'None', description: 'No collision' },
  { id: 'solid', label: 'Solid', description: 'Blocks movement' },
  { id: 'passthrough', label: 'Passthrough', description: 'Can jump through from below' },
  { id: 'hazard', label: 'Hazard', description: 'Deals damage on contact' },
  { id: 'water', label: 'Water', description: 'Swimmable fluid' },
]

const CATEGORIES = [
  { id: 'terrain', label: 'Terrain', icon: '🟫' },
  { id: 'hazard', label: 'Hazard', icon: '⚠️' },
  { id: 'decoration', label: 'Decoration', icon: '🎨' },
  { id: 'special', label: 'Special', icon: '⭐' },
]

const DEFAULT_COLORS = [
  '#808080', '#6b7280', '#4b5563', '#374151', // Grays
  '#22c55e', '#16a34a', '#15803d', '#166534', // Greens
  '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', // Blues
  '#f59e0b', '#d97706', '#b45309', '#92400e', // Oranges/Browns
  '#ef4444', '#dc2626', '#b91c1c', '#991b1b', // Reds
  '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', // Purples
]

export default function TileTypeManager({ 
  projectId, 
  tileTypes = [], 
  onRefresh,
  onSelectTile,
  selectedTileId 
}) {
  const [editingTile, setEditingTile] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState(getDefaultFormData())

  function getDefaultFormData() {
    return {
      name: '',
      color: '#808080',
      description: '',
      collision_type: 'solid',
      friction: 1.0,
      damage: 0,
      category: 'terrain',
    }
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a tile name')
      return
    }

    try {
      const res = await fetch(`http://192.168.68.72:8000/api/projects/${projectId}/tile-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          color: formData.color,
          description: formData.description || null,
          collision_type: formData.collision_type,
          friction: formData.friction,
          damage: formData.damage,
          category: formData.category,
        })
      })

      if (!res.ok) throw new Error('Failed to create tile type')

      setShowCreateForm(false)
      setFormData(getDefaultFormData())
      onRefresh && onRefresh()
    } catch (err) {
      console.error('Create tile type failed:', err)
      alert('Failed to create tile type')
    }
  }

  const handleUpdate = async () => {
    if (!editingTile || !formData.name.trim()) {
      alert('Please enter a tile name')
      return
    }

    try {
      const res = await fetch(`http://192.168.68.72:8000/api/tile-types/${editingTile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          color: formData.color,
          description: formData.description || null,
          collision_type: formData.collision_type,
          friction: formData.friction,
          damage: formData.damage,
          category: formData.category,
        })
      })

      if (!res.ok) throw new Error('Failed to update tile type')

      setEditingTile(null)
      setFormData(getDefaultFormData())
      onRefresh && onRefresh()
    } catch (err) {
      console.error('Update tile type failed:', err)
      alert('Failed to update tile type')
    }
  }

  const handleDelete = async (tileId) => {
    if (!confirm('Delete this tile type?')) return

    try {
      const res = await fetch(`http://192.168.68.72:8000/api/tile-types/${tileId}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Failed to delete tile type')

      if (editingTile?.id === tileId) {
        setEditingTile(null)
        setFormData(getDefaultFormData())
      }
      onRefresh && onRefresh()
    } catch (err) {
      console.error('Delete tile type failed:', err)
      alert('Failed to delete tile type')
    }
  }

  const startEdit = (tile) => {
    setEditingTile(tile)
    setFormData({
      name: tile.name,
      color: tile.color,
      description: tile.description || '',
      collision_type: tile.collision_type,
      friction: tile.friction,
      damage: tile.damage,
      category: tile.category,
    })
    setShowCreateForm(false)
  }

  const cancelEdit = () => {
    setEditingTile(null)
    setShowCreateForm(false)
    setFormData(getDefaultFormData())
  }

  // Group tiles by category
  const groupedTiles = tileTypes.reduce((acc, tile) => {
    const cat = tile.category || 'terrain'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(tile)
    return acc
  }, {})

  return (
    <div className="tile-type-manager">
      <div className="tile-type-header">
        <h3>Tile Types</h3>
        <button 
          className="btn-small btn-primary"
          onClick={() => { setShowCreateForm(true); setEditingTile(null); }}
        >
          + New
        </button>
      </div>

      {/* Tile List by Category */}
      <div className="tile-type-list">
        {CATEGORIES.map(cat => {
          const tiles = groupedTiles[cat.id] || []
          if (tiles.length === 0 && cat.id !== 'terrain') return null
          
          return (
            <div key={cat.id} className="tile-category">
              <div className="category-header">
                <span className="category-icon">{cat.icon}</span>
                <span className="category-name">{cat.label}</span>
                <span className="category-count">{tiles.length}</span>
              </div>
              <div className="category-tiles">
                {tiles.map(tile => (
                  <div 
                    key={tile.id} 
                    className={`tile-type-item ${selectedTileId === tile.id ? 'selected' : ''}`}
                    onClick={() => onSelectTile && onSelectTile(tile)}
                  >
                    <div 
                      className="tile-preview" 
                      style={{ backgroundColor: tile.color }}
                      title={tile.name}
                    />
                    <div className="tile-info">
                      <span className="tile-name">{tile.name}</span>
                      <span className="tile-collision">{tile.collision_type}</span>
                    </div>
                    <div className="tile-actions">
                      <button 
                        className="btn-icon" 
                        onClick={(e) => { e.stopPropagation(); startEdit(tile); }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button 
                        className="btn-icon danger" 
                        onClick={(e) => { e.stopPropagation(); handleDelete(tile.id); }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
                {tiles.length === 0 && cat.id === 'terrain' && (
                  <div className="no-tiles">No tiles yet</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingTile) && (
        <div className="tile-type-form-overlay" onClick={cancelEdit}>
          <div className="tile-type-form" onClick={e => e.stopPropagation()}>
            <h4>{editingTile ? 'Edit Tile Type' : 'Create Tile Type'}</h4>
            
            <div className="form-section">
              <label>Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Grass, Stone, Water..."
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-section half">
                <label>Color</label>
                <div className="color-picker">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                  />
                  <div className="color-presets">
                    {DEFAULT_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`color-preset ${formData.color === color ? 'selected' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="form-section half">
                <label>Category</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-section">
              <label>Collision Type</label>
              <div className="collision-grid">
                {COLLISION_TYPES.map(ct => (
                  <button
                    key={ct.id}
                    type="button"
                    className={`collision-option ${formData.collision_type === ct.id ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, collision_type: ct.id })}
                  >
                    <span className="collision-label">{ct.label}</span>
                    <span className="collision-desc">{ct.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-section half">
                <label>Friction (0.0 - 1.0)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.friction}
                  onChange={e => setFormData({ ...formData, friction: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="form-section half">
                <label>Damage/Second</label>
                <input
                  type="number"
                  min="0"
                  value={formData.damage}
                  onChange={e => setFormData({ ...formData, damage: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="form-section">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description for AI generation..."
                rows={2}
              />
            </div>

            <div className="form-actions">
              <button className="btn-secondary" onClick={cancelEdit}>Cancel</button>
              <button className="btn-primary" onClick={editingTile ? handleUpdate : handleCreate}>
                {editingTile ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
