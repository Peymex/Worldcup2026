import { createClient } from '@supabase/supabase-js'
import { calculatePoints } from '../src/lib/scoring.js'

const DATABASE_PAGE_SIZE = 1000
const DATABASE_WRITE_BATCH_SIZE = 500

class DisabledRealtimeTransport {
  constructor() {
    throw new Error('Realtime is disabled for admin API routes.')
  }
}

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Score management is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY to the server environment variables, then redeploy.')
  }

  return { supabaseUrl, serviceRoleKey }
}

function getAuthToken(req) {
  const authHeader = req.headers.authorization || ''
  const [scheme, token] = authHeader.split(' ')
  return scheme?.toLowerCase() === 'bearer' ? token : null
}

async function requireAdmin(req, supabaseAdmin) {
  const token = getAuthToken(req)
  if (!token) {
    const error = new Error('Missing authorization token')
    error.status = 401
    throw error
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData?.user) {
    const error = new Error('Invalid authorization token')
    error.status = 401
    throw error
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, is_admin')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile?.is_admin) {
    const error = new Error('Admin access required')
    error.status = 403
    throw error
  }
}

async function getMatch(supabaseAdmin, matchId) {
  const { data: match, error } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team, home_score, away_score, status')
    .eq('id', matchId)
    .single()

  if (error) throw error
  return match
}

async function getMatchPredictions(supabaseAdmin, matchId) {
  const { data, error } = await supabaseAdmin
    .from('predictions')
    .select('id, user_id, match_id, predicted_home_score, predicted_away_score, points_earned')
    .eq('match_id', matchId)

  if (error) throw error
  return data || []
}

async function getAllPredictions(supabaseAdmin) {
  const predictions = []

  for (let from = 0; ; from += DATABASE_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('predictions')
      .select('id, user_id, match_id, predicted_home_score, predicted_away_score, points_earned')
      .order('id', { ascending: true })
      .range(from, from + DATABASE_PAGE_SIZE - 1)

    if (error) throw error

    predictions.push(...(data || []))
    if (!data || data.length < DATABASE_PAGE_SIZE) break
  }

  return predictions
}

async function upsertPredictions(supabaseAdmin, predictions) {
  let updatedCount = 0

  for (let index = 0; index < predictions.length; index += DATABASE_WRITE_BATCH_SIZE) {
    const batch = predictions.slice(index, index + DATABASE_WRITE_BATCH_SIZE)
    const { data: updatedPredictions, error } = await supabaseAdmin
      .from('predictions')
      .upsert(batch, { onConflict: 'id' })
      .select('id')

    if (error) throw error
    if ((updatedPredictions || []).length !== batch.length) {
      throw new Error('Not all predictions were scored.')
    }

    updatedCount += batch.length
  }

  return updatedCount
}

async function recomputeLeaderboardTotals(supabaseAdmin) {
  const [{ data: profiles, error: profilesError }, predictions] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, is_admin, total_points'),
    getAllPredictions(supabaseAdmin),
  ])

  if (profilesError) throw profilesError

  const totalsByUser = new Map()
  for (const prediction of predictions || []) {
    const currentTotal = totalsByUser.get(prediction.user_id) || 0
    totalsByUser.set(prediction.user_id, currentTotal + (Number(prediction.points_earned) || 0))
  }

  const profileUpdates = (profiles || []).map(profile => ({
    ...profile,
    total_points: totalsByUser.get(profile.id) || 0,
  }))

  if (profileUpdates.length > 0) {
    const { data: updatedProfiles, error: updateError } = await supabaseAdmin
      .from('profiles')
      .upsert(profileUpdates, { onConflict: 'id' })
      .select('id')

    if (updateError) throw updateError
    if ((updatedProfiles || []).length !== profileUpdates.length) {
      throw new Error('Not all leaderboard totals were updated.')
    }
  }

  return profileUpdates.map(profile => ({
    id: profile.id,
    total_points: profile.total_points,
  }))
}

async function finalizeMatch(req, res, supabaseAdmin) {
  const matchId = req.body?.matchId
  const homeScore = Number(req.body?.homeScore)
  const awayScore = Number(req.body?.awayScore)

  if (matchId === undefined || matchId === null || matchId === '') {
    return res.status(400).json({ error: 'Match id is required.' })
  }

  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
    return res.status(400).json({ error: 'Final scores must be non-negative whole numbers.' })
  }

  const match = await getMatch(supabaseAdmin, matchId)
  const predictions = await getMatchPredictions(supabaseAdmin, matchId)
  const scoredPredictions = predictions.map(prediction => ({
    ...prediction,
    points_earned: calculatePoints(prediction, homeScore, awayScore),
  }))

  await upsertPredictions(supabaseAdmin, scoredPredictions)

  const totals = await recomputeLeaderboardTotals(supabaseAdmin)

  const { data: updatedMatch, error: matchError } = await supabaseAdmin
    .from('matches')
    .update({
      home_score: homeScore,
      away_score: awayScore,
      status: 'finished',
    })
    .eq('id', matchId)
    .select('id, home_team, away_team, home_score, away_score, status')
    .single()

  if (matchError) throw matchError

  return res.status(200).json({
    match: updatedMatch || match,
    scoredCount: scoredPredictions.length,
    totals,
  })
}

async function resetMatch(req, res, supabaseAdmin) {
  const matchId = req.body?.matchId
  if (matchId === undefined || matchId === null || matchId === '') {
    return res.status(400).json({ error: 'Match id is required.' })
  }

  await getMatch(supabaseAdmin, matchId)
  const predictions = await getMatchPredictions(supabaseAdmin, matchId)

  const { data: resetPredictions, error: predictionsError } = await supabaseAdmin
    .from('predictions')
    .update({ points_earned: 0 })
    .eq('match_id', matchId)
    .select('id')

  if (predictionsError) throw predictionsError
  if ((resetPredictions || []).length !== predictions.length) {
    throw new Error('Not all prediction points were reset.')
  }

  const totals = await recomputeLeaderboardTotals(supabaseAdmin)

  const { data: updatedMatch, error: matchError } = await supabaseAdmin
    .from('matches')
    .update({
      home_score: null,
      away_score: null,
      status: 'upcoming',
    })
    .eq('id', matchId)
    .select('id, home_team, away_team, home_score, away_score, status')
    .single()

  if (matchError) throw matchError

  return res.status(200).json({ match: updatedMatch, totals })
}

async function recalculateAllScores(res, supabaseAdmin) {
  const [{ data: matches, error: matchesError }, predictions] = await Promise.all([
    supabaseAdmin
      .from('matches')
      .select('id, home_score, away_score, status'),
    getAllPredictions(supabaseAdmin),
  ])

  if (matchesError) throw matchesError

  const matchesById = new Map((matches || []).map(match => [String(match.id), match]))
  const correctedPredictions = predictions.map(prediction => {
    const match = matchesById.get(String(prediction.match_id))
    const points = match?.status === 'finished' && match.home_score != null && match.away_score != null
      ? calculatePoints(prediction, Number(match.home_score), Number(match.away_score))
      : 0

    return {
      ...prediction,
      points_earned: points,
    }
  })
  const changedPredictions = correctedPredictions.filter((prediction, index) => {
    return (Number(predictions[index].points_earned) || 0) !== prediction.points_earned
  })

  await upsertPredictions(supabaseAdmin, changedPredictions)
  const totals = await recomputeLeaderboardTotals(supabaseAdmin)

  return res.status(200).json({
    predictionCount: predictions.length,
    updatedPredictionCount: changedPredictions.length,
    totals,
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  try {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig()
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        transport: DisabledRealtimeTransport,
      },
    })

    await requireAdmin(req, supabaseAdmin)

    if (req.body?.action === 'finalize') {
      return finalizeMatch(req, res, supabaseAdmin)
    }

    if (req.body?.action === 'reset') {
      return resetMatch(req, res, supabaseAdmin)
    }

    if (req.body?.action === 'recalculate') {
      return recalculateAllScores(res, supabaseAdmin)
    }

    return res.status(400).json({ error: 'Unknown score management action.' })
  } catch (err) {
    if (!err.status || err.status >= 500) {
      console.error('Admin score management failed:', err)
    }
    return res.status(err.status || 500).json({
      error: err.message || 'Score management failed.',
    })
  }
}
