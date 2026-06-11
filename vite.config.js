import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import adminMembersHandler from './api/admin-members.js'
import adminScoresHandler from './api/admin-scores.js'

async function parseJsonBody(req) {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return {}

  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }

  const body = Buffer.concat(chunks).toString('utf8').trim()
  if (!body) return {}

  return JSON.parse(body)
}

function createApiResponse(res) {
  const apiRes = Object.assign(res, {
    status(statusCode) {
      res.statusCode = statusCode
      return apiRes
    },
    json(payload) {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(payload))
      return apiRes
    },
  })

  return apiRes
}

function localApiRoute(handler) {
  return async (req, res, next) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost')
      req.query = Object.fromEntries(url.searchParams.entries())
      req.body = await parseJsonBody(req)
      await handler(req, createApiResponse(res))
    } catch (err) {
      next(err)
    }
  }
}

function localApiPlugin() {
  return {
    name: 'local-api-routes',
    configureServer(server) {
      server.middlewares.use('/api/admin-members', localApiRoute(adminMembersHandler))
      server.middlewares.use('/api/admin-scores', localApiRoute(adminScoresHandler))
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    plugins: [react(), localApiPlugin()],
  }
})
