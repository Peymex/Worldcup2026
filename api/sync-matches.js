export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  try {
    const response = await fetch(
      'https://api.football-data.org/v4/competitions/2000/matches',
      { headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY } }
    )
    const data = await response.json()
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
