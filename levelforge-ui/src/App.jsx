import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import './App.css'

// Genre options
const GENRES = [
  { id: 'platformer', name: 'Platformer', icon: '🎮' },
  { id: 'puzzle', name: 'Puzzle', icon: '🧩' },
  { id: 'shooter', name: 'Shooter', icon: '🔫' },
  { id: 'top_down_rpg', name: 'Top-Down RPG', icon: '🗺️' },
  { id: 'dungeon_crawler', name: 'Dungeon Crawler', icon: '🏰' },
]

// Difficulty options
const DIFFICULTIES = [
  { id: 'easy', name: 'Easy', color: '#4ade80' },
  { id: 'medium', name: 'Medium', color: '#facc15' },
  { id: 'hard', name: 'Hard', color: '#f97316' },
  { id: 'expert', name: 'Expert', color: '#ef4444' },
]

// Level type options
const LEVEL_TYPES = [
  { id: 'linear', name: 'Linear', description: 'Single path from start to goal' },
  { id: 'metroidvania', name: 'Metroidvania', description: 'Multiple paths with gating' },
]

// Entity rendering config
const ENTITY_STYLES = {
  player_spawn: { emoji: '🧑', color: '#22c55e' },
  goal: { emoji: '🚩', color: '#eab308' },
  coin: { emoji: '🪙', color: '#facc15' },
  key: { emoji: '🔑', color: '#a855f7' },
  enemy_basic: { emoji: '👾', color: '#ef4444' },
  enemy_flying: { emoji: '🦇', color: '#dc2626' },
  enemy_patrol: { emoji: '🤖', color: '#f97316' },
  spike: { emoji: '⚠️', color: '#6b7280' },
  lava: { emoji: '🔥', color: '#dc2626' },
  powerup: { emoji: '⭐', color: '#3b82f6' },
}

function LevelPreview({ level, isFullscreen, onClose }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 })

  // Calculate level bounds
  const levelBounds = useMemo(() => ({
    width: Math.max(800, ...(level?.platforms?.map(p => p.x + p.width) || [800])),
    height: Math.max(600, ...(level?.platforms?.map(p => p.y + (p.height || 20)) || [600]))
  }), [level])

  // Fit to screen on level change
  useEffect(() => {
    if (!level || !containerRef.current) return
    const container = containerRef.current
    const containerWidth = container.clientWidth - 32
    const containerHeight = isFullscreen ? window.innerHeight - 100 : 400
    
    const scaleX = containerWidth / levelBounds.width
    const scaleY = containerHeight / levelBounds.height
    const newScale = Math.min(scaleX, scaleY, 1) * 0.9
    
    setScale(newScale)
    setOffset({ 
      x: (containerWidth - levelBounds.width * newScale) / 2,
      y: (containerHeight - levelBounds.height * newScale) / 2
    })
    setCanvasSize({ width: containerWidth, height: containerHeight })
  }, [level, isFullscreen, levelBounds])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !level) return
    
    const ctx = canvas.getContext('2d')
    const { width, height } = canvasSize
    
    // Clear canvas
    ctx.fillStyle = '#1e1e2e'
    ctx.fillRect(0, 0, width, height)
    
    const scaledWidth = levelBounds.width * scale
    const scaledHeight = levelBounds.height * scale
    const offsetX = offset.x
    const offsetY = offset.y
    
    // Draw grid
    ctx.strokeStyle = '#2d2d3d'
    ctx.lineWidth = 1
    const gridSize = 50 * scale
    const gridStartX = offsetX % gridSize
    const gridStartY = offsetY % gridSize
    
    for (let x = gridStartX; x < width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = gridStartY; y < height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
    
    // Draw platforms
    ctx.fillStyle = '#475569'
    ctx.strokeStyle = '#64748b'
    ctx.lineWidth = 2
    level.platforms?.forEach(platform => {
      const x = offsetX + platform.x * scale
      const y = offsetY + platform.y * scale
      const w = platform.width * scale
      const h = (platform.height || 20) * scale
      
      ctx.fillRect(x, y, w, h)
      ctx.strokeRect(x, y, w, h)
    })
    
    // Draw entities with emojis
    ctx.font = `${Math.max(16, 24 * scale)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    level.entities?.forEach(entity => {
      const style = ENTITY_STYLES[entity.type] || { emoji: '❓', color: '#ffffff' }
      const x = offsetX + entity.x * scale
      const y = offsetY + entity.y * scale
      
      // Draw background circle
      ctx.fillStyle = style.color + '40'
      ctx.beginPath()
      ctx.arc(x, y, 16 * scale, 0, Math.PI * 2)
      ctx.fill()
      
      // Draw emoji
      ctx.fillStyle = style.color
      ctx.fillText(style.emoji, x, y)
    })
    
  }, [level, scale, offset, canvasSize, levelBounds])

  useEffect(() => {
    draw()
  }, [draw])

  // Mouse handlers for panning
  const handleMouseDown = (e) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e) => {
    e.preventDefault()
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(3, scale * zoomFactor))
    
    // Zoom toward mouse position
    const rect = canvasRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const newOffsetX = mouseX - (mouseX - offset.x) * (newScale / scale)
    const newOffsetY = mouseY - (mouseY - offset.y) * (newScale / scale)
    
    setScale(newScale)
    setOffset({ x: newOffsetX, y: newOffsetY })
  }

  const handleZoomIn = () => setScale(s => Math.min(3, s * 1.2))
  const handleZoomOut = () => setScale(s => Math.max(0.1, s / 1.2))
  const handleResetView = () => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.clientWidth - 32
    const containerHeight = isFullscreen ? window.innerHeight - 100 : 400
    const scaleX = containerWidth / levelBounds.width
    const scaleY = containerHeight / levelBounds.height
    const newScale = Math.min(scaleX, scaleY, 1) * 0.9
    setScale(newScale)
    setOffset({ 
      x: (containerWidth - levelBounds.width * newScale) / 2,
      y: (containerHeight - levelBounds.height * newScale) / 2
    })
  }

  return (
    <div className={`level-preview ${isFullscreen ? 'fullscreen' : ''}`} ref={containerRef}>
      <div className="preview-toolbar">
        <div className="zoom-controls">
          <button onClick={handleZoomOut} title="Zoom Out">➖</button>
          <span>{Math.round(scale * 100)}%</span>
          <button onClick={handleZoomIn} title="Zoom In">➕</button>
          <button onClick={handleResetView} title="Reset View">🎯</button>
        </div>
        <div className="preview-info">
          {levelBounds.width} × {levelBounds.height}
        </div>
        {isFullscreen && (
          <button className="close-btn" onClick={onClose}>✕ Close</button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  )
}

function App() {
  // Project state
  const [projects, setProjects] = useState([])
  const [currentProject, setCurrentProject] = useState(null)
  const [levels, setLevels] = useState([])
  
  // Form state
  const [genre, setGenre] = useState('platformer')
  const [difficulty, setDifficulty] = useState('medium')
  const [levelType, setLevelType] = useState('linear')
  const [theme, setTheme] = useState('')
  const [requirements, setRequirements] = useState('')
  
  // Generation state
  const [generating, setGenerating] = useState(false)
  const [level, setLevel] = useState(null)
  const [error, setError] = useState(null)
  
  // Preview state
  const [showPreview, setShowPreview] = useState(true)
  const [showJson, setShowJson] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // Refinement state
  const [modification, setModification] = useState('')
  const [refining, setRefining] = useState(false)
  
  // Load projects on mount
  useEffect(() => {
    loadProjects()
  }, [])
  
  // Load levels when project changes
  useEffect(() => {
    if (currentProject) {
      loadLevels(currentProject.id)
    }
  }, [currentProject])
  
  const loadProjects = async () => {
    try {
      const res = await fetch('http://192.168.68.72:8000/api/projects')
      const data = await res.json()
      setProjects(data)
    } catch (err) {
      console.error('Failed to load projects:', err)
    }
  }
  
  const loadLevels = async (projectId) => {
    try {
      const res = await fetch(`http://192.168.68.72:8000/api/projects/${projectId}/levels`)
      const data = await res.json()
      setLevels(data)
    } catch (err) {
      console.error('Failed to load levels:', err)
    }
  }
  
  const handleCreateProject = async () => {
    const name = prompt('Project name:')
    if (!name) return
    
    try {
      const res = await fetch(`http://192.168.68.72:8000/api/projects?name=${encodeURIComponent(name)}`, {
        method: 'POST'
      })
      const data = await res.json()
      await loadProjects()
      setCurrentProject({ id: data.id, name: data.name })
    } catch (err) {
      setError('Failed to create project')
    }
  }
  
  const handleSelectProject = (project) => {
    setCurrentProject(project)
    setLevel(null)
  }
  
  const handleSaveLevel = async () => {
    if (!currentProject || !level) return
    
    const name = prompt('Level name:', `Level ${levels.length + 1}`)
    if (!name) return
    
    try {
      await fetch(`http://192.168.68.72:8000/api/projects/${currentProject.id}/levels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          genre: level.genre || genre,
          difficulty: level.difficulty || difficulty,
          level_type: level.type || levelType,
          theme: level.theme || theme,
          level_data: JSON.stringify(level)
        })
      })
      await loadLevels(currentProject.id)
      alert('Level saved!')
    } catch (err) {
      setError('Failed to save level')
    }
  }
  
  const handleLoadLevel = async (levelId) => {
    try {
      const res = await fetch(`http://192.168.68.72:8000/api/levels/${levelId}`)
      const data = await res.json()
      setLevel(JSON.parse(data.level_data))
    } catch (err) {
      setError('Failed to load level')
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000) // 90s timeout
    
    try {
      const response = await fetch('http://192.168.68.72:8000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genre,
          difficulty,
          level_type: levelType,
          theme: theme || 'default',
          requirements: requirements || 'Create an engaging level'
        }),
        signal: controller.signal
      })
      
      if (!response.ok) {
        throw new Error('Generation failed')
      }
      
      const data = await response.json()
      setLevel(data.level)
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Generation timed out - try again')
      } else {
        setError(err.message || 'Failed to generate level')
      }
    } finally {
      clearTimeout(timeoutId)
      setGenerating(false)
    }
  }

  const handleRefine = async () => {
    if (!level || !modification.trim()) return
    
    setRefining(true)
    setError(null)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s timeout
    
    try {
      const response = await fetch('http://192.168.68.72:8000/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level_data: level,
          modification: modification
        }),
        signal: controller.signal
      })
      
      if (!response.ok) {
        throw new Error('Refinement failed')
      }
      
      const data = await response.json()
      setLevel(data.level)
      setModification('')
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Refinement timed out - try a simpler modification')
      } else {
        setError(err.message || 'Failed to refine level')
      }
    } finally {
      clearTimeout(timeoutId)
      setRefining(false)
    }
  }

  const handleExportJson = () => {
    if (!level) return
    const blob = new Blob([JSON.stringify(level, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `levelforge-${level.genre}-${level.difficulty}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🎮 LevelForge AI</h1>
        <p>AI-powered level design for game developers</p>
      </header>

      <main className="main">
        {/* Project Management */}
        <section className="project-panel">
          <div className="project-header">
            <h3>📁 Projects</h3>
            <button className="new-project-btn" onClick={handleCreateProject}>+ New Project</button>
          </div>
          
          {projects.length > 0 && (
            <div className="project-list">
              {projects.map(p => (
                <button
                  key={p.id}
                  className={`project-item ${currentProject?.id === p.id ? 'active' : ''}`}
                  onClick={() => handleSelectProject(p)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          
          {currentProject && (
            <div className="level-list">
              <h3>Levels in {currentProject.name}</h3>
              {levels.length === 0 ? (
                <p className="no-levels">No levels yet. Generate one below!</p>
              ) : (
                levels.map(l => (
                  <div key={l.id} className="level-item" onClick={() => handleLoadLevel(l.id)}>
                    <span className="level-name">{l.name}</span>
                    <span className="level-info">{l.genre} • {l.difficulty} • v{l.version}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        <section className="config-panel">
          <h2>Level Configuration</h2>
          
          <div className="form-group">
            <label>Genre</label>
            <div className="genre-grid">
              {GENRES.map(g => (
                <button
                  key={g.id}
                  className={`genre-btn ${genre === g.id ? 'active' : ''}`}
                  onClick={() => setGenre(g.id)}
                >
                  <span className="genre-icon">{g.icon}</span>
                  <span className="genre-name">{g.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Level Type</label>
            <div className="type-grid">
              {LEVEL_TYPES.map(t => (
                <button
                  key={t.id}
                  className={`type-btn ${levelType === t.id ? 'active' : ''}`}
                  onClick={() => setLevelType(t.id)}
                >
                  <span className="type-name">{t.name}</span>
                  <span className="type-desc">{t.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Difficulty</label>
            <div className="difficulty-row">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.id}
                  className={`difficulty-btn ${difficulty === d.id ? 'active' : ''}`}
                  style={{ 
                    '--active-color': d.color,
                    borderColor: difficulty === d.id ? d.color : 'transparent'
                  }}
                  onClick={() => setDifficulty(d.id)}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Theme (optional)</label>
            <input
              type="text"
              placeholder="e.g., forest, castle, space station..."
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Additional Requirements (optional)</label>
            <textarea
              placeholder="e.g., Include 5 coins, add a moving platform..."
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
            />
          </div>

          <button 
            className={`generate-btn ${generating ? 'loading' : ''}`}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? '🎲 Generating...' : '🚀 Generate Level'}
          </button>

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}
        </section>

        {level && (
          <section className="results-panel">
            <div className="results-header">
              <h2>Generated Level</h2>
              <div className="results-actions">
                <button onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? '🎨 Hide Preview' : '🎨 Show Preview'}
                </button>
                <button onClick={() => setIsFullscreen(!isFullscreen)}>
                  {isFullscreen ? '↙ Compact' : '⛶ Fullscreen'}
                </button>
                <button onClick={() => setShowJson(!showJson)}>
                  {showJson ? '📄 Hide JSON' : '📄 Show JSON'}
                </button>
                <button onClick={handleExportJson}>💾 Export JSON</button>
                {currentProject && (
                  <button onClick={handleSaveLevel}>💿 Save to Project</button>
                )}
              </div>
            </div>

            <div className="level-info">
              <span className="badge">{level.genre}</span>
              <span className="badge">{level.difficulty}</span>
              {level.theme && <span className="badge">{level.theme}</span>}
            </div>

            {showPreview && (
              <LevelPreview 
                level={level} 
                isFullscreen={isFullscreen}
                onClose={() => setIsFullscreen(false)}
              />
            )}

            {showJson && (
              <div className="preview-container">
                <pre className="json-preview">
                  {JSON.stringify(level, null, 2)}
                </pre>
              </div>
            )}

            <div className="level-stats">
              <div className="stat">
                <span className="stat-label">Platforms</span>
                <span className="stat-value">{level.platforms?.length || 0}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Entities</span>
                <span className="stat-value">{level.entities?.length || 0}</span>
              </div>
              {level.metadata?.difficulty_score && (
                <div className="stat">
                  <span className="stat-label">Difficulty</span>
                  <span className="stat-value">{level.metadata.difficulty_score}/10</span>
                </div>
              )}
            </div>
            
            <div className="legend">
              <span className="legend-item">🧑 Player</span>
              <span className="legend-item">🚩 Goal</span>
              <span className="legend-item">🪙 Coin</span>
              <span className="legend-item">🔑 Key</span>
              <span className="legend-item">👾 Enemy</span>
              <span className="legend-item">🔥 Hazard</span>
              <span className="legend-item">⭐ Powerup</span>
              <span className="legend-item">■ Platform</span>
            </div>
            
            {/* Refinement Section */}
            <div className="refine-section">
              <h3>✨ Refine Level</h3>
              <div className="refine-suggestions">
                <button onClick={() => setModification('Make the level harder')}>Make Harder</button>
                <button onClick={() => setModification('Add more platforms')}>Add Platforms</button>
                <button onClick={() => setModification('Add more coins')}>Add Coins</button>
                <button onClick={() => setModification('Add more enemies')}>Add Enemies</button>
                <button onClick={() => setModification('Make the level easier')}>Make Easier</button>
              </div>
              <div className="refine-input">
                <textarea
                  placeholder="Or describe your own modification..."
                  value={modification}
                  onChange={(e) => setModification(e.target.value)}
                  rows={2}
                />
                <button 
                  className={`refine-btn ${refining ? 'loading' : ''}`}
                  onClick={handleRefine}
                  disabled={refining || !modification.trim()}
                >
                  {refining ? '✨ Refining...' : '✨ Refine'}
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {isFullscreen && level && (
        <div className="fullscreen-overlay">
          <LevelPreview 
            level={level} 
            isFullscreen={true}
            onClose={() => setIsFullscreen(false)}
          />
        </div>
      )}
    </div>
  )
}

export default App
