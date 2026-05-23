import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { calculatePoints, getPointsLabel } from '../lib/scoring'
import { format } from 'date-fns'

function TeamFlag({ src, name }) {
  const [error, setError] = useState(false)
  if (error || !src) {
    return <div className="team-flag-fallback">🏳️</div>
  }
  return <img className="team-flag" src={src} alt={name} onError={() => setError(true)} />
}

export default function MatchCard({ match, userPrediction: initialPrediction, onPredictionSaved }) {
  const { user } = useAuth()
  const [homeInput, setHomeInput] = useState('')
  const [awayInput, setAwayInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [prediction, setPrediction] = useState(initialPrediction)
  const [allPredictions, setAllPredictions] = useState([])
  const [showingAll, setShowingAll] = useState(false)

  const now = new Date()
  const kickoff = new Date(match.kickoff_time)
  const minutesUntilKickoff = (kickoff - now) / 60000
  const isLocked = minutesUntilKickoff <= 10
  const isRevealTime = minutesUntilKickoff <= 5
  const isFinished = match.status === 'finished'
  const isLive = match.status === 'live'

  useEffect(() => {
    if (initialPrediction) {
      setHomeInput(String(initialPrediction.predicted_home_score))
      setAwayInput(String(initialPrediction.predicted_away_score))
      setPrediction(initialPrediction)
    }
  }, [initialPrediction])

  useEffect(() => {
    if (isRevealTime || isFinished || isLive) {
      fetchAllPredictions()
    }
  }, [isRevealTime, isFinished, isLive, match.id])

  async function fetchAllPredictions() {
    const { data } = await supabase
      .from('predictions')
      .select('*, profiles(username)')
      .eq('match_id', match.id)
      .order('points_earned', { ascending: false })
    if (data) setAllPredictions(data)
    setShowingAll(true)
  }

  async function handleSubmit() {
    if (homeInput === '' || awayInput === '') return
    setSubmitting(true)
    const payload = {
      user_id: user.id,
      match_id: match.id,
      predicted_home_score: parseInt(homeInput),
      predicted_away_score: parseInt(awayInput),
    }
    const { data, error } = await supabase
      .from('predictions')
      .upsert(payload, { onConflict: 'user_id,match_id' })
      .select()
      .single()
    if (!error && data) {
      setPrediction(data)
      onPredictionSaved?.()
    }
    setSubmitting(false)
  }

  function getStatusBadge() {
    if (isLive) return <span className="match-status-badge badge-live">● Live</span>
    if (isFinished) return <span className="match-status-badge badge-finished">Finished</span>
    if (isLocked) return <span className="match-status-badge badge-locked">Locked</span>
    return <span className="match-status-badge badge-upcoming">Upcoming</span>
  }

  function getMyPoints() {
    if (!prediction || !isFinished || match.home_score == null) return null
    const pts = calculatePoints(prediction, match.home_score, match.away_score)
    const { label, color } = getPointsLabel(pts)
    return (
      <span className="points-earned" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
        +{pts} pts — {label}
      </span>
    )
  }

  return (
    <div className={`match-card ${isLocked ? 'locked' : ''}`}>
      <div className="match-card-header">
        <span className="match-stage">
          {match.stage?.replace(/_/g, ' ')} {match.matchday ? `· MD ${match.matchday}` : ''}
        </span>
        {getStatusBadge()}
      </div>

      <div className="match-teams">
        <div className="team">
          <TeamFlag src={match.home_team_flag} name={match.home_team} />
          <span className="team-name">{match.home_team}</span>
        </div>

        <div className="match-score-vs">
          {isFinished || isLive ? (
            <div className="score-display">
              {match.home_score ?? '?'} – {match.away_score ?? '?'}
            </div>
          ) : (
            <div className="vs-text">VS</div>
          )}
          <div className="match-time">
            {format(kickoff, 'MMM d · HH:mm')}
          </div>
        </div>

        <div className="team">
          <TeamFlag src={match.away_team_flag} name={match.away_team} />
          <span className="team-name">{match.away_team}</span>
        </div>
      </div>

      {/* Prediction section */}
      <div className="prediction-section">
        {isFinished && prediction && (
          <div style={{ marginBottom: '10px' }}>
            {getMyPoints()}
          </div>
        )}

        {!isLocked && !isFinished && !isLive ? (
          <>
            <div className="prediction-label">Your Prediction</div>
            <div className="prediction-inputs">
              <input
                className="score-input"
                type="number"
                min="0"
                max="99"
                placeholder="0"
                value={homeInput}
                onChange={e => setHomeInput(e.target.value)}
              />
              <span className="score-dash">–</span>
              <input
                className="score-input"
                type="number"
                min="0"
                max="99"
                placeholder="0"
                value={awayInput}
                onChange={e => setAwayInput(e.target.value)}
              />
              <div className="prediction-submit">
                {prediction && !isLocked ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--green)' }}>
                      ✓ Saved: {prediction.predicted_home_score}–{prediction.predicted_away_score}
                    </span>
                    <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting}>
                      Update
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting || homeInput === '' || awayInput === ''}>
                    {submitting ? '...' : 'Predict'}
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          prediction && (isLocked || isFinished || isLive) && (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Your prediction: <span style={{ color: 'var(--accent)', fontFamily: 'Bebas Neue', fontSize: '16px' }}>
                {prediction.predicted_home_score} – {prediction.predicted_away_score}
              </span>
              {isLocked && !isFinished && !isLive && <span style={{ marginLeft: '8px', color: 'var(--text-secondary)' }}>(locked)</span>}
            </div>
          )
        )}

        {!prediction && isLocked && !isFinished && !isLive && (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Predictions are locked for this match.
          </div>
        )}
      </div>

      {/* All predictions reveal */}
      {showingAll && allPredictions.length > 0 && (
        <div className="predictions-reveal">
          <div className="predictions-reveal-title">
            All Predictions ({allPredictions.length})
          </div>
          <div>
            {allPredictions.map(p => (
              <span key={p.id} className="prediction-pill">
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {p.profiles?.username}
                </span>
                <span className="prediction-pill-score">
                  {p.predicted_home_score}–{p.predicted_away_score}
                </span>
                {p.points_earned > 0 && (
                  <span style={{ fontSize: '11px', color: 'var(--green)' }}>+{p.points_earned}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
