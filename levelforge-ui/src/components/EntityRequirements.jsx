import { useState, useEffect } from 'react'
import './EntityRequirements.css'

// Preset templates for different level types
const PRESET_TEMPLATES = {
  beginner: {
    name: 'Beginner Level',
    icon: '🌱',
    description: 'Easy level with basic challenges',
    entities: [
      { count: 5, placement: 'evenly distributed' },
      { count: 3, placement: 'on wide platforms' },
      { count: 2, placement: 'after checkpoints' }
    ]
  },
  standard: {
    name: 'Standard Level',
    icon: '🎮',
    description: 'Balanced difficulty with variety',
    entities: [
      { count: 10, placement: 'throughout level' },
      { count: 5, placement: 'on platforms' },
      { count: 3, placement: 'near gaps' },
      { count: 2, placement: 'after hard sections' }
    ]
  },
  challenge: {
    name: 'Challenge Level',
    icon: '🔥',
    description: 'High difficulty with many obstacles',
    entities: [
      { count: 15, placement: 'everywhere' },
      { count: 8, placement: 'guarding coins' },
      { count: 6, placement: 'in tricky spots' },
      { count: 4, placement: 'sparsely' }
    ]
  },
  speedrun: {
    name: 'Speedrun Level',
    icon: '⚡',
    description: 'Fast-paced with clear paths',
    entities: [
      { count: 20, placement: 'along optimal path' },
      { count: 3, placement: 'rarely' },
      { count: 1, placement: 'at start' }
    ]
  },
  exploration: {
    name: 'Exploration Level',
    icon: '🗺️',
    description: 'Hidden secrets and rewards',
    entities: [
      { count: 25, placement: 'hidden in corners' },
      { count: 5, placement: 'in secret areas' },
      { count: 3, placement: 'rewarding exploration' }
    ]
  }
}

// Common placement patterns for auto-suggest
const PLACEMENT_SUGGESTIONS = [
  'evenly distributed',
  'throughout level',
  'near checkpoints',
  'after difficult sections',
  'on platforms',
  'in corners',
  'hidden areas',
  'along main path',
  'rewarding exploration',
  'guarding objectives',
  'sparsely placed',
  'clustered together',
  'alternating pattern'
]

export default function EntityRequirements({ 
  entityTypes, 
  requirements, 
  onRequirementsChange 
}) {
  const [newEntityType, setNewEntityType] = useState('')
  const [newCount, setNewCount] = useState(1)
  const [newPlacement, setNewPlacement] = useState('')
  const [showPresets, setShowPresets] = useState(false)
  const [showPlacementSuggestions, setShowPlacementSuggestions] = useState(null)
  const [savedPresets, setSavedPresets] = useState(() => {
    const saved = localStorage.getItem('levelforge-entity-presets')
    return saved ? JSON.parse(saved) : []
  })
  
  // Save presets to localStorage when they change
  useEffect(() => {
    localStorage.setItem('levelforge-entity-presets', JSON.stringify(savedPresets))
  }, [savedPresets])
  
  const handleAddRequirement = () => {
    if (!newEntityType) return
    
    const entity = entityTypes.find(e => e.id === parseInt(newEntityType))
    if (!entity) return
    
    const newReq = {
      id: Date.now(),
      entityId: entity.id,
      entityName: entity.name,
      entityEmoji: entity.emoji,
      count: newCount,
      placement: newPlacement || 'distributed throughout level'
    }
    
    onRequirementsChange([...requirements, newReq])
    setNewEntityType('')
    setNewCount(1)
    setNewPlacement('')
  }
  
  const handleRemoveRequirement = (id) => {
    onRequirementsChange(requirements.filter(r => r.id !== id))
  }
  
  const handleUpdateRequirement = (id, field, value) => {
    onRequirementsChange(requirements.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    ))
  }
  
  const handleApplyPreset = (presetKey) => {
    const preset = PRESET_TEMPLATES[presetKey]
    if (!preset || entityTypes.length === 0) return
    
    // Map preset entities to actual entity types from the project
    const newReqs = preset.entities.map((presetEntity, index) => {
      // Cycle through available entity types
      const entityType = entityTypes[index % entityTypes.length]
      return {
        id: Date.now() + index,
        entityId: entityType.id,
        entityName: entityType.name,
        entityEmoji: entityType.emoji,
        count: presetEntity.count,
        placement: presetEntity.placement
      }
    })
    
    onRequirementsChange(newReqs)
    setShowPresets(false)
  }
  
  const handleSaveAsPreset = () => {
    if (requirements.length === 0) return
    
    const name = prompt('Save preset as:', 'My Custom Preset')
    if (!name) return
    
    const newPreset = {
      id: Date.now(),
      name,
      requirements: requirements.map(r => ({
        entityId: r.entityId,
        count: r.count,
        placement: r.placement
      }))
    }
    
    setSavedPresets([...savedPresets, newPreset])
  }
  
  const handleLoadSavedPreset = (preset) => {
    const newReqs = preset.requirements.map((req, index) => {
      const entity = entityTypes.find(e => e.id === req.entityId)
      if (!entity) return null
      
      return {
        id: Date.now() + index,
        entityId: entity.id,
        entityName: entity.name,
        entityEmoji: entity.emoji,
        count: req.count,
        placement: req.placement
      }
    }).filter(Boolean)
    
    onRequirementsChange(newReqs)
    setShowPresets(false)
  }
  
  const handleDeleteSavedPreset = (presetId) => {
    setSavedPresets(savedPresets.filter(p => p.id !== presetId))
  }
  
  const handleApplyPlacementSuggestion = (reqId, suggestion) => {
    handleUpdateRequirement(reqId, 'placement', suggestion)
    setShowPlacementSuggestions(null)
  }
  
  const clearAll = () => {
    onRequirementsChange([])
  }
  
  return (
    <div className="entity-requirements">
      <div className="requirements-header">
        <div className="header-row">
          <h3>Entity Requirements</h3>
          <div className="header-actions">
            <button 
              className="btn-preset"
              onClick={() => setShowPresets(!showPresets)}
            >
              📋 Presets
            </button>
            {requirements.length > 0 && (
              <button 
                className="btn-clear"
                onClick={clearAll}
              >
                🗑️ Clear All
              </button>
            )}
          </div>
        </div>
        <span className="hint">Specify entities to include in the generated level</span>
      </div>
      
      {/* Presets Panel */}
      {showPresets && (
        <div className="presets-panel">
          <div className="presets-section">
            <h4>Quick Templates</h4>
            <div className="preset-grid">
              {Object.entries(PRESET_TEMPLATES).map(([key, preset]) => (
                <button
                  key={key}
                  className="preset-card"
                  onClick={() => handleApplyPreset(key)}
                >
                  <span className="preset-icon">{preset.icon}</span>
                  <span className="preset-name">{preset.name}</span>
                  <span className="preset-desc">{preset.description}</span>
                </button>
              ))}
            </div>
          </div>
          
          {savedPresets.length > 0 && (
            <div className="presets-section">
              <h4>Saved Presets</h4>
              <div className="saved-presets-list">
                {savedPresets.map(preset => (
                  <div key={preset.id} className="saved-preset-item">
                    <span className="preset-name">{preset.name}</span>
                    <button 
                      className="btn-load"
                      onClick={() => handleLoadSavedPreset(preset)}
                    >
                      Load
                    </button>
                    <button 
                      className="btn-delete"
                      onClick={() => handleDeleteSavedPreset(preset.id)}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {requirements.length > 0 && (
            <div className="presets-section">
              <button 
                className="btn-save-preset"
                onClick={handleSaveAsPreset}
              >
                💾 Save Current as Preset
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Visual Preview */}
      {requirements.length > 0 && (
        <div className="visual-preview">
          <h4>Preview</h4>
          <div className="entity-preview-grid">
            {requirements.map(req => (
              <div key={req.id} className="preview-entity">
                <span className="preview-emoji">{req.entityEmoji}</span>
                <span className="preview-count">×{req.count}</span>
              </div>
            ))}
          </div>
          <div className="preview-summary">
            Total: {requirements.reduce((sum, r) => sum + r.count, 0)} entities
          </div>
        </div>
      )}
      
      {/* Requirements List */}
      {requirements.length > 0 && (
        <div className="requirements-list">
          {requirements.map(req => (
            <div key={req.id} className="requirement-item">
              <div className="req-entity">
                <span className="req-emoji">{req.entityEmoji}</span>
                <span className="req-name">{req.entityName}</span>
              </div>
              
              <div className="req-count">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={req.count}
                  onChange={(e) => handleUpdateRequirement(req.id, 'count', parseInt(e.target.value) || 1)}
                />
              </div>
              
              <div className="req-placement">
                <input
                  type="text"
                  placeholder="Placement details..."
                  value={req.placement}
                  onChange={(e) => handleUpdateRequirement(req.id, 'placement', e.target.value)}
                  onFocus={() => setShowPlacementSuggestions(req.id)}
                  onBlur={() => setTimeout(() => setShowPlacementSuggestions(null), 200)}
                />
                {showPlacementSuggestions === req.id && (
                  <div className="placement-suggestions">
                    {PLACEMENT_SUGGESTIONS.map(suggestion => (
                      <button
                        key={suggestion}
                        className="suggestion-item"
                        onClick={() => handleApplyPlacementSuggestion(req.id, suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <button 
                className="req-remove"
                onClick={() => handleRemoveRequirement(req.id)}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Add New Requirement */}
      <div className="add-requirement">
        <div className="add-row">
          <select 
            value={newEntityType}
            onChange={(e) => setNewEntityType(e.target.value)}
          >
            <option value="">Select entity type...</option>
            {entityTypes.map(entity => (
              <option key={entity.id} value={entity.id}>
                {entity.emoji} {entity.name}
              </option>
            ))}
          </select>
          
          <input
            type="number"
            min="1"
            max="100"
            value={newCount}
            onChange={(e) => setNewCount(parseInt(e.target.value) || 1)}
            placeholder="Count"
          />
          
          <input
            type="text"
            value={newPlacement}
            onChange={(e) => setNewPlacement(e.target.value)}
            placeholder="Placement (optional)"
          />
          
          <button 
            className="btn-add"
            onClick={handleAddRequirement}
            disabled={!newEntityType}
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  )
}

