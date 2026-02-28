import { useState, useEffect } from 'react'
import TileTypeManager from './TileTypeManager'
import './Settings.css'

export default function Settings({ 
  currentProject,
  availableModels,
  selectedModel,
  onModelChange,
  onUpdateProject,
  theme,
  accentColor,
  onThemeChange,
  onAccentChange
}) {
  const [activeSection, setActiveSection] = useState('project')
  const [tileTypes, setTileTypes] = useState([])
  const [tileSize, setTileSize] = useState(32)
  const [savingTileSize, setSavingTileSize] = useState(false)
  
  const sections = [
    { id: 'project', label: 'Project', icon: '📁' },
    { id: 'tiles', label: 'Tile Types', icon: '🟫' },
    { id: 'ai', label: 'AI Settings', icon: '🤖' },
    { id: 'ui', label: 'UI & Themes', icon: '🎨' },
    { id: 'export', label: 'Export', icon: '📤' },
  ]
  
  // Load tile types when project changes
  useEffect(() => {
    if (currentProject) {
      loadTileTypes()
      setTileSize(currentProject.tile_size || 32)
    }
  }, [currentProject])
  
  const loadTileTypes = async () => {
    if (!currentProject) return
    try {
      const res = await fetch(`http://192.168.68.72:8000/api/projects/${currentProject.id}/tile-types`)
      const data = await res.json()
      setTileTypes(data)
    } catch (err) {
      console.error('Failed to load tile types:', err)
    }
  }
  
  const handleTileSizeChange = async (newSize) => {
    setTileSize(newSize)
    if (!currentProject) return
    
    setSavingTileSize(true)
    try {
      const res = await fetch(`http://192.168.68.72:8000/api/projects/${currentProject.id}/tile-size`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tile_size: newSize })
      })
      if (!res.ok) throw new Error('Failed to update tile size')
    } catch (err) {
      console.error('Failed to update tile size:', err)
    } finally {
      setSavingTileSize(false)
    }
  }
  
  const themes = [
    { id: 'dark', label: 'Dark', icon: '🌙' },
    { id: 'light', label: 'Light', icon: '☀️' },
    { id: 'system', label: 'System', icon: '💻' },
  ]
  
  const accents = [
    { id: 'indigo', color: '#6366f1', label: 'Indigo' },
    { id: 'purple', color: '#a855f7', label: 'Purple' },
    { id: 'green', color: '#22c55e', label: 'Green' },
    { id: 'orange', color: '#f97316', label: 'Orange' },
    { id: 'red', color: '#ef4444', label: 'Red' },
  ]
  
  const handleThemeChange = (newTheme) => {
    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      onThemeChange(prefersDark ? 'dark' : 'light')
    } else {
      onThemeChange(newTheme)
    }
  }
  
  return (
    <div className="settings-page">
      <header className="page-header">
        <h1>Settings</h1>
      </header>
      
      <div className="settings-layout">
        {/* Sidebar */}
        <nav className="settings-nav">
          {sections.map(s => (
            <button
              key={s.id}
              className={`nav-item ${activeSection === s.id ? 'active' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              <span className="nav-icon">{s.icon}</span>
              <span className="nav-label">{s.label}</span>
            </button>
          ))}
        </nav>
        
        {/* Content */}
        <div className="settings-content">
          {activeSection === 'project' && (
            <section className="settings-section">
              <h2>Project Settings</h2>
              {currentProject ? (
                <div className="settings-form">
                  <div className="field">
                    <label>Project Name</label>
                    <input type="text" defaultValue={currentProject.name} />
                  </div>
                  <div className="field">
                    <label>Description</label>
                    <textarea defaultValue={currentProject.description || ''} rows={3} />
                  </div>
                  <div className="field">
                    <label>Created</label>
                    <span className="info">{new Date(currentProject.created_at).toLocaleString()}</span>
                  </div>
                  <button className="save-btn">Save Changes</button>
                </div>
              ) : (
                <p className="no-project">No project selected. Choose a project from the Dashboard.</p>
              )}
            </section>
          )}
          
          {activeSection === 'tiles' && (
            <section className="settings-section tile-settings">
              <h2>Tile Settings</h2>
              {currentProject ? (
                <>
                  <div className="settings-form">
                    <div className="field">
                      <label>Tile Size (pixels)</label>
                      <div className="tile-size-options">
                        {[16, 24, 32, 48, 64].map(size => (
                          <button
                            key={size}
                            className={`tile-size-btn ${tileSize === size ? 'active' : ''}`}
                            onClick={() => handleTileSizeChange(size)}
                            disabled={savingTileSize}
                          >
                            {size}px
                          </button>
                        ))}
                      </div>
                      <span className="hint">Grid size for tilemaps in this project</span>
                    </div>
                  </div>
                  
                  <div className="tile-types-section">
                    <h3>Tile Types</h3>
                    <p className="section-desc">
                      Define tile types for your project's tilemaps. Each tile type has properties like color, collision, and friction.
                    </p>
                    <TileTypeManager
                      projectId={currentProject.id}
                      tileTypes={tileTypes}
                      onRefresh={loadTileTypes}
                    />
                  </div>
                </>
              ) : (
                <p className="no-project">No project selected. Choose a project from the Dashboard.</p>
              )}
            </section>
          )}
          
          {activeSection === 'ai' && (
            <section className="settings-section">
              <h2>AI Settings</h2>
              <div className="settings-form">
                <div className="field">
                  <label>Default AI Model</label>
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
                
                <div className="field">
                  <label>Generation Timeout</label>
                  <input type="number" defaultValue={90} />
                  <span className="hint">Seconds before generation times out</span>
                </div>
                
                <div className="field">
                  <label>Auto-save Levels</label>
                  <label className="toggle">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </section>
          )}
          
          {activeSection === 'ui' && (
            <section className="settings-section">
              <h2>UI & Themes</h2>
              <div className="settings-form">
                <div className="field">
                  <label>Theme</label>
                  <div className="theme-options">
                    {themes.map(t => (
                      <button 
                        key={t.id}
                        className={`theme-btn ${theme === t.id ? 'active' : ''}`}
                        onClick={() => handleThemeChange(t.id)}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                  <span className="hint">Choose your preferred color scheme</span>
                </div>
                
                <div className="field">
                  <label>Accent Color</label>
                  <div className="color-options">
                    {accents.map(a => (
                      <button 
                        key={a.id}
                        className={`color-btn ${accentColor === a.id ? 'active' : ''}`}
                        style={{ background: a.color }}
                        onClick={() => onAccentChange(a.id)}
                        title={a.label}
                      />
                    ))}
                  </div>
                  <span className="hint">Accent color for buttons, links, and highlights</span>
                </div>
                
                <div className="field">
                  <label>Font Size</label>
                  <select defaultValue="medium">
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                  <span className="hint">Adjust the base font size for better readability</span>
                </div>
                
                <div className="field">
                  <label>Compact Mode</label>
                  <label className="toggle">
                    <input type="checkbox" />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className="hint">Reduce spacing and padding for more content</span>
                </div>
              </div>
            </section>
          )}
          
          {activeSection === 'export' && (
            <section className="settings-section">
              <h2>Export Settings</h2>
              <div className="settings-form">
                <div className="field">
                  <label>Default Export Format</label>
                  <select defaultValue="json">
                    <option value="json">JSON</option>
                    <option value="yaml">YAML</option>
                    <option value="xml">XML</option>
                  </select>
                </div>
                
                <div className="field">
                  <label>Include Metadata</label>
                  <label className="toggle">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className="hint">Include project and version info in exports</span>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
