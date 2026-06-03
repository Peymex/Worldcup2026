import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import MatchCard from '../components/MatchCard'
import { format, isToday, isTomorrow } from 'date-fns'

function getDateKey(match) {
  return format(new Date(match.kickoff_time), 'yyyy-MM-dd')
}

function getDateTitle(date) {
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'EEEE')
}

function groupMatchesByDate(matchList) {
  const groups = []
  const groupsByKey = {}

  matchList.forEach(match => {
    const date = new Date(match.kickoff_time)
    const key = getDateKey(match)

    if (!groupsByKey[key]) {
      groupsByKey[key] = {
        key,
        date,
        matches: [],
      }
      groups.push(groupsByKey[key])
    }

    groupsByKey[key].matches.push(match)
  })

  return groups
}

export default function MatchesPage() {
  const { user, profile } = useAuth()
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [selectedDate, setSelectedDate] = useState('all')

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

  const upcomingMatches = matches.filter(m => m.status === 'upcoming')
  const liveMatches = matches.filter(m => m.status === 'live')
  const finishedMatches = matches.filter(m => m.status === 'finished').reverse()

  const displayMatches = tab === 'upcoming' ? [...liveMatches, ...upcomingMatches]
    : tab === 'finished' ? finishedMatches
    : matches

  const totalPredictions = Object.keys(predictions).length
  const totalPoints = profile?.total_points || 0
  const dateGroups = groupMatchesByDate(displayMatches)
  const visibleDateGroups = selectedDate === 'all'
    ? dateGroups
    : dateGroups.filter(group => group.key === selectedDate)

  function handleTabChange(nextTab) {
    setTab(nextTab)
    setSelectedDate('all')
  }

  function handlePredictionChanged(matchId) {
    if (matchId) {
      setPredictions(prev => {
        const next = { ...prev }
        delete next[matchId]
        return next
      })
    }
    fetchData()
  }

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
        <button className={`tab-btn ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => handleTabChange('upcoming')}>
          Upcoming {liveMatches.length > 0 && `· ${liveMatches.length} Live`}
        </button>
        <button className={`tab-btn ${tab === 'finished' ? 'active' : ''}`} onClick={() => handleTabChange('finished')}>
          Finished ({finishedMatches.length})
        </button>
        <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => handleTabChange('all')}>
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
        <div>
          <div className="date-rail" aria-label="Filter matches by date">
            <button
              className={`date-chip date-chip-all ${selectedDate === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedDate('all')}
            >
              <span className="date-chip-day">All Dates</span>
              <span className="date-chip-count">{displayMatches.length} matches</span>
            </button>

            {dateGroups.map(group => (
              <button
                key={group.key}
                className={`date-chip ${selectedDate === group.key ? 'active' : ''}`}
                onClick={() => setSelectedDate(group.key)}
              >
                <span className="date-chip-day">{getDateTitle(group.date)}</span>
                <span className="date-chip-date">{format(group.date, 'MMM d')}</span>
                <span className="date-chip-count">{group.matches.length} match{group.matches.length === 1 ? '' : 'es'}</span>
              </button>
            ))}
          </div>

          <div className="matches-by-date">
            {visibleDateGroups.map(group => (
              <section key={group.key} className="match-date-section">
                <div className="match-date-header">
                  <div className="match-date-marker">
                    <span className="match-date-day-number">{format(group.date, 'd')}</span>
                    <span className="match-date-month">{format(group.date, 'MMM')}</span>
                  </div>
                  <div>
                    <h2 className="match-date-title">{getDateTitle(group.date)}</h2>
                    <div className="match-date-subtitle">{format(group.date, 'EEEE, MMMM d, yyyy')}</div>
                  </div>
                  <span className="match-date-count">
                    {group.matches.length} match{group.matches.length === 1 ? '' : 'es'}
                  </span>
                </div>

                <div className="matches-stack">
                  {group.matches.map(match => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      userPrediction={predictions[match.id]}
                      onPredictionSaved={handlePredictionChanged}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
