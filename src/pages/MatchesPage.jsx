import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import MatchCard from '../components/MatchCard'

export default function MatchesPage() {
  const { user, profile } = useAuth()
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')

  useEffect(() => {
    fetchData()
  }, [user])

  async function fetchData() {
    setLoading(true)
    const [{ data: matchData }, { data: predData }] = await Promise.all([
      supabase.from('matches').select('*').order('kickoff_time', { ascending: true }),
      supabase.from('predictions').select('*').eq('user_id', user.id)
    ])
    setMatches(matchData || [])
    const predMap = {}
    predData?.forEach(p => { predMap[p.match_id] = p })
    setPredictions(predMap)
    setLoading(false)
  }

  const now = new Date()
  const upcomingMatches = matches.filter(m => m.status === 'upcoming')
  const liveMatches = matches.filter(m => m.status === 'live')
  const finishedMatches = matches.filter(m => m.status === 'finished').reverse()

  const displayMatches = tab === 'upcoming' ? [...liveMatches, ...upcomingMatches]
    : tab === 'finished' ? finishedMatches
    : matches

  const totalPredictions = Object.keys(predictions).length
  const totalPoints = profile?.total_points || 0

  if (loading) return <div className="loading-spinner"><div className="spinner" /><span>Loading matches...</span></div>

  return (
    <div>
      <div className="hero">
        <div className="hero-title">WORLD CUP 2026</div>
        <div className="hero-subtitle">Predict every match. Climb the leaderboard. Win the pot.</div>
        <div className="hero-stats">
          <div>
            <div className="hero-stat-value">{totalPoints}</div>
            <div className="hero-stat-label">Your Points</div>
          </div>
          <div>
            <div className="hero-stat-value">{totalPredictions}</div>
            <div className="hero-stat-label">Predictions Made</div>
          </div>
          <div>
            <div className="hero-stat-value">{upcomingMatches.length}</div>
            <div className="hero-stat-label">Matches Left</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
          Upcoming {liveMatches.length > 0 && `· ${liveMatches.length} Live`}
        </button>
        <button className={`tab-btn ${tab === 'finished' ? 'active' : ''}`} onClick={() => setTab('finished')}>
          Finished ({finishedMatches.length})
        </button>
        <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          All ({matches.length})
        </button>
      </div>

      {displayMatches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚽</div>
          <div className="empty-state-title">No matches yet</div>
          <div>Matches will appear here once the tournament schedule is loaded.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displayMatches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              userPrediction={predictions[match.id]}
              onPredictionSaved={fetchData}
            />
          ))}
        </div>
      )}
    </div>
  )
}
