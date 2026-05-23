import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

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

          <div style={{ display: 'flex', gap: '4px' }}>
            <NavLink to="/" end style={({ isActive }) => ({
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              background: isActive ? 'var(--accent-dim)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            })}>
              Matches
            </NavLink>
            <NavLink to="/leaderboard" style={({ isActive }) => ({
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              background: isActive ? 'var(--accent-dim)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            })}>
              Leaderboard
            </NavLink>
            {profile?.is_admin && (
              <NavLink to="/admin" style={({ isActive }) => ({
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              })}>
                Admin
              </NavLink>
            )}
          </div>

          <div className="navbar-right">
            <span className="navbar-username">
              {profile?.username || profile?.full_name || ''}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
