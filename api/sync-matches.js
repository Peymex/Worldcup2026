export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  try {
    // First check available competitions
    const compResponse = await fetch('https://api.football-data.org/v4/competitions', {
      headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY }
    })
    const compData = await compResponse.json()
    
    // Find World Cup
    const wc = compData.competitions?.find(c => 
      c.name.toLowerCase().includes('world cup') || c.code === 'WC'
    )

    if (!wc) {
      return res.status(200).json({ 
        matches: [], 
        debug: compData.competitions?.map(c => `${c.id}: ${c.name}`) 
      })
    }

    const response = await fetch(
      `https://api.football-data.org/v4/competitions/${wc.id}/matches`, 
      { headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY } }
    )
    const data = await response.json()
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
