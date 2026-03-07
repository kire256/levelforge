import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import LevelView from './LevelView'
import TilemapCanvas, { TOOLS } from './TilemapCanvas'
import EntityRequirements from './EntityRequirements'
import './Levels.css'
import { API_BASE } from '../utils/api'
import { SemanticGrid32, Cell } from '../models/semanticGrid.js'
import { SemanticToTilemap, TileIds } from '../models/semanticToTilemap.js'

// Layer types
const LAYERS = {
  ENTITIES: 'entities',
  TILEMAP: 'tilemap',
  LADDERS: 'ladders',
}

export default function Levels({
  currentProject,
  levels,
  currentLevel,
  onSelectLevel,
  onGenerateLevel,
  onInterpretDescription,
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
  onTilemapChange,
  // Grid settings
  snapToGrid = false,
  showGrid = true,
  gridSize = 32,
}) {
  const [viewMode, setViewMode] = useState(externalViewMode ?? 'canvas') // canvas | ai
  const [leftWidth, setLeftWidth] = useState(320)
  const isResizing = useRef(false)
  
  // Selected object in hierarchy/canvas - can be controlled or uncontrolled
  const [localSelectedObject, setLocalSelectedObject] = useState(null)
  const activeSelectedObject = selectedObject ?? localSelectedObject
  const handleObjectSelect = onSelectObject || setLocalSelectedObject

  // Generation knobs (dual-mode: description ↔ sliders)
  const [description, setDescription]               = useState('')
  const [seed, setSeed]                             = useState('')
  const [difficulty, setDifficulty]                 = useState(0.5)
  const [verticality, setVerticality]               = useState(0.3)
  const [hazardDensity, setHazardDensity]           = useState(0.1)
  const [targetFootholdCount, setTargetFootholdCount] = useState(8)
  const [allowLadders, setAllowLadders]             = useState(false)
  const [styleTags, setStyleTags]                   = useState('')
  const [levelWidth, setLevelWidth]                 = useState(32)
  const [levelHeight, setLevelHeight]               = useState(32)
  const [entityRequirements, setEntityRequirements] = useState([])
  const [interpreting, setInterpreting]             = useState(false)
  
  // Single tree state (only one level expanded at a time)
  const [expandedLevelId, setExpandedLevelId] = useState(currentLevel?.id ?? null)
  
  // Layer visibility
  const [layerVisibility, setLayerVisibility] = useState({
    [LAYERS.ENTITIES]: true,
    [LAYERS.TILEMAP]: true,
    [LAYERS.LADDERS]: true,
  })
  const [activeLayer, setActiveLayer] = useState(LAYERS.ENTITIES)
  
  // Tilemap state
  const [tileTypes, setTileTypes] = useState([])
  const [selectedTileId, setSelectedTileId] = useState(null)
  const [selectedTool, setSelectedTool] = useState(TOOLS.PENCIL)
  const [tilemapData, setTilemapData] = useState(null)
  const [ladderData, setLadderData] = useState(null)
  const tilemapDirty = useRef(false) // true only after user edits a tile
  
  // Shared pan/zoom state for both layers
  const [sharedZoom, setSharedZoom] = useState(1)
  const [sharedPan, setSharedPan] = useState({ x: 0, y: 0 })
  
  // Load entity types when project changes
  const [entityTypes, setEntityTypes] = useState([])
  
  // Load entity and tile types when project changes
  useEffect(() => {
    if (currentProject) {
      fetch(`${API_BASE}/api/projects/${currentProject.id}/entity-types`)
        .then(res => res.json())
        .then(data => setEntityTypes(data))
        .catch(err => console.error('Failed to load entity types:', err))
      
      fetch(`${API_BASE}/api/projects/${currentProject.id}/tile-types`)
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

  useEffect(() => {
    if (currentLevel?.id) {
      setExpandedLevelId(currentLevel.id)
    }
  }, [currentLevel?.id])

  const parseLevelData = useCallback((rawLevelData) => {
    if (!rawLevelData) return null
    try {
      return typeof rawLevelData === 'string' ? JSON.parse(rawLevelData) : rawLevelData
    } catch {
      return null
    }
  }, [])

  const handleTreeLevelClick = (level) => {
    setExpandedLevelId(prev => (prev === level.id ? null : level.id))
    handleSelectLevel(level)
  }

  // Parse current level data for object hierarchy
  const currentLevelData = parseLevelData(currentLevel?.level_data)

  const clampCanvasSize = useCallback((value) => {
    return Math.max(8, Math.min(256, Number(value) || 32))
  }, [])

  const createEmptyTilemap = useCallback((width, height) => ({
    width,
    height,
    data: Array.from({ length: height }, () => Array(width).fill(null)),
  }), [])
  
  // Sync tilemap data only when the selected level changes (not when level data is updated in-place)
  useEffect(() => {
    tilemapDirty.current = false  // reset on every level switch — init must not trigger save
    if (!currentLevel) { setLadderData(null); return }
    let levelData = null
    try {
      levelData = typeof currentLevel.level_data === 'string'
        ? JSON.parse(currentLevel.level_data)
        : currentLevel.level_data
    } catch {}

    // Load ladder tilemap if it was saved separately
    if (levelData?.ladder_tilemap) {
      setLadderData(levelData.ladder_tilemap)
    } else {
      setLadderData(null)
    }

    if (levelData?.tilemap) {
      setTilemapData(levelData.tilemap)
    } else if (levelData?.semantic_grid) {
      // Auto-convert semantic grid to a displayable tilemap.
      // Ladders go to their own layer; pass ladder: 0 to the main tilemap.
      try {
        const grid = SemanticGrid32.fromJSON(levelData.semantic_grid)
        const canvasWidth = clampCanvasSize(levelData.canvas_width ?? levelData.level_plan?.level_width ?? SemanticGrid32.WIDTH)
        const canvasHeight = clampCanvasSize(levelData.canvas_height ?? levelData.level_plan?.level_height ?? SemanticGrid32.HEIGHT)
        const byCollision = (col) => tileTypes.find(t => t.collision_type === col)?.id ?? 0
        const ladderTileId = byCollision('ladder')

        // Main tilemap — ladder cells become empty
        const tileIds = new TileIds({
          solidBase: byCollision('solid'),
          oneway:    byCollision('passthrough'),
          hazard:    byCollision('hazard'),
          ladder:    0,
        })
        const baseData = new SemanticToTilemap(tileIds).convert(grid)
        const data = Array.from({ length: canvasHeight }, (_, y) =>
          Array.from({ length: canvasWidth }, (_, x) =>
            (y < SemanticGrid32.HEIGHT && x < SemanticGrid32.WIDTH) ? baseData[y][x] : null
          )
        )
        setTilemapData({ width: canvasWidth, height: canvasHeight, data })

        // Ladder layer — only cells flagged LADDER
        if (!levelData.ladder_tilemap) {
          const ladderLayerData = Array.from({ length: canvasHeight }, (_, y) =>
            Array.from({ length: canvasWidth }, (_, x) =>
              (y < SemanticGrid32.HEIGHT && x < SemanticGrid32.WIDTH && (grid.get(x, y) & Cell.LADDER))
                ? ladderTileId
                : null
            )
          )
          const hasAnyLadder = ladderLayerData.some(row => row.some(c => c !== null))
          if (hasAnyLadder) {
            setLadderData({ width: canvasWidth, height: canvasHeight, data: ladderLayerData })
          }
        }
      } catch {
        setTilemapData(createEmptyTilemap(SemanticGrid32.WIDTH, SemanticGrid32.HEIGHT))
      }
    } else {
      const canvasWidth = clampCanvasSize(levelData?.canvas_width ?? 32)
      const canvasHeight = clampCanvasSize(levelData?.canvas_height ?? 32)
      setTilemapData(createEmptyTilemap(canvasWidth, canvasHeight))
    }
  }, [currentLevel?.id, tileTypes, clampCanvasSize, createEmptyTilemap])
  
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
  
  // Tile change handler — updates local state; debounced save via useEffect below
  const handleTileChange = useCallback((x, y, tileId) => {
    tilemapDirty.current = true  // mark as user-edited so the debounced save fires
    setTilemapData(prev => {
      if (!prev) return prev
      const newData = prev.data.map(row => [...row])
      if (newData[y]) {
        newData[y][x] = tileId
      }
      return { ...prev, data: newData }
    })
  }, [])

  // Ladder tile change handler — same pattern but for the ladder layer
  const handleLadderTileChange = useCallback((x, y, tileId) => {
    tilemapDirty.current = true
    setLadderData(prev => {
      const width = tilemapData?.width || SemanticGrid32.WIDTH
      const height = tilemapData?.height || SemanticGrid32.HEIGHT
      const base = prev || createEmptyTilemap(width, height)
      const newData = base.data.map(row => [...row])
      if (newData[y]) newData[y][x] = tileId
      return { ...base, data: newData }
    })
  }, [tilemapData, createEmptyTilemap])

  // Debounced tilemap save: notify parent 500ms after last tile change (only if user edited)
  const tilemapSaveTimer = useRef(null)
  useEffect(() => {
    if (!tilemapData || !currentLevel || !onTilemapChange || !tilemapDirty.current) return
    clearTimeout(tilemapSaveTimer.current)
    tilemapSaveTimer.current = setTimeout(() => {
      onTilemapChange(tilemapData, ladderData)
    }, 500)
    return () => clearTimeout(tilemapSaveTimer.current)
  }, [tilemapData, ladderData])
  
  // Shared pan/zoom handlers
  const handleSharedZoomChange = useCallback((newZoom) => {
    setSharedZoom(newZoom)
  }, [])
  
  const handleSharedPanChange = useCallback((newPan) => {
    setSharedPan(newPan)
  }, [])
  
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
    onGenerateLevel({
      seed: seed !== '' ? parseInt(seed, 10) : null,
      level_width: clampCanvasSize(levelWidth),
      level_height: clampCanvasSize(levelHeight),
      difficulty,
      verticality,
      hazard_density: hazardDensity,
      target_foothold_count: targetFootholdCount,
      allow_ladders: allowLadders,
      style_tags: styleTags.split(',').map(s => s.trim()).filter(Boolean),
      entity_requirements: entityRequirements,
    })
  }

  const buildEntityRequirementFromType = useCallback((entityType, count, placementText) => ({
    id: Date.now() + Math.floor(Math.random() * 100000),
    entityId: entityType.id,
    entityName: entityType.name,
    entityEmoji: entityType.emoji,
    count: Math.max(1, Number(count) || 1),
    placement: placementText || entityType.placement_rules || 'distributed throughout level',
  }), [])

  const extractEntityRequirementsFromDescription = useCallback((text) => {
    if (!text?.trim() || entityTypes.length === 0) return []

    const lower = text.toLowerCase()
    const extracted = []

    for (const entity of entityTypes) {
      const name = (entity.name || '').trim().toLowerCase()
      if (!name) continue

      const variants = new Set([
        name,
        `${name}s`,
        `${name}es`,
      ])

      for (const variant of variants) {
        const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

        // e.g. "12 coins"
        const beforePattern = new RegExp(`\\b(\\d+)\\s+${escaped}\\b`, 'i')
        const beforeMatch = lower.match(beforePattern)
        if (beforeMatch) {
          extracted.push(buildEntityRequirementFromType(entity, parseInt(beforeMatch[1], 10), entity.placement_rules))
          break
        }

        // e.g. "coins x12"
        const afterPattern = new RegExp(`\\b${escaped}\\s*[x×]\\s*(\\d+)\\b`, 'i')
        const afterMatch = lower.match(afterPattern)
        if (afterMatch) {
          extracted.push(buildEntityRequirementFromType(entity, parseInt(afterMatch[1], 10), entity.placement_rules))
          break
        }
      }
    }

    // De-duplicate by entityId (keep first)
    const seen = new Set()
    return extracted.filter(req => {
      if (seen.has(req.entityId)) return false
      seen.add(req.entityId)
      return true
    })
  }, [entityTypes, buildEntityRequirementFromType])

  const handleInterpret = async () => {
    if (!description.trim() || !onInterpretDescription) return
    setInterpreting(true)
    const plan = await onInterpretDescription(description)
    if (plan) {
      if (plan.difficulty          !== undefined) setDifficulty(plan.difficulty)
      if (plan.verticality         !== undefined) setVerticality(plan.verticality)
      if (plan.hazard_density      !== undefined) setHazardDensity(plan.hazard_density)
      if (plan.target_foothold_count !== undefined) setTargetFootholdCount(plan.target_foothold_count)
      if (plan.allow_ladders       !== undefined) setAllowLadders(plan.allow_ladders)
      if (plan.style_tags          !== undefined) setStyleTags(plan.style_tags.join(', '))
      if (plan.seed                !== undefined) setSeed(String(plan.seed))
      if (plan.level_width         !== undefined) setLevelWidth(clampCanvasSize(plan.level_width))
      if (plan.level_height        !== undefined) setLevelHeight(clampCanvasSize(plan.level_height))

      // If interpret returns explicit entity requirements, use them.
      // Otherwise, infer from description using project entity type names (e.g. "12 coins").
      if (Array.isArray(plan.entity_requirements) && plan.entity_requirements.length > 0) {
        const mapped = plan.entity_requirements
          .map((req) => {
            const byId = entityTypes.find(et => et.id === req.entityId)
            const byName = entityTypes.find(et => et.name?.toLowerCase() === String(req.entityName || '').toLowerCase())
            const entity = byId || byName
            if (!entity) return null
            return buildEntityRequirementFromType(entity, req.count, req.placement)
          })
          .filter(Boolean)
        if (mapped.length > 0) setEntityRequirements(mapped)
      } else {
        const inferred = extractEntityRequirementsFromDescription(description)
        if (inferred.length > 0) setEntityRequirements(inferred)
      }
    }
    setInterpreting(false)
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
            <div className="levels-sidebar-header">
              <h3>Level Tree</h3>
              <span className="count-badge">{levels.length}</span>
            </div>
            <div className="level-tree-list">
              {levels.length === 0 ? (
                <div className="empty-levels small">
                  <div className="empty-icon">🗺</div>
                  <p>No levels yet</p>
                </div>
              ) : levels.map(level => {
                const isExpanded = expandedLevelId === level.id
                const isSelected = currentLevel?.id === level.id
                const levelData = parseLevelData(level.level_data)
                const previewLadderData = isSelected ? ladderData : levelData?.ladder_tilemap
                return (
                  <div key={level.id} className={`level-tree-node ${isSelected ? 'selected' : ''}`}>
                    <button
                      className={`level-tree-item ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => handleTreeLevelClick(level)}
                    >
                      <span className="level-tree-chevron">{isExpanded ? '▾' : '▸'}</span>
                      <span className="level-tree-name">{level.name}</span>
                      <span className={`diff-badge ${level.difficulty}`}>{level.difficulty}</span>
                    </button>
                    {isExpanded && (
                      <div className="level-tree-children">
                        {/* fake layers-list scope start */}
                        <div className="layers-list">
                  {/* Entities Layer */}
                  <div className={`layer-item-group ${activeLayer === LAYERS.ENTITIES && isSelected ? 'active' : ''}`}>
                    <div
                      className={`layer-item ${activeLayer === LAYERS.ENTITIES && isSelected ? 'active' : ''}`}
                      onClick={() => { if (!isSelected) handleSelectLevel(level); setActiveLayer(LAYERS.ENTITIES) }}
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
                    
                    {activeLayer === LAYERS.ENTITIES && isSelected && currentLevelData && (
                      <div className="object-hierarchy">
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
                                {entities.map((entity, i) => {
                                  const globalIndex = currentLevelData.entities.indexOf(entity)
                                  return (
                                  <div 
                                    key={i}
                                    className={`object-item ${activeSelectedObject?.type === 'entity' && activeSelectedObject?.index === globalIndex ? 'selected' : ''}`}
                                    onClick={() => handleSelectObject({ type: 'entity', data: entity, entityType: type, index: globalIndex })}
                                  >
                                    <span className="item-icon">{typeInfo.emoji}</span>
                                    <span className="item-name">{entity.name || `${type} ${i + 1}`}</span>
                                    <span className="item-coords">@ {entity.x}, {entity.y}</span>
                                  </div>
                                  )
                                })}
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
                        
                        {/* Empty state */}
                        {(!currentLevelData.platforms || currentLevelData.platforms.length === 0) && 
                         (!currentLevelData.entities || currentLevelData.entities.length === 0) &&
                         !currentLevelData.player_spawn && !currentLevelData.goal && (
                          <div className="hierarchy-empty">
                            <span className="empty-icon">📦</span>
                            <span>No objects in this level</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Ladder Layer */}
                  <div
                    className={`layer-item ${activeLayer === LAYERS.LADDERS && isSelected ? 'active' : ''}`}
                    onClick={() => { if (!isSelected) handleSelectLevel(level); setActiveLayer(LAYERS.LADDERS) }}
                  >
                    <button
                      className="layer-visibility-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayerVisibility(v => ({ ...v, [LAYERS.LADDERS]: !v[LAYERS.LADDERS] }))
                      }}
                      title={layerVisibility[LAYERS.LADDERS] ? 'Hide layer' : 'Show layer'}
                    >
                      {layerVisibility[LAYERS.LADDERS] ? '👁️' : '👁️‍🗨️'}
                    </button>
                    <span className="layer-icon">🪜</span>
                    <span className="layer-name">Ladders</span>
                    <span className="layer-count">
                      {previewLadderData ? `${previewLadderData.width}x${previewLadderData.height}` : '—'}
                    </span>
                  </div>

                  {/* Tilemap Layer */}
                  <div
                    className={`layer-item ${activeLayer === LAYERS.TILEMAP && isSelected ? 'active' : ''}`}
                    onClick={() => { if (!isSelected) handleSelectLevel(level); setActiveLayer(LAYERS.TILEMAP) }}
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
                      {levelData?.tilemap ? `${levelData.tilemap.width}x${levelData.tilemap.height}` : '—'}
                    </span>
                  </div>
                        </div>{/* end layers-list */}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Tilemap Settings */}
            {(activeLayer === LAYERS.TILEMAP || activeLayer === LAYERS.LADDERS) && currentLevel && (
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
          </aside>

          <div className="resize-handle-vertical" onMouseDown={handleMouseDown} />

          <section className="levels-center">
            {viewMode === 'canvas' && (
              <div className="canvas-area">
                {currentLevel ? (
                  <>
                    {/* Tile Tools Toolbar - appears when tilemap or ladder layer is active */}
                    {(activeLayer === LAYERS.TILEMAP || activeLayer === LAYERS.LADDERS) && (
                      <div className="tile-tools-toolbar">
                        <div className="toolbar-section tools-section">
                          <span className="toolbar-label">Tools:</span>
                          <button
                            className={`tool-btn ${selectedTool === TOOLS.PENCIL ? 'active' : ''}`}
                            onClick={() => setSelectedTool(TOOLS.PENCIL)}
                            title="Pencil (B)"
                          >
                            ✏️
                          </button>
                          <button
                            className={`tool-btn ${selectedTool === TOOLS.ERASER ? 'active' : ''}`}
                            onClick={() => setSelectedTool(TOOLS.ERASER)}
                            title="Eraser (E)"
                          >
                            🧹
                          </button>
                          <button
                            className={`tool-btn ${selectedTool === TOOLS.RECT ? 'active' : ''}`}
                            onClick={() => setSelectedTool(TOOLS.RECT)}
                            title="Rectangle (R)"
                          >
                            ▢
                          </button>
                          <button
                            className={`tool-btn ${selectedTool === TOOLS.FILL ? 'active' : ''}`}
                            onClick={() => setSelectedTool(TOOLS.FILL)}
                            title="Fill (G)"
                          >
                            🪣
                          </button>
                          <button
                            className={`tool-btn ${selectedTool === TOOLS.PAN ? 'active' : ''}`}
                            onClick={() => setSelectedTool(TOOLS.PAN)}
                            title="Pan (Space)"
                          >
                            ✋
                          </button>
                        </div>
                        
                        <div className="toolbar-divider" />
                        
                        <div className="toolbar-section tiles-section">
                          <span className="toolbar-label">Tiles:</span>
                          <button
                            className={`tile-swatch-btn ${selectedTileId === null ? 'selected' : ''}`}
                            onClick={() => setSelectedTileId(null)}
                            title="Eraser (Empty)"
                          >
                            🚫
                          </button>
                          {(activeLayer === LAYERS.LADDERS
                            ? tileTypes.filter(t => t.collision_type === 'ladder')
                            : tileTypes
                          ).map(tile => (
                            <button
                              key={tile.id}
                              className={`tile-swatch-btn ${selectedTileId === tile.id ? 'selected' : ''}`}
                              style={{ backgroundColor: tile.color }}
                              onClick={() => setSelectedTileId(tile.id)}
                              title={`${tile.name}\n${tile.collision_type} • ${tile.category}`}
                            />
                          ))}
                        </div>
                        
                        {selectedTileId !== null && tileTypes.find(t => t.id === selectedTileId) && (
                          <>
                            <div className="toolbar-divider" />
                            <div className="toolbar-section info-section">
                              <span className="selected-tile-name">
                                {tileTypes.find(t => t.id === selectedTileId)?.name}
                              </span>
                              <span className="selected-tile-type">
                                {tileTypes.find(t => t.id === selectedTileId)?.collision_type}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    
                    {/* Main Canvas - Both layers render simultaneously */}
                    <div className="canvas-view layered-canvas">
                      {/* Tilemap Layer (renders first, underneath) */}
                      {layerVisibility[LAYERS.TILEMAP] && (
                        <div className={`canvas-layer tilemap-layer ${activeLayer === LAYERS.TILEMAP ? 'interactive' : ''}`}>
                          <TilemapCanvas
                            tilemap={tilemapData || { width: 50, height: 30, data: [] }}
                            tileTypes={tileTypes}
                            selectedTileId={selectedTileId}
                            tool={selectedTool}
                            tileSize={currentProject?.tile_size || 32}
                            showGrid={showGrid && activeLayer === LAYERS.TILEMAP}
                            onTileChange={handleTileChange}
                            interactive={activeLayer === LAYERS.TILEMAP}
                            transparent={true}
                            externalZoom={sharedZoom}
                            externalPan={sharedPan}
                            onZoomChange={handleSharedZoomChange}
                            onPanChange={handleSharedPanChange}
                          />
                        </div>
                      )}
                      
                      {/* Ladder Layer (renders above tilemap, below entities) */}
                      {layerVisibility[LAYERS.LADDERS] && ladderData && (
                        <div className={`canvas-layer ladders-layer ${activeLayer === LAYERS.LADDERS ? 'interactive' : ''}`}>
                          <TilemapCanvas
                            tilemap={ladderData}
                            tileTypes={tileTypes.filter(t => t.collision_type === 'ladder')}
                            selectedTileId={selectedTileId}
                            tool={selectedTool}
                            tileSize={currentProject?.tile_size || 32}
                            showGrid={showGrid && activeLayer === LAYERS.LADDERS}
                            onTileChange={handleLadderTileChange}
                            interactive={activeLayer === LAYERS.LADDERS}
                            transparent={true}
                            externalZoom={sharedZoom}
                            externalPan={sharedPan}
                            onZoomChange={handleSharedZoomChange}
                            onPanChange={handleSharedPanChange}
                          />
                        </div>
                      )}

                      {/* Entities Layer (renders on top) */}
                      {layerVisibility[LAYERS.ENTITIES] && (
                        <div className={`canvas-layer entities-layer ${activeLayer === LAYERS.ENTITIES ? 'interactive' : ''}`}>
                          <LevelView 
                            level={currentLevel} 
                            mode="draft" 
                            entityTypes={entityTypes || []} 
                            onRename={onRenameLevel}
                            selectedObject={activeSelectedObject}
                            onSelectObject={handleSelectObject}
                            onUpdateObject={onUpdateObject}
                            snapToGrid={snapToGrid}
                            showGrid={showGrid && activeLayer === LAYERS.ENTITIES}
                            gridSize={gridSize}
                            interactive={activeLayer === LAYERS.ENTITIES}
                            externalZoom={sharedZoom}
                            externalPan={sharedPan}
                            onZoomChange={handleSharedZoomChange}
                            onPanChange={handleSharedPanChange}
                          />
                        </div>
                      )}
                    </div>
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
                    <p>Describe what you want, or tune the knobs directly.</p>
                  </div>

                  {/* Description + Interpret */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Description <span className="label-hint">(optional — used by Interpret)</span></label>
                      <textarea
                        placeholder="e.g., A hard cave level with lava pits and lots of verticality..."
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={3}
                      />
                      <button
                        className="btn-secondary interpret-btn"
                        onClick={handleInterpret}
                        disabled={interpreting || !description.trim()}
                      >
                        {interpreting ? '⏳ Interpreting...' : '✦ Interpret'}
                      </button>
                    </div>
                  </div>

                  <div className="form-divider" />

                  {/* Knob sliders */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Difficulty <span className="knob-value">{difficulty.toFixed(2)}</span></label>
                      <input type="range" min="0" max="1" step="0.05"
                        value={difficulty} onChange={e => setDifficulty(parseFloat(e.target.value))} />
                      <div className="range-labels"><span>Easy</span><span>Expert</span></div>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Verticality <span className="knob-value">{verticality.toFixed(2)}</span></label>
                      <input type="range" min="0" max="1" step="0.05"
                        value={verticality} onChange={e => setVerticality(parseFloat(e.target.value))} />
                      <div className="range-labels"><span>Flat</span><span>Tower</span></div>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Hazard Density <span className="knob-value">{hazardDensity.toFixed(2)}</span></label>
                      <input type="range" min="0" max="1" step="0.05"
                        value={hazardDensity} onChange={e => setHazardDensity(parseFloat(e.target.value))} />
                      <div className="range-labels"><span>None</span><span>Max</span></div>
                    </div>
                  </div>

                  <div className="form-row form-row-inline">
                    <div className="form-group half">
                      <label>Footholds <span className="knob-value">{targetFootholdCount}</span></label>
                      <input type="number" min="4" max="16"
                        value={targetFootholdCount}
                        onChange={e => setTargetFootholdCount(Math.max(4, Math.min(16, parseInt(e.target.value, 10) || 8)))} />
                    </div>
                    <div className="form-group half form-group-checkbox">
                      <label>
                        <input type="checkbox" checked={allowLadders}
                          onChange={e => setAllowLadders(e.target.checked)} />
                        Allow Ladders
                      </label>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Style Tags <span className="label-hint">comma-separated, e.g. cave, lava</span></label>
                      <input type="text" placeholder="cave, lava, ruins..."
                        value={styleTags} onChange={e => setStyleTags(e.target.value)} />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Seed <span className="label-hint">leave blank for random</span></label>
                      <input type="number" min="0" placeholder="random"
                        value={seed} onChange={e => setSeed(e.target.value)} />
                    </div>
                  </div>

                  <div className="form-row form-row-inline">
                    <div className="form-group half">
                      <label>Level Width <span className="label-hint">tiles</span></label>
                      <input
                        type="number"
                        min="8"
                        max="256"
                        value={levelWidth}
                        onChange={e => setLevelWidth(clampCanvasSize(e.target.value))}
                      />
                    </div>
                    <div className="form-group half">
                      <label>Level Height <span className="label-hint">tiles</span></label>
                      <input
                        type="number"
                        min="8"
                        max="256"
                        value={levelHeight}
                        onChange={e => setLevelHeight(clampCanvasSize(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <EntityRequirements
                        entityTypes={entityTypes}
                        requirements={entityRequirements}
                        onRequirementsChange={setEntityRequirements}
                      />
                    </div>
                  </div>

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
