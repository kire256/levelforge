import { useState, useEffect, useRef, useCallback } from 'react'
import LevelView from './LevelView'
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
  onViewModeChange
}) {
  const [viewMode, setViewMode] = useState(externalViewMode ?? 'canvas') // canvas | ai
  const [leftWidth, setLeftWidth] = useState(320)
  const isResizing = useRef(false)

  const [genre, setGenre] = useState('platformer')
  const [difficulty, setDifficulty] = useState('medium')
  const [theme, setTheme] = useState('')
  const [requirements, setRequirements] = useState('')

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

  const handleGenerate = () => {
    onGenerateLevel({
      genre,
      difficulty,
      theme: theme || 'default',
      requirements: requirements || 'Create an engaging level'
    })
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
              <h3>Project Levels</h3>
              <span>{levels.length}</span>
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
          </aside>

          <div className="resize-handle-vertical" onMouseDown={handleMouseDown} />

          <section className="levels-center">
            {viewMode === 'canvas' && (
              <div className="canvas-view">
                {currentLevel ? (
                  <LevelView level={currentLevel} mode="draft" />
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
