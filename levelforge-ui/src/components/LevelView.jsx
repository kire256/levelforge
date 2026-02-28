import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import './LevelView.css'

// ASCII symbols for different entity types
const ENTITY_SYMBOLS = {
  // Platforms
  platform: '█',
  ground: '▀',
  
  // Actors - LLM generated types mapped here
  player: '🧑',
  player_spawn: '🧑',
  spawn: '🧑',
  enemy: '👾',
  enemy_basic: '👾',
  enemy_flying: '🦇',
  enemy_patrol: '👾',
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
  ammo: '📦',
  health: '❤️',
  collectible: '⭐',
  
  // Hazards
  spike: '▲',
  spikes: '▲',
  lava: '🔥',
  water: '💧',
  hazard: '⚠️',
  
  // Goals
  goal: '🚩',
  door: '🚪',
  portal: '🌀',
  exit: '🚪',
  
  // Interactive
  switch: '🔘',
  button: '🔘',
  pressure_plate: '⬇️',
  cover: '🧱',
  
  // Default
  unknown: '?'
}

// Colors for different entity types
const ENTITY_COLORS = {
  platform: '#6b7280',
  ground: '#8b5a2b',
  player: '#3b82f6',
  player_spawn: '#3b82f6',
  spawn: '#3b82f6',
  enemy: '#ef4444',
  enemy_basic: '#ef4444',
  enemy_flying: '#a855f7',
  enemy_patrol: '#ef4444',
  boss: '#dc2626',
  npc: '#10b981',
  coin: '#fbbf24',
  key: '#fbbf24',
  gem: '#a855f7',
  star: '#fbbf24',
  heart: '#ef4444',
  health: '#ef4444',
  powerup: '#f59e0b',
  weapon: '#6b7280',
  ammo: '#9ca3af',
  spike: '#dc2626',
  spikes: '#dc2626',
  lava: '#f97316',
  water: '#3b82f6',
  hazard: '#dc2626',
  goal: '#22c55e',
  door: '#8b5a2b',
  portal: '#a855f7',
  exit: '#22c55e',
  switch: '#6366f1',
  button: '#6366f1',
  pressure_plate: '#6366f1',
  cover: '#6b7280',
  collectible: '#fbbf24',
  unknown: '#9ca3af'
}

export default function LevelView({ level, mode = 'draft', onModeChange, entityTypes = [], onRename, selectedObject, onSelectObject, onUpdateObject, snapToGrid = false, showGrid = true, gridSize = 32, interactive = true, externalZoom, externalPan, onZoomChange, onPanChange }) {
  const canvasRef = useRef(null)
  const canvasContainerRef = useRef(null)
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 })
  const [viewMode, setViewMode] = useState(mode) // draft, polish, playable

  // Resize canvas to match container (ResizeObserver catches toolbar show/hide too)
  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          setCanvasSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) })
        }
      }
    }
    resizeCanvas()
    const observer = new ResizeObserver(resizeCanvas)
    if (canvasContainerRef.current) observer.observe(canvasContainerRef.current)
    return () => observer.disconnect()
  }, [])

  // Use external pan/zoom if provided, otherwise use internal state
  const [internalZoom, setInternalZoom] = useState(1)
  const [internalPan, setInternalPan] = useState({ x: 0, y: 0 })
  
  const zoom = externalZoom !== undefined ? externalZoom : internalZoom
  const pan = externalPan !== undefined ? externalPan : internalPan
  const setZoom = onZoomChange || setInternalZoom
  const setPan = onPanChange || setInternalPan
  
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  
  // Draggable panel state
  const [legendPos, setLegendPos] = useState({ x: 16, y: 16 })
  const [infoPos, setInfoPos] = useState({ x: null, y: 16 }) // null = right side default
  const [legendMinimized, setLegendMinimized] = useState(false)
  const [infoMinimized, setInfoMinimized] = useState(false)
  const [draggingPanel, setDraggingPanel] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  // Inline rename state
  const [editingName, setEditingName] = useState(false)
  const [tempName, setTempName] = useState('')
  const nameInputRef = useRef(null)
  
  // Hover state for cursor feedback
  const [hoveredObject, setHoveredObject] = useState(null)
  
  // Dragging state for entities
  const [isDraggingEntity, setIsDraggingEntity] = useState(false)
  const [draggingObject, setDraggingObject] = useState(null)
  const [dragStartWorld, setDragStartWorld] = useState(null)
  
  // Parse level data safely - MUST be before any callbacks that use it
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
  
  // Build custom entity lookup from props
  const customEntityLookup = useMemo(() => {
    const lookup = {}
    if (entityTypes && entityTypes.length > 0) {
      entityTypes.forEach(et => {
        // Map by name (lowercase for case-insensitive matching)
        lookup[et.name.toLowerCase()] = {
          symbol: et.emoji || '?',
          color: et.color || '#9ca3af'
        }
      })
    }
    return lookup
  }, [entityTypes])
  
  // Get symbol for entity type, checking custom types first
  const getEntitySymbol = useCallback((type) => {
    if (!type) return ENTITY_SYMBOLS.unknown
    const normalizedType = type.toLowerCase().replace(/[_\s]+/g, '_')
    // Try exact match first
    if (customEntityLookup[type.toLowerCase()]) {
      return customEntityLookup[type.toLowerCase()].symbol
    }
    // Try normalized match
    if (customEntityLookup[normalizedType]) {
      return customEntityLookup[normalizedType].symbol
    }
    // Try partial match for multi-word types
    const typeLower = type.toLowerCase()
    for (const [key, value] of Object.entries(customEntityLookup)) {
      if (typeLower.includes(key) || key.includes(typeLower)) {
        return value.symbol
      }
    }
    return ENTITY_SYMBOLS[type] || ENTITY_SYMBOLS[normalizedType] || ENTITY_SYMBOLS.unknown
  }, [customEntityLookup])
  
  // Get color for entity type, checking custom types first
  const getEntityColor = useCallback((type) => {
    if (!type) return ENTITY_COLORS.unknown
    const normalizedType = type.toLowerCase().replace(/[_\s]+/g, '_')
    // Try exact match first
    if (customEntityLookup[type.toLowerCase()]) {
      return customEntityLookup[type.toLowerCase()].color
    }
    // Try normalized match
    if (customEntityLookup[normalizedType]) {
      return customEntityLookup[normalizedType].color
    }
    // Try partial match for multi-word types
    const typeLower = type.toLowerCase()
    for (const [key, value] of Object.entries(customEntityLookup)) {
      if (typeLower.includes(key) || key.includes(typeLower)) {
        return value.color
      }
    }
    return ENTITY_COLORS[type] || ENTITY_COLORS[normalizedType] || ENTITY_COLORS.unknown
  }, [customEntityLookup])
  
  // Helper to detect what object is at canvas coordinates - MUST be defined before handleMouseDown
  const getObjectAtPosition = useCallback((canvasX, canvasY) => {
    if (!levelData) return null
    
    const canvas = canvasRef.current
    if (!canvas) return null
    
    // Calculate transform (same as renderDraftView)
    const allPoints = []
    if (levelData.platforms) {
      levelData.platforms.forEach(p => {
        allPoints.push({ x: p.x, y: p.y })
        allPoints.push({ x: p.x + p.width, y: p.y + p.height })
      })
    }
    if (levelData.entities) {
      levelData.entities.forEach(e => {
        allPoints.push({ x: e.x, y: e.y })
      })
    }
    if (levelData.player_spawn) {
      allPoints.push({ x: levelData.player_spawn.x, y: levelData.player_spawn.y })
    }
    if (levelData.goal) {
      allPoints.push({ x: levelData.goal.x, y: levelData.goal.y })
    }
    
    let minX = 0, maxX = 800, minY = 0, maxY = 600
    if (allPoints.length > 0) {
      minX = Math.min(...allPoints.map(p => p.x))
      maxX = Math.max(...allPoints.map(p => p.x))
      minY = Math.min(...allPoints.map(p => p.y))
      maxY = Math.max(...allPoints.map(p => p.y))
      const paddingX = Math.max(50, (maxX - minX) * 0.1)
      const paddingY = Math.max(50, (maxY - minY) * 0.1)
      minX -= paddingX
      maxX += paddingX
      minY -= paddingY
      maxY += paddingY
    }
    
    const levelWidth = maxX - minX
    const levelHeight = maxY - minY
    const scaleX = (canvas.width - 100) / levelWidth
    const scaleY = (canvas.height - 100) / levelHeight
    const baseScale = Math.min(scaleX, scaleY, 1)
    const scale = baseScale * zoom
    
    const offsetX = canvas.width / 2 - (minX + levelWidth / 2) * scale + pan.x
    const offsetY = canvas.height / 2 + (minY + levelHeight / 2) * scale + pan.y
    
    // Convert to world coordinates
    const worldX = (canvasX - offsetX) / scale
    const worldY = (offsetY - canvasY) / scale
    
    const hitRadius = 20 / scale
    
    // Check entities (reverse order)
    if (levelData.entities) {
      for (let i = levelData.entities.length - 1; i >= 0; i--) {
        const entity = levelData.entities[i]
        const dx = entity.x - worldX
        const dy = entity.y - worldY
        if (dx * dx + dy * dy < hitRadius * hitRadius) {
          return { type: 'entity', entityType: entity.type, data: entity, index: i }
        }
      }
    }
    
    // Check platforms (reverse order)
    if (levelData.platforms) {
      for (let i = levelData.platforms.length - 1; i >= 0; i--) {
        const p = levelData.platforms[i]
        if (worldX >= p.x && worldX <= p.x + p.width &&
            worldY <= p.y && worldY >= p.y - p.height) {
          return { type: 'platform', data: p, index: i }
        }
      }
    }
    
    // Check player spawn
    if (levelData.player_spawn) {
      const ps = levelData.player_spawn
      const dx = ps.x - worldX
      const dy = ps.y - worldY
      if (dx * dx + dy * dy < hitRadius * hitRadius) {
        return { type: 'spawn', data: ps }
      }
    }
    
    // Check goal
    if (levelData.goal) {
      const g = levelData.goal
      const dx = g.x - worldX
      const dy = g.y - worldY
      if (dx * dx + dy * dy < hitRadius * hitRadius) {
        return { type: 'goal', data: g }
      }
    }
    
    return null
  }, [levelData, zoom, pan])
  
  // Mouse event handlers for panning and object dragging
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return // Only handle left click
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Check if clicking on an object
    const obj = getObjectAtPosition(x, y)
    
    if (obj && onSelectObject) {
      // Select the object
      onSelectObject(obj)
      
      // Start dragging
      setIsDraggingEntity(true)
      setDraggingObject(obj)
      setDragStartWorld({ x: obj.data.x, y: obj.data.y, clientX: e.clientX, clientY: e.clientY })
    } else if (!obj) {
      // Clicked on empty space - start panning
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      if (onSelectObject) onSelectObject(null)
    }
  }, [pan, getObjectAtPosition, onSelectObject])
  
  const handleMouseMove = useCallback((e) => {
    if (isDraggingEntity && draggingObject && dragStartWorld) {
      // Calculate delta in screen pixels
      const deltaX = e.clientX - dragStartWorld.clientX
      const deltaY = e.clientY - dragStartWorld.clientY
      
      const canvas = canvasRef.current
      if (!canvas || !levelData) return
      
      // Calculate scale
      const allPoints = []
      if (levelData.platforms) {
        levelData.platforms.forEach(p => {
          allPoints.push({ x: p.x, y: p.y })
          allPoints.push({ x: p.x + p.width, y: p.y + p.height })
        })
      }
      if (levelData.entities) {
        levelData.entities.forEach(e => {
          allPoints.push({ x: e.x, y: e.y })
        })
      }
      if (levelData.player_spawn) {
        allPoints.push({ x: levelData.player_spawn.x, y: levelData.player_spawn.y })
      }
      if (levelData.goal) {
        allPoints.push({ x: levelData.goal.x, y: levelData.goal.y })
      }
      
      let minX = 0, maxX = 800, minY = 0, maxY = 600
      if (allPoints.length > 0) {
        minX = Math.min(...allPoints.map(p => p.x))
        maxX = Math.max(...allPoints.map(p => p.x))
        minY = Math.min(...allPoints.map(p => p.y))
        maxY = Math.max(...allPoints.map(p => p.y))
        const paddingX = Math.max(50, (maxX - minX) * 0.1)
        const paddingY = Math.max(50, (maxY - minY) * 0.1)
        minX -= paddingX
        maxX += paddingX
        minY -= paddingY
        maxY += paddingY
      }
      
      const levelWidth = maxX - minX
      const levelHeight = maxY - minY
      const scaleX = (canvas.width - 100) / levelWidth
      const scaleY = (canvas.height - 100) / levelHeight
      const baseScale = Math.min(scaleX, scaleY, 1)
      const scale = baseScale * zoom
      
      // Convert screen delta to world delta (Y is flipped)
      const worldDeltaX = deltaX / scale
      const worldDeltaY = -deltaY / scale
      
      // Calculate new position
      let newX = dragStartWorld.x + worldDeltaX
      let newY = dragStartWorld.y + worldDeltaY
      
      // Snap to grid if enabled
      if (snapToGrid) {
        newX = Math.round(newX / gridSize) * gridSize
        newY = Math.round(newY / gridSize) * gridSize
      } else {
        // Round to integers
        newX = Math.round(newX)
        newY = Math.round(newY)
      }
      
      const updatedData = { ...draggingObject.data, x: newX, y: newY }
      const updatedObj = { ...draggingObject, data: updatedData }
      
      // Update selection for immediate visual feedback
      onSelectObject(updatedObj)
      // Update dragging object for next move delta calculation
      setDraggingObject(updatedObj)
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
    }
  }, [isDraggingEntity, draggingObject, dragStartWorld, isPanning, panStart, zoom, levelData, onSelectObject, snapToGrid, gridSize])
  
  const handleMouseUp = useCallback(() => {
    // If we were dragging an entity, persist the change
    if (isDraggingEntity && draggingObject && onUpdateObject) {
      onUpdateObject(draggingObject)
    }
    
    setIsPanning(false)
    setIsDraggingEntity(false)
    setDraggingObject(null)
    setDragStartWorld(null)
  }, [isDraggingEntity, draggingObject, onUpdateObject])
  
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false)
    setIsDraggingEntity(false)
    setDraggingObject(null)
    setDragStartWorld(null)
    setHoveredObject(null)
  }, [])
  
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(prev => Math.max(0.25, Math.min(4, prev + delta)))
  }, [])
  
  // Panel drag handlers
  const handlePanelMouseDown = useCallback((e, panel) => {
    if (e.target.closest('.panel-minimize-btn')) return // Don't drag on minimize button
    e.preventDefault()
    e.stopPropagation()
    
    const panelEl = e.currentTarget
    const rect = panelEl.getBoundingClientRect()
    
    setDraggingPanel(panel)
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    
    // If info panel and position is null, set initial position based on current location
    if (panel === 'info' && infoPos.x === null) {
      const parentRect = panelEl.parentElement.getBoundingClientRect()
      setInfoPos({
        x: parentRect.width - rect.width - 16,
        y: 16
      })
    }
  }, [infoPos])
  
  const handlePanelMouseMove = useCallback((e) => {
    if (!draggingPanel) return
    
    const canvasContainer = canvasRef.current?.parentElement
    if (!canvasContainer) return
    
    const rect = canvasContainer.getBoundingClientRect()
    const newX = e.clientX - rect.left - dragOffset.x
    const newY = e.clientY - rect.top - dragOffset.y
    
    if (draggingPanel === 'legend') {
      setLegendPos({ x: Math.max(0, newX), y: Math.max(0, newY) })
    } else if (draggingPanel === 'info') {
      setInfoPos({ x: Math.max(0, newX), y: Math.max(0, newY) })
    }
  }, [draggingPanel, dragOffset])
  
  const handlePanelMouseUp = useCallback(() => {
    setDraggingPanel(null)
  }, [])
  
  // Handle canvas hover for cursor feedback
  const handleCanvasHover = useCallback((e) => {
    if (isPanning || draggingPanel) return
    
    const canvas = canvasRef.current
    if (!canvas || !onSelectObject) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const obj = getObjectAtPosition(x, y)
    setHoveredObject(obj)
  }, [isPanning, draggingPanel, onSelectObject, getObjectAtPosition])
  
  // Inline rename handlers
  const handleNameClick = useCallback((e) => {
    e.stopPropagation()
    if (!onRename) return
    setTempName(level.name)
    setEditingName(true)
  }, [level.name, onRename])
  
  const handleNameChange = useCallback((e) => {
    setTempName(e.target.value)
  }, [])
  
  const handleNameKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      const newName = tempName.trim()
      if (newName && newName !== level.name) {
        onRename({ ...level, name: newName })
      }
      setEditingName(false)
    } else if (e.key === 'Escape') {
      setEditingName(false)
    }
    e.stopPropagation()
  }, [tempName, level, onRename])
  
  const handleNameBlur = useCallback(() => {
    const newName = tempName.trim()
    if (newName && newName !== level.name && onRename) {
      onRename({ ...level, name: newName })
    }
    setEditingName(false)
  }, [tempName, level, onRename])
  
  // Focus input when editing starts
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [editingName])
  
  // Update view mode when prop changes
  useEffect(() => {
    setViewMode(mode)
  }, [mode])
  
  // Render draft view (ASCII/symbols)
  const renderDraftView = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !levelData) return
    
    const ctx = canvas.getContext('2d')
    
    // Always clear with transparent - tilemap layer provides background
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Collect all coordinates to determine bounds
    const allPoints = []
    
    if (levelData.platforms) {
      levelData.platforms.forEach(p => {
        allPoints.push({ x: p.x, y: p.y })
        allPoints.push({ x: p.x + p.width, y: p.y + p.height })
      })
    }
    
    if (levelData.entities) {
      levelData.entities.forEach(e => {
        allPoints.push({ x: e.x, y: e.y })
      })
    }
    
    if (levelData.player_spawn) {
      allPoints.push({ x: levelData.player_spawn.x, y: levelData.player_spawn.y })
    }
    
    if (levelData.goal) {
      allPoints.push({ x: levelData.goal.x, y: levelData.goal.y })
    }
    
    // Calculate bounds
    let minX = 0, maxX = 800, minY = 0, maxY = 600
    if (allPoints.length > 0) {
      minX = Math.min(...allPoints.map(p => p.x))
      maxX = Math.max(...allPoints.map(p => p.x))
      minY = Math.min(...allPoints.map(p => p.y))
      maxY = Math.max(...allPoints.map(p => p.y))
      
      // Add padding
      const paddingX = Math.max(50, (maxX - minX) * 0.1)
      const paddingY = Math.max(50, (maxY - minY) * 0.1)
      minX -= paddingX
      maxX += paddingX
      minY -= paddingY
      maxY += paddingY
    }
    
    // Calculate scale to fit level in canvas
    const levelWidth = maxX - minX
    const levelHeight = maxY - minY
    const scaleX = (canvas.width - 100) / levelWidth
    const scaleY = (canvas.height - 100) / levelHeight
    const baseScale = Math.min(scaleX, scaleY, 1) // Don't zoom in beyond 1:1
    const scale = baseScale * zoom
    
    // Center offset
    const offsetX = canvas.width / 2 - (minX + levelWidth / 2) * scale + pan.x
    const offsetY = canvas.height / 2 + (minY + levelHeight / 2) * scale + pan.y
    
    // Draw grid (conditional)
    if (showGrid) {
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = 1
      
      const scaledGridSize = gridSize * scale
      const startX = ((offsetX % scaledGridSize) + scaledGridSize) % scaledGridSize
      const startY = ((offsetY % scaledGridSize) + scaledGridSize) % scaledGridSize

      for (let x = startX; x < canvas.width; x += scaledGridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }

      for (let y = startY; y < canvas.height; y += scaledGridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }
    }
    
    // Draw platforms
    if (levelData.platforms) {
      levelData.platforms.forEach((platform, i) => {
        // Use selected object's position if this platform is selected (for live dragging)
        const isSelected = selectedObject?.type === 'platform' && selectedObject?.index === i
        const displayPlatform = isSelected ? selectedObject.data : platform
        
        const x = displayPlatform.x * scale + offsetX
        const y = offsetY - displayPlatform.y * scale // Flip Y axis
        const width = displayPlatform.width * scale
        const height = displayPlatform.height * scale
        
        // Fill
        ctx.fillStyle = ENTITY_COLORS.platform
        ctx.fillRect(x, y - height, width, height)
        
        // Hover highlight
        const isHovered = hoveredObject?.type === 'platform' && hoveredObject?.index === i && !isSelected
        if (isHovered) {
          ctx.strokeStyle = '#a5b4fc'
          ctx.lineWidth = 2
          ctx.strokeRect(x - 1, y - height - 1, width + 2, height + 2)
        }
        
        // Selection highlight
        if (isSelected) {
          ctx.strokeStyle = '#6366f1'
          ctx.lineWidth = 3
          ctx.strokeRect(x - 1.5, y - height - 1.5, width + 3, height + 3)
        }
      })
    }
    
    // Draw entities
    if (levelData.entities) {
      levelData.entities.forEach((entity, i) => {
        // Use selected object's position if this entity is selected (for live dragging)
        const isSelected = selectedObject?.type === 'entity' && selectedObject?.index === i
        const displayEntity = isSelected ? selectedObject.data : entity
        
        const x = displayEntity.x * scale + offsetX
        const y = offsetY - displayEntity.y * scale // Flip Y axis
        const entityType = entity.type || 'unknown'
        const symbol = getEntitySymbol(entityType)
        const color = getEntityColor(entityType)
        
        // Hover highlight
        const isHovered = hoveredObject?.type === 'entity' && hoveredObject?.index === i && !isSelected
        if (isHovered) {
          ctx.beginPath()
          ctx.arc(x, y, Math.max(12, 16 * scale), 0, Math.PI * 2)
          ctx.strokeStyle = '#a5b4fc'
          ctx.lineWidth = 2
          ctx.stroke()
        }
        
        // Selection highlight
        if (isSelected) {
          ctx.beginPath()
          ctx.arc(x, y, Math.max(14, 18 * scale), 0, Math.PI * 2)
          ctx.strokeStyle = '#6366f1'
          ctx.lineWidth = 3
          ctx.stroke()
        }
        
        // Draw symbol
        ctx.font = `${Math.max(12, 16 * scale)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = color
        ctx.fillText(symbol, x, y)
        
        // Draw label
        if (entity.name) {
          ctx.font = `${Math.max(8, 10 * scale)}px monospace`
          ctx.fillStyle = '#6b7280'
          ctx.fillText(entity.name, x, y + 12 * scale)
        }
      })
    }
    
    // Draw player spawn
    if (levelData.player_spawn) {
      // Use selected object's position if spawn is selected (for live dragging)
      const isSelected = selectedObject?.type === 'spawn'
      const displaySpawn = isSelected ? selectedObject.data : levelData.player_spawn
      
      const x = displaySpawn.x * scale + offsetX
      const y = offsetY - displaySpawn.y * scale
      
      // Hover highlight
      const isHovered = hoveredObject?.type === 'spawn' && !isSelected
      if (isHovered) {
        ctx.beginPath()
        ctx.arc(x, y, Math.max(14, 20 * scale), 0, Math.PI * 2)
        ctx.strokeStyle = '#a5b4fc'
        ctx.lineWidth = 2
        ctx.stroke()
      }
      
      // Selection highlight
      if (isSelected) {
        ctx.beginPath()
        ctx.arc(x, y, Math.max(16, 22 * scale), 0, Math.PI * 2)
        ctx.strokeStyle = '#6366f1'
        ctx.lineWidth = 3
        ctx.stroke()
      }
      
      ctx.font = `${Math.max(14, 20 * scale)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = getEntityColor('player_spawn')
      ctx.fillText(getEntitySymbol('player_spawn'), x, y)
      
      ctx.font = `${Math.max(8, 10 * scale)}px monospace`
      ctx.fillStyle = '#6b7280'
      ctx.fillText('SPAWN', x, y + 16 * scale)
    }
    
    // Draw goal
    if (levelData.goal) {
      // Use selected object's position if goal is selected (for live dragging)
      const isSelected = selectedObject?.type === 'goal'
      const displayGoal = isSelected ? selectedObject.data : levelData.goal
      
      const x = displayGoal.x * scale + offsetX
      const y = offsetY - displayGoal.y * scale
      
      // Hover highlight
      const isHovered = hoveredObject?.type === 'goal' && !isSelected
      if (isHovered) {
        ctx.beginPath()
        ctx.arc(x, y, Math.max(14, 20 * scale), 0, Math.PI * 2)
        ctx.strokeStyle = '#a5b4fc'
        ctx.lineWidth = 2
        ctx.stroke()
      }
      
      // Selection highlight
      if (isSelected) {
        ctx.beginPath()
        ctx.arc(x, y, Math.max(16, 22 * scale), 0, Math.PI * 2)
        ctx.strokeStyle = '#6366f1'
        ctx.lineWidth = 3
        ctx.stroke()
      }
      
      ctx.font = `${Math.max(14, 20 * scale)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = getEntityColor('goal')
      ctx.fillText(getEntitySymbol('goal'), x, y)
      
      ctx.font = `${Math.max(8, 10 * scale)}px monospace`
      ctx.fillStyle = '#6b7280'
      ctx.fillText('GOAL', x, y + 16 * scale)
    }
  }, [levelData, zoom, pan, customEntityLookup, selectedObject, hoveredObject, getEntitySymbol, getEntityColor, showGrid, gridSize])
  
  // Trigger render when dependencies change
  useEffect(() => {
    if (viewMode === 'draft') {
      renderDraftView()
    }
  }, [viewMode, renderDraftView])
  
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
    <div className={`level-view ${!interactive ? 'non-interactive' : ''}`} ref={canvasContainerRef}>
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
              width={canvasSize.width}
              height={canvasSize.height}
              className={`level-canvas ${isPanning ? 'panning' : ''}`}
              onMouseDown={handleMouseDown}
              onMouseMove={(e) => {
                handleMouseMove(e)
                handleCanvasHover(e)
              }}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                handleMouseLeave()
                setHoveredObject(null)
              }}
              onWheel={handleWheel}
              style={{ 
                cursor: isDraggingEntity ? 'move' : isPanning ? 'grabbing' : hoveredObject ? 'pointer' : 'grab' 
              }}
            />
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
