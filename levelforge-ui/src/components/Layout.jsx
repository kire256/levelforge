import { useState, useEffect, useRef, useCallback } from 'react'
import UndoRedoControls from './UndoRedoControls'
import './Layout.css'

// Menu configurations (generated dynamically)
const createMenus = (recentProjects = []) => {
  const recentItems = recentProjects.length > 0 
    ? [
        ...recentProjects.map((p, i) => ({ id: `recent-${p.id}`, label: p.name })),
        { id: 'divider-recent', type: 'divider' },
        { id: 'clear-recent', label: 'Clear List' },
      ]
    : [{ id: 'no-recent', label: 'No recent projects', disabled: true }]
  
  return {
  file: {
    label: 'File',
    items: [
      { id: 'new-project', label: 'New Project...', shortcut: 'Ctrl+N' },
      { id: 'open-project', label: 'Open Project...' },
      { id: 'divider-1', type: 'divider' },
      { id: 'open-recent', label: 'Open Recent', submenu: recentItems },
      { id: 'divider-2', type: 'divider' },
      { id: 'save', label: 'Save', shortcut: 'Ctrl+S' },
      { id: 'save-as', label: 'Save As...' },
      { id: 'divider-3', type: 'divider' },
      { id: 'import', label: 'Import', submenu: [
        { id: 'import-level', label: 'Level (.json)' },
        { id: 'import-entity', label: 'Entity Pack' },
        { id: 'import-asset', label: 'Asset Bundle' },
        { id: 'import-template', label: 'AI Template' },
      ]},
      { id: 'export', label: 'Export', submenu: [
        { id: 'export-level', label: 'Level' },
        { id: 'export-project', label: 'Full Project' },
        { id: 'divider-e1', type: 'divider' },
        { id: 'export-unity', label: 'Unity Package' },
        { id: 'export-godot', label: 'Godot Package' },
        { id: 'export-unreal', label: 'Unreal Package' },
      ]},
      { id: 'divider-4', type: 'divider' },
      { id: 'project-settings', label: 'Project Settings...' },
      { id: 'divider-5', type: 'divider' },
      { id: 'exit', label: 'Exit' },
    ]
  },
  edit: {
    label: 'Edit',
    items: [
      { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z' },
      { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y' },
      { id: 'divider-1', type: 'divider' },
      { id: 'cut', label: 'Cut', shortcut: 'Ctrl+X' },
      { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C' },
      { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V' },
      { id: 'duplicate', label: 'Duplicate', shortcut: 'Ctrl+D' },
      { id: 'delete', label: 'Delete', shortcut: 'Del' },
      { id: 'divider-2', type: 'divider' },
      { id: 'find', label: 'Find...', shortcut: 'Ctrl+F' },
      { id: 'replace', label: 'Replace...', shortcut: 'Ctrl+H' },
      { id: 'divider-3', type: 'divider' },
      { id: 'preferences', label: 'Preferences...' },
    ]
  },
  view: {
    label: 'View',
    items: [
      { id: 'panels', label: 'Panels', submenu: [
        { id: 'toggle-inspector', label: 'Inspector', shortcut: 'Ctrl+I', toggle: true },
        { id: 'toggle-console', label: 'Console', shortcut: 'Ctrl+`', toggle: true },
        { id: 'toggle-suggestions', label: 'AI Suggestions' },
        { id: 'toggle-assets', label: 'Asset Browser' },
        { id: 'toggle-history', label: 'History' },
      ]},
      { id: 'layout', label: 'Layout', submenu: [
        { id: 'layout-default', label: 'Default' },
        { id: 'layout-level-design', label: 'Level Design' },
        { id: 'layout-ai-tuning', label: 'AI Tuning' },
        { id: 'divider-l1', type: 'divider' },
        { id: 'layout-custom', label: 'Custom...' },
        { id: 'layout-save', label: 'Save Current Layout' },
      ]},
      { id: 'divider-1', type: 'divider' },
      { id: 'zoom-in', label: 'Zoom In', shortcut: 'Ctrl++' },
      { id: 'zoom-out', label: 'Zoom Out', shortcut: 'Ctrl+-' },
      { id: 'reset-zoom', label: 'Reset Zoom', shortcut: 'Ctrl+0' },
      { id: 'divider-2', type: 'divider' },
      { id: 'fullscreen', label: 'Toggle Fullscreen', shortcut: 'F11' },
    ]
  },
  entities: {
    label: 'Entities',
    items: [
      { id: 'create', label: 'Create', submenu: [
        { id: 'create-actor', label: 'Actor' },
        { id: 'create-item', label: 'Item' },
        { id: 'create-terrain', label: 'Terrain' },
        { id: 'create-behavior', label: 'AI Behavior' },
        { id: 'create-script', label: 'Script' },
      ]},
      { id: 'convert-type', label: 'Convert Type...' },
      { id: 'divider-1', type: 'divider' },
      { id: 'validate', label: 'Validate Entities' },
      { id: 'bulk-edit', label: 'Bulk Edit...' },
      { id: 'divider-2', type: 'divider' },
      { id: 'schema-editor', label: 'Entity Schema Editor...' },
    ]
  },
  levels: {
    label: 'Levels',
    items: [
      { id: 'new-level', label: 'New Level...' },
      { id: 'duplicate-level', label: 'Duplicate Level' },
      { id: 'divider-1', type: 'divider' },
      { id: 'validate-level', label: 'Validate Level' },
      { id: 'generate-ai', label: 'Generate With AI...', shortcut: 'Ctrl+G' },
      { id: 'divider-2', type: 'divider' },
      { id: 'analyze-difficulty', label: 'Analyze Difficulty' },
      { id: 'playtest', label: 'Playtest Simulation' },
      { id: 'divider-3', type: 'divider' },
      { id: 'level-settings', label: 'Level Settings...' },
    ]
  },
  ai: {
    label: 'AI',
    items: [
      { id: 'generate', label: 'Generate', submenu: [
        { id: 'gen-level', label: 'Level' },
        { id: 'gen-enemies', label: 'Enemy Set' },
        { id: 'gen-encounter', label: 'Encounter' },
        { id: 'gen-loot', label: 'Loot Table' },
        { id: 'gen-campaign', label: 'Full Campaign' },
      ]},
      { id: 'divider-1', type: 'divider' },
      { id: 'prompt-templates', label: 'Prompt Templates...' },
      { id: 'model-settings', label: 'Model Settings...' },
      { id: 'training-data', label: 'Training Data...' },
      { id: 'divider-2', type: 'divider' },
      { id: 'history', label: 'Generation History' },
      { id: 'cost-usage', label: 'Cost / Token Usage' },
      { id: 'divider-3', type: 'divider' },
      { id: 'api-config', label: 'API Configuration...' },
    ]
  },
  tools: {
    label: 'Tools',
    items: [
      { id: 'schema-validator', label: 'Schema Validator' },
      { id: 'dependency-graph', label: 'Dependency Graph' },
      { id: 'performance', label: 'Performance Analyzer' },
      { id: 'json-viewer', label: 'JSON Viewer' },
      { id: 'divider-1', type: 'divider' },
      { id: 'plugin-manager', label: 'Plugin Manager...' },
      { id: 'script-console', label: 'Script Console' },
    ]
  },
  help: {
    label: 'Help',
    items: [
      { id: 'documentation', label: 'Documentation' },
      { id: 'tutorials', label: 'Tutorials' },
      { id: 'shortcuts', label: 'Keyboard Shortcuts' },
      { id: 'divider-1', type: 'divider' },
      { id: 'check-updates', label: 'Check for Updates' },
      { id: 'report-issue', label: 'Report Issue (GitHub)' },
      { id: 'divider-2', type: 'divider' },
      { id: 'about', label: 'About LevelForge AI' },
    ]
  },
}}

// Main layout component with top menu, tabs, and panels
export default function Layout({ 
  children, 
  activeTab, 
  onTabChange, 
  onMenuAction,
  selectedItem,
  inspectorContent,
  consoleLogs,
  onClearConsole,
  showInspector: externalShowInspector,
  showConsole: externalShowConsole,
  onToggleInspector,
  onToggleConsole,
  onEditItem,
  onRenameLevel,
  onDeleteLevel,
  recentProjects = [],
  projects = [],
  showProjectModal,
  onCloseProjectModal,
  onSelectProject,
  forceShowConsole = false,
  onConsoleShown,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  historyInfo = null,
}) {
  const [showInspector, setShowInspector] = useState(externalShowInspector ?? true)
  const [showConsole, setShowConsole] = useState(externalShowConsole ?? false)
  const [activeMenu, setActiveMenu] = useState(null)
  const [activeSubmenu, setActiveSubmenu] = useState(null)
  const [activeConsoleTab, setActiveConsoleTab] = useState('console')
  const consoleRef = useRef(null)
  const menuRef = useRef(null)
  
  // Panel sizes (stored in state for persistence)
  const [inspectorWidth, setInspectorWidth] = useState(320)
  const [consoleHeight, setConsoleHeight] = useState(180)
  
  // Resize refs
  const isResizingInspector = useRef(false)
  const isResizingConsole = useRef(false)
  
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', shortcut: '1' },
    { id: 'entities', label: 'Entities', icon: '🧬', shortcut: '2' },
    { id: 'levels', label: 'Levels', icon: '🗺', shortcut: '3' },
    { id: 'library', label: 'Library', icon: '📚', shortcut: '4' },
    { id: 'ai-tools', label: 'AI Tools', icon: '🤖', shortcut: '5' },
    { id: 'settings', label: 'Settings', icon: '⚙️', shortcut: '6' },
  ]
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenu(null)
        setActiveSubmenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Auto-show console when forced
  useEffect(() => {
    if (forceShowConsole && !showConsole) {
      setShowConsole(true)
      onConsoleShown && onConsoleShown()
    }
  }, [forceShowConsole])
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Tab shortcuts (Ctrl/Cmd + 1-6)
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '6') {
        e.preventDefault()
        const tabIndex = parseInt(e.key) - 1
        if (tabs[tabIndex]) {
          onTabChange(tabs[tabIndex].id)
        }
      }
      
      // Toggle inspector (Ctrl/Cmd + I)
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault()
        setShowInspector(prev => !prev)
        onToggleInspector && onToggleInspector()
      }
      
      // Toggle console (Ctrl/Cmd + `)
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault()
        setShowConsole(prev => !prev)
        onToggleConsole && onToggleConsole()
      }
      
      // Close menus on Escape
      if (e.key === 'Escape') {
        setActiveMenu(null)
        setActiveSubmenu(null)
      }
      
      // Generate level shortcut (Ctrl+G)
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault()
        onMenuAction && onMenuAction('generate-ai', 'levels')
      }
      
      // Save shortcut (Ctrl+S)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        onMenuAction && onMenuAction('save', 'file')
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onTabChange, tabs, onMenuAction, onToggleInspector, onToggleConsole])
  
  // Auto-scroll console to bottom
  useEffect(() => {
    if (consoleRef.current && showConsole) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [consoleLogs, showConsole])
  
  // Inspector resize handlers
  const handleInspectorMouseDown = useCallback((e) => {
    e.preventDefault()
    isResizingInspector.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])
  
  // Console resize handlers
  const handleConsoleMouseDown = useCallback((e) => {
    e.preventDefault()
    isResizingConsole.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])
  
  // Global mouse move and up handlers
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingInspector.current) {
        const newWidth = window.innerWidth - e.clientX
        setInspectorWidth(Math.max(250, Math.min(500, newWidth)))
      }
      if (isResizingConsole.current) {
        const newHeight = window.innerHeight - e.clientY
        setConsoleHeight(Math.max(100, Math.min(400, newHeight)))
      }
    }
    
    const handleMouseUp = () => {
      if (isResizingInspector.current || isResizingConsole.current) {
        isResizingInspector.current = false
        isResizingConsole.current = false
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
  
  const handleMenuClick = (menuId) => {
    setActiveMenu(activeMenu === menuId ? null : menuId)
    setActiveSubmenu(null)
  }
  
  const handleMenuItemClick = (itemId, menuId) => {
    onMenuAction && onMenuAction(itemId, menuId)
    setActiveMenu(null)
    setActiveSubmenu(null)
  }
  
  const handleSubmenuEnter = (itemId) => {
    setActiveSubmenu(itemId)
  }
  
  const renderMenuItem = (item, menuId) => {
    if (item.type === 'divider') {
      return <div key={item.id} className="menu-divider" />
    }
    
    const hasSubmenu = item.submenu && item.submenu.length > 0
    const isActive = activeSubmenu === item.id
    
    return (
      <div
        key={item.id}
        className={`menu-item ${hasSubmenu ? 'has-submenu' : ''} ${isActive ? 'active' : ''}`}
        onClick={() => !hasSubmenu && handleMenuItemClick(item.id, menuId)}
        onMouseEnter={() => hasSubmenu && handleSubmenuEnter(item.id)}
      >
        <span className="menu-item-label">{item.label}</span>
        {item.shortcut && <span className="menu-item-shortcut">{item.shortcut}</span>}
        {item.toggle !== undefined && <span className="menu-item-toggle">{item.toggle ? '✓' : ''}</span>}
        {hasSubmenu && <span className="menu-item-arrow">▶</span>}
        
        {hasSubmenu && isActive && (
          <div className="submenu">
            {item.submenu.map(subItem => renderMenuItem(subItem, menuId))}
          </div>
        )}
      </div>
    )
  }
  
  return (
    <div className="app-layout">
      {/* Top Menu Bar */}
      <header className="top-menu">
        <div className="menu-left">
          <span className="logo">🎮 LevelForge</span>
          <nav className="menu-bar" ref={menuRef}>
            {Object.entries(createMenus(recentProjects)).map(([menuId, menu]) => (
              <div key={menuId} className="menu-container">
                <button 
                  className={`menu-btn ${activeMenu === menuId ? 'active' : ''}`}
                  onClick={() => handleMenuClick(menuId)}
                >
                  {menu.label}
                </button>
                {activeMenu === menuId && (
                  <div className="menu-dropdown">
                    {menu.items.map(item => renderMenuItem(item, menuId))}
                  </div>
                )}
              </div>
            ))}
          </nav>
          {selectedItem && (
            <span className="context-info">
              <span className="context-separator">›</span>
              <span className="context-name">{selectedItem.name || selectedItem.type || 'Item'}</span>
            </span>
          )}
        </div>
        <div className="menu-spacer" />
        <div className="menu-right">
          <button 
            className={`icon-btn ${showInspector ? 'active' : ''}`}
            onClick={() => {
              setShowInspector(!showInspector)
              onToggleInspector && onToggleInspector()
            }} 
            title="Toggle Inspector (Ctrl+I)"
          >
            👁️
          </button>
          <button 
            className={`icon-btn ${showConsole ? 'active' : ''}`}
            onClick={() => {
              setShowConsole(!showConsole)
              onToggleConsole && onToggleConsole()
            }} 
            title="Toggle Console (Ctrl+`)"
          >
            📋
          </button>
          <button className="profile-btn" title="Profile">👤</button>
        </div>
      </header>
      
      {/* Main Tabs */}
      <nav className="main-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            title={`Ctrl+${tab.shortcut}`}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
        <div className="tabs-spacer" />
        <div className="tabs-shortcuts">
          <kbd>Ctrl+1-6</kbd> tabs • <kbd>Ctrl+G</kbd> generate • <kbd>Ctrl+I</kbd> inspector
        </div>
      </nav>
      
      {/* Main Content Area */}
      <div className="main-content">
        <div className="content-area">
          {children}
        </div>
        {showInspector && (
          <>
            <div 
              className="resize-handle-vertical"
              onMouseDown={handleInspectorMouseDown}
            />
            <aside className="inspector-panel">
              <div className="panel-header">
                <h3>Inspector</h3>
                <div className="panel-header-actions">
                  {selectedItem && selectedItem.type === 'Entity' && !inspectorContent && onEditItem && (
                    <button className="btn-small" onClick={() => onEditItem(selectedItem)}>Edit</button>
                  )}
                  {selectedItem && selectedItem.type === 'Level' && !inspectorContent && (
                    <>
                      {onRenameLevel && (
                        <button className="btn-small" onClick={() => onRenameLevel(selectedItem)}>Rename</button>
                      )}
                      {onDeleteLevel && (
                        <button className="btn-small btn-danger" onClick={() => onDeleteLevel(selectedItem)}>Delete</button>
                      )}
                    </>
                  )}
                  <button 
                    className="panel-close" 
                    onClick={() => {
                      setShowInspector(false)
                      onToggleInspector && onToggleInspector()
                    }}
                    title="Close (Ctrl+I)"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="panel-content">
                {inspectorContent ? (
                  inspectorContent
                ) : selectedItem ? (
                  <div className="inspector-default">
                    <div className="inspector-item-header">
                      {selectedItem.emoji ? (
                        <span className="inspector-icon">{selectedItem.emoji}</span>
                      ) : selectedItem.type === 'Level' ? (
                        <span className="inspector-icon">🗺</span>
                      ) : selectedItem.category ? (
                        <span className="inspector-icon">
                          {selectedItem.category === 'textures' && '🎨'}
                          {selectedItem.category === 'models' && '🧊'}
                          {selectedItem.category === 'audio' && '🎵'}
                          {selectedItem.category === 'scripts' && '📜'}
                          {selectedItem.category === 'templates' && '🤖'}
                        </span>
                      ) : null}
                      <h4>{selectedItem.name || 'Selected Item'}</h4>
                    </div>
                    {selectedItem.description && (
                      <p className="inspector-desc">{selectedItem.description}</p>
                    )}
                    <div className="inspector-meta">
                      {Object.entries(selectedItem).map(([key, value]) => {
                        if (['id', 'emoji', 'name', 'description', 'category', 'typeLabel', 'type'].includes(key)) return null
                        if (typeof value === 'object') return null
                        return (
                          <div key={key} className="meta-row">
                            <span className="meta-key">{key}:</span>
                            <span className="meta-value">{String(value)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="inspector-empty">
                    <span className="empty-icon">🔍</span>
                    <p>Select an item to inspect</p>
                  </div>
                )}
              </div>
            </aside>
          </>
        )}
      </div>
      
      {/* Bottom Console */}
      {showConsole && (
        <>
          <div 
            className="resize-handle-horizontal"
            onMouseDown={handleConsoleMouseDown}
          />
          <div className="console-panel" style={{ height: consoleHeight }}>
            <div className="console-header">
              <div className="console-tabs">
                <button 
                  className={`console-tab ${activeConsoleTab === 'console' ? 'active' : ''}`}
                  onClick={() => setActiveConsoleTab('console')}
                >
                  Console
                </button>
                <button 
                  className={`console-tab ${activeConsoleTab === 'ai-output' ? 'active' : ''}`}
                  onClick={() => setActiveConsoleTab('ai-output')}
                >
                  AI Output
                </button>
                <button 
                  className={`console-tab ${activeConsoleTab === 'logs' ? 'active' : ''}`}
                  onClick={() => setActiveConsoleTab('logs')}
                >
                  Logs
                </button>
              </div>
              <div className="console-actions">
                <button onClick={onClearConsole} title="Clear">🗑️</button>
                <button onClick={() => {
                  setShowConsole(false)
                  onToggleConsole && onToggleConsole()
                }} title="Close">×</button>
              </div>
            </div>
            <div className="console-content" ref={consoleRef}>
              {(() => {
                // Filter logs based on active tab
                const filteredLogs = consoleLogs && consoleLogs.filter(log => {
                  if (activeConsoleTab === 'console') {
                    return ['info', 'warning', 'error'].includes(log.type)
                  }
                  if (activeConsoleTab === 'ai-output') {
                    return ['success', 'ai-progress', 'ai-response', 'generation'].includes(log.type)
                  }
                  if (activeConsoleTab === 'logs') {
                    return ['system', 'debug', 'log'].includes(log.type) || !log.type
                  }
                  return true
                })
                
                return filteredLogs && filteredLogs.length > 0 ? (
                  filteredLogs.map((log, index) => (
                    <div key={index} className={`console-line ${log.type || 'info'}`}>
                      <span className="console-time">{log.time}</span>
                      <span className="console-message">{log.message}</span>
                    </div>
                  ))
                ) : (
                  <div className="console-empty">
                    {activeConsoleTab === 'console' && <p>No console output yet.</p>}
                    {activeConsoleTab === 'ai-output' && <p>No AI output yet. Generate a level to see progress.</p>}
                    {activeConsoleTab === 'logs' && <p>No system logs yet.</p>}
                  </div>
                )
              })()}
            </div>
          </div>
        </>
      )}
      
      {/* Project Selection Modal */}
      {showProjectModal && (
        <div className="modal-overlay" onClick={onCloseProjectModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Open Project</h2>
              <button className="modal-close" onClick={onCloseProjectModal}>×</button>
            </div>
            <div className="modal-content">
              {projects && projects.length > 0 ? (
                <div className="project-list">
                  {projects.map(project => (
                    <div 
                      key={project.id} 
                      className="project-item"
                      onClick={() => {
                        onSelectProject(project)
                        onCloseProjectModal()
                      }}
                    >
                      <div className="project-icon">📁</div>
                      <div className="project-info">
                        <h3>{project.name}</h3>
                        <p className="project-date">
                          Created: {new Date(project.created_at).toLocaleDateString()}
                        </p>
                        {project.description && (
                          <p className="project-desc">{project.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="modal-empty">
                  <div className="empty-icon">📁</div>
                  <p>No projects found</p>
                  <p className="hint">Create a new project from the Dashboard</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
