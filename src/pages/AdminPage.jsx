import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { calculatePoints } from '../lib/scoring'
import { format } from 'date-fns'

function buildScoreInputs(matchList) {
  const inputs = {}
  matchList.forEach(match => {
    inputs[match.id] = {
      home: match.home_score ?? '',
      away: match.away_score ?? '',
    }
  })
  return inputs
}

export default function AdminPage() {
  const { profile } = useAuth()
  const [savingScores, setSavingScores] = useState({})
  const [resettingMatches, setResettingMatches] = useState({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [matches, setMatches] = useState([])
  const [scoreInputs, setScoreInputs] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLocalMatches()
  }, [])

  async function fetchLocalMatches() {
    const { data } = await supabase.from('matches').select('*').order('kickoff_time')
    const matchList = data || []
    setMatches(matchList)
    setScoreInputs(buildScoreInputs(matchList))
    setLoading(false)
  }

  function updateScoreInput(matchId, field, value) {
    setScoreInputs(prev => ({
      ...prev,
      [matchId]: {
        home: prev[matchId]?.home ?? '',
        away: prev[matchId]?.away ?? '',
        [field]: value,
      },
    }))
  }

  async function scorePredictionsForMatch(matchId, actualHome, actualAway) {
    const { data: predictions, error: predictionError } = await supabase
      .from('predictions')
      .select('*')
      .eq('match_id', matchId)

    if (predictionError) throw predictionError

    for (const prediction of predictions || []) {
      const points = calculatePoints(prediction, actualHome, actualAway)
      const { error: updateError } = await supabase
        .from('predictions')
        .update({ points_earned: points })
        .eq('id', prediction.id)

      if (updateError) throw updateError
    }

    return predictions?.length || 0
  }

  async function refreshLeaderboardTotals() {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')

    if (profilesError) throw profilesError

    for (const player of profiles || []) {
      const { data: predictions, error: predictionError } = await supabase
        .from('predictions')
        .select('points_earned')
        .eq('user_id', player.id)

      if (predictionError) throw predictionError

      const total = predictions?.reduce((sum, prediction) => {
        return sum + (prediction.points_earned || 0)
      }, 0) || 0

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ total_points: total })
        .eq('id', player.id)

      if (updateError) throw updateError
    }
  }

  async function saveFinalScore(match) {
    const score = scoreInputs[match.id] || {}
    const homeScore = Number(score.home)
    const awayScore = Number(score.away)

    if (score.home === '' || score.away === '' || !Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
      setError('Enter both final scores before saving.')
      return
    }

    if (homeScore < 0 || awayScore < 0) {
      setError('Final scores cannot be negative.')
      return
    }

    setSavingScores(prev => ({ ...prev, [match.id]: true }))
    setMessage('')
    setError('')

    try {
      const { error: matchError } = await supabase
        .from('matches')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          status: 'finished',
        })
        .eq('id', match.id)

      if (matchError) throw matchError

      const scoredCount = await scorePredictionsForMatch(match.id, homeScore, awayScore)
      await refreshLeaderboardTotals()
      await fetchLocalMatches()

      setMessage(`Saved ${match.home_team} ${homeScore}-${awayScore} ${match.away_team}. Scored ${scoredCount} predictions and updated the leaderboard.`)
    } catch (err) {
      setError(`Saving final score failed: ${err.message}`)
    }

    setSavingScores(prev => ({ ...prev, [match.id]: false }))
  }

  async function resetMatch(match) {
    setResettingMatches(prev => ({ ...prev, [match.id]: true }))
    setMessage('')
    setError('')

    try {
      const { error: matchError } = await supabase
        .from('matches')
        .update({
          home_score: null,
          away_score: null,
          status: 'upcoming',
        })
        .eq('id', match.id)

      if (matchError) throw matchError

      const { error: predictionsError } = await supabase
        .from('predictions')
        .update({ points_earned: 0 })
        .eq('match_id', match.id)

      if (predictionsError) throw predictionsError

      await refreshLeaderboardTotals()
      await fetchLocalMatches()

      setMessage(`Reset ${match.home_team} vs ${match.away_team}. Users can predict again, and leaderboard totals were updated.`)
    } catch (err) {
      setError(`Resetting match failed: ${err.message}`)
    }

    setResettingMatches(prev => ({ ...prev, [match.id]: false }))
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

      {message && (
        <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '8px', color: 'var(--green)', padding: '12px 16px', fontSize: '14px', marginBottom: '16px' }}>
          {message}
        </div>
      )}
      {error && (
        <div className="auth-error" style={{ marginBottom: '16px' }}>{error}</div>
      )}

      <div className="section-header">
        <h2 className="section-title">Manual Final Scores</h2>
        <span className="section-count">{matches.length} total</span>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : matches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">No matches yet</div>
          <div>Add matches to the database, then enter final scores here.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {matches.map(m => {
            const score = scoreInputs[m.id] || { home: '', away: '' }
            const isSaving = savingScores[m.id]
            const isResetting = resettingMatches[m.id]
            const isBusy = isSaving || isResetting

            return (
              <div key={m.id} className="admin-match-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>{m.home_team} vs {m.away_team}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{format(new Date(m.kickoff_time), 'MMM d, yyyy · HH:mm')}</div>
                </div>

                <div className="admin-score-editor">
                  <input
                    className="admin-score-input"
                    type="number"
                    min="0"
                    max="99"
                    value={score.home}
                    aria-label={`${m.home_team} final score`}
                    onChange={event => updateScoreInput(m.id, 'home', event.target.value)}
                  />
                  <span className="admin-score-separator">-</span>
                  <input
                    className="admin-score-input"
                    type="number"
                    min="0"
                    max="99"
                    value={score.away}
                    aria-label={`${m.away_team} final score`}
                    onChange={event => updateScoreInput(m.id, 'away', event.target.value)}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => saveFinalScore(m)}
                    disabled={isBusy || score.home === '' || score.away === ''}
                  >
                    {isSaving ? 'Saving...' : m.status === 'finished' ? 'Update Final' : 'Save Final'}
                  </button>
                  {m.status === 'finished' && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => resetMatch(m)}
                      disabled={isBusy}
                    >
                      {isResetting ? 'Resetting...' : 'Reset'}
                    </button>
                  )}
                  {m.status === 'finished' && (
                    <span className="match-status-badge badge-finished">Finished</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
