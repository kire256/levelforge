import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Custom hook for undo/redo functionality
 * Tracks state history and provides undo/redo methods
 */
export const useUndoRedo = (initialState, options = {}) => {
  const {
    maxHistorySize = 50,  // Maximum number of states to keep
    debounceMs = 100      // Debounce rapid changes
  } = options
  
  const [history, setHistory] = useState([initialState])
  const [currentIndex, setCurrentIndex] = useState(0)
  const debounceTimer = useRef(null)
  
  // Current state is whatever is at the current index
  const state = history[currentIndex]
  
  // Can we undo/redo?
  const canUndo = currentIndex > 0
  const canRedo = currentIndex < history.length - 1
  
  // Push a new state onto history
  const setState = useCallback((newState, immediate = false) => {
    const pushState = () => {
      setHistory(prev => {
        // Trim future history if we're not at the end
        const newHistory = prev.slice(0, currentIndex + 1)
        
        // Add new state
        newHistory.push(newState)
        
        // Trim old history if too long
        if (newHistory.length > maxHistorySize) {
          return newHistory.slice(-maxHistorySize)
        }
        
        return newHistory
      })
      
      setCurrentIndex(prev => {
        const newIndex = Math.min(prev + 1, maxHistorySize - 1)
        return newIndex
      })
    }
    
    if (immediate) {
      pushState()
    } else {
      // Debounce rapid changes
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
      debounceTimer.current = setTimeout(pushState, debounceMs)
    }
  }, [currentIndex, maxHistorySize, debounceMs])
  
  // Undo last change
  const undo = useCallback(() => {
    if (canUndo) {
      setCurrentIndex(prev => prev - 1)
      return true
    }
    return false
  }, [canUndo])
  
  // Redo previously undone change
  const redo = useCallback(() => {
    if (canRedo) {
      setCurrentIndex(prev => prev + 1)
      return true
    }
    return false
  }, [canRedo])
  
  // Jump to specific point in history
  const jumpTo = useCallback((index) => {
    if (index >= 0 && index < history.length) {
      setCurrentIndex(index)
      return true
    }
    return false
  }, [history.length])
  
  // Clear all history and reset to initial state
  const clearHistory = useCallback(() => {
    setHistory([initialState])
    setCurrentIndex(0)
  }, [initialState])
  
  // Get history info for debugging/UI
  const getHistoryInfo = useCallback(() => ({
    length: history.length,
    currentIndex,
    canUndo,
    canRedo
  }), [history.length, currentIndex, canUndo, canRedo])
  
  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])
  
  return {
    state,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    jumpTo,
    clearHistory,
    getHistoryInfo
  }
}

/**
 * Command pattern implementation for complex undo/redo
 */
export class Command {
  constructor(execute, undo, description = '') {
    this.execute = execute
    this.undo = undo
    this.description = description
    this.timestamp = Date.now()
  }
}

/**
 * Command manager for tracking and executing commands
 */
export const useCommandManager = () => {
  const [commands, setCommands] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  
  const executeCommand = useCallback((command) => {
    // Execute the command
    command.execute()
    
    // Trim future commands if we're not at the end
    setCommands(prev => {
      const newCommands = prev.slice(0, currentIndex + 1)
      newCommands.push(command)
      return newCommands
    })
    
    setCurrentIndex(prev => prev + 1)
  }, [currentIndex])
  
  const undo = useCallback(() => {
    if (currentIndex >= 0) {
      commands[currentIndex].undo()
      setCurrentIndex(prev => prev - 1)
      return true
    }
    return false
  }, [commands, currentIndex])
  
  const redo = useCallback(() => {
    if (currentIndex < commands.length - 1) {
      commands[currentIndex + 1].execute()
      setCurrentIndex(prev => prev + 1)
      return true
    }
    return false
  }, [commands, currentIndex])
  
  const canUndo = currentIndex >= 0
  const canRedo = currentIndex < commands.length - 1
  
  return {
    executeCommand,
    undo,
    redo,
    canUndo,
    canRedo,
    commandHistory: commands.slice(0, currentIndex + 1)
  }
}

export default useUndoRedo
