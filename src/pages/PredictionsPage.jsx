import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function getDisplayName(player) {
  return player.full_name?.trim() || player.username || 'Unnamed player'
}

function getInitials(player) {
  const displayName = getDisplayName(player)
  const parts = displayName.split(/\s+/).filter(Boolean)
  const initials = parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`
    : displayName.slice(0, 2)

  return initials.toUpperCase()
}

function hasMatchStarted(match, now) {
  return new Date(match.kickoff_time) <= now
}

function getMatchBadge(match, now) {
  if (!hasMatchStarted(match, now)) return 'Hidden'
  if (match.status === 'finished') return 'Final'
  if (match.status === 'live') return 'Live'
  return 'Started'
}

export default function PredictionsPage() {
  const { user } = useAuth()
  const [players, setPlayers] = useState([])
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState([])
  const [playerSearch, setPlayerSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState(() => new Date())

  useEffect(() => {
    fetchPredictionMatrix()

    const refreshTimer = window.setInterval(fetchPredictionMatrix, 60000)
    return () => window.clearInterval(refreshTimer)
  }, [])

  async function fetchPredictionMatrix() {
    setLoading(true)
    setError('')
    const requestTime = new Date()
    setCurrentTime(requestTime)

    try {
      const [{ data: playerData, error: playerError }, { data: matchData, error: matchError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, full_name, total_points')
          .order('total_points', { ascending: false }),
        supabase
          .from('matches')
          .select('id, home_team, away_team, kickoff_time, status, home_score, away_score, stage')
          .order('kickoff_time', { ascending: true }),
      ])

      if (playerError) throw playerError
      if (matchError) throw matchError

      const startedMatchIds = (matchData || [])
        .filter(match => hasMatchStarted(match, requestTime))
        .map(match => match.id)

      let predictionData = []
      if (startedMatchIds.length > 0) {
        const { data, error: predictionError } = await supabase
          .from('predictions')
          .select('id, user_id, match_id, predicted_home_score, predicted_away_score, points_earned')
          .in('match_id', startedMatchIds)

        if (predictionError) throw predictionError
        predictionData = data || []
      }

      setPlayers(playerData || [])
      setMatches(matchData || [])
      setPredictions(predictionData)
    } catch (err) {
      setError(err.message || 'Could not load predictions.')
    }

    setLoading(false)
  }

  const predictionsByPlayerAndMatch = useMemo(() => {
    const map = {}

    predictions.forEach(prediction => {
      map[`${prediction.user_id}:${prediction.match_id}`] = prediction
    })

    return map
  }, [predictions])

  const filteredPlayers = useMemo(() => {
    const query = playerSearch.trim().toLowerCase()
    if (!query) return players

    return players.filter(player => {
      return [
        player.full_name,
        player.username,
      ].some(value => (value || '').toLowerCase().includes(query))
    })
  }, [players, playerSearch])

  const startedMatchesCount = matches.filter(match => hasMatchStarted(match, currentTime)).length
  const lockedMatchesCount = matches.length - startedMatchesCount

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /><span>Loading predictions...</span></div>
  }

  return (
    <div className="predictions-page">
      <div className="predictions-header">
        <div>
          <h2 className="section-title">Predictions</h2>
          <div className="predictions-subtitle">Everyone's picks, revealed at kickoff.</div>
        </div>
        <button className="btn btn-ghost btn-sm" type="button" onClick={fetchPredictionMatrix}>
          Refresh
        </button>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <div className="predictions-stats">
        <div className="predictions-stat">
          <span>{players.length}</span>
          <small>Players</small>
        </div>
        <div className="predictions-stat">
          <span>{startedMatchesCount}</span>
          <small>Revealed</small>
        </div>
        <div className="predictions-stat">
          <span>{lockedMatchesCount}</span>
          <small>Hidden</small>
        </div>
      </div>

      <div className="predictions-toolbar">
        <input
          className="form-input predictions-search"
          type="search"
          placeholder="Search players"
          aria-label="Search players"
          value={playerSearch}
          onChange={event => setPlayerSearch(event.target.value)}
        />
        <div className="predictions-legend">
          <span><i className="legend-dot legend-dot-revealed" /> Revealed</span>
          <span><i className="legend-dot legend-dot-hidden" /> Hidden</span>
        </div>
      </div>

      {players.length === 0 || matches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">Nothing to show yet</div>
          <div>Players and matches will appear here once they exist.</div>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔎</div>
          <div className="empty-state-title">No players found</div>
          <div>Try a different search.</div>
        </div>
      ) : (
        <div className="predictions-matrix-card">
          <div className="predictions-table-shell">
            <table className="predictions-table">
              <thead>
                <tr>
                  <th className="predictions-player-heading">Player</th>
                  {matches.map(match => {
                    const isStarted = hasMatchStarted(match, currentTime)
                    return (
                      <th key={match.id} className={`predictions-match-heading ${isStarted ? 'revealed' : 'hidden'}`}>
                        <div className="predictions-match-teams">{match.home_team} vs {match.away_team}</div>
                        <div className="predictions-match-date">{format(new Date(match.kickoff_time), 'MMM d · HH:mm')}</div>
                        <span className={`predictions-match-badge ${isStarted ? 'revealed' : 'hidden'}`}>
                          {getMatchBadge(match, currentTime)}
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map(player => {
                  const isMe = player.id === user?.id

                  return (
                    <tr key={player.id} className={isMe ? 'is-me' : ''}>
                      <th className="predictions-player-cell">
                        <span className="predictions-player-avatar">{getInitials(player)}</span>
                        <span className="predictions-player-info">
                          <span className="predictions-player-name">
                            {getDisplayName(player)}
                            {isMe && <small>You</small>}
                          </span>
                          <span className="predictions-player-points">{player.total_points || 0} pts</span>
                        </span>
                      </th>

                      {matches.map(match => {
                        const isStarted = hasMatchStarted(match, currentTime)
                        const prediction = predictionsByPlayerAndMatch[`${player.id}:${match.id}`]

                        if (!isStarted) {
                          return (
                            <td key={match.id} className="predictions-cell locked">
                              <span>Hidden</span>
                            </td>
                          )
                        }

                        if (!prediction) {
                          return (
                            <td key={match.id} className="predictions-cell empty">
                              <span>-</span>
                            </td>
                          )
                        }

                        return (
                          <td key={match.id} className="predictions-cell revealed">
                            <span className="prediction-score-pill">
                              {prediction.predicted_home_score}-{prediction.predicted_away_score}
                            </span>
                            {match.status === 'finished' && (
                              <span className="prediction-points-pill">+{prediction.points_earned || 0}</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
