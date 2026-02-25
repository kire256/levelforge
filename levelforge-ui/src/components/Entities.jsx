import { useState, useRef, useCallback, useEffect } from 'react'
import './Entities.css'

// Sub-categories for entities
const ENTITY_CATEGORIES = [
  { id: 'actors', label: 'Actors', icon: '👤' },
  { id: 'items', label: 'Items', icon: '📦' },
  { id: 'terrain', label: 'Terrain', icon: '🏔️' },
  { id: 'behaviors', label: 'AI Behaviors', icon: '🧠' },
  { id: 'scripts', label: 'Scripts', icon: '📜' },
]

// Common entity emojis
const ENTITY_EMOJIS = [
  '🧑', '🚩', '🪙', '🔑', '💎', '⭐', '❤️', '💜', '🛡️',
  '👾', '🦇', '🤖', '👻', '💀', '🕷️', '🐉', '👹', '👿',
  '⚠️', '🔥', '💧', '❄️', '⚡', '💨', '☀️', '🌙', '🌀',
  '📦', '🪨', '🌳', '🍄', '🌸', '🍀', '🌊', '⛰️', '🌋',
  '⚔️', '🏹', '🔮', '📜', '🎁', '🏆', '🔔', '💣', '🧪'
]

const METADATA_TYPES = ['text', 'number', 'boolean', 'select']

export default function Entities({ 
  entityTypes, 
  currentProject,
  onCreateEntityType,
  onUpdateEntityType,
  onDeleteEntityType,
  onSelectEntity,
  onEditEntity,
  selectedEntity
}) {
  const [activeCategory, setActiveCategory] = useState('actors')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Panel width
  const [leftWidth, setLeftWidth] = useState(180)
  
  // Resize state
  const isResizingLeft = useRef(false)
  const containerRef = useRef(null)
  
  const filteredEntities = entityTypes.filter(et => 
    et.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  // Resize handlers
  const handleLeftMouseDown = useCallback((e) => {
    e.preventDefault()
    isResizingLeft.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])
  
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return
      
      const containerRect = containerRef.current.getBoundingClientRect()
      
      if (isResizingLeft.current) {
        const newWidth = e.clientX - containerRect.left
        setLeftWidth(Math.max(140, Math.min(280, newWidth)))
      }
    }
    
    const handleMouseUp = () => {
      if (isResizingLeft.current) {
        isResizingLeft.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])
  
  const handleCreate = () => {
    // Create new entity with defaults - could also use inspector in future
    onCreateEntityType({
      name: 'New Entity',
      emoji: '📦',
      color: '#6366f1',
      description: '',
      placement_rules: '',
      behavior: '',
      collision_type: 'neutral',
      category: activeCategory,
      metadata_fields: '[]'
    })
  }
  
  const handleEdit = (entity) => {
    onEditEntity && onEditEntity(entity)
  }
  
  if (!currentProject) {
    return (
      <div className="entities-page">
        <div className="no-project-state">
          <div className="empty-icon">📁</div>
          <h2>No Project Selected</h2>
          <p>Select or create a project from the Dashboard to manage entities.</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="entities-page" ref={containerRef}>
      {/* Left Sub-Navigation */}
      <aside className="sub-nav" style={{ width: leftWidth, minWidth: 140, maxWidth: 280 }}>
        <div className="sub-nav-header">
          <h3>Categories</h3>
        </div>
        <nav className="sub-nav-list">
          {ENTITY_CATEGORIES.map(cat => (
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
      
      {/* Left resize handle */}
      <div className="resize-handle-vertical" onMouseDown={handleLeftMouseDown} />
      
      {/* Main Content Area */}
      <main className="main-area">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="toolbar-left">
            <input
              type="text"
              placeholder="Search entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="toolbar-right">
            <button className="btn-secondary">Import</button>
            <button className="btn-primary" onClick={handleCreate}>+ Create Entity</button>
          </div>
        </div>
        
        {/* Data Grid */}
        <div className="data-grid-container">
          {filteredEntities.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🧬</div>
              <h3>No entities yet</h3>
              <p>Create custom entity types to use in your levels.</p>
              <button className="btn-primary" onClick={handleCreate}>+ Create First Entity</button>
            </div>
          ) : (
            <table className="data-grid">
              <thead>
                <tr>
                  <th className="col-icon"></th>
                  <th className="col-name">Name</th>
                  <th className="col-type">Type</th>
                  <th className="col-collision">Collision</th>
                  <th className="col-behavior">Behavior</th>
                  <th className="col-actions"></th>
                </tr>
              </thead>
              <tbody>
                {filteredEntities.map(entity => (
                  <tr 
                    key={entity.id} 
                    className={selectedEntity?.id === entity.id ? 'selected' : ''}
                    onClick={() => {
                      setSelectedEntity && onSelectEntity(entity)
                    }}
                  >
                    <td className="col-icon">
                      <span className="entity-icon" style={{ background: entity.color + '20' }}>
                        {entity.emoji}
                      </span>
                    </td>
                    <td className="col-name">
                      <strong>{entity.name}</strong>
                    </td>
                    <td className="col-type">{entity.category || 'actors'}</td>
                    <td className="col-collision">
                      <span className={`badge badge-${entity.collision_type}`}>
                        {entity.collision_type}
                      </span>
                    </td>
                    <td className="col-behavior">
                      <span className="truncate">{entity.behavior || '-'}</span>
                    </td>
                    <td className="col-actions">
                      <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleEdit(entity) }}>
                        ✏️
                      </button>
                      <button className="action-btn danger" onClick={(e) => { e.stopPropagation(); onDeleteEntityType(entity.id) }}>
                        🗑️
                      </button>
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
