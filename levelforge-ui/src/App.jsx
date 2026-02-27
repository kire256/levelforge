import { useState, useEffect, useCallback } from 'react'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Entities from './components/Entities'
import Levels from './components/Levels'
import Library from './components/Library'
import AITools from './components/AITools'
import Settings from './components/Settings'
import { useUndoRedo } from './hooks/useUndoRedo'
import './App.css'

const API_BASE = 'http://192.168.68.72:8000'

function App() {
  // Navigation state
  const [activeTab, setActiveTab] = useState('dashboard')
  
  // Theme state
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('levelforge-theme')
    return saved || 'dark'
  })
  const [accentColor, setAccentColor] = useState(() => {
    const saved = localStorage.getItem('levelforge-accent')
    return saved || 'indigo'
  })
  
  // Apply theme on mount and changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-accent', accentColor)
    localStorage.setItem('levelforge-theme', theme)
    localStorage.setItem('levelforge-accent', accentColor)
  }, [theme, accentColor])
  
  // Project state
  const [projects, setProjects] = useState([])
  const [currentProject, setCurrentProject] = useState(null)
  const [levels, setLevels] = useState([])
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [levelViewMode, setLevelViewMode] = useState('ai') // 'list', 'canvas', or 'ai'
  const [recentProjects, setRecentProjects] = useState(() => {
    const saved = localStorage.getItem('levelforge-recent-projects')
    return saved ? JSON.parse(saved) : []
  })
  
  // Entity types state
  const [entityTypes, setEntityTypes] = useState([])
  
  // Selection state (for inspector)
  const [selectedItem, setSelectedItem] = useState(null)
  const [inspectorContent, setInspectorContent] = useState(null)
  const [selectedObject, setSelectedObject] = useState(null) // For level object selection
  
  // Console state
  const [consoleLogs, setConsoleLogs] = useState([])
  const [forceShowConsole, setForceShowConsole] = useState(false)
  
  // Generation state
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [currentLevel, setCurrentLevel] = useState(null)
  const [showGenerator, setShowGenerator] = useState(false)
  
  // Model state
  const [availableModels, setAvailableModels] = useState({})
  const [selectedModel, setSelectedModel] = useState('')
  
  // Undo/Redo state - track current level with history
  const {
    state: levelWithHistory,
    setState: setLevelWithHistory,
    undo: undoLevel,
    redo: redoLevel,
    canUndo,
    canRedo,
    getHistoryInfo
  } = useUndoRedo(currentLevel, { maxHistorySize: 50, debounceMs: 200 })
  
  // Use the historical state as the "display" level
  const displayLevel = levelWithHistory || currentLevel
  
  // Wrap setCurrentLevel to also update history
  const handleSetCurrentLevel = (level) => {
    setCurrentLevel(level)
    if (level) {
      setLevelWithHistory(level, true)
    }
  }
  
  // Handle undo - apply the historical state back to the actual level
  const handleUndo = useCallback(() => {
    if (!canUndo) return
    undoLevel()
    // displayLevel will automatically reflect the historical state
  }, [canUndo, undoLevel])
  
  // Sync selectedItem with displayLevel changes (from undo/redo)
  useEffect(() => {
    if (displayLevel && selectedItem?.type === 'Level' && selectedItem?.id === displayLevel?.id) {
      // Update selected item to reflect historical state
      setSelectedItem({ type: 'Level', ...displayLevel })
    }
  }, [displayLevel])
  
  // Console logging helper
  const logToConsole = (message, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false })
    setConsoleLogs(prev => [...prev, { message, type, time }])
    
    // Auto-show console on errors and AI progress
    if (type === 'error' || type === 'ai-progress') {
      setForceShowConsole(true)
    }
  }
  
  // Clear console
  const handleClearConsole = () => {
    setConsoleLogs([])
  }
  
  // Update object in level data
  const handleUpdateObject = useCallback(async (updatedObj) => {
    if (!updatedObj || !currentLevel) return
    
    // Parse current level data
    let levelData = null
    try {
      levelData = typeof currentLevel.level_data === 'string'
        ? JSON.parse(currentLevel.level_data)
        : currentLevel.level_data
    } catch {
      return
    }
    
    if (!levelData) return
    
    const { type, data, index, entityType } = updatedObj
    
    // Update the appropriate part of level data
    if (type === 'entity' && levelData.entities && index !== undefined) {
      levelData.entities[index] = { ...levelData.entities[index], ...data }
    } else if (type === 'platform' && levelData.platforms && index !== undefined) {
      levelData.platforms[index] = { ...levelData.platforms[index], ...data }
    } else if (type === 'spawn') {
      levelData.player_spawn = { ...levelData.player_spawn, ...data }
    } else if (type === 'goal') {
      levelData.goal = { ...levelData.goal, ...data }
    }
    
    // Save to backend
    try {
      const res = await fetch(`${API_BASE}/api/levels/${currentLevel.id}?level_data=${encodeURIComponent(JSON.stringify(levelData))}`, {
        method: 'PUT'
      })
      if (!res.ok) throw new Error('Failed to update level')
      
      // Update local state
      const updatedLevel = { ...currentLevel, level_data: JSON.stringify(levelData) }
      setCurrentLevel(updatedLevel)
      
      logToConsole(`Updated ${type} ${index !== undefined ? `#${index + 1}` : ''}`, 'info')
    } catch (err) {
      console.error('Update object failed:', err)
      logToConsole('Failed to update object', 'error')
    }
  }, [currentLevel, logToConsole])
  
  // Load projects and models on mount
  useEffect(() => {
    loadProjects()
    loadModels()
    logToConsole('LevelForge initialized', 'system')
  }, [])
  
  // Load levels and entity types when project changes
  useEffect(() => {
    if (currentProject) {
      loadLevels(currentProject.id)
      loadEntityTypes(currentProject.id)
      logToConsole(`Loaded project: ${currentProject.name}`, 'info')
    }
  }, [currentProject])
  
  // Clear selection when changing tabs
  useEffect(() => {
    setSelectedItem(null)
    setInspectorContent(null)
  }, [activeTab])
  
  // Force dashboard tab when no project is selected
  useEffect(() => {
    if (!currentProject && activeTab !== 'dashboard' && activeTab !== 'settings') {
      setActiveTab('dashboard')
    }
  }, [currentProject, activeTab])
  
  // API functions
  const loadProjects = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`)
      const data = await res.json()
      setProjects(data)
    } catch (err) {
      console.error('Failed to load projects:', err)
      logToConsole('Failed to load projects', 'error')
    }
  }
  
  const loadLevels = async (projectId) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/levels`)
      const data = await res.json()
      setLevels(data)
    } catch (err) {
      console.error('Failed to load levels:', err)
    }
  }
  
  const loadEntityTypes = async (projectId) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/entity-types`)
      const data = await res.json()
      setEntityTypes(data)
    } catch (err) {
      console.error('Failed to load entity types:', err)
    }
  }
  
  const loadModels = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/models`)
      const data = await res.json()
      if (data.providers) {
        setAvailableModels(data.providers)
        setSelectedModel(data.current || '')
        logToConsole(`AI model: ${data.current} (${data.current_provider})`, 'info')
      }
    } catch (err) {
      console.error('Failed to load models:', err)
    }
  }
  
  const handleModelChange = async (modelName) => {
    try {
      await fetch(`${API_BASE}/api/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName })
      })
      setSelectedModel(modelName)
      logToConsole(`Switched to model: ${modelName}`, 'info')
    } catch (err) {
      console.error('Failed to switch model:', err)
      logToConsole('Failed to switch model', 'error')
    }
  }
  
  const handleCreateProject = async () => {
    const name = prompt('Project name:')
    if (!name) return
    
    try {
      const res = await fetch(`${API_BASE}/api/projects?name=${encodeURIComponent(name)}`, {
        method: 'POST'
      })
      const data = await res.json()
      await loadProjects()
      setCurrentProject({ id: data.id, name: data.name })
      setActiveTab('levels')
      logToConsole(`Created project: ${name}`, 'success')
    } catch (err) {
      console.error('Failed to create project:', err)
      logToConsole('Failed to create project', 'error')
    }
  }
  
  const handleSelectProject = (project) => {
    setCurrentProject(project)
    setSelectedItem({ type: 'Project', name: project.name, ...project })
    loadLevels(project.id)
    loadEntityTypes(project.id)
    
    // Update recent projects
    const updated = [{ id: project.id, name: project.name, timestamp: Date.now() }, 
                     ...recentProjects.filter(p => p.id !== project.id)]
                     .slice(0, 4)
    setRecentProjects(updated)
    localStorage.setItem('levelforge-recent-projects', JSON.stringify(updated))
    
    logToConsole(`Loaded project: ${project.name}`, 'info')
    
    // Switch to levels tab when selecting a project
    setActiveTab('levels')
  }
  
  const handleOpenProject = () => {
    setShowProjectModal(true)
  }
  
  const handleOpenRecentProject = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    if (project) {
      handleSelectProject(project)
    }
  }
  
  const handleCloseProjectModal = () => {
    setShowProjectModal(false)
  }
  
  const handleGenerateLevel = async (settings) => {
    if (!currentProject) {
      const msg = 'Please select a project first'
      logToConsole(msg, 'error')
      alert(msg)
      return
    }
    
    // Auto-show console when generation starts
    logToConsole('=== Level Generation Started ===', 'ai-progress')
    logToConsole(`Project: ${currentProject.name}`, 'system')
    logToConsole(`Genre: ${settings.genre}`, 'system')
    logToConsole(`Difficulty: ${settings.difficulty}`, 'system')
    logToConsole(`Theme: ${settings.theme}`, 'system')
    
    setGenerating(true)
    setProgress(0)
    setProgressMessage('Starting...')
    
    try {
      logToConsole('Sending request to backend...', 'ai-progress')
      
      const requestBody = {
        ...settings,
        model: selectedModel || undefined,
        project_id: currentProject.id
      }
      logToConsole(`Request: ${JSON.stringify(requestBody, null, 2)}`, 'debug')
      
      const response = await fetch(`${API_BASE}/api/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        logToConsole(`Server error (${response.status}): ${errorText}`, 'error')
        throw new Error(`Server returned ${response.status}: ${errorText}`)
      }
      
      logToConsole('✓ Connected to backend, streaming response...', 'success')
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let eventCount = 0
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          logToConsole('Stream ended', 'system')
          break
        }
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            eventCount++
            try {
              const data = JSON.parse(line.slice(6))
              logToConsole(`Event: ${data.event}`, 'debug')
              
              if (data.event === 'progress') {
                setProgress(data.progress)
                setProgressMessage(data.message)
                logToConsole(`  → ${data.message} (${data.progress}%)`, 'ai-progress')
              } else if (data.event === 'result') {
                const generatedLevel = data.level
                handleSetCurrentLevel(generatedLevel)
                setProgress(100)
                setProgressMessage('Done!')
                await loadLevels(currentProject.id)
                logToConsole('✓ Level generated successfully!', 'success')
                logToConsole(`Level ID: ${generatedLevel.id}`, 'system')
                
                // Auto-switch to canvas view to show the generated level
                setLevelViewMode('canvas')
                setShowGenerator(false)
              } else if (data.event === 'error') {
                logToConsole(`✗ Generation error: ${data.message}`, 'error')
                alert(`Generation failed: ${data.message}`)
              }
            } catch (e) {
              logToConsole(`Parse error for line: ${line}`, 'warning')
            }
          }
        }
      }
      
      if (eventCount === 0) {
        logToConsole('⚠ No events received from stream', 'warning')
      }
    } catch (err) {
      console.error('Generation error:', err)
      logToConsole(`✗ Generation failed: ${err.message}`, 'error')
      logToConsole(`Stack trace: ${err.stack}`, 'debug')
      alert(`Failed to generate level: ${err.message}`)
    } finally {
      setGenerating(false)
      logToConsole('Generation process completed', 'system')
    }
  }
  
  // Entity type CRUD
  const handleCreateEntityType = async (data) => {
    try {
      await fetch(`${API_BASE}/api/projects/${currentProject.id}/entity-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      loadEntityTypes(currentProject.id)
      logToConsole(`Created entity: ${data.name}`, 'success')
    } catch (err) {
      console.error('Failed to create entity type:', err)
      logToConsole('Failed to create entity', 'error')
    }
  }
  
  const handleUpdateEntityType = async (id, data) => {
    try {
      await fetch(`${API_BASE}/api/entity-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      loadEntityTypes(currentProject.id)
      logToConsole(`Updated entity: ${data.name}`, 'success')
    } catch (err) {
      console.error('Failed to update entity type:', err)
      logToConsole('Failed to update entity', 'error')
    }
  }
  
  const handleDeleteEntityType = async (id) => {
    if (!confirm('Delete this entity type?')) return
    
    try {
      await fetch(`${API_BASE}/api/entity-types/${id}`, {
        method: 'DELETE'
      })
      loadEntityTypes(currentProject.id)
      setSelectedItem(null)
      logToConsole('Entity deleted', 'info')
    } catch (err) {
      console.error('Failed to delete entity type:', err)
      logToConsole('Failed to delete entity', 'error')
    }
  }
  
  const handleSelectLevel = (level) => {
    handleSetCurrentLevel(level)
    setSelectedItem({ type: 'Level', ...level })
  }

  const handleRenameLevel = async (level) => {
    const newName = prompt('Rename level:', level?.name || '')
    if (!newName || !newName.trim() || newName.trim() === level.name) return

    try {
      const res = await fetch(`${API_BASE}/api/levels/${level.id}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() })
      })
      if (!res.ok) throw new Error('Failed to rename level')

      await loadLevels(currentProject.id)
      const updated = { ...level, name: newName.trim() }
      handleSetCurrentLevel(updated)
      setSelectedItem({ type: 'Level', ...updated })
      logToConsole(`Renamed level to "${newName.trim()}"`, 'info')
    } catch (err) {
      console.error('Rename level failed:', err)
      logToConsole('Failed to rename level', 'error')
      alert('Failed to rename level')
    }
  }
  
  const handleDeleteLevel = async (level) => {
    if (!confirm(`Delete level "${level?.name}"? This cannot be undone.`)) return

    try {
      const res = await fetch(`${API_BASE}/api/levels/${level.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete level')

      await loadLevels(currentProject.id)
      if (currentLevel?.id === level.id) setCurrentLevel(null)
      if (selectedItem?.id === level.id && selectedItem?.type === 'Level') setSelectedItem(null)
      setSelectedObject(null) // Clear selected object too
      logToConsole(`Deleted level "${level.name}"`, 'info')
    } catch (err) {
      console.error('Delete level failed:', err)
      logToConsole('Failed to delete level', 'error')
      alert('Failed to delete level')
    }
  }
  
  // Render object inspector content
  const renderObjectInspector = useCallback((obj) => {
    if (!obj || !obj.data) return null
    
    const { type, data, index } = obj
    
    const handleFieldChange = (field, value) => {
      const updatedData = { ...data, [field]: value }
      const updatedObj = { ...obj, data: updatedData }
      setSelectedObject(updatedObj)
      // Persist the change
      handleUpdateObject(updatedObj)
    }
    
    const handleNumberChange = (field, value) => {
      const num = parseFloat(value)
      if (!isNaN(num)) {
        handleFieldChange(field, num)
      }
    }
    
    // Get type info for entities
    const getTypeInfo = () => {
      if (type === 'entity') {
        const found = entityTypes.find(et => et.name.toLowerCase() === obj.entityType?.toLowerCase())
        if (found) return { emoji: found.emoji, name: found.name }
      }
      if (type === 'platform') return { emoji: '▬', name: 'Platform' }
      if (type === 'spawn') return { emoji: '🧑', name: 'Player Spawn' }
      if (type === 'goal') return { emoji: '🚩', name: 'Goal' }
      return { emoji: '📦', name: type }
    }
    
    const typeInfo = getTypeInfo()
    
    return (
      <div className="object-inspector">
        <div className="object-inspector-header">
          <span className="object-icon">{typeInfo.emoji}</span>
          <span className="object-title">{typeInfo.name} {type === 'platform' || type === 'entity' ? `#${(index ?? 0) + 1}` : ''}</span>
        </div>
        
        <div className="object-section">
          <h4>Position</h4>
          <div className="object-field">
            <label>X</label>
            <input 
              type="number" 
              value={data.x ?? 0} 
              onChange={(e) => handleNumberChange('x', e.target.value)}
            />
          </div>
          <div className="object-field">
            <label>Y</label>
            <input 
              type="number" 
              value={data.y ?? 0} 
              onChange={(e) => handleNumberChange('y', e.target.value)}
            />
          </div>
        </div>
        
        {type === 'platform' && (
          <div className="object-section">
            <h4>Size</h4>
            <div className="object-field">
              <label>Width</label>
              <input 
                type="number" 
                value={data.width ?? 100} 
                onChange={(e) => handleNumberChange('width', e.target.value)}
              />
            </div>
            <div className="object-field">
              <label>Height</label>
              <input 
                type="number" 
                value={data.height ?? 30} 
                onChange={(e) => handleNumberChange('height', e.target.value)}
              />
            </div>
          </div>
        )}
        
        {type === 'entity' && (
          <div className="object-section">
            <h4>Entity Properties</h4>
            <div className="object-field">
              <label>Name</label>
              <input 
                type="text" 
                value={data.name ?? ''} 
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="Optional name"
              />
            </div>
            <div className="object-field">
              <label>Type</label>
              <input 
                type="text" 
                value={obj.entityType ?? data.type ?? ''} 
                disabled
                className="disabled"
              />
            </div>
          </div>
        )}
        
        {/* Show any additional metadata */}
        {Object.entries(data).map(([key, value]) => {
          if (['x', 'y', 'width', 'height', 'type', 'name'].includes(key)) return null
          if (typeof value === 'object') {
            return (
              <div key={key} className="object-section">
                <h4>{key}</h4>
                <pre className="object-metadata">{JSON.stringify(value, null, 2)}</pre>
              </div>
            )
          }
          return null
        })}
        
        {/* Level actions */}
        <div className="object-section">
          <h4>Level Actions</h4>
          <div className="object-actions">
            <button 
              className="btn-small btn-danger" 
              onClick={() => {
                if (confirm(`Delete level "${currentLevel?.name}"? This cannot be undone.`)) {
                  handleDeleteLevel(currentLevel)
                  setSelectedObject(null)
                }
              }}
            >
              🗑 Delete Level
            </button>
          </div>
        </div>
      </div>
    )
  }, [entityTypes, handleUpdateObject, currentLevel, handleDeleteLevel])
  
  const handleSelectEntity = (entity) => {
    setSelectedItem({ type: 'Entity', ...entity })
    setInspectorContent(null) // Clear any edit form
  }
  
  const handleSelectAsset = (asset) => {
    setSelectedItem({ type: 'Asset', ...asset })
    setInspectorContent(null)
  }
  
  // Entity editing state
  const [editingEntity, setEditingEntity] = useState(null)
  const [entityFormData, setEntityFormData] = useState({})
  
  const handleEditEntity = (entity) => {
    setEditingEntity(entity)
    setEntityFormData({
      name: entity.name,
      emoji: entity.emoji,
      color: entity.color,
      description: entity.description || '',
      placement_rules: entity.placement_rules || '',
      behavior: entity.behavior || '',
      collision_type: entity.collision_type,
      category: entity.category || 'actors',
      metadata_fields: JSON.parse(entity.metadata_fields || '[]')
    })
    setSelectedItem({ type: 'Entity', ...entity })
  }
  
  const handleSaveEntity = async () => {
    const data = { ...entityFormData, metadata_fields: JSON.stringify(entityFormData.metadata_fields) }
    await handleUpdateEntityType(editingEntity.id, data)
    setEditingEntity(null)
    setInspectorContent(null)
    setSelectedItem(null)
  }
  
  const handleCancelEditEntity = () => {
    setEditingEntity(null)
    setInspectorContent(null)
  }
  
  // Entity edit form for inspector
  const renderEntityEditForm = () => {
    if (!editingEntity) return null
    
    const ENTITY_EMOJIS = [
      '🧑', '🚩', '🪙', '🔑', '💎', '⭐', '❤️', '💜', '🛡️',
      '👾', '🦇', '🤖', '👻', '💀', '🕷️', '🐉', '👹', '👿',
      '⚠️', '🔥', '💧', '❄️', '⚡', '💨', '☀️', '🌙', '🌀',
      '📦', '🪨', '🌳', '🍄', '🌸', '🍀', '🌊', '⛰️', '🌋',
      '⚔️', '🏹', '🔮', '📜', '🎁', '🏆', '🔔', '💣', '🧪'
    ]
    
    const METADATA_TYPES = ['text', 'number', 'boolean', 'select']
    
    const handleAddMetadataField = () => {
      setEntityFormData(prev => ({
        ...prev,
        metadata_fields: [...prev.metadata_fields, { name: '', type: 'text', description: '', default: '' }]
      }))
    }
    
    const handleUpdateMetadataField = (index, field, value) => {
      setEntityFormData(prev => ({
        ...prev,
        metadata_fields: prev.metadata_fields.map((f, i) => 
          i === index ? { ...f, [field]: value } : f
        )
      }))
    }
    
    const handleRemoveMetadataField = (index) => {
      setEntityFormData(prev => ({
        ...prev,
        metadata_fields: prev.metadata_fields.filter((_, i) => i !== index)
      }))
    }
    
    return (
      <div className="inspector-edit-form">
        <div className="form-section">
          <label>Name</label>
          <input
            type="text"
            value={entityFormData.name}
            onChange={e => setEntityFormData({...entityFormData, name: e.target.value})}
            placeholder="Entity name..."
          />
        </div>
        
        <div className="form-row">
          <div className="form-section half">
            <label>Color</label>
            <input
              type="color"
              value={entityFormData.color}
              onChange={e => setEntityFormData({...entityFormData, color: e.target.value})}
            />
          </div>
          <div className="form-section half">
            <label>Collision</label>
            <select
              value={entityFormData.collision_type}
              onChange={e => setEntityFormData({...entityFormData, collision_type: e.target.value})}
            >
              <option value="neutral">Neutral</option>
              <option value="harmful">Harmful</option>
              <option value="helpful">Helpful</option>
            </select>
          </div>
        </div>
        
        <div className="form-section">
          <label>Emoji</label>
          <div className="emoji-grid">
            {ENTITY_EMOJIS.slice(0, 18).map(emoji => (
              <button
                key={emoji}
                type="button"
                className={`emoji-btn ${entityFormData.emoji === emoji ? 'selected' : ''}`}
                onClick={() => setEntityFormData({...entityFormData, emoji})}
              >
                {emoji}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={entityFormData.emoji}
            onChange={e => setEntityFormData({...entityFormData, emoji: e.target.value})}
            placeholder="Or type custom..."
            className="mt-2"
          />
        </div>
        
        <div className="form-section">
          <label>Description</label>
          <textarea
            value={entityFormData.description}
            onChange={e => setEntityFormData({...entityFormData, description: e.target.value})}
            placeholder="Description for AI..."
            rows={2}
          />
        </div>
        
        <div className="form-section">
          <label>Placement Rules</label>
          <input
            type="text"
            value={entityFormData.placement_rules}
            onChange={e => setEntityFormData({...entityFormData, placement_rules: e.target.value})}
            placeholder="e.g., Place on platforms"
          />
        </div>
        
        <div className="form-section">
          <label>Behavior</label>
          <input
            type="text"
            value={entityFormData.behavior}
            onChange={e => setEntityFormData({...entityFormData, behavior: e.target.value})}
            placeholder="e.g., Patrols left/right"
          />
        </div>
        
        <div className="form-section">
          <div className="section-header">
            <label>Metadata Fields</label>
            <button type="button" className="btn-link" onClick={handleAddMetadataField}>+ Add</button>
          </div>
          {entityFormData.metadata_fields.length === 0 ? (
            <p className="hint">Add fields like hit_points, speed, etc.</p>
          ) : (
            <div className="metadata-list">
              {entityFormData.metadata_fields.map((field, index) => (
                <div key={index} className="metadata-item">
                  <input
                    type="text"
                    value={field.name}
                    onChange={e => handleUpdateMetadataField(index, 'name', e.target.value)}
                    placeholder="Field name"
                  />
                  <select
                    value={field.type}
                    onChange={e => handleUpdateMetadataField(index, 'type', e.target.value)}
                  >
                    {METADATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button 
                    type="button" 
                    className="btn-icon danger"
                    onClick={() => handleRemoveMetadataField(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="form-actions">
          <button className="btn-secondary" onClick={handleCancelEditEntity}>Cancel</button>
          <button className="btn-primary" onClick={handleSaveEntity}>Update</button>
        </div>
      </div>
    )
  }
  
  const handleMenuAction = (action, menu) => {
    logToConsole(`Menu: ${menu} > ${action}`, 'info')
    
    // File menu
    if (menu === 'file') {
      switch (action) {
        case 'new-project':
          handleCreateProject()
          break
        case 'open-project':
          handleOpenProject()
          break
        case 'save':
          logToConsole('Project saved', 'success')
          break
        case 'project-settings':
          setActiveTab('settings')
          break
        case 'exit':
          if (confirm('Exit LevelForge?')) {
            window.close()
          }
          break
        default:
          // Handle recent project actions (format: recent-{id})
          if (action.startsWith('recent-')) {
            const projectId = parseInt(action.replace('recent-', ''))
            if (!isNaN(projectId)) {
              handleOpenRecentProject(projectId)
            }
          }
      }
    }
    
    // Edit menu
    if (menu === 'edit') {
      switch (action) {
        case 'preferences':
          setActiveTab('settings')
          break
      }
    }
    
    // View menu
    if (menu === 'view') {
      switch (action) {
        case 'toggle-inspector':
          // Handled by layout
          break
        case 'toggle-console':
          // Handled by layout
          break
        case 'fullscreen':
          if (document.fullscreenElement) {
            document.exitFullscreen()
          } else {
            document.documentElement.requestFullscreen()
          }
          break
      }
    }
    
    // Entities menu
    if (menu === 'entities') {
      switch (action) {
        case 'create-actor':
        case 'create-item':
        case 'create-terrain':
        case 'create-behavior':
        case 'create-script':
          setActiveTab('entities')
          // Could trigger create dialog
          break
        case 'schema-editor':
          setActiveTab('settings')
          break
      }
    }
    
    // Levels menu
    if (menu === 'levels') {
      switch (action) {
        case 'new-level':
          setActiveTab('levels')
          setShowGenerator(true)
          break
        case 'generate-ai':
          setActiveTab('levels')
          setShowGenerator(true)
          break
        case 'level-settings':
          setActiveTab('settings')
          break
      }
    }
    
    // AI menu
    if (menu === 'ai') {
      switch (action) {
        case 'gen-level':
          setActiveTab('levels')
          setShowGenerator(true)
          break
        case 'model-settings':
        case 'api-config':
          setActiveTab('ai-tools')
          break
        case 'history':
          setActiveTab('ai-tools')
          break
      }
    }
    
    // Tools menu
    if (menu === 'tools') {
      switch (action) {
        case 'json-viewer':
          logToConsole('JSON Viewer coming soon...', 'info')
          break
        case 'plugin-manager':
          logToConsole('Plugin Manager coming soon...', 'info')
          break
      }
    }
    
    // Help menu
    if (menu === 'help') {
      switch (action) {
        case 'documentation':
          window.open('https://docs.openclaw.ai/levelforge', '_blank')
          break
        case 'shortcuts':
          alert(`Keyboard Shortcuts:
          
Ctrl+1-6: Switch tabs
Ctrl+I: Toggle Inspector
Ctrl+\`: Toggle Console
Ctrl+G: Generate Level
Ctrl+S: Save
F11: Fullscreen
Escape: Close menus`)
          break
        case 'report-issue':
          window.open('https://github.com/kire256/levelforge/issues', '_blank')
          break
        case 'about':
          alert(`LevelForge AI
          
AI-powered level generator for game developers.

Version: 1.0.0
Built with ❤️ by OpenClaw`)
          break
      }
    }
  }
  
  // Render active tab content
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            projects={projects}
            currentProject={currentProject}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onGenerateLevel={() => {
              if (!currentProject) {
                alert('Please select a project first')
                return
              }
              setActiveTab('levels')
            }}
          />
        )
      case 'entities':
        return (
          <Entities
            entityTypes={entityTypes}
            currentProject={currentProject}
            onCreateEntityType={handleCreateEntityType}
            onUpdateEntityType={handleUpdateEntityType}
            onDeleteEntityType={handleDeleteEntityType}
            onSelectEntity={handleSelectEntity}
            onEditEntity={handleEditEntity}
            selectedEntity={selectedItem}
          />
        )
      case 'levels':
        return (
          <Levels
            currentProject={currentProject}
            levels={levels}
            currentLevel={displayLevel}
            onSelectLevel={handleSelectLevel}
            onGenerateLevel={handleGenerateLevel}
            generating={generating}
            progress={progress}
            progressMessage={progressMessage}
            availableModels={availableModels}
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
            showGenerator={showGenerator}
            onShowGeneratorChange={setShowGenerator}
            viewMode={levelViewMode}
            onViewModeChange={setLevelViewMode}
            onRenameLevel={handleRenameLevel}
            selectedObject={selectedObject}
            onSelectObject={setSelectedObject}
            onUpdateObject={handleUpdateObject}
          />
        )
      case 'library':
        return (
          <Library 
            currentProject={currentProject}
            onSelectAsset={handleSelectAsset}
            selectedAsset={selectedItem}
          />
        )
      case 'ai-tools':
        return (
          <AITools
            availableModels={availableModels}
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
            consoleLogs={consoleLogs}
          />
        )
      case 'settings':
        return (
          <Settings
            currentProject={currentProject}
            availableModels={availableModels}
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
            theme={theme}
            accentColor={accentColor}
            onThemeChange={setTheme}
            onAccentChange={setAccentColor}
          />
        )
      default:
        return null
    }
  }
  
  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onMenuAction={handleMenuAction}
      selectedItem={selectedItem}
      inspectorContent={
        editingEntity ? renderEntityEditForm() : 
        (activeTab === 'levels' && selectedObject) ? renderObjectInspector(selectedObject) : 
        inspectorContent
      }
      consoleLogs={consoleLogs}
      onClearConsole={handleClearConsole}
      onEditItem={handleEditEntity}
      onRenameLevel={handleRenameLevel}
      onDeleteLevel={handleDeleteLevel}
      recentProjects={recentProjects}
      projects={projects}
      showProjectModal={showProjectModal}
      onCloseProjectModal={handleCloseProjectModal}
      onSelectProject={handleSelectProject}
      forceShowConsole={forceShowConsole}
      onConsoleShown={() => setForceShowConsole(false)}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={handleUndo}
      onRedo={redoLevel}
      historyInfo={getHistoryInfo()}
      currentProject={currentProject}
    >
      {renderContent()}
    </Layout>
  )
}

export default App
