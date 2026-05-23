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

      {/* Teams row */}
      <div className="match-teams">
        {/* Home team */}
        <div className="team">
          <TeamFlag name={match.home_team} />
          <span className="team-name">{match.home_team}</span>
          {/* Home score input below team */}
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

        {/* Middle: VS or score */}
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
          {/* Submit button in middle */}
          {!isLocked && !isFinished && !isLive && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSubmit}
              disabled={submitting || homeInput === '' || awayInput === ''}
              style={{ marginTop: '8px' }}
            >
              {submitting ? '...' : prediction ? 'Update' : 'Predict'}
            </button>
          )}
        </div>

        {/* Away team */}
        <div className="team">
          <TeamFlag name={match.away_team} />
          <span className="team-name">{match.away_team}</span>
          {/* Away score input below team */}
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

      {/* Points earned */}
      {isFinished && prediction && (
        <div style={{ marginBottom: '8px' }}>{getMyPoints()}</div>
      )}

      {/* Locked message */}
      {!prediction && isLocked && !isFinished && !isLive && (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
          Predictions locked for this match.
        </div>
      )}

      {/* Saved indicator */}
      {prediction && !isLocked && !isFinished && !isLive && (
        <div style={{ fontSize: '12px', color: 'var(--green)', paddingTop: '4px' }}>
          ✓ Prediction saved
        </div>
      )}

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
