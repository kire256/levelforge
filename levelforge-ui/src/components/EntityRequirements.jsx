import { useState } from 'react'
import './EntityRequirements.css'

export default function EntityRequirements({ entityTypes,  requirements,
  onRequirementsChange }) {
  
  const [newEntityType, setNewEntityType] = useState('')
  const [newCount, setNewCount] = useState(1)
  const [newPlacement, setNewPlacement] = useState('')
  
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
  
  return (
    <div className="entity-requirements">
      <div className="requirements-header">
        <h4>Entity Requirements</h4>
        <span className="hint">Specify entities to include in the generated level</span>
      </div>
      
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
                />
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
            placeholder="Placement details (optional)"
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
