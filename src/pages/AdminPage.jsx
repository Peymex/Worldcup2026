import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { mapMatchToDb } from '../lib/footballApi'
import { calculatePoints } from '../lib/scoring'
import { format } from 'date-fns'

export default function AdminPage() {
  const { profile } = useAuth()
  const [syncing, setSyncing] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLocalMatches()
  }, [])

  async function fetchLocalMatches() {
    const { data } = await supabase.from('matches').select('*').order('kickoff_time')
    setMatches(data || [])
    setLoading(false)
  }

  async function syncMatches() {
    setSyncing(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/sync-matches')
      const data = await response.json()
      if (!data.matches) throw new Error(data.error || 'No matches returned')

      let upserted = 0
      for (const m of data.matches) {
        const mapped = mapMatchToDb(m)
        const { error } = await supabase
          .from('matches')
          .upsert(mapped, { onConflict: 'api_match_id' })
        if (!error) upserted++
      }
      setMessage(`✅ Synced ${upserted} matches from football-data.org`)
      fetchLocalMatches()
    } catch (err) {
      setError(`❌ Sync failed: ${err.message}`)
    }
    setSyncing(false)
  }

  async function calculateAllScores() {
    setScoring(true)
    setMessage('')
    setError('')
    try {
      const { data: finishedMatches } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'finished')
        .not('home_score', 'is', null)

      let updated = 0
      for (const match of finishedMatches || []) {
        const { data: preds } = await supabase
          .from('predictions')
          .select('*')
          .eq('match_id', match.id)

        for (const pred of preds || []) {
          const points = calculatePoints(pred, match.home_score, match.away_score)
          await supabase
            .from('predictions')
            .update({ points_earned: points })
            .eq('id', pred.id)
          updated++
        }
      }

      const { data: allProfiles } = await supabase.from('profiles').select('id')
      for (const p of allProfiles || []) {
        const { data: userPreds } = await supabase
          .from('predictions')
          .select('points_earned')
          .eq('user_id', p.id)
        const total = userPreds?.reduce((sum, pr) => sum + (pr.points_earned || 0), 0) || 0
        await supabase.from('profiles').update({ total_points: total }).eq('id', p.id)
      }

      setMessage(`✅ Scored ${updated} predictions and updated all leaderboard totals`)
    } catch (err) {
      setError(`❌ Scoring failed: ${err.message}`)
    }
    setScoring(false)
  }

  if (!profile?.is_admin) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔒</div>
        <div className="empty-state-title">Admin Only</div>
        <div>You don't have admin access.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Admin Panel</h2>
      </div>

      <div className="admin-banner">
        ⚡ Admin controls — changes affect all users
      </div>

      {message && (
        <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '8px', color: 'var(--green)', padding: '12px 16px', fontSize: '14px', marginBottom: '16px' }}>
          {message}
        </div>
      )}
      {error && (
        <div className="auth-error" style={{ marginBottom: '16px' }}>{error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
        <div className="card">
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '20px', marginBottom: '8px' }}>Sync Matches</div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Pull the latest match schedule and scores from football-data.org. Run this once at the start, and again after each matchday to update results.
          </div>
          <button className="btn btn-primary" onClick={syncMatches} disabled={syncing}>
            {syncing ? 'Syncing...' : '🔄 Sync Matches from API'}
          </button>
        </div>

        <div className="card">
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '20px', marginBottom: '8px' }}>Calculate Scores</div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            After syncing matches, run this to calculate points for all finished games and update the leaderboard. Safe to run multiple times.
          </div>
          <button className="btn btn-primary" onClick={calculateAllScores} disabled={scoring}>
            {scoring ? 'Calculating...' : '🏆 Calculate All Scores'}
          </button>
        </div>
      </div>

      <div className="section-header">
        <h2 className="section-title">Matches in DB</h2>
        <span className="section-count">{matches.length} total</span>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : matches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">No matches yet</div>
          <div>Click "Sync Matches" to load the World Cup schedule.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {matches.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>{m.home_team} vs {m.away_team}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{format(new Date(m.kickoff_time), 'MMM d, yyyy · HH:mm')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {m.status === 'finished' && m.home_score != null ? (
                  <span style={{ fontFamily: 'Bebas Neue', fontSize: '18px', color: 'var(--green)' }}>{m.home_score}–{m.away_score}</span>
                ) : (
                  <span className={`match-status-badge badge-${m.status}`}>{m.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
