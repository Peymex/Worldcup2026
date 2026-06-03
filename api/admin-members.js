import { createClient } from '@supabase/supabase-js'

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

  if (!supabaseUrl) {
    throw new Error('Member management is missing SUPABASE_URL. Add SUPABASE_URL to your Vercel environment variables, then redeploy.')
  }

  if (!serviceRoleKey) {
    throw new Error('Member management is missing a server Supabase key. Add SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY to your Vercel environment variables, then redeploy.')
  }

  return { supabaseUrl, serviceRoleKey }
}

function getAuthToken(req) {
  const authHeader = req.headers.authorization || ''
  const [scheme, token] = authHeader.split(' ')
  return scheme?.toLowerCase() === 'bearer' ? token : null
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
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

  return userData.user
}

async function listAllAuthUsers(supabaseAdmin) {
  const users = []
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error) throw error

    users.push(...(data?.users || []))
    if (!data?.users || data.users.length < perPage) break
    page += 1
  }

  return users
}

async function listMembers(supabaseAdmin) {
  const [{ data: profiles, error: profilesError }, authUsers] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, is_admin, total_points')
      .order('full_name', { ascending: true }),
    listAllAuthUsers(supabaseAdmin),
  ])

  if (profilesError) throw profilesError

  const authById = {}
  authUsers.forEach(user => {
    authById[user.id] = user
  })

  return (profiles || []).map(profile => {
    const authUser = authById[profile.id]
    return {
      ...profile,
      email: authUser?.email || '',
      created_at: authUser?.created_at || null,
      last_sign_in_at: authUser?.last_sign_in_at || null,
    }
  })
}

async function createMember(req, res, supabaseAdmin) {
  const email = cleanText(req.body?.email).toLowerCase()
  const password = req.body?.password || ''
  const username = cleanText(req.body?.username)
  const fullName = cleanText(req.body?.full_name)
  const isAdmin = Boolean(req.body?.is_admin)

  if (!email || !password || !username) {
    return res.status(400).json({ error: 'Email, password, and username are required.' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' })
  }

  const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      full_name: fullName,
    },
  })

  if (createError) throw createError

  const user = authData.user
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: user.id,
      username,
      full_name: fullName,
      is_admin: isAdmin,
      total_points: 0,
    }, { onConflict: 'id' })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(user.id)
    throw profileError
  }

  const members = await listMembers(supabaseAdmin)
  return res.status(201).json({ members })
}

async function updateMember(req, res, supabaseAdmin, currentUser) {
  const id = cleanText(req.body?.id)
  const email = cleanText(req.body?.email).toLowerCase()
  const password = req.body?.password || ''
  const username = cleanText(req.body?.username)
  const fullName = cleanText(req.body?.full_name)
  const isAdmin = Boolean(req.body?.is_admin)

  if (!id || !email || !username) {
    return res.status(400).json({ error: 'Member id, email, and username are required.' })
  }

  if (password && password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' })
  }

  if (id === currentUser.id && !isAdmin) {
    return res.status(400).json({ error: 'You cannot remove your own admin access.' })
  }

  const authUpdate = {
    email,
    user_metadata: {
      username,
      full_name: fullName,
    },
  }

  if (password) authUpdate.password = password

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdate)
  if (authError) throw authError

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      username,
      full_name: fullName,
      is_admin: isAdmin,
    })
    .eq('id', id)

  if (profileError) throw profileError

  const members = await listMembers(supabaseAdmin)
  return res.status(200).json({ members })
}

async function deleteMember(req, res, supabaseAdmin, currentUser) {
  const id = cleanText(req.body?.id || req.query?.id)

  if (!id) {
    return res.status(400).json({ error: 'Member id is required.' })
  }

  if (id === currentUser.id) {
    return res.status(400).json({ error: 'You cannot remove your own account.' })
  }

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (authError) throw authError

  const { error: predictionsError } = await supabaseAdmin
    .from('predictions')
    .delete()
    .eq('user_id', id)

  if (predictionsError) throw predictionsError

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', id)

  if (profileError) throw profileError

  const members = await listMembers(supabaseAdmin)
  return res.status(200).json({ members })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
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

    const currentUser = await requireAdmin(req, supabaseAdmin)

    if (req.method === 'GET') {
      const members = await listMembers(supabaseAdmin)
      return res.status(200).json({ members })
    }

    if (req.method === 'POST') {
      return createMember(req, res, supabaseAdmin)
    }

    if (req.method === 'PATCH') {
      return updateMember(req, res, supabaseAdmin, currentUser)
    }

    if (req.method === 'DELETE') {
      return deleteMember(req, res, supabaseAdmin, currentUser)
    }

    res.setHeader('Allow', 'GET,POST,PATCH,DELETE,OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({ error: err.message || 'Unexpected server error' })
  }
}
