import { useState } from 'react'
import './PlaceholderPages.css'

const AI_TOOLS = [
  { id: 'prompts', label: 'Prompt Editor', icon: '✍️' },
  { id: 'models', label: 'Model Settings', icon: '🔧' },
  { id: 'history', label: 'Generation History', icon: '📜' },
  { id: 'feedback', label: 'Quality Ratings', icon: '⭐' },
]

export default function AITools({ 
  availableModels, 
  selectedModel, 
  onModelChange,
  consoleLogs 
}) {
  const [activeTool, setActiveTool] = useState('prompts')
  const [promptText, setPromptText] = useState('')
  
  // Mock generation history
  const mockHistory = [
    { id: 1, time: '09:45', model: 'gpt-4o', genre: 'platformer', status: 'success' },
    { id: 2, time: '09:30', model: 'llama3.2', genre: 'puzzle', status: 'success' },
    { id: 3, time: '09:15', model: 'gpt-4o', genre: 'shooter', status: 'failed' },
  ]
  
  return (
    <div className="ai-tools-page">
      {/* Left Sub-Navigation */}
      <aside className="sub-nav">
        <div className="sub-nav-header">
          <h3>AI Tools</h3>
        </div>
        <nav className="sub-nav-list">
          {AI_TOOLS.map(tool => (
            <button
              key={tool.id}
              className={`sub-nav-item ${activeTool === tool.id ? 'active' : ''}`}
              onClick={() => setActiveTool(tool.id)}
            >
              <span className="sub-nav-icon">{tool.icon}</span>
              <span className="sub-nav-label">{tool.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      
      {/* Main Content */}
      <main className="main-area">
        {activeTool === 'prompts' && (
          <div className="prompt-editor">
            <div className="toolbar">
              <h2>Prompt Editor</h2>
              <div className="toolbar-right">
                <button className="btn-secondary">Load Template</button>
                <button className="btn-primary">Save Prompt</button>
              </div>
            </div>
            <div className="editor-area">
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Write your custom level generation prompt here...

Example:
Generate a medium-difficulty platformer level with:
- 10 platforms
- 5 enemies
- 3 collectible coins
- A checkpoint at the halfway point"
                className="prompt-textarea"
              />
            </div>
            <div className="prompt-suggestions">
              <h4>Suggestions</h4>
              <div className="suggestions-list">
                <button onClick={() => setPromptText(prev => prev + '\n- Include moving platforms') }>
                  + Moving platforms
                </button>
                <button onClick={() => setPromptText(prev => prev + '\n- Add a boss fight area') }>
                  + Boss fight
                </button>
                <button onClick={() => setPromptText(prev => prev + '\n- Include secret areas') }>
                  + Secret areas
                </button>
                <button onClick={() => setPromptText(prev => prev + '\n- Add environmental hazards') }>
                  + Hazards
                </button>
              </div>
            </div>
          </div>
        )}
        
        {activeTool === 'models' && (
          <div className="model-settings">
            <div className="toolbar">
              <h2>Model Settings</h2>
            </div>
            <div className="settings-form">
              <div className="form-group">
                <label>Active Model</label>
                <select value={selectedModel} onChange={(e) => onModelChange(e.target.value)}>
                  {availableModels && Object.entries(availableModels).map(([provider, models]) => (
                    models.map(m => (
                      <option key={m.name} value={m.name}>
                        {provider.toUpperCase()}: {m.display || m.name}
                      </option>
                    ))
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Temperature</label>
                <input type="range" min="0" max="100" defaultValue="70" />
                <span className="hint">Higher = more creative, Lower = more consistent</span>
              </div>
              <div className="form-group">
                <label>Max Tokens</label>
                <input type="number" defaultValue="2000" />
              </div>
              <div className="form-group">
                <label>Auto-fallback to Ollama</label>
                <label className="toggle">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-slider"></span>
                </label>
                <span className="hint">Automatically switch to local Ollama on rate limits</span>
              </div>
            </div>
          </div>
        )}
        
        {activeTool === 'history' && (
          <div className="generation-history">
            <div className="toolbar">
              <h2>Generation History</h2>
              <button className="btn-secondary">Clear History</button>
            </div>
            <table className="data-grid">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Model</th>
                  <th>Genre</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mockHistory.map(item => (
                  <tr key={item.id}>
                    <td>{item.time}</td>
                    <td>{item.model}</td>
                    <td>{item.genre}</td>
                    <td>
                      <span className={`status-badge ${item.status}`}>
                        {item.status === 'success' ? '✓' : '✗'}
                      </span>
                    </td>
                    <td>
                      <button className="action-btn">👁️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {activeTool === 'feedback' && (
          <div className="feedback-page">
            <div className="toolbar">
              <h2>Quality Ratings</h2>
            </div>
            <div className="empty-state">
              <div className="empty-icon">⭐</div>
              <h3>No ratings yet</h3>
              <p>Rate generated levels to improve AI quality over time.</p>
            </div>
          </div>
        )}
      </main>
      
      {/* Inspector */}
      <aside className="inspector">
        <div className="inspector-header">
          <h3>AI Status</h3>
        </div>
        <div className="inspector-content">
          <div className="status-section">
            <div className="status-item">
              <span className="status-label">Current Model</span>
              <span className="status-value">{selectedModel || 'None'}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Generations Today</span>
              <span className="status-value">12</span>
            </div>
            <div className="status-item">
              <span className="status-label">Success Rate</span>
              <span className="status-value success">92%</span>
            </div>
          </div>
          <div className="recent-activity">
            <h4>Recent Activity</h4>
            {consoleLogs && consoleLogs.length > 0 ? (
              <div className="activity-list">
                {consoleLogs.slice(-5).map((log, i) => (
                  <div key={i} className={`activity-item ${log.type}`}>
                    <span className="activity-time">{log.time}</span>
                    <span className="activity-msg">{log.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint">No recent activity</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
