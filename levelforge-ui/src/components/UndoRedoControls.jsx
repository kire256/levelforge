import { useEffect, useCallback } from 'react'
import './UndoRedoControls.css'

export default function UndoRedoControls({ 
  canUndo, 
  canRedo, 
  onUndo, 
  onRedo,
  showLabels = false,
  showHistory = false,
  historyInfo = null
}) {
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) onUndo()
      }
      
      // Ctrl+Shift+Z or Cmd+Shift+Z for redo
      // Also Ctrl+Y for redo (common alternative)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        if (canRedo) onRedo()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canUndo, canRedo, onUndo, onRedo])
  
  return (
    <div className="undo-redo-controls">
      <button 
        className={`undo-btn ${canUndo ? '' : 'disabled'}`}
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        ↩️ {showLabels && 'Undo'}
      </button>
      
      <button 
        className={`redo-btn ${canRedo ? '' : 'disabled'}`}
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
      >
        ↪️ {showLabels && 'Redo'}
      </button>
      
      {showHistory && historyInfo && (
        <div className="history-indicator">
          {historyInfo.currentIndex + 1}/{historyInfo.length}
        </div>
      )}
    </div>
  )
}
