import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function LeaderboardPage() {
  const { user } = useAuth()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

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

      <div className="card" style={{ marginBottom: '20px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Prize Pool</div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            🥇 1st place → <strong style={{ color: 'var(--text-primary)' }}>50%</strong> &nbsp;
            🥈 2nd → <strong style={{ color: 'var(--text-primary)' }}>30%</strong> &nbsp;
            🥉 3rd → <strong style={{ color: 'var(--text-primary)' }}>20%</strong>
          </div>
        </div>
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
            return (
              <div
                key={player.id}
                className="leaderboard-row"
                style={isMe ? { background: 'var(--accent-dim)' } : {}}
              >
                <div className={`rank-number ${rankClasses[index] || ''}`}>
                  {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                </div>
                <div className="leaderboard-name">
                  {player.username}
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
            )
          })}
        </div>
      )}
    </div>
  )
}
