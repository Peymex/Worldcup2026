import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { calculatePoints, getPointsLabel } from '../lib/scoring'
import { format } from 'date-fns'

const TEAM_FLAGS = {
  'Mexico': 'mx', 'South Africa': 'za', 'South Korea': 'kr', 'Czechia': 'cz',
  'Canada': 'ca', 'Bosnia-Herzegovina': 'ba', 'United States': 'us', 'Paraguay': 'py',
  'Qatar': 'qa', 'Switzerland': 'ch', 'Brazil': 'br', 'Morocco': 'ma',
  'Haiti': 'ht', 'Scotland': 'gb-sct', 'Australia': 'au', 'Turkey': 'tr',
  'Germany': 'de', 'Curacao': 'cw', 'Netherlands': 'nl', 'Japan': 'jp',
  'Ivory Coast': 'ci', 'Ecuador': 'ec', 'Sweden': 'se', 'Tunisia': 'tn',
  'Spain': 'es', 'Cape Verde Islands': 'cv', 'Belgium': 'be', 'Egypt': 'eg',
  'Saudi Arabia': 'sa', 'Uruguay': 'uy', 'Iran': 'ir', 'New Zealand': 'nz',
  'France': 'fr', 'Senegal': 'sn', 'Iraq': 'iq', 'Norway': 'no',
  'Argentina': 'ar', 'Algeria': 'dz', 'Austria': 'at', 'Jordan': 'jo',
  'Portugal': 'pt', 'Congo DR': 'cd', 'Uzbekistan': 'uz', 'Colombia': 'co',
  'England': 'gb-eng', 'Croatia': 'hr', 'Ghana': 'gh', 'Panama': 'pa',
  'Korea Republic': 'kr', 'Bosnia-H.': 'ba', 'USA': 'us',
}

function TeamFlag({ name }) {
  const [error, setError] = useState(false)
  const code = TEAM_FLAGS[name]
  if (!code || error) {
    return (
      <div className="team-flag-fallback" style={{ fontSize: '28px', background: 'var(--border)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        🏳️
      </div>
    )
  }
  return (
    <img
      className="team-flag"
      src={`https://flagcdn.com/w80/${code}.png`}
      alt={name}
      onError={() => setError(true)}
      style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '50%', border: '2px solid var(--border)' }}
    />
  )
}

export default function MatchCard({ match, userPrediction: initialPrediction, onPredictionSaved }) {
  const { user } = useAuth()
  const [homeInput, setHomeInput] = useState('')
  const [awayInput, setAwayInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [prediction, setPrediction] = useState(initialPrediction)
  const [allPredictions, setAllPredictions] = useState([])
  const [showingAll, setShowingAll] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [actionError, setActionError] = useState('')

  const now = currentTime
  const kickoff = new Date(match.kickoff_time)
  const hasKickoffStarted = now >= kickoff
  const isFinished = match.status === 'finished'
  const isLive = match.status === 'live'
  const isLocked = hasKickoffStarted
  const isRevealTime = hasKickoffStarted

  useEffect(() => {
    let timer

    function scheduleNextTick() {
      const millisecondsUntilKickoff = kickoff.getTime() - Date.now()
      if (millisecondsUntilKickoff <= 0) {
        setCurrentTime(new Date())
        return
      }

      const timerDelay = Math.min(millisecondsUntilKickoff + 100, 60 * 1000)
      timer = window.setTimeout(() => {
        setCurrentTime(new Date())
        if (kickoff.getTime() > Date.now()) scheduleNextTick()
      }, timerDelay)
    }

    scheduleNextTick()
    return () => window.clearTimeout(timer)
  }, [match.kickoff_time])

  useEffect(() => {
    if (initialPrediction) {
      setHomeInput(String(initialPrediction.predicted_home_score))
      setAwayInput(String(initialPrediction.predicted_away_score))
      setPrediction(initialPrediction)
    } else {
      setHomeInput('')
      setAwayInput('')
      setPrediction(null)
    }
  }, [initialPrediction])

  useEffect(() => {
    if (isRevealTime || isFinished || isLive) {
      fetchAllPredictions()
    } else {
      setAllPredictions([])
      setShowingAll(false)
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
    if (new Date() >= kickoff || isFinished || isLive) return
    setActionError('')
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
    if (error) {
      setActionError(error.message || 'Could not save prediction.')
    } else if (data) {
      setPrediction(data)
      onPredictionSaved?.()
    }
    setSubmitting(false)
  }

  async function handleResetPrediction() {
    if (!prediction) return
    if (new Date() >= kickoff || isFinished || isLive) return
    setActionError('')
    setResetting(true)
    const predictionId = prediction.id
    const { error } = await supabase
      .from('predictions')
      .delete()
      .eq('id', predictionId)
      .eq('user_id', user.id)

    if (error) {
      setActionError(error.message || 'Could not reset prediction.')
    } else {
      const { data: remainingPrediction, error: verifyError } = await supabase
        .from('predictions')
        .select('id')
        .eq('id', predictionId)
        .maybeSingle()

      if (verifyError) {
        setActionError(verifyError.message || 'Could not verify prediction reset.')
      } else if (remainingPrediction) {
        setActionError('Reset is blocked by database permissions. Ask an admin to enable prediction deletes.')
      } else {
        setHomeInput('')
        setAwayInput('')
        setPrediction(null)
        setAllPredictions(prev => prev.filter(p => p.id !== predictionId))
        onPredictionSaved?.(match.id)
      }
    }
    setResetting(false)
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
    <div className={`match-card match-card-${match.status} ${isLocked ? 'locked' : ''}`}>
      <div className="match-card-header">
        <span className="match-stage">
          {match.stage?.replace(/_/g, ' ')} {match.matchday ? `· MD ${match.matchday}` : ''}
        </span>
        {getStatusBadge()}
      </div>

      <div className="match-teams">
        <div className="team">
          <TeamFlag name={match.home_team} />
          <span className="team-name">{match.home_team}</span>
          {!isLocked && !isFinished && !isLive && (
            <input
              className="score-input-under"
              type="number"
              min="0"
              max="99"
              placeholder="–"
              value={homeInput}
              onChange={e => setHomeInput(e.target.value)}
            />
          )}
          {(isLocked || isFinished || isLive) && prediction && (
            <div className="score-input-under-display">{prediction.predicted_home_score}</div>
          )}
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
          {!isLocked && !isFinished && !isLive && (
            <div className="match-action-buttons">
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSubmit}
                disabled={submitting || resetting || homeInput === '' || awayInput === ''}
              >
                {submitting ? '...' : prediction ? 'Update' : 'Predict'}
              </button>
              {prediction && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleResetPrediction}
                  disabled={submitting || resetting}
                >
                  {resetting ? 'Resetting...' : 'Reset'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="team">
          <TeamFlag name={match.away_team} />
          <span className="team-name">{match.away_team}</span>
          {!isLocked && !isFinished && !isLive && (
            <input
              className="score-input-under"
              type="number"
              min="0"
              max="99"
              placeholder="–"
              value={awayInput}
              onChange={e => setAwayInput(e.target.value)}
            />
          )}
          {(isLocked || isFinished || isLive) && prediction && (
            <div className="score-input-under-display">{prediction.predicted_away_score}</div>
          )}
        </div>
      </div>

      {isFinished && prediction && (
        <div style={{ marginBottom: '8px' }}>{getMyPoints()}</div>
      )}

      {!prediction && isLocked && !isFinished && !isLive && (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
          Predictions locked for this match.
        </div>
      )}

      {prediction && !isLocked && !isFinished && !isLive && (
        <div style={{ fontSize: '12px', color: 'var(--green)', paddingTop: '4px' }}>
          ✓ Prediction saved
        </div>
      )}

      {actionError && (
        <div className="match-action-error">
          {actionError}
        </div>
      )}

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
