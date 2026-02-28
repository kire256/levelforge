import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import LevelView from './LevelView'
import EntityRequirements from './EntityRequirements'
import TilemapCanvas, { TOOLS } from './TilemapCanvas'
import TilePalette from './TilePalette'
import './Levels.css'

const GENRES = [
  { id: 'platformer', name: 'Platformer', icon: '🎮' },
  { id: 'puzzle', name: 'Puzzle', icon: '🧩' },
  { id: 'shooter', name: 'Shooter', icon: '🔫' },
]

const DIFFICULTIES = [
  { id: 'easy', name: 'Easy', color: '#4ade80' },
  { id: 'medium', name: 'Medium', color: '#facc15' },
  { id: 'hard', name: 'Hard', color: '#f97316' },
  { id: 'expert', name: 'Expert', color: '#ef4444' },
]

// Layer types
const LAYERS = {
  ENTITIES: 'entities',
  TILEMAP: 'tilemap',
}

export default function Levels({
  currentProject,
  levels,
  currentLevel,
  onSelectLevel,
  onGenerateLevel,
  generating,
  progress,
  progressMessage,
  availableModels,
  selectedModel,
  onModelChange,
  showGenerator: externalShowGenerator,
  onShowGeneratorChange,
  viewMode: externalViewMode,
  onViewModeChange,
  onRenameLevel,
  selectedObject,
  onSelectObject,
  onUpdateObject,
  // Grid settings
  snapToGrid = false,
  showGrid = true,
  gridSize = 50,
}) {
  const [viewMode, setViewMode] = useState(externalViewMode ?? 'canvas') // canvas | ai
  const [leftWidth, setLeftWidth] = useState(320)
  const isResizing = useRef(false)
  
  // Selected object in hierarchy/canvas - can be controlled or uncontrolled
  const [localSelectedObject, setLocalSelectedObject] = useState(null)
  const activeSelectedObject = selectedObject ?? localSelectedObject
  const handleObjectSelect = onSelectObject || setLocalSelectedObject

  const [genre, setGenre] = useState('platformer')
  const [difficulty, setDifficulty] = useState('medium')
  const [theme, setTheme] = useState('')
  const [requirements, setRequirements] = useState('')
  const [entityRequirements, setEntityRequirements] = useState([])
  
  // Sidebar tab state
  const [sidebarTab, setSidebarTab] = useState('layers') // 'layers', 'levels', or 'objects'
  
  // Layer visibility
  const [layerVisibility, setLayerVisibility] = useState({
    [LAYERS.ENTITIES]: true,
    [LAYERS.TILEMAP]: true,
  })
  const [activeLayer, setActiveLayer] = useState(LAYERS.ENTITIES)
  
  // Tilemap state
  const [tileTypes, setTileTypes] = useState([])
  const [selectedTileId, setSelectedTileId] = useState(null)
  const [selectedTool, setSelectedTool] = useState(TOOLS.PENCIL)
  
  // Load entity types when project changes
  const [entityTypes, setEntityTypes] = useState([])
  
  // Load entity and tile types when project changes
  useEffect(() => {
    if (currentProject) {
      fetch(`http://192.168.68.72:8000/api/projects/${currentProject.id}/entity-types`)
        .then(res => res.json())
        .then(data => setEntityTypes(data))
        .catch(err => console.error('Failed to load entity types:', err))
      
      fetch(`http://192.168.68.72:8000/api/projects/${currentProject.id}/tile-types`)
        .then(res => res.json())
        .then(data => {
          setTileTypes(data)
          // Auto-select first tile if available
          if (data.length > 0 && selectedTileId === null) {
            setSelectedTileId(data[0].id)
          }
        })
        .catch(err => console.error('Failed to load tile types:', err))
    }
  }, [currentProject])
  
  useEffect(() => {
    if (currentProject) {
      fetch(`http://192.168.68.72:8000/api/projects/${currentProject.id}/entity-types`)
        .then(res => res.json())
        .then(data => setEntityTypes(data))
        .catch(err => console.error('Failed to load entity types:', err))
    }
  }, [currentProject])

  useEffect(() => {
    if (externalViewMode !== undefined) setViewMode(externalViewMode)
  }, [externalViewMode])

  useEffect(() => {
    if (externalShowGenerator) {
      setViewMode('ai')
      onViewModeChange && onViewModeChange('ai')
    }
  }, [externalShowGenerator])

  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMove = (e) => {
      if (!isResizing.current) return
      setLeftWidth(Math.max(220, Math.min(520, e.clientX)))
    }
    const onUp = () => {
      if (!isResizing.current) return
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  const handleViewModeChange = (newMode) => {
    setViewMode(newMode)
    onViewModeChange && onViewModeChange(newMode)
    onShowGeneratorChange && onShowGeneratorChange(newMode === 'ai')
  }

  const handleSelectLevel = (level) => {
    onSelectLevel(level)
    handleViewModeChange('canvas')
  }

  // Parse current level data for object hierarchy
  let currentLevelData = null
  try {
    if (currentLevel?.level_data) {
      currentLevelData = typeof currentLevel.level_data === 'string'
        ? JSON.parse(currentLevel.level_data)
        : currentLevel.level_data
    }
  } catch {
    currentLevelData = null
  }
  
  // Group entities by type for object hierarchy
  const entityGroups = useMemo(() => {
    if (!currentLevelData?.entities) return {}
    const groups = {}
    currentLevelData.entities.forEach(entity => {
      const type = entity.type || 'unknown'
      if (!groups[type]) groups[type] = []
      groups[type].push(entity)
    })
    return groups
  }, [currentLevelData])
  
  // Get entity type info (emoji, color) for display
  const getEntityTypeInfo = useCallback((type) => {
    const found = entityTypes.find(et => et.name.toLowerCase() === type.toLowerCase())
    if (found) return { emoji: found.emoji, color: found.color }
    // Default mappings
    const defaults = {
      player_spawn: { emoji: '🧑', color: '#3b82f6' },
      goal: { emoji: '🚩', color: '#22c55e' },
      enemy: { emoji: '👾', color: '#ef4444' },
      enemy_basic: { emoji: '👾', color: '#ef4444' },
      enemy_flying: { emoji: '🦇', color: '#a855f7' },
      coin: { emoji: '🪙', color: '#fbbf24' },
      key: { emoji: '🔑', color: '#fbbf24' },
      spike: { emoji: '▲', color: '#dc2626' },
      hazard: { emoji: '⚠️', color: '#dc2626' },
    }
    return defaults[type.toLowerCase()] || { emoji: '📦', color: '#9ca3af' }
  }, [entityTypes])
  
  // Object selection handlers
  const handleSelectObject = useCallback((obj) => {
    handleObjectSelect(obj)
  }, [])
  
  const handleUpdateObject = useCallback((updatedObj) => {
    // TODO: This would update the level data
    // For now just update the local state
    handleObjectSelect(updatedObj)
    console.log('Update object:', updatedObj)
  }, [])

  const handleGenerate = () => {
    // Format entity requirements into prompt
    let entityReqsText = ''
    if (entityRequirements.length > 0) {
      entityReqsText = '\n\nEntity Requirements:\n'
      entityRequirements.forEach(req => {
        if (req.entityType && req.count > 0) {
          entityReqsText += `- ${req.count}x ${req.entityType.name}`
          if (req.placement) {
            entityReqsText += `: ${req.placement}`
          }
          entityReqsText += '\n'
        }
      })
    }
    
    const fullRequirements = (requirements || 'Create an engaging level') + entityReqsText
    
    onGenerateLevel({
      genre,
      difficulty,
      theme: theme || 'default',
      requirements: fullRequirements
    })
  }
  
  const addEntityRequirement = () => {
    setEntityRequirements([...entityRequirements, {
      id: Date.now(),
      entityType: null,
      count: 1,
      placement: ''
    }])
  }
  
  const removeEntityRequirement = (id) => {
    setEntityRequirements(entityRequirements.filter(req => req.id !== id))
  }
  
  const updateEntityRequirement = (id, field, value) => {
    setEntityRequirements(entityRequirements.map(req => 
      req.id === id ? { ...req, [field]: value } : req
    ))
  }

  if (!currentProject) {
    return (
      <div className="levels-page">
        <div className="no-project-state">
          <div className="empty-icon">🗺</div>
          <h2>No Project Selected</h2>
          <p>Select a project from the Dashboard to manage levels.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="levels-page">
      <main className="main-area">
        <div className="toolbar">
          <div className="toolbar-left">
            <h2>🗺 Levels</h2>
            <span className="project-name">{currentProject.name}</span>
          </div>
          <div className="toolbar-right">
            <button className="btn-primary" onClick={() => handleViewModeChange('ai')}>
              🚀 Generate New Level
            </button>
            {viewMode === 'ai' && (
              <button className="btn-secondary" onClick={() => handleViewModeChange('canvas')}>
                🎨 Back to Canvas
              </button>
            )}
          </div>
        </div>

        <div className="levels-workspace">
          <aside className="levels-sidebar" style={{ width: leftWidth }}>
            {/* Sidebar Tabs */}
            <div className="sidebar-tabs">
              <button 
                className={`sidebar-tab ${sidebarTab === 'layers' ? 'active' : ''}`}
                onClick={() => setSidebarTab('layers')}
              >
                📑 Layers
              </button>
              <button 
                className={`sidebar-tab ${sidebarTab === 'levels' ? 'active' : ''}`}
                onClick={() => setSidebarTab('levels')}
              >
                🗺 Levels
              </button>
              <button 
                className={`sidebar-tab ${sidebarTab === 'objects' ? 'active' : ''}`}
                onClick={() => setSidebarTab('objects')}
              >
                📦 Objects
              </button>
            </div>
            
            {/* Layers Tab Content */}
            {sidebarTab === 'layers' && (
              <>
                <div className="levels-sidebar-header">
                  <h3>Level Layers</h3>
                  {!currentLevel && <span className="hint-text">Select a level</span>}
                </div>
                <div className="layers-list">
                  {/* Entities Layer */}
                  <div 
                    className={`layer-item ${activeLayer === LAYERS.ENTITIES ? 'active' : ''}`}
                    onClick={() => setActiveLayer(LAYERS.ENTITIES)}
                  >
                    <button 
                      className="layer-visibility-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayerVisibility(v => ({ ...v, [LAYERS.ENTITIES]: !v[LAYERS.ENTITIES] }))
                      }}
                      title={layerVisibility[LAYERS.ENTITIES] ? 'Hide layer' : 'Show layer'}
                    >
                      {layerVisibility[LAYERS.ENTITIES] ? '👁️' : '👁️‍🗨️'}
                    </button>
                    <span className="layer-icon">🧑</span>
                    <span className="layer-name">Entities</span>
                    <span className="layer-count">
                      {currentLevelData?.entities?.length || 0}
                    </span>
                  </div>
                  
                  {/* Tilemap Layer */}
                  <div 
                    className={`layer-item ${activeLayer === LAYERS.TILEMAP ? 'active' : ''}`}
                    onClick={() => setActiveLayer(LAYERS.TILEMAP)}
                  >
                    <button 
                      className="layer-visibility-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayerVisibility(v => ({ ...v, [LAYERS.TILEMAP]: !v[LAYERS.TILEMAP] }))
                      }}
                      title={layerVisibility[LAYERS.TILEMAP] ? 'Hide layer' : 'Show layer'}
                    >
                      {layerVisibility[LAYERS.TILEMAP] ? '👁️' : '👁️‍🗨️'}
                    </button>
                    <span className="layer-icon">🟫</span>
                    <span className="layer-name">Tilemap</span>
                    <span className="layer-count">
                      {currentLevelData?.tilemap ? `${currentLevelData.tilemap.width}x${currentLevelData.tilemap.height}` : '—'}
                    </span>
                  </div>
                </div>
                
                {/* Tilemap Settings (when tilemap layer is active) */}
                {activeLayer === LAYERS.TILEMAP && currentLevel && (
                  <div className="tilemap-settings">
                    <h4>Tilemap Settings</h4>
                    <div className="setting-row">
                      <span>Tile Size</span>
                      <span>{currentProject?.tile_size || 32}px</span>
                    </div>
                    <div className="setting-row">
                      <span>Tile Types</span>
                      <span>{tileTypes.length}</span>
                    </div>
                    <p className="tilemap-hint">
                      Select a tile type from the right palette and draw on the canvas.
                    </p>
                  </div>
                )}
              </>
            )}
            
            {/* Levels Tab Content */}
            {sidebarTab === 'levels' && (
              <>
                <div className="levels-sidebar-header">
                  <h3>Project Levels</h3>
                  <span className="count-badge">{levels.length}</span>
                </div>
                <div className="levels-sidebar-list">
                  {levels.length === 0 ? (
                    <div className="empty-levels small">
                      <div className="empty-icon">🗺</div>
                      <p>No levels yet</p>
                    </div>
                  ) : (
                    levels.map(level => (
                      <button
                        key={level.id}
                        className={`level-list-item ${currentLevel?.id === level.id ? 'active' : ''}`}
                        onClick={() => handleSelectLevel(level)}
                      >
                        <div className="level-list-name">{level.name}</div>
                        <div className="level-list-meta">
                          <span>{level.genre}</span>
                          <span className={`diff-badge ${level.difficulty}`}>{level.difficulty}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
            
            {/* Objects Tab Content */}
            {sidebarTab === 'objects' && (
              <>
                <div className="levels-sidebar-header">
                  <h3>Object Hierarchy</h3>
                  {!currentLevel && <span className="hint-text">Select a level</span>}
                </div>
                <div className="levels-sidebar-list objects-list">
                  {!currentLevel ? (
                    <div className="empty-levels small">
                      <div className="empty-icon">📦</div>
                      <p>Select a level to view objects</p>
                    </div>
                  ) : !currentLevelData ? (
                    <div className="empty-levels small">
                      <div className="empty-icon">📦</div>
                      <p>No objects in this level</p>
                    </div>
                  ) : (
                    <>
                      {/* Platforms */}
                      {currentLevelData.platforms && currentLevelData.platforms.length > 0 && (
                        <div className="object-group">
                          <div className="object-group-header">
                            <span className="group-icon">▬</span>
                            <span className="group-name">Platforms</span>
                            <span className="count-badge">{currentLevelData.platforms.length}</span>
                          </div>
                          <div className="object-items">
                            {currentLevelData.platforms.map((platform, i) => (
                              <div 
                                key={i} 
                                className={`object-item ${activeSelectedObject?.type === 'platform' && activeSelectedObject?.index === i ? 'selected' : ''}`}
                                onClick={() => handleSelectObject({ type: 'platform', data: platform, index: i })}
                              >
                                <span className="item-icon">▬</span>
                                <span className="item-name">Platform {i + 1}</span>
                                <span className="item-coords">@ {platform.x}, {platform.y}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Entities by type */}
                      {Object.entries(entityGroups).map(([type, entities]) => {
                        const typeInfo = getEntityTypeInfo(type)
                        return (
                          <div key={type} className="object-group">
                            <div className="object-group-header">
                              <span className="group-icon">{typeInfo.emoji}</span>
                              <span className="group-name">{type}</span>
                              <span className="count-badge">{entities.length}</span>
                            </div>
                            <div className="object-items">
                              {entities.map((entity, i) => (
                                <div 
                                  key={i} 
                                  className={`object-item ${activeSelectedObject?.type === 'entity' && activeSelectedObject?.index === i && activeSelectedObject?.entityType === type ? 'selected' : ''}`}
                                  onClick={() => handleSelectObject({ type: 'entity', entityType: type, data: entity, index: i })}
                                >
                                  <span className="item-icon">{typeInfo.emoji}</span>
                                  <span className="item-name">{entity.name || `${type} ${i + 1}`}</span>
                                  <span className="item-coords">@ {entity.x}, {entity.y}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                      
                      {/* Player Spawn */}
                      {currentLevelData.player_spawn && (
                        <div className="object-group">
                          <div className="object-group-header">
                            <span className="group-icon">🧑</span>
                            <span className="group-name">Player Spawn</span>
                          </div>
                          <div className="object-items">
                            <div 
                              className={`object-item ${activeSelectedObject?.type === 'spawn' ? 'selected' : ''}`}
                              onClick={() => handleSelectObject({ type: 'spawn', data: currentLevelData.player_spawn })}
                            >
                              <span className="item-icon">🧑</span>
                              <span className="item-name">Spawn Point</span>
                              <span className="item-coords">@ {currentLevelData.player_spawn.x}, {currentLevelData.player_spawn.y}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Goal */}
                      {currentLevelData.goal && (
                        <div className="object-group">
                          <div className="object-group-header">
                            <span className="group-icon">🚩</span>
                            <span className="group-name">Goal</span>
                          </div>
                          <div className="object-items">
                            <div 
                              className={`object-item ${activeSelectedObject?.type === 'goal' ? 'selected' : ''}`}
                              onClick={() => handleSelectObject({ type: 'goal', data: currentLevelData.goal })}
                            >
                              <span className="item-icon">🚩</span>
                              <span className="item-name">Goal Point</span>
                              <span className="item-coords">@ {currentLevelData.goal.x}, {currentLevelData.goal.y}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </aside>

          <div className="resize-handle-vertical" onMouseDown={handleMouseDown} />

          <section className="levels-center">
            {viewMode === 'canvas' && (
              <div className="canvas-area">
                {currentLevel ? (
                  <>
                    {/* Main Canvas */}
                    <div className="canvas-view">
                      {activeLayer === LAYERS.ENTITIES ? (
                        <LevelView 
                          level={currentLevel} 
                          mode="draft" 
                          entityTypes={entityTypes || []} 
                          onRename={onRenameLevel}
                          selectedObject={activeSelectedObject}
                          onSelectObject={handleSelectObject}
                          onUpdateObject={onUpdateObject}
                          snapToGrid={snapToGrid}
                          showGrid={showGrid}
                          gridSize={gridSize}
                        />
                      ) : (
                        <TilemapCanvas
                          tilemap={currentLevelData?.tilemap || { width: 50, height: 30, data: [] }}
                          tileTypes={tileTypes}
                          selectedTileId={selectedTileId}
                          tool={selectedTool}
                          tileSize={currentProject?.tile_size || 32}
                          showGrid={showGrid}
                          onTileChange={(x, y, tileId) => {
                            // TODO: Implement tile change persistence
                            console.log('Tile change:', x, y, tileId)
                          }}
                        />
                      )}
                    </div>
                    
                    {/* Tile Palette (shown when tilemap layer is active) */}
                    {activeLayer === LAYERS.TILEMAP && (
                      <TilePalette
                        tileTypes={tileTypes}
                        selectedTileId={selectedTileId}
                        onSelectTile={setSelectedTileId}
                        selectedTool={selectedTool}
                        onSelectTool={setSelectedTool}
                      />
                    )}
                  </>
                ) : (
                  <div className="no-selection">
                    <div className="empty-icon">🎨</div>
                    <h3>No Level Selected</h3>
                    <p>Select a level from the left panel or generate a new one.</p>
                    <button className="btn-primary" onClick={() => handleViewModeChange('ai')}>
                      🚀 Generate New Level
                    </button>
                  </div>
                )}
              </div>
            )}

            {viewMode === 'ai' && (
              <div className="ai-generation-view">
                {generating && (
                  <div className="progress-section">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="progress-info">
                      <span>{progressMessage}</span>
                      <span>{progress}%</span>
                    </div>
                  </div>
                )}

                <div className="model-bar">
                  <label>AI Model:</label>
                  <select value={selectedModel} onChange={e => onModelChange(e.target.value)}>
                    {availableModels && Object.entries(availableModels).map(([provider, models]) => (
                      models.map(m => (
                        <option key={m.name} value={m.name}>
                          {provider.toUpperCase()}: {m.display || m.name}
                        </option>
                      ))
                    ))}
                  </select>
                </div>

                <div className="generation-form">
                  <div className="form-header">
                    <h2>🚀 Generate New Level</h2>
                    <p>Configure your level settings and let AI create it for you.</p>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Genre</label>
                      <div className="genre-grid">
                        {GENRES.map(g => (
                          <button
                            key={g.id}
                            className={`genre-card ${genre === g.id ? 'active' : ''}`}
                            onClick={() => setGenre(g.id)}
                          >
                            <span className="icon">{g.icon}</span>
                            <span className="name">{g.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Difficulty</label>
                      <div className="diff-grid">
                        {DIFFICULTIES.map(d => (
                          <button
                            key={d.id}
                            className={`diff-card ${difficulty === d.id ? 'active' : ''}`}
                            style={{ '--active-color': d.color }}
                            onClick={() => setDifficulty(d.id)}
                          >
                            {d.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group half">
                      <label>Theme</label>
                      <input
                        type="text"
                        placeholder="e.g., forest, castle, space station..."
                        value={theme}
                        onChange={e => setTheme(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Additional Requirements</label>
                      <textarea
                        placeholder="e.g., Include 5 coins, add moving platforms, make it challenging..."
                        value={requirements}
                        onChange={e => setRequirements(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>

                  <EntityRequirements 
                    entityTypes={entityTypes || []}
                    requirements={entityRequirements}
                    onRequirementsChange={setEntityRequirements}
                  />

                  <button className="generate-btn" onClick={handleGenerate} disabled={generating}>
                    {generating ? '🎲 Generating...' : '🚀 Generate Level'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
