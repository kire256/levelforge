import { useState } from 'react'
import { BUILD_VERSION, getFullVersion } from '../version'
import './Dashboard.css'

export default function Dashboard({ 
  projects, 
  currentProject, 
  onSelectProject, 
  onCreateProject,
  onGenerateLevel 
}) {
  const [quickAction, setQuickAction] = useState(null)
  
  // Calculate stats
  const stats = {
    totalProjects: projects.length,
    totalLevels: 0, // Would come from props
    aiRuns: 0, // Would come from state
  }
  
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Welcome back! Here's your LevelForge overview.</p>
        <span className="version-badge">{getFullVersion()}</span>
      </header>
      
      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{stats.totalProjects}</span>
          <span className="stat-label">Projects</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.totalLevels}</span>
          <span className="stat-label">Levels</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.aiRuns}</span>
          <span className="stat-label">AI Runs</span>
        </div>
      </div>
      
      {/* Quick Actions */}
      <section className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-buttons">
          <button className="action-btn primary" onClick={onGenerateLevel}>
            <span className="action-icon">🚀</span>
            <span>Generate Level</span>
          </button>
          <button className="action-btn" onClick={onCreateProject}>
            <span className="action-icon">📁</span>
            <span>New Project</span>
          </button>
          <button className="action-btn" onClick={() => setQuickAction('import')}>
            <span className="action-icon">📥</span>
            <span>Import</span>
          </button>
        </div>
      </section>
      
      {/* Recent Projects */}
      <section className="recent-section">
        <h2>Recent Projects</h2>
        {projects.length === 0 ? (
          <div className="empty-state">
            <p>No projects yet. Create one to get started!</p>
            <button className="action-btn primary" onClick={onCreateProject}>
              + Create Project
            </button>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map(project => (
              <div 
                key={project.id} 
                className={`project-card ${currentProject?.id === project.id ? 'active' : ''}`}
                onClick={() => onSelectProject(project)}
              >
                <div className="project-icon">🎮</div>
                <div className="project-info">
                  <h3>{project.name}</h3>
                  <span className="project-date">
                    Updated {new Date(project.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
