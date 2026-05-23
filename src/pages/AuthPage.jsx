import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function AuthPage() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState('')
  const [message, setMessage] = useState('')
  const { signIn, signUp } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else {
        if (!username.trim()) { setError('Username is required'); setLoading(false); return }
        await signUp(email, password, username.trim(), fullName.trim())
        setMessage('Account created! Check your email to confirm, then sign in.')
        setMode('signin')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">WC2026</div>
        <div className="auth-subtitle">
          {mode === 'signin' ? 'Sign in to make your predictions' : 'Join the prediction game'}
        </div>

        {error && <div className="auth-error">{error}</div>}
        {message && (
          <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '8px', color: 'var(--green)', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" type="text" placeholder="Your name" value={fullName} onChange={e => setFullName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" type="text" placeholder="e.g. goatnaldo" value={username} onChange={e => setUsername(e.target.value)} required />
              </div>
            </>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: '8px', padding: '13px' }}>
            {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'signin' ? (
            <>Don't have an account? <button onClick={() => setMode('signup')}>Sign up</button></>
          ) : (
            <>Already have an account? <button onClick={() => setMode('signin')}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  )
}
