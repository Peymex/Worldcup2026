const API_KEY = import.meta.env.VITE_FOOTBALL_API_KEY
const BASE_URL = 'https://api.football-data.org/v4'

// World Cup 2026 competition ID
const WC_2026_ID = 2000

export async function fetchMatches() {
  const res = await fetch(`${BASE_URL}/competitions/${WC_2026_ID}/matches`, {
    headers: { 'X-Auth-Token': API_KEY }
  })
  if (!res.ok) throw new Error('Failed to fetch matches')
  const data = await res.json()
  return data.matches
}

export async function fetchMatch(matchId) {
  const res = await fetch(`${BASE_URL}/matches/${matchId}`, {
    headers: { 'X-Auth-Token': API_KEY }
  })
  if (!res.ok) throw new Error('Failed to fetch match')
  const data = await res.json()
  return data
}

export function mapMatchToDb(match) {
  return {
    api_match_id: String(match.id),
    home_team: match.homeTeam.name,
    away_team: match.awayTeam.name,
    home_team_flag: `https://crests.football-data.org/${match.homeTeam.id}.png`,
    away_team_flag: `https://crests.football-data.org/${match.awayTeam.id}.png`,
    kickoff_time: match.utcDate,
    home_score: match.score?.fullTime?.home ?? null,
    away_score: match.score?.fullTime?.away ?? null,
    status: match.status === 'FINISHED' ? 'finished' :
            match.status === 'IN_PLAY' || match.status === 'PAUSED' ? 'live' : 'upcoming',
    stage: match.stage,
    matchday: match.matchday,
  }
}
