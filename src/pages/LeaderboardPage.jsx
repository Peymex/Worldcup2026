import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'

export default function LeaderboardPage() {
  const { user } = useAuth()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [finishedPredictions, setFinishedPredictions] = useState([])
  const [predictionsLoading, setPredictionsLoading] = useState(false)
  const [predictionsError, setPredictionsError] = useState('')
  const predictionRequestRef = useRef(0)

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  async function fetchLeaderboard() {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, total_points')
      .order('total_points', { ascending: false })
    setPlayers(data || [])
    setLoading(false)
  }

  async function togglePlayerPredictions(player) {
    if (selectedPlayerId === player.id) {
      predictionRequestRef.current += 1
      setSelectedPlayerId(null)
      setFinishedPredictions([])
      setPredictionsError('')
      setPredictionsLoading(false)
      return
    }

    const requestId = predictionRequestRef.current + 1
    predictionRequestRef.current = requestId
    setSelectedPlayerId(player.id)
    setFinishedPredictions([])
    setPredictionsError('')
    setPredictionsLoading(true)

    try {
      const { data: finishedMatches, error: matchesError } = await supabase
        .from('matches')
        .select('id, home_team, away_team, home_score, away_score, kickoff_time')
        .eq('status', 'finished')
        .order('kickoff_time', { ascending: false })

      if (matchesError) throw matchesError

      const matchIds = finishedMatches?.map(match => match.id) || []
      if (matchIds.length === 0) {
        if (predictionRequestRef.current !== requestId) return
        setFinishedPredictions([])
        setPredictionsLoading(false)
        return
      }

      const { data: predictions, error: predictionsFetchError } = await supabase
        .from('predictions')
        .select('id, match_id, predicted_home_score, predicted_away_score, points_earned')
        .eq('user_id', player.id)
        .in('match_id', matchIds)

      if (predictionsFetchError) throw predictionsFetchError

      const predictionsByMatch = {}
      predictions?.forEach(prediction => {
        predictionsByMatch[prediction.match_id] = prediction
      })

      if (predictionRequestRef.current !== requestId) return

      setFinishedPredictions(
        finishedMatches
          .map(match => ({
            match,
            prediction: predictionsByMatch[match.id],
          }))
          .filter(item => item.prediction)
      )
    } catch (err) {
      if (predictionRequestRef.current !== requestId) return
      setPredictionsError(err.message || 'Could not load predictions.')
    }

    if (predictionRequestRef.current !== requestId) return
    setPredictionsLoading(false)
  }

  function handlePlayerKeyDown(event, player) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      togglePlayerPredictions(player)
    }
  }

  if (loading) return <div className="loading-spinner"><div className="spinner" /><span>Loading leaderboard...</span></div>

  const totalPlayers = players.length
  const prizeLabels = ['1st', '2nd', '3rd']
  const prizeClasses = ['prize-1st', 'prize-2nd', 'prize-3rd']
  const rankClasses = ['rank-1', 'rank-2', 'rank-3']

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Leaderboard</h2>
        <span className="section-count">{totalPlayers} players</span>
      </div>

      {players.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏆</div>
          <div className="empty-state-title">No players yet</div>
          <div>Invite your friends to join!</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {players.map((player, index) => {
            const rank = index + 1
            const isMe = player.id === user?.id
            const displayName = player.full_name?.trim() || player.username
            const isSelected = selectedPlayerId === player.id
            return (
              <div key={player.id} className="leaderboard-player-item">
                <div
                  className={`leaderboard-row leaderboard-row-clickable ${isSelected ? 'expanded' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => togglePlayerPredictions(player)}
                  onKeyDown={event => handlePlayerKeyDown(event, player)}
                  style={isMe ? { background: 'var(--accent-dim)' } : {}}
                >
                  <div className={`rank-number ${rankClasses[index] || ''}`}>
                    {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                  </div>
                  <div className="leaderboard-name">
                    {displayName}
                    {isMe && <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase' }}>You</span>}
                    {rank <= 3 && player.total_points > 0 && (
                      <span className={`prize-badge ${prizeClasses[rank - 1]}`} style={{ marginLeft: '8px' }}>
                        {prizeLabels[rank - 1]}
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="leaderboard-points">{player.total_points}</div>
                    <div className="leaderboard-pts-label">pts</div>
                  </div>
                </div>

                {isSelected && (
                  <div className="leaderboard-predictions-panel">
                    {predictionsLoading ? (
                      <div className="leaderboard-prediction-empty">Loading finished predictions...</div>
                    ) : predictionsError ? (
                      <div className="leaderboard-prediction-error">{predictionsError}</div>
                    ) : finishedPredictions.length === 0 ? (
                      <div className="leaderboard-prediction-empty">No finished-match predictions yet.</div>
                    ) : (
                      <div className="leaderboard-prediction-list">
                        {finishedPredictions.map(({ match, prediction }) => (
                          <div key={prediction.id} className="leaderboard-prediction-row">
                            <div>
                              <div className="leaderboard-prediction-match">{match.home_team} vs {match.away_team}</div>
                              <div className="leaderboard-prediction-date">{format(new Date(match.kickoff_time), 'MMM d, yyyy')}</div>
                            </div>
                            <div className="leaderboard-prediction-scores">
                              <span>Predicted {prediction.predicted_home_score}-{prediction.predicted_away_score}</span>
                              <span>Final {match.home_score}-{match.away_score}</span>
                              <span className="leaderboard-prediction-points">+{prediction.points_earned || 0}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
