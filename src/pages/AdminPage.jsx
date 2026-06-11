import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'

function buildScoreInputs(matchList) {
  const inputs = {}
  matchList.forEach(match => {
    inputs[match.id] = {
      home: match.home_score ?? '',
      away: match.away_score ?? '',
    }
  })
  return inputs
}

const EMPTY_MEMBER_FORM = {
  email: '',
  password: '',
  username: '',
  full_name: '',
  is_admin: false,
}

const MEMBERS_PER_PAGE = 6

function getMemberDisplayName(member) {
  return member.full_name || member.username || member.email || 'Unnamed member'
}

function getMemberInitials(member) {
  const displayName = getMemberDisplayName(member)
  const parts = displayName.split(/\s+/).filter(Boolean)
  const initials = parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`
    : displayName.slice(0, 2)

  return initials.toUpperCase()
}

export default function AdminPage() {
  const { profile } = useAuth()
  const [savingScores, setSavingScores] = useState({})
  const [resettingMatches, setResettingMatches] = useState({})
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [memberSaving, setMemberSaving] = useState(false)
  const [memberDeleting, setMemberDeleting] = useState({})
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER_FORM)
  const [editingMembers, setEditingMembers] = useState({})
  const [expandedMemberId, setExpandedMemberId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [memberRoleFilter, setMemberRoleFilter] = useState('all')
  const [memberPage, setMemberPage] = useState(1)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [matches, setMatches] = useState([])
  const [scoreInputs, setScoreInputs] = useState({})
  const [loading, setLoading] = useState(true)

  const adminCount = useMemo(() => {
    return members.filter(member => member.is_admin).length
  }, [members])

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase()

    return members.filter(member => {
      if (memberRoleFilter === 'admins' && !member.is_admin) return false
      if (memberRoleFilter === 'members' && member.is_admin) return false
      if (!query) return true

      return [
        member.email,
        member.username,
        member.full_name,
      ].some(value => (value || '').toLowerCase().includes(query))
    })
  }, [members, memberRoleFilter, memberSearch])

  const totalMemberPages = Math.max(1, Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE))
  const currentMemberPage = Math.min(memberPage, totalMemberPages)
  const pagedMembers = filteredMembers.slice(
    (currentMemberPage - 1) * MEMBERS_PER_PAGE,
    currentMemberPage * MEMBERS_PER_PAGE,
  )
  const memberRangeStart = filteredMembers.length === 0 ? 0 : ((currentMemberPage - 1) * MEMBERS_PER_PAGE) + 1
  const memberRangeEnd = Math.min(currentMemberPage * MEMBERS_PER_PAGE, filteredMembers.length)

  useEffect(() => {
    if (!profile?.is_admin) {
      setLoading(false)
      setMembersLoading(false)
      return
    }

    fetchLocalMatches()
    fetchMembers()
  }, [profile?.is_admin])

  useEffect(() => {
    setMemberPage(1)
  }, [memberSearch, memberRoleFilter, members.length])

  useEffect(() => {
    if (memberPage > totalMemberPages) {
      setMemberPage(totalMemberPages)
    }
  }, [memberPage, totalMemberPages])

  async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('You need to sign in again.')

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    }
  }

  async function requestMembers(method, body) {
    const headers = await getAuthHeaders()
    const response = await fetch('/api/admin-members', {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Member request failed.')
    }

    return data.members || []
  }

  async function requestAdminScore(body) {
    const headers = await getAuthHeaders()
    const response = await fetch('/api/admin-scores', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Score management request failed.')
    }

    return data
  }

  function applyLeaderboardTotals(totals) {
    const totalsById = new Map(
      (totals || []).map(item => [String(item.id), item.total_points || 0])
    )

    setMembers(currentMembers => currentMembers.map(member => {
      const memberId = String(member.id)
      if (!totalsById.has(memberId)) return member

      return {
        ...member,
        total_points: totalsById.get(memberId),
      }
    }))
  }

  async function fetchMembers() {
    setMembersLoading(true)
    try {
      const nextMembers = await requestMembers('GET')
      setMembers(nextMembers)
      setEditingMembers(buildEditingMembers(nextMembers))
    } catch (err) {
      setError(`Loading members failed: ${err.message}`)
    }
    setMembersLoading(false)
  }

  function buildEditingMembers(memberList) {
    const rows = {}
    memberList.forEach(member => {
      rows[member.id] = {
        email: member.email || '',
        password: '',
        username: member.username || '',
        full_name: member.full_name || '',
        is_admin: Boolean(member.is_admin),
      }
    })
    return rows
  }

  function updateMemberForm(field, value) {
    setMemberForm(prev => ({ ...prev, [field]: value }))
  }

  function updateEditingMember(id, field, value) {
    setEditingMembers(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }))
  }

  async function createMember(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    setMemberSaving(true)

    try {
      const nextMembers = await requestMembers('POST', memberForm)
      setMembers(nextMembers)
      setEditingMembers(buildEditingMembers(nextMembers))
      setMemberForm(EMPTY_MEMBER_FORM)
      setMemberSearch('')
      setMemberRoleFilter('all')
      setMemberPage(1)
      setMessage(`Created member ${memberForm.email}.`)
    } catch (err) {
      setError(`Creating member failed: ${err.message}`)
    }

    setMemberSaving(false)
  }

  async function saveMember(member) {
    const draft = editingMembers[member.id]
    if (!draft) return

    setMessage('')
    setError('')
    setMemberSaving(true)

    try {
      const nextMembers = await requestMembers('PATCH', {
        id: member.id,
        ...draft,
      })
      setMembers(nextMembers)
      setEditingMembers(buildEditingMembers(nextMembers))
      setExpandedMemberId('')
      setMessage(`Updated ${draft.email}.`)
    } catch (err) {
      setError(`Updating member failed: ${err.message}`)
    }

    setMemberSaving(false)
  }

  async function deleteMember(member) {
    const displayName = member.full_name || member.username || member.email
    const confirmed = window.confirm(`Remove ${displayName}? This deletes their account and predictions.`)
    if (!confirmed) return

    setMessage('')
    setError('')
    setMemberDeleting(prev => ({ ...prev, [member.id]: true }))

    try {
      const nextMembers = await requestMembers('DELETE', { id: member.id })
      setMembers(nextMembers)
      setEditingMembers(buildEditingMembers(nextMembers))
      setExpandedMemberId('')
      setMessage(`Removed ${displayName}.`)
    } catch (err) {
      setError(`Removing member failed: ${err.message}`)
    }

    setMemberDeleting(prev => ({ ...prev, [member.id]: false }))
  }

  async function fetchLocalMatches() {
    const { data } = await supabase.from('matches').select('*').order('kickoff_time')
    const matchList = data || []
    setMatches(matchList)
    setScoreInputs(buildScoreInputs(matchList))
    setLoading(false)
  }

  function updateScoreInput(matchId, field, value) {
    setScoreInputs(prev => ({
      ...prev,
      [matchId]: {
        home: prev[matchId]?.home ?? '',
        away: prev[matchId]?.away ?? '',
        [field]: value,
      },
    }))
  }

  async function saveFinalScore(match) {
    const score = scoreInputs[match.id] || {}
    const homeScore = Number(score.home)
    const awayScore = Number(score.away)

    if (score.home === '' || score.away === '' || !Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
      setError('Enter both final scores before saving.')
      return
    }

    if (homeScore < 0 || awayScore < 0) {
      setError('Final scores cannot be negative.')
      return
    }

    setSavingScores(prev => ({ ...prev, [match.id]: true }))
    setMessage('')
    setError('')

    try {
      const result = await requestAdminScore({
        action: 'finalize',
        matchId: match.id,
        homeScore,
        awayScore,
      })

      applyLeaderboardTotals(result.totals)
      await fetchLocalMatches()

      setMessage(`Saved ${match.home_team} ${homeScore}-${awayScore} ${match.away_team}. Scored ${result.scoredCount} predictions and updated the leaderboard.`)
    } catch (err) {
      setError(`Saving final score failed: ${err.message}`)
    }

    setSavingScores(prev => ({ ...prev, [match.id]: false }))
  }

  async function resetMatch(match) {
    setResettingMatches(prev => ({ ...prev, [match.id]: true }))
    setMessage('')
    setError('')

    try {
      const result = await requestAdminScore({
        action: 'reset',
        matchId: match.id,
      })

      applyLeaderboardTotals(result.totals)
      await fetchLocalMatches()

      setMessage(`Reset ${match.home_team} vs ${match.away_team}. Users can predict again, and leaderboard totals were updated.`)
    } catch (err) {
      setError(`Resetting match failed: ${err.message}`)
    }

    setResettingMatches(prev => ({ ...prev, [match.id]: false }))
  }

  if (!profile?.is_admin) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔒</div>
        <div className="empty-state-title">Admin Only</div>
        <div>You don't have admin access.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Admin Panel</h2>
      </div>

      {message && (
        <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '8px', color: 'var(--green)', padding: '12px 16px', fontSize: '14px', marginBottom: '16px' }}>
          {message}
        </div>
      )}
      {error && (
        <div className="auth-error" style={{ marginBottom: '16px' }}>{error}</div>
      )}

      <div className="section-header">
        <h2 className="section-title">Members</h2>
        <span className="section-count">{filteredMembers.length} of {members.length}</span>
      </div>

      <div className="admin-members-grid">
        <form className="card admin-member-create" onSubmit={createMember}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '20px', marginBottom: '12px' }}>Create Member</div>
          <div className="admin-member-form-grid">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                value={memberForm.email}
                onChange={event => updateMemberForm('email', event.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Temporary Password</label>
              <input
                className="form-input"
                type="password"
                value={memberForm.password}
                onChange={event => updateMemberForm('password', event.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                value={memberForm.username}
                onChange={event => updateMemberForm('username', event.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                value={memberForm.full_name}
                onChange={event => updateMemberForm('full_name', event.target.value)}
              />
            </div>
          </div>
          <label className="admin-check-row">
            <input
              type="checkbox"
              checked={memberForm.is_admin}
              onChange={event => updateMemberForm('is_admin', event.target.checked)}
            />
            Admin access
          </label>
          <button className="btn btn-primary" type="submit" disabled={memberSaving}>
            {memberSaving ? 'Creating...' : 'Create Member'}
          </button>
        </form>

        <div className="card admin-member-list">
          <div className="admin-member-toolbar">
            <input
              className="form-input admin-member-search"
              type="search"
              placeholder="Search members"
              aria-label="Search members"
              value={memberSearch}
              onChange={event => setMemberSearch(event.target.value)}
            />
            <div className="admin-member-filters" aria-label="Member filter">
              <button
                className={`admin-member-filter ${memberRoleFilter === 'all' ? 'active' : ''}`}
                type="button"
                onClick={() => setMemberRoleFilter('all')}
              >
                All
              </button>
              <button
                className={`admin-member-filter ${memberRoleFilter === 'admins' ? 'active' : ''}`}
                type="button"
                onClick={() => setMemberRoleFilter('admins')}
              >
                Admins
              </button>
              <button
                className={`admin-member-filter ${memberRoleFilter === 'members' ? 'active' : ''}`}
                type="button"
                onClick={() => setMemberRoleFilter('members')}
              >
                Members
              </button>
            </div>
          </div>

          <div className="admin-member-summary">
            <span>{adminCount} admins</span>
            <span>{members.length - adminCount} members</span>
          </div>

          {membersLoading ? (
            <div className="loading-spinner"><div className="spinner" /><span>Loading members...</span></div>
          ) : members.length === 0 ? (
            <div className="empty-state" style={{ padding: '36px 16px' }}>
              <div className="empty-state-title">No members yet</div>
              <div>Create the first member from the form.</div>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="empty-state" style={{ padding: '36px 16px' }}>
              <div className="empty-state-title">No members</div>
              <div>Try a different search or filter.</div>
            </div>
          ) : (
            <>
              <div className="admin-member-directory">
                {pagedMembers.map(member => {
              const draft = editingMembers[member.id] || EMPTY_MEMBER_FORM
              const isDeleting = memberDeleting[member.id]
              const isExpanded = expandedMemberId === member.id
              const displayName = getMemberDisplayName(member)
              const lastSignIn = member.last_sign_in_at
                ? format(new Date(member.last_sign_in_at), 'MMM d, yyyy')
                : 'No sign in yet'

              return (
                <div key={member.id} className={`admin-member-row ${isExpanded ? 'is-expanded' : ''}`}>
                  <button
                    className="admin-member-main"
                    type="button"
                    onClick={() => setExpandedMemberId(isExpanded ? '' : member.id)}
                    aria-expanded={isExpanded}
                  >
                    <span className="admin-member-avatar">{getMemberInitials(member)}</span>
                    <span className="admin-member-identity">
                      <span className="admin-member-name-line">
                        <span className="admin-member-name">{displayName}</span>
                        {member.is_admin && <span className="admin-member-badge">Admin</span>}
                      </span>
                      <span className="admin-member-subline">{member.email || member.username}</span>
                    </span>
                    <span className="admin-member-score">
                      <strong>{member.total_points || 0}</strong>
                      <span>pts</span>
                    </span>
                    <span className="admin-member-last">{lastSignIn}</span>
                    <span className="admin-member-edit-label">{isExpanded ? 'Close' : 'Edit'}</span>
                  </button>

                  {isExpanded && (
                    <div className="admin-member-edit-panel">
                      <div className="admin-member-fields">
                        <div className="form-group">
                          <label className="form-label">Email</label>
                          <input
                            className="form-input"
                            type="email"
                            value={draft.email}
                            onChange={event => updateEditingMember(member.id, 'email', event.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Username</label>
                          <input
                            className="form-input"
                            type="text"
                            value={draft.username}
                            onChange={event => updateEditingMember(member.id, 'username', event.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Full Name</label>
                          <input
                            className="form-input"
                            type="text"
                            value={draft.full_name}
                            onChange={event => updateEditingMember(member.id, 'full_name', event.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">New Password</label>
                          <input
                            className="form-input"
                            type="password"
                            placeholder="Leave blank"
                            value={draft.password}
                            onChange={event => updateEditingMember(member.id, 'password', event.target.value)}
                          />
                        </div>
                      </div>

                      <div className="admin-member-actions">
                        <label className="admin-check-row">
                          <input
                            type="checkbox"
                            checked={Boolean(draft.is_admin)}
                            onChange={event => updateEditingMember(member.id, 'is_admin', event.target.checked)}
                          />
                          Admin
                        </label>
                        <button
                          className="btn btn-primary btn-sm"
                          type="button"
                          onClick={() => saveMember(member)}
                          disabled={memberSaving || isDeleting}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => deleteMember(member)}
                          disabled={memberSaving || isDeleting}
                        >
                          {isDeleting ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
                })}
              </div>

              <div className="admin-member-pagination">
                <span>{memberRangeStart}-{memberRangeEnd} of {filteredMembers.length}</span>
                <div className="admin-member-page-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => setMemberPage(page => Math.max(1, page - 1))}
                    disabled={currentMemberPage === 1}
                  >
                    Prev
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => setMemberPage(page => Math.min(totalMemberPages, page + 1))}
                    disabled={currentMemberPage === totalMemberPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="section-header">
        <h2 className="section-title">Manual Final Scores</h2>
        <span className="section-count">{matches.length} total</span>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : matches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">No matches yet</div>
          <div>Add matches to the database, then enter final scores here.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {matches.map(m => {
            const score = scoreInputs[m.id] || { home: '', away: '' }
            const isSaving = savingScores[m.id]
            const isResetting = resettingMatches[m.id]
            const isBusy = isSaving || isResetting

            return (
              <div key={m.id} className="admin-match-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>{m.home_team} vs {m.away_team}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{format(new Date(m.kickoff_time), 'MMM d, yyyy · HH:mm')}</div>
                </div>

                <div className="admin-score-editor">
                  <input
                    className="admin-score-input"
                    type="number"
                    min="0"
                    max="99"
                    value={score.home}
                    aria-label={`${m.home_team} final score`}
                    onChange={event => updateScoreInput(m.id, 'home', event.target.value)}
                  />
                  <span className="admin-score-separator">-</span>
                  <input
                    className="admin-score-input"
                    type="number"
                    min="0"
                    max="99"
                    value={score.away}
                    aria-label={`${m.away_team} final score`}
                    onChange={event => updateScoreInput(m.id, 'away', event.target.value)}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => saveFinalScore(m)}
                    disabled={isBusy || score.home === '' || score.away === ''}
                  >
                    {isSaving ? 'Saving...' : m.status === 'finished' ? 'Update Final' : 'Save Final'}
                  </button>
                  {m.status === 'finished' && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => resetMatch(m)}
                      disabled={isBusy}
                    >
                      {isResetting ? 'Resetting...' : 'Reset'}
                    </button>
                  )}
                  {m.status === 'finished' && (
                    <span className="match-status-badge badge-finished">Finished</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
