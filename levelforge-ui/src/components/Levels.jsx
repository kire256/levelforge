import { useState, useEffect } from 'react'
import './Levels.css'

// Genre options
const GENRES = [
  { id: 'platformer', name: 'Platformer', icon: '🎮' },
  { id: 'puzzle', name: 'Puzzle', icon: '🧩' },
  { id: 'shooter', name: 'Shooter', icon: '🔫' },
]

// Difficulty options
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
  onShowGeneratorChange
}) {
  const [viewMode, setViewMode] = useState('ai') // Default to AI view
  const [showGenerator, setShowGenerator] = useState(externalShowGenerator ?? false)
  
  // Generation settings
  const [genre, setGenre] = useState('platformer')
  const [difficulty, setDifficulty] = useState('medium')
  const [theme, setTheme] = useState('')
  const [requirements, setRequirements] = useState('')
  
  // Sync with external state
  useEffect(() => {
    if (externalShowGenerator !== undefined) {
      setShowGenerator(externalShowGenerator)
      if (externalShowGenerator) {
        setViewMode('ai')
      }
    }
  }, [externalShowGenerator])
  
  const handleGenerate = () => {
    onGenerateLevel({
      genre,
      difficulty,
      theme: theme || 'default',
      requirements: requirements || 'Create an engaging level'
    })
  }
  
  const handleShowGenerator = () => {
    setShowGenerator(true)
    setViewMode('ai')
    onShowGeneratorChange && onShowGeneratorChange(true)
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
      {/* Main Content */}
      <main className="main-area">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="toolbar-left">
            <h2>🗺 Levels</h2>
            <span className="project-name">{currentProject.name}</span>
          </div>
          <div className="toolbar-right">
            <div className="view-toggle">
              <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>📋 List</button>
              <button className={viewMode === 'canvas' ? 'active' : ''} onClick={() => setViewMode('canvas')}>🎨 Canvas</button>
              <button className={viewMode === 'ai' ? 'active' : ''} onClick={() => setViewMode('ai')}>🤖 AI</button>
            </div>
          </div>
        </div>
        
        {/* Model Selector */}
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
        
        {/* Content based on view mode */}
        {viewMode === 'list' && (
          <div className="levels-list-container">
            {levels.length === 0 ? (
              <div className="empty-levels">
                <div className="empty-icon">🗺</div>
                <h3>No levels yet</h3>
                <p>Generate your first level using the AI panel.</p>
                <button className="btn-primary" onClick={() => setViewMode('ai')}>
                  🤖 Switch to AI View
                </button>
              </div>
            ) : (
              <table className="data-grid">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Genre</th>
                    <th>Difficulty</th>
                    <th>Version</th>
                    <th>Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {levels.map(level => (
                    <tr 
                      key={level.id} 
                      className={currentLevel?.id === level.id ? 'selected' : ''}
                      onClick={() => onSelectLevel(level)}
                    >
                      <td><strong>{level.name}</strong></td>
                      <td>{level.genre}</td>
                      <td>
                        <span className={`diff-badge ${level.difficulty}`}>
                          {level.difficulty}
                        </span>
                      </td>
                      <td>v{level.version}</td>
                      <td>{new Date(level.updated_at).toLocaleDateString()}</td>
                      <td className="col-actions">
                        <button className="action-btn">👁️</button>
                        <button className="action-btn">🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        
        {viewMode === 'canvas' && (
          <div className="canvas-view">
            {currentLevel ? (
              <div className="canvas-placeholder">
                <div className="canvas-header-bar">
                  <h3>{currentLevel.name}</h3>
                  <div className="canvas-tools">
                    <button className="tool-btn">🖱️ Select</button>
                    <button className="tool-btn">✏️ Draw</button>
                    <button className="tool-btn">📦 Place</button>
                    <button className="tool-btn">🗑️ Erase</button>
                  </div>
                </div>
                <div className="canvas-area">
                  <p className="hint">Canvas editor coming soon...</p>
                  <p>Drag and drop entities, pan/zoom, and edit level layout.</p>
                </div>
              </div>
            ) : (
              <div className="no-selection">
                <div className="empty-icon">🎨</div>
                <h3>No Level Selected</h3>
                <p>Select a level from the list or generate a new one.</p>
                <button className="btn-primary" onClick={() => setViewMode('ai')}>
                  🤖 Generate Level
                </button>
              </div>
            )}
          </div>
        )}
        
        {viewMode === 'ai' && (
          <div className="ai-generation-view">
            {/* Progress Bar */}
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
            
            {/* Generation Form */}
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
              
              <button 
                className="generate-btn"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? '🎲 Generating...' : '🚀 Generate Level'}
              </button>
            </div>
            
            {/* Quick Suggestions */}
            <div className="suggestions-section">
              <h4>Quick Add</h4>
              <div className="suggestions-list">
                <button className="suggestion" onClick={() => setRequirements(prev => prev + (prev ? '\n' : '') + 'Include 3 moving platforms')}>
                  🎯 Moving platforms
                </button>
                <button className="suggestion" onClick={() => setRequirements(prev => prev + (prev ? '\n' : '') + 'Add a boss fight area')}>
                  👹 Boss fight
                </button>
                <button className="suggestion" onClick={() => setRequirements(prev => prev + (prev ? '\n' : '') + 'Include secret areas with coins')}>
                  🪙 Secret areas
                </button>
                <button className="suggestion" onClick={() => setRequirements(prev => prev + (prev ? '\n' : '') + 'Add environmental hazards')}>
                  ⚠️ Hazards
                </button>
                <button className="suggestion" onClick={() => setRequirements(prev => prev + (prev ? '\n' : '') + 'Add checkpoints')}>
                  🚩 Checkpoints
                </button>
                <button className="suggestion" onClick={() => setRequirements(prev => prev + (prev ? '\n' : '') + 'Include power-ups')}>
                  ⭐ Power-ups
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
