export function calculatePoints(prediction, actualHome, actualAway) {
  const predHome = prediction.predicted_home_score
  const predAway = prediction.predicted_away_score

  // Exact result and score for both teams = 10 points
  if (predHome === actualHome && predAway === actualAway) {
    return 10
  }

  const predDiff = predHome - predAway
  const actualDiff = actualHome - actualAway
  const predResult = getResult(predHome, predAway)
  const actualResult = getResult(actualHome, actualAway)

  // Correct winner with right goal difference, or any non-exact draw = 7 points
  if (predDiff === actualDiff && predResult === actualResult) {
    return 7
  }

  // Correct winning team only = 5 points
  if (predResult === actualResult) {
    return 5
  }

  // Participation = 2 points
  return 2
}

export function getResult(homeScore, awayScore) {
  if (homeScore > awayScore) return 'home'
  if (awayScore > homeScore) return 'away'
  return 'draw'
}

export function getPointsLabel(points) {
  switch (points) {
    case 10: return { label: 'Exact Score!', color: '#00C853' }
    case 7: return { label: 'Right Margin!', color: '#64DD17' }
    case 5: return { label: 'Right Winner!', color: '#FFD600' }
    case 2: return { label: 'Participated', color: '#90A4AE' }
    default: return { label: '', color: '#90A4AE' }
  }
}
