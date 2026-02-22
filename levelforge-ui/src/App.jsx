import { useState } from 'react'
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

function App() {
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
  const [showPreview, setShowPreview] = useState(false)

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    
    try {
      // Call the backend API
      const response = await fetch('http://localhost:8000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genre,
          difficulty,
          level_type: levelType,
          theme: theme || 'default',
          requirements: requirements || 'Create an engaging level'
        })
      })
      
      if (!response.ok) {
        throw new Error('Generation failed')
      }
      
      const data = await response.json()
      setLevel(data.level)
    } catch (err) {
      setError(err.message || 'Failed to generate level')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🎮 LevelForge AI</h1>
        <p>AI-powered level design for game developers</p>
      </header>

      <main className="main">
        <section className="config-panel">
          <h2>Level Configuration</h2>
          
          {/* Genre Selection */}
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

          {/* Level Type */}
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

          {/* Difficulty */}
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

          {/* Theme */}
          <div className="form-group">
            <label>Theme (optional)</label>
            <input
              type="text"
              placeholder="e.g., forest, castle, space station..."
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            />
          </div>

          {/* Requirements */}
          <div className="form-group">
            <label>Additional Requirements (optional)</label>
            <textarea
              placeholder="e.g., Include 5 coins, add a moving platform..."
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
            />
          </div>

          {/* Generate Button */}
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

        {/* Results Panel */}
        {level && (
          <section className="results-panel">
            <div className="results-header">
              <h2>Generated Level</h2>
              <div className="results-actions">
                <button onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? '👁️ Hide Preview' : '👁️ Show Preview'}
                </button>
                <button>💾 Export JSON</button>
                <button>📄 Export ASCII</button>
              </div>
            </div>

            <div className="level-info">
              <span className="badge">{level.genre}</span>
              <span className="badge">{level.difficulty}</span>
              {level.theme && <span className="badge">{level.theme}</span>}
            </div>

            {showPreview && (
              <div className="preview-container">
                {/* ASCII Preview */}
                <pre className="ascii-preview">
                  {JSON.stringify(level.platforms, null, 2)}
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
          </section>
        )}
      </main>
    </div>
  )
}

export default App
