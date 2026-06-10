import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function AccountPage() {
  const { user, profile } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleChangePassword(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    if (!user?.email) {
      setError('Could not find your account email. Please sign out and sign in again.')
      return
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from your current password.')
      return
    }

    setSaving(true)

    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })

      if (verifyError) {
        throw new Error('Current password is incorrect.')
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) throw updateError

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Password updated successfully.')
    } catch (err) {
      setError(err.message || 'Could not update password.')
    }

    setSaving(false)
  }

  return (
    <div className="account-page">
      <div className="section-header">
        <h2 className="section-title">Account</h2>
        <span className="section-count">{profile?.full_name || profile?.username || user?.email}</span>
      </div>

      <div className="account-grid">
        <section className="account-summary">
          <div className="account-avatar">
            {(profile?.full_name || profile?.username || user?.email || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3>{profile?.full_name || profile?.username || 'Your account'}</h3>
            <p>{user?.email}</p>
          </div>
        </section>

        <form className="card account-password-card" onSubmit={handleChangePassword}>
          <div className="account-card-title">Change Password</div>

          {message && (
            <div className="account-success">{message}</div>
          )}
          {error && (
            <div className="auth-error">{error}</div>
          )}

          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input
              className="form-input"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              className="form-input"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
              minLength={6}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input
              className="form-input"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              minLength={6}
              required
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
