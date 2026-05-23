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
