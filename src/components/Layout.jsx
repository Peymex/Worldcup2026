import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [showRules, setShowRules] = useState(false)

  useEffect(() => {
    if (!showRules) return

    function handleKeyDown(event) {
      if (event.key === 'Escape') setShowRules(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showRules])

  async function handleSignOut() {
    await signOut()
    navigate('/auth')
  }

  return (
    <div className="app-layout">
      <nav className="navbar">
        <div className="navbar-inner">
          <NavLink to="/" className="navbar-logo">
            WC<span>2026</span>
          </NavLink>

          <div className="navbar-links">
            <NavLink to="/" end className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}>
              Matches
            </NavLink>
            <NavLink to="/predictions" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}>
              Predictions
            </NavLink>
            <NavLink to="/leaderboard" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}>
              Leaderboard
            </NavLink>
            {profile?.is_admin && (
              <NavLink to="/admin" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}>
                Admin
              </NavLink>
            )}
          </div>

          <div className="navbar-right">
            <span className="navbar-username">
              {profile?.username || profile?.full_name || ''}
            </span>
            <button
              className="rules-help-button"
              type="button"
              aria-label="Open scoring rules"
              onClick={() => setShowRules(true)}
            >
              ?
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>

      {showRules && (
        <div className="rules-modal-backdrop" role="presentation" onClick={() => setShowRules(false)}>
          <div
            className="rules-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-modal-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="rules-modal-header">
              <div>
                <h2 id="rules-modal-title" className="rules-modal-title">Scoring Rules</h2>
                <div className="rules-modal-subtitle">Predictions lock when the match kicks off.</div>
              </div>
              <button
                className="rules-modal-close"
                type="button"
                aria-label="Close scoring rules"
                onClick={() => setShowRules(false)}
              >
                ×
              </button>
            </div>

            <div className="rules-score-grid">
              <div className="rules-score-item">
                <span className="rules-score-value">10</span>
                <span className="rules-score-label">Exact score</span>
              </div>
              <div className="rules-score-item">
                <span className="rules-score-value">7</span>
                <span className="rules-score-label">Right goal difference</span>
              </div>
              <div className="rules-score-item">
                <span className="rules-score-value">5</span>
                <span className="rules-score-label">Right result</span>
              </div>
              <div className="rules-score-item">
                <span className="rules-score-value">1</span>
                <span className="rules-score-label">Participated</span>
              </div>
            </div>

            <div className="rules-notes">
              <div>Exact score means both teams' scores match the final result.</div>
              <div>Right goal difference means the margin and winner are correct, but the exact score is not.</div>
              <div>Right result means you picked the correct home win, away win, or draw.</div>
              <div>You can update or reset a prediction until that match's kickoff time.</div>
              <div>Other players' predictions are revealed once the match has kicked off.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
