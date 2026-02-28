import { useState } from 'react'
import { TOOLS } from './TilemapCanvas'
import './TilePalette.css'

const TOOL_INFO = {
  [TOOLS.PENCIL]: { icon: '✏️', label: 'Pencil', shortcut: 'B' },
  [TOOLS.ERASER]: { icon: '🧹', label: 'Eraser', shortcut: 'E' },
  [TOOLS.RECT]: { icon: '▢', label: 'Rectangle', shortcut: 'R' },
  [TOOLS.FILL]: { icon: '🪣', label: 'Fill', shortcut: 'G' },
  [TOOLS.PAN]: { icon: '✋', label: 'Pan', shortcut: 'Space' },
}

export default function TilePalette({
  tileTypes = [],
  selectedTileId,
  onSelectTile,
  selectedTool,
  onSelectTool,
}) {
  const [showTools, setShowTools] = useState(true)
  const [showTiles, setShowTiles] = useState(true)
  
  // Find the selected tile type
  const selectedTile = tileTypes.find(t => t.id === selectedTileId)
  
  return (
    <div className="tile-palette">
      {/* Drag Header */}
      <div className="tile-palette-header">
        <span className="drag-handle">⋮⋮</span>
        <span className="palette-title">Tile Tools</span>
      </div>
      
      {/* Tools Section */}
      <div className="palette-section">
        <div 
          className="section-header"
          onClick={() => setShowTools(!showTools)}
        >
          <span className="section-title">🖌️ Tools</span>
          <span className="section-toggle">{showTools ? '▼' : '▶'}</span>
        </div>
        
        {showTools && (
          <div className="tool-grid">
            {Object.entries(TOOL_INFO).map(([tool, info]) => (
              <button
                key={tool}
                className={`tool-btn ${selectedTool === tool ? 'active' : ''}`}
                onClick={() => onSelectTool(tool)}
                title={`${info.label} (${info.shortcut})`}
              >
                <span className="tool-icon">{info.icon}</span>
                <span className="tool-label">{info.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Tiles Section */}
      <div className="palette-section tiles-section">
        <div className="section-header">
          <span className="section-title">🟫 Tiles</span>
          <span className="tile-count">{tileTypes.length}</span>
        </div>
        
        <div className="tile-grid">
          {/* Eraser (null tile) */}
          <button
            className={`tile-btn ${selectedTileId === null ? 'selected' : ''}`}
            onClick={() => onSelectTile(null)}
            title="Eraser (Empty)"
          >
            <div className="tile-swatch eraser">
              <span className="eraser-icon">🚫</span>
            </div>
          </button>
          
          {/* Tile types */}
          {tileTypes.map(tile => (
            <button
              key={tile.id}
              className={`tile-btn ${selectedTileId === tile.id ? 'selected' : ''}`}
              onClick={() => onSelectTile(tile.id)}
              title={`${tile.name}\n${tile.collision_type} • ${tile.category}`}
            >
              <div 
                className="tile-swatch"
                style={{ backgroundColor: tile.color }}
              />
            </button>
          ))}
        </div>
        
        {/* Selected tile info */}
        {selectedTile && (
          <div className="selected-tile-info">
            <div className="selected-tile-header">
              <div 
                className="selected-tile-swatch"
                style={{ backgroundColor: selectedTile.color }}
              />
              <span className="selected-tile-name">{selectedTile.name}</span>
            </div>
            <div className="selected-tile-meta">
              <span className="meta-item">
                <span className="meta-label">Collision:</span>
                <span className="meta-value">{selectedTile.collision_type}</span>
              </span>
              <span className="meta-item">
                <span className="meta-label">Category:</span>
                <span className="meta-value">{selectedTile.category}</span>
              </span>
            </div>
          </div>
        )}
        
        {selectedTileId === null && (
          <div className="selected-tile-info">
            <div className="selected-tile-header">
              <div className="selected-tile-swatch eraser">
                <span>🚫</span>
              </div>
              <span className="selected-tile-name">Eraser</span>
            </div>
            <div className="selected-tile-meta">
              <span className="meta-item">Clears tiles</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
