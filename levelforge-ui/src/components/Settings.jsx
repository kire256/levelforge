import { useState, useEffect } from 'react'
import TileTypeManager from './TileTypeManager'
import './Settings.css'
import { API_BASE } from '../utils/api'

const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🟢',
    placeholder: 'sk-...',
    hint: 'Get your key at platform.openai.com',
    models: 'GPT-4o, GPT-4o Mini, GPT-4 Turbo, o3 Mini',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🟠',
    placeholder: 'sk-ant-...',
    hint: 'Get your key at console.anthropic.com',
    models: 'Claude Opus 4.6, Claude Sonnet 4.6, Claude Haiku 4.5',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '🔵',
    placeholder: 'AIza...',
    hint: 'Get your key at aistudio.google.com',
    models: 'Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash',
  },
  {
    id: 'grok',
    name: 'xAI Grok',
    icon: '⚫',
    placeholder: 'xai-...',
    hint: 'Get your key at console.x.ai',
    models: 'Grok 2, Grok 2 Mini',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '🐋',
    placeholder: 'sk-...',
    hint: 'Get your key at platform.deepseek.com',
    models: 'DeepSeek Chat, DeepSeek Reasoner',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    icon: '🌀',
    placeholder: '...',
    hint: 'Get your key at console.mistral.ai',
    models: 'Mistral Large, Mistral Small',
  },
  {
    id: 'zai',
    name: 'Z-AI (GLM)',
    icon: '🟣',
    placeholder: '...',
    hint: 'Get your key at open.bigmodel.cn',
    models: 'GLM-4 Plus, GLM-4 Flash',
  },
]

export default function Settings({
  currentProject,
  availableModels,
  selectedModel,
  onModelChange,
  onRefreshModels,
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

  // API key state
  const [apiKeyStatus, setApiKeyStatus] = useState({})
  const [keyInputs, setKeyInputs] = useState({})
  const [showKeys, setShowKeys] = useState({})
  const [ollamaUrl, setOllamaUrl] = useState('http://192.168.68.76:11434')
  const [savingKeys, setSavingKeys] = useState(false)
  const [keySaveMsg, setKeySaveMsg] = useState(null)

  const sections = [
    { id: 'project', label: 'Project', icon: '📁' },
    { id: 'tiles', label: 'Tile Types', icon: '🟫' },
    { id: 'ai', label: 'AI Settings', icon: '🤖' },
    { id: 'ui', label: 'UI & Themes', icon: '🎨' },
    { id: 'export', label: 'Export', icon: '📤' },
  ]

  useEffect(() => {
    if (currentProject) {
      loadTileTypes()
      setTileSize(currentProject.tile_size || 32)
    }
  }, [currentProject])

  useEffect(() => {
    if (activeSection === 'ai') {
      loadApiKeyStatus()
    }
  }, [activeSection])

  const loadApiKeyStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/keys`)
      if (!res.ok) return
      const data = await res.json()
      setApiKeyStatus(data)
      if (data.ollama_url?.value) setOllamaUrl(data.ollama_url.value)
    } catch (err) {
      console.error('Failed to load API key status:', err)
    }
  }

  const handleSaveKeys = async () => {
    setSavingKeys(true)
    setKeySaveMsg(null)

    const body = {}
    for (const provider of PROVIDERS) {
      const input = keyInputs[provider.id]
      if (input !== undefined) {
        body[provider.id] = input
      }
    }
    body.ollama_url = ollamaUrl

    try {
      const res = await fetch(`${API_BASE}/api/settings/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save')
      setKeyInputs({})
      await loadApiKeyStatus()
      if (onRefreshModels) await onRefreshModels()
      setKeySaveMsg({ type: 'success', text: 'API keys saved.' })
    } catch (err) {
      setKeySaveMsg({ type: 'error', text: 'Failed to save API keys.' })
    } finally {
      setSavingKeys(false)
    }
  }

  const handleClearKey = (providerId) => {
    setKeyInputs(prev => ({ ...prev, [providerId]: '' }))
  }

  const loadTileTypes = async () => {
    if (!currentProject) return
    try {
      const res = await fetch(`${API_BASE}/api/projects/${currentProject.id}/tile-types`)
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
      const res = await fetch(`${API_BASE}/api/projects/${currentProject.id}/tile-size`, {
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
            <section className="settings-section ai-section">
              <h2>AI Settings</h2>

              <div className="ai-subsection">
                <h3>API Keys</h3>
                <p className="section-desc">
                  Enter API keys for the AI providers you want to use. Keys are stored on the server.
                  Leave blank to keep an existing key unchanged. Click ✕ to clear a key.
                </p>

                <div className="provider-cards">
                  {PROVIDERS.map(provider => {
                    const status = apiKeyStatus[provider.id]
                    const isConfigured = status?.configured
                    const maskedKey = status?.masked_key
                    const inputVal = keyInputs[provider.id] ?? ''
                    const isVisible = showKeys[provider.id]
                    return (
                      <div key={provider.id} className={`provider-card ${isConfigured ? 'configured' : ''}`}>
                        <div className="provider-header">
                          <span className="provider-icon">{provider.icon}</span>
                          <div className="provider-info">
                            <span className="provider-name">{provider.name}</span>
                            <span className="provider-model-list">{provider.models}</span>
                          </div>
                          <span className={`provider-badge ${isConfigured ? 'badge-ok' : 'badge-missing'}`}>
                            {isConfigured ? '✓ Set' : 'Not set'}
                          </span>
                        </div>
                        <div className="provider-key-row">
                          <input
                            type={isVisible ? 'text' : 'password'}
                            className="key-input"
                            placeholder={isConfigured ? maskedKey : provider.placeholder}
                            value={inputVal}
                            onChange={e => setKeyInputs(prev => ({ ...prev, [provider.id]: e.target.value }))}
                            autoComplete="off"
                          />
                          <button
                            className="btn-icon-sm"
                            title={isVisible ? 'Hide key' : 'Show key'}
                            onClick={() => setShowKeys(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                          >
                            {isVisible ? '🙈' : '👁'}
                          </button>
                          {isConfigured && (
                            <button
                              className="btn-clear-key"
                              title="Clear key"
                              onClick={() => handleClearKey(provider.id)}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <span className="key-hint">{provider.hint}</span>
                      </div>
                    )
                  })}

                  {/* Ollama */}
                  <div className="provider-card ollama-card configured">
                    <div className="provider-header">
                      <span className="provider-icon">🦙</span>
                      <div className="provider-info">
                        <span className="provider-name">Ollama (Local)</span>
                        <span className="provider-model-list">Local models — no API key needed</span>
                      </div>
                      <span className="provider-badge badge-ok">✓ Local</span>
                    </div>
                    <div className="provider-key-row">
                      <input
                        type="text"
                        className="key-input"
                        placeholder="http://localhost:11434"
                        value={ollamaUrl}
                        onChange={e => setOllamaUrl(e.target.value)}
                      />
                    </div>
                    <span className="key-hint">URL of your local Ollama instance</span>
                  </div>
                </div>

                {keySaveMsg && (
                  <div className={`save-msg ${keySaveMsg.type}`}>{keySaveMsg.text}</div>
                )}

                <button className="save-btn" onClick={handleSaveKeys} disabled={savingKeys}>
                  {savingKeys ? 'Saving...' : 'Save API Keys'}
                </button>
              </div>

              <div className="ai-subsection">
                <h3>Default Model</h3>
                <p className="section-desc">
                  The model used for AI level generation. Only configured providers appear here.
                </p>
                <div className="settings-form">
                  <div className="field">
                    <select value={selectedModel} onChange={e => onModelChange(e.target.value)}>
                      {availableModels && Object.entries(availableModels).map(([provider, models]) =>
                        models.length > 0 && (
                          <optgroup key={provider} label={provider.toUpperCase()}>
                            {models.map(m => (
                              <option key={m.name} value={m.name}>
                                {m.display || m.name}
                              </option>
                            ))}
                          </optgroup>
                        )
                      )}
                    </select>
                    <span className="hint">
                      Save API keys and restart the server to unlock more providers.
                    </span>
                  </div>
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
