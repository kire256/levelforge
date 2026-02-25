import { useState, useEffect, useRef } from 'react'
import './LevelView.css'

// ASCII symbols for different entity types
const ENTITY_SYMBOLS = {
  // Platforms
  platform: '█',
  ground: '▀',
  
  // Actors
  player: '🧑',
  enemy: '👾',
  boss: '👹',
  npc: '👤',
  
  // Items
  coin: '🪙',
  key: '🔑',
  gem: '💎',
  star: '⭐',
  heart: '❤️',
  powerup: '⚡',
  weapon: '⚔️',
  
  // Hazards
  spike: '▲',
  lava: '🔥',
  water: '💧',
  
  // Goals
  goal: '🚩',
  door: '🚪',
  portal: '🌀',
  exit: '🚪',
  
  // Default
  unknown: '?'
}

// Colors for different entity types
const ENTITY_COLORS = {
  platform: '#6b7280',
  ground: '#8b5a2b',
  player: '#3b82f6',
  enemy: '#ef4444',
  boss: '#dc2626',
  npc: '#10b981',
  coin: '#fbbf24',
  key: '#fbbf24',
  gem: '#a855f7',
  star: '#fbbf24',
  heart: '#ef4444',
  powerup: '#f59e0b',
  weapon: '#6b7280',
  spike: '#dc2626',
  lava: '#f97316',
  water: '#3b82f6',
  goal: '#22c55e',
  door: '#8b5a2b',
  portal: '#a855f7',
  exit: '#22c55e',
  unknown: '#9ca3af'
}

export default function LevelView({ level, mode = 'draft', onModeChange }) {
  const canvasRef = useRef(null)
  const [viewMode, setViewMode] = useState(mode) // draft, polish, playable
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  
  // Parse level data safely
  let levelData = null
  try {
    if (level?.level_data) {
      levelData = typeof level.level_data === 'string'
        ? JSON.parse(level.level_data)
        : level.level_data
    }
  } catch {
    levelData = null
  }
  
  // Update view mode when prop changes
  useEffect(() => {
    setViewMode(mode)
  }, [mode])
  
  // Render draft view (ASCII/symbols)
  useEffect(() => {
    if (viewMode === 'draft' && canvasRef.current && levelData) {
      renderDraftView()
    }
  }, [viewMode, levelData, zoom, pan])
  
  const renderDraftView = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    // Clear canvas
    ctx.fillStyle = '#0f0f1a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Calculate scale
    const scale = 20 * zoom // 20px per unit
    
    // Center the level
    const offsetX = canvas.width / 2 + pan.x
    const offsetY = canvas.height / 2 + pan.y
    
    // Draw grid
    ctx.strokeStyle = '#1a1a28'
    ctx.lineWidth = 1
    
    for (let x = 0; x < canvas.width; x += scale) {
      ctx.beginPath()
      ctx.moveTo(x + offsetX % scale, 0)
      ctx.lineTo(x + offsetX % scale, canvas.height)
      ctx.stroke()
    }
    
    for (let y = 0; y < canvas.height; y += scale) {
      ctx.beginPath()
      ctx.moveTo(0, y + offsetY % scale)
      ctx.lineTo(canvas.width, y + offsetY % scale)
      ctx.stroke()
    }
    
    // Draw platforms
    if (levelData.platforms) {
      ctx.fillStyle = ENTITY_COLORS.platform
      levelData.platforms.forEach(platform => {
        const x = platform.x * scale + offsetX
        const y = canvas.height - (platform.y * scale + offsetY) // Flip Y axis
        const width = platform.width * scale
        const height = platform.height * scale
        
        ctx.fillRect(x, y - height, width, height)
        
        // Add platform label
        ctx.fillStyle = '#fff'
        ctx.font = '10px monospace'
        ctx.fillText('███', x + 2, y - height / 2 + 4)
        ctx.fillStyle = ENTITY_COLORS.platform
      })
    }
    
    // Draw entities
    if (levelData.entities) {
      levelData.entities.forEach(entity => {
        const x = entity.x * scale + offsetX
        const y = canvas.height - (entity.y * scale + offsetY)
        const symbol = ENTITY_SYMBOLS[entity.type] || ENTITY_SYMBOLS.unknown
        const color = ENTITY_COLORS[entity.type] || ENTITY_COLORS.unknown
        
        // Draw symbol
        ctx.font = `${16 * zoom}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = color
        ctx.fillText(symbol, x, y)
        
        // Draw label
        if (entity.name) {
          ctx.font = '10px monospace'
          ctx.fillStyle = '#9ca3af'
          ctx.fillText(entity.name, x, y + 12 * zoom)
        }
      })
    }
    
    // Draw player spawn
    if (levelData.player_spawn) {
      const x = levelData.player_spawn.x * scale + offsetX
      const y = canvas.height - (levelData.player_spawn.y * scale + offsetY)
      
      ctx.font = `${20 * zoom}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = ENTITY_COLORS.player
      ctx.fillText('🧑', x, y)
      
      ctx.font = '10px monospace'
      ctx.fillStyle = '#9ca3af'
      ctx.fillText('SPAWN', x, y + 16 * zoom)
    }
    
    // Draw goal
    if (levelData.goal) {
      const x = levelData.goal.x * scale + offsetX
      const y = canvas.height - (levelData.goal.y * scale + offsetY)
      
      ctx.font = `${20 * zoom}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = ENTITY_COLORS.goal
      ctx.fillText('🚩', x, y)
      
      ctx.font = '10px monospace'
      ctx.fillStyle = '#9ca3af'
      ctx.fillText('GOAL', x, y + 16 * zoom)
    }
  }
  
  const handleModeChange = (newMode) => {
    setViewMode(newMode)
    onModeChange && onModeChange(newMode)
  }
  
  const handleZoomIn = () => setZoom(Math.min(zoom + 0.25, 4))
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.25, 0.25))
  const handleResetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }
  
  if (!levelData) {
    return (
      <div className="level-view-empty">
        <div className="empty-icon">🗺</div>
        <h3>No Level Data</h3>
        <p>This level has no data to display.</p>
      </div>
    )
  }
  
  return (
    <div className="level-view">
      {/* View Mode Tabs */}
      <div className="view-mode-bar">
        <div className="view-mode-tabs">
          <button 
            className={`view-tab ${viewMode === 'draft' ? 'active' : ''}`}
            onClick={() => handleModeChange('draft')}
          >
            📝 Draft
          </button>
          <button 
            className={`view-tab ${viewMode === 'polish' ? 'active' : ''}`}
            onClick={() => handleModeChange('polish')}
            disabled
          >
            🎨 Polish
            <span className="badge-coming-soon">Coming Soon</span>
          </button>
          <button 
            className={`view-tab ${viewMode === 'playable' ? 'active' : ''}`}
            onClick={() => handleModeChange('playable')}
            disabled
          >
            🎮 Playable
            <span className="badge-coming-soon">Coming Soon</span>
          </button>
        </div>
        
        {/* Zoom Controls */}
        <div className="view-controls">
          <button onClick={handleZoomOut} title="Zoom Out">➖</button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} title="Zoom In">➕</button>
          <button onClick={handleResetView} title="Reset View">🎯</button>
        </div>
      </div>
      
      {/* Canvas Area */}
      <div className="canvas-container">
        {viewMode === 'draft' && (
          <>
            <canvas 
              ref={canvasRef}
              width={1200}
              height={800}
              className="level-canvas"
            />
            
            {/* Legend */}
            <div className="draft-legend">
              <h4>Legend</h4>
              <div className="legend-items">
                <div className="legend-item">
                  <span>🧑</span>
                  <span>Player</span>
                </div>
                <div className="legend-item">
                  <span>👾</span>
                  <span>Enemy</span>
                </div>
                <div className="legend-item">
                  <span>🪙</span>
                  <span>Collectible</span>
                </div>
                <div className="legend-item">
                  <span>🚩</span>
                  <span>Goal</span>
                </div>
                <div className="legend-item">
                  <span>▲</span>
                  <span>Hazard</span>
                </div>
                <div className="legend-item">
                  <span>███</span>
                  <span>Platform</span>
                </div>
              </div>
            </div>
            
            {/* Level Info */}
            <div className="level-info-panel">
              <h4>{level.name}</h4>
              <div className="info-item">
                <span className="info-label">Genre:</span>
                <span className="info-value">{level.genre}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Difficulty:</span>
                <span className={`diff-badge ${level.difficulty}`}>{level.difficulty}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Theme:</span>
                <span className="info-value">{level.theme}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Platforms:</span>
                <span className="info-value">{levelData.platforms?.length || 0}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Entities:</span>
                <span className="info-value">{levelData.entities?.length || 0}</span>
              </div>
            </div>
          </>
        )}
        
        {viewMode === 'polish' && (
          <div className="view-stub">
            <div className="stub-icon">🎨</div>
            <h3>Polish View</h3>
            <p>Apply custom textures, sprites, and visual effects.</p>
            <p className="hint">Upload your own assets or choose from the library.</p>
          </div>
        )}
        
        {viewMode === 'playable' && (
          <div className="view-stub">
            <div className="stub-icon">🎮</div>
            <h3>Playable Preview</h3>
            <p>Test your level in real-time with basic gameplay mechanics.</p>
            <p className="hint">Coming soon: Player movement, collision detection, and win conditions.</p>
          </div>
        )}
      </div>
    </div>
  )
}
