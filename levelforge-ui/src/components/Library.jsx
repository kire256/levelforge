import { useState } from 'react'
import './PlaceholderPages.css'

// Common entity emojis for Library assets
const ASSET_TYPES = [
  { id: 'textures', label: 'Textures', icon: '🎨' },
  { id: 'models', label: 'Models', icon: '🧊' },
  { id: 'audio', label: 'Audio', icon: '🎵' },
  { id: 'scripts', label: 'Scripts', icon: '📜' },
  { id: 'templates', label: 'AI Templates', icon: '🤖' },
]

export default function Library({ currentProject, onSelectAsset, selectedAsset }) {
  const [activeCategory, setActiveCategory] = useState('textures')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Mock assets for demo
  const mockAssets = {
    textures: [
      { id: 1, name: 'Grass Tile', type: 'png', size: '64x64', category: 'textures' },
      { id: 2, name: 'Stone Wall', type: 'png', size: '64x64', category: 'textures' },
      { id: 3, name: 'Water Surface', type: 'png', size: '64x64', category: 'textures' },
    ],
    models: [
      { id: 4, name: 'Player Character', type: 'glb', vertices: 1200, category: 'models' },
      { id: 5, name: 'Enemy Slime', type: 'glb', vertices: 300, category: 'models' },
    ],
    audio: [
      { id: 6, name: 'Jump Sound', type: 'wav', duration: '0.5s', category: 'audio' },
      { id: 7, name: 'Coin Collect', type: 'wav', duration: '0.3s', category: 'audio' },
    ],
    scripts: [
      { id: 8, name: 'Player Controller', type: 'js', lines: 150, category: 'scripts' },
      { id: 9, name: 'Enemy AI', type: 'js', lines: 80, category: 'scripts' },
    ],
    templates: [
      { id: 10, name: 'Forest Level', type: 'prompt', tokens: 120, category: 'templates' },
      { id: 11, name: 'Dungeon Room', type: 'prompt', tokens: 85, category: 'templates' },
    ],
  }
  
  const assets = mockAssets[activeCategory] || []
  
  const handleAssetClick = (asset) => {
    const assetWithType = { ...asset, typeLabel: 'Asset' }
    onSelectAsset && onSelectAsset(assetWithType)
  }
  
  if (!currentProject) {
    return (
      <div className="placeholder-page">
        <div className="no-project-state">
          <div className="empty-icon">📚</div>
          <h2>No Project Selected</h2>
          <p>Select a project from the Dashboard to manage assets.</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="library-page">
      {/* Left Sub-Navigation */}
      <aside className="sub-nav">
        <div className="sub-nav-header">
          <h3>Asset Types</h3>
        </div>
        <nav className="sub-nav-list">
          {ASSET_TYPES.map(cat => (
            <button
              key={cat.id}
              className={`sub-nav-item ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span className="sub-nav-icon">{cat.icon}</span>
              <span className="sub-nav-label">{cat.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      
      {/* Main Content */}
      <main className="main-area">
        <div className="toolbar">
          <div className="toolbar-left">
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="toolbar-right">
            <button className="btn-secondary">Import</button>
            <button className="btn-primary">+ Upload Asset</button>
          </div>
        </div>
        
        <div className="data-grid-container">
          {assets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{ASSET_TYPES.find(t => t.id === activeCategory)?.icon}</div>
              <h3>No {activeCategory} yet</h3>
              <p>Upload or import assets to use in your levels.</p>
            </div>
          ) : (
            <table className="data-grid">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Details</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {assets.map(asset => (
                  <tr 
                    key={asset.id}
                    className={selectedAsset?.id === asset.id ? 'selected' : ''}
                    onClick={() => handleAssetClick(asset)}
                  >
                    <td><strong>{asset.name}</strong></td>
                    <td><span className="badge">{asset.type}</span></td>
                    <td>{asset.size || asset.vertices || asset.duration || asset.lines || asset.tokens}</td>
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
      </main>
    </div>
  )
}
