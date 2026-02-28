import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './TilemapCanvas.css'

// Drawing tools
const TOOLS = {
  PENCIL: 'pencil',
  ERASER: 'eraser',
  RECT: 'rect',
  FILL: 'fill',
  PAN: 'pan',
}

export default function TilemapCanvas({
  tilemap,
  tileTypes = [],
  selectedTileId,
  tool = TOOLS.PENCIL,
  tileSize = 32,
  showGrid = true,
  snapToGrid = false,
  onTileChange,
  interactive = true,
  externalZoom,
  externalPan,
  onZoomChange,
  onPanChange,
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  
  // Use external pan/zoom if provided, otherwise use internal state
  const [internalZoom, setInternalZoom] = useState(1)
  const [internalPan, setInternalPan] = useState({ x: 0, y: 0 })
  
  const zoom = externalZoom !== undefined ? externalZoom : internalZoom
  const pan = externalPan !== undefined ? externalPan : internalPan
  const setZoom = onZoomChange || setInternalZoom
  const setPan = onPanChange || setInternalPan
  
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 })
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState(null)
  const [currentTile, setCurrentTile] = useState(null)
  
  // Get tilemap dimensions
  const width = tilemap?.width || 50
  const height = tilemap?.height || 30
  const data = tilemap?.data || []
  
  // Build tile type lookup
  const tileTypeLookup = useMemo(() => {
    const lookup = { 0: { id: 0, name: 'Empty', color: 'transparent' } }
    tileTypes.forEach(tt => {
      lookup[tt.id] = tt
    })
    return lookup
  }, [tileTypes])
  
  // Resize canvas to match container
  useEffect(() => {
    const resizeCanvas = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setCanvasSize({ 
          width: Math.floor(rect.width), 
          height: Math.floor(rect.height) 
        })
      }
    }
    
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])
  
  // Convert screen coordinates to tile coordinates
  const screenToTile = useCallback((screenX, screenY) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    
    // Get the actual rendered size of the canvas
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    // Convert to canvas coordinates
    const canvasX = screenX * scaleX
    const canvasY = screenY * scaleY
    
    const tileX = Math.floor((canvasX - pan.x) / (tileSize * zoom))
    const tileY = Math.floor((canvasY - pan.y) / (tileSize * zoom))
    
    if (tileX < 0 || tileX >= width || tileY < 0 || tileY >= height) {
      return null
    }
    
    return { tileX, tileY }
  }, [pan, tileSize, zoom, width, height])
  
  // Get tile at position
  const getTileAt = useCallback((tileX, tileY) => {
    if (!data[tileY]) return null
    return data[tileY][tileX]
  }, [data])
  
  // Set tile at position
  const setTileAt = useCallback((tileX, tileY, tileId) => {
    if (onTileChange) {
      onTileChange(tileX, tileY, tileId)
    }
  }, [onTileChange])
  
  // Flood fill algorithm
  const floodFill = useCallback((startX, startY, newTileId) => {
    const originalTileId = getTileAt(startX, startY)
    if (originalTileId === newTileId) return
    
    const changes = []
    const visited = new Set()
    const stack = [{ x: startX, y: startY }]
    
    while (stack.length > 0) {
      const { x, y } = stack.pop()
      const key = `${x},${y}`
      
      if (visited.has(key)) continue
      if (x < 0 || x >= width || y < 0 || y >= height) continue
      if (getTileAt(x, y) !== originalTileId) continue
      
      visited.add(key)
      changes.push({ x, y, tileId: newTileId })
      
      stack.push({ x: x + 1, y })
      stack.push({ x: x - 1, y })
      stack.push({ x, y: y + 1 })
      stack.push({ x, y: y - 1 })
    }
    
    // Apply all changes
    changes.forEach(({ x, y, tileId }) => {
      setTileAt(x, y, tileId)
    })
  }, [getTileAt, setTileAt, width, height])
  
  // Draw rectangle
  const drawRect = useCallback((startX, startY, endX, endY, tileId) => {
    const minX = Math.min(startX, endX)
    const maxX = Math.max(startX, endX)
    const minY = Math.min(startY, endY)
    const maxY = Math.max(startY, endY)
    
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          setTileAt(x, y, tileId)
        }
      }
    }
  }, [setTileAt, width, height])
  
  // Mouse handlers
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    if (tool === TOOLS.PAN || e.shiftKey) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      return
    }
    
    const tilePos = screenToTile(x, y)
    if (!tilePos) return
    
    setIsDrawing(true)
    setDrawStart(tilePos)
    
    if (tool === TOOLS.PENCIL) {
      setTileAt(tilePos.tileX, tilePos.tileY, selectedTileId)
    } else if (tool === TOOLS.ERASER) {
      setTileAt(tilePos.tileX, tilePos.tileY, null)
    } else if (tool === TOOLS.FILL) {
      floodFill(tilePos.tileX, tilePos.tileY, selectedTileId)
    }
  }, [tool, pan, screenToTile, selectedTileId, setTileAt, floodFill])
  
  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Update current tile for hover preview
    const tilePos = screenToTile(x, y)
    setCurrentTile(tilePos)
    
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
      return
    }
    
    if (!isDrawing || !tilePos) return
    
    if (tool === TOOLS.PENCIL) {
      setTileAt(tilePos.tileX, tilePos.tileY, selectedTileId)
    } else if (tool === TOOLS.ERASER) {
      setTileAt(tilePos.tileX, tilePos.tileY, null)
    }
  }, [isPanning, panStart, isDrawing, tool, screenToTile, setTileAt, selectedTileId])
  
  const handleMouseUp = useCallback((e) => {
    if (isPanning) {
      setIsPanning(false)
      return
    }
    
    if (!isDrawing || !drawStart) {
      setIsDrawing(false)
      return
    }
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const tilePos = screenToTile(x, y)
    
    if (tool === TOOLS.RECT && tilePos) {
      drawRect(drawStart.tileX, drawStart.tileY, tilePos.tileX, tilePos.tileY, selectedTileId)
    }
    
    setIsDrawing(false)
    setDrawStart(null)
  }, [isPanning, isDrawing, drawStart, tool, screenToTile, drawRect, selectedTileId])
  
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(prev => Math.max(0.25, Math.min(4, prev + delta)))
  }, [])
  
  // Render tilemap
  const renderTilemap = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    const canvasW = canvasSize.width
    const canvasH = canvasSize.height
    
    // Clear canvas with dark background (this is the base layer)
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvasW, canvasH)
    
    const scaledTileSize = tileSize * zoom
    
    // Calculate visible tile range for culling
    const startTileX = Math.max(0, Math.floor(-pan.x / scaledTileSize))
    const startTileY = Math.max(0, Math.floor(-pan.y / scaledTileSize))
    const endTileX = Math.min(width, Math.ceil((canvasW - pan.x) / scaledTileSize))
    const endTileY = Math.min(height, Math.ceil((canvasH - pan.y) / scaledTileSize))
    
    // Draw tiles
    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const tileId = data[y]?.[x]
        const screenX = x * scaledTileSize + pan.x
        const screenY = y * scaledTileSize + pan.y
        
        if (tileId && tileTypeLookup[tileId]) {
          const tileType = tileTypeLookup[tileId]
          ctx.fillStyle = tileType.color
          ctx.fillRect(screenX, screenY, scaledTileSize, scaledTileSize)
          
          // Add subtle border for non-empty tiles
          ctx.strokeStyle = 'rgba(255,255,255,0.1)'
          ctx.lineWidth = 1
          ctx.strokeRect(screenX + 0.5, screenY + 0.5, scaledTileSize - 1, scaledTileSize - 1)
        }
      }
    }
    
    // Draw grid (always show when visible)
    if (showGrid && scaledTileSize >= 8) {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 1
      
      for (let x = startTileX; x <= endTileX; x++) {
        const screenX = x * scaledTileSize + pan.x
        ctx.beginPath()
        ctx.moveTo(screenX, 0)
        ctx.lineTo(screenX, canvasH)
        ctx.stroke()
      }
      
      for (let y = startTileY; y <= endTileY; y++) {
        const screenY = y * scaledTileSize + pan.y
        ctx.beginPath()
        ctx.moveTo(0, screenY)
        ctx.lineTo(canvasW, screenY)
        ctx.stroke()
      }
    }
    
    // Draw hover highlight
    if (currentTile && !isPanning && interactive) {
      const screenX = currentTile.tileX * scaledTileSize + pan.x
      const screenY = currentTile.tileY * scaledTileSize + pan.y
      
      ctx.strokeStyle = '#6366f1'
      ctx.lineWidth = 2
      ctx.strokeRect(screenX, screenY, scaledTileSize, scaledTileSize)
      
      // Show preview for rect tool
      if (tool === TOOLS.RECT && isDrawing && drawStart) {
        const startX = Math.min(drawStart.tileX, currentTile.tileX) * scaledTileSize + pan.x
        const startY = Math.min(drawStart.tileY, currentTile.tileY) * scaledTileSize + pan.y
        const rectWidth = (Math.abs(currentTile.tileX - drawStart.tileX) + 1) * scaledTileSize
        const rectHeight = (Math.abs(currentTile.tileY - drawStart.tileY) + 1) * scaledTileSize
        
        const previewTileType = tileTypeLookup[selectedTileId]
        if (previewTileType) {
          ctx.fillStyle = previewTileType.color + '80' // 50% opacity
          ctx.fillRect(startX, startY, rectWidth, rectHeight)
        }
        
        ctx.strokeStyle = '#6366f1'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.strokeRect(startX, startY, rectWidth, rectHeight)
        ctx.setLineDash([])
      }
    }
    
    // Draw coordinates info
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(8, 8, 120, 24)
    ctx.fillStyle = '#fff'
    ctx.font = '12px monospace'
    ctx.fillText(`Size: ${width}x${height}`, 14, 24)
  }, [data, tileTypeLookup, tileSize, zoom, pan, showGrid, currentTile, isPanning, tool, isDrawing, drawStart, selectedTileId, width, height, canvasSize, interactive])
  
  // Trigger render on changes
  useEffect(() => {
    renderTilemap()
  }, [renderTilemap])
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      
      // Space for pan
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  const handleZoomIn = () => setZoom(prev => Math.min(4, prev + 0.25))
  const handleZoomOut = () => setZoom(prev => Math.max(0.25, prev - 0.25))
  const handleResetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }
  
  const getCursor = () => {
    if (isPanning) return 'grabbing'
    if (tool === TOOLS.PAN) return 'grab'
    if (tool === TOOLS.ERASER) return 'crosshair'
    if (tool === TOOLS.FILL) return 'cell'
    return 'crosshair'
  }
  
  return (
    <div ref={containerRef} className={`tilemap-canvas-container ${!interactive ? 'non-interactive' : ''}`}>
      {/* Controls */}
      <div className="canvas-controls">
        <button onClick={handleZoomOut} title="Zoom Out">➖</button>
        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomIn} title="Zoom In">➕</button>
        <button onClick={handleResetView} title="Reset View">🎯</button>
      </div>
      
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="tilemap-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsPanning(false)
          setIsDrawing(false)
          setCurrentTile(null)
        }}
        onWheel={handleWheel}
        style={{ cursor: getCursor() }}
      />
      
      {/* Coordinates display */}
      {currentTile && interactive && (
        <div className="tile-coords">
          Tile: ({currentTile.tileX}, {currentTile.tileY})
        </div>
      )}
    </div>
  )
}

export { TOOLS }
