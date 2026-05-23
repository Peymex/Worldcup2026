export function calculatePoints(prediction, actualHome, actualAway) {
  const predHome = prediction.predicted_home_score
  const predAway = prediction.predicted_away_score

  // Exact score match = 10 points
  if (predHome === actualHome && predAway === actualAway) {
    return 10
  }

  const predDiff = predHome - predAway
  const actualDiff = actualHome - actualAway
  const predResult = getResult(predHome, predAway)
  const actualResult = getResult(actualHome, actualAway)

  // Right goal difference AND right result = 7 points
  if (predDiff === actualDiff && predResult === actualResult) {
    return 7
  }

  // Just right result (win/draw/loss) = 5 points
  if (predResult === actualResult) {
    return 5
  }

  // Just participating = 1 point
  return 1
}

export function getResult(homeScore, awayScore) {
  if (homeScore > awayScore) return 'home'
  if (awayScore > homeScore) return 'away'
  return 'draw'
}

export function getPointsLabel(points) {
  switch (points) {
    case 10: return { label: 'Exact Score!', color: '#00C853' }
    case 7: return { label: 'Right Difference!', color: '#64DD17' }
    case 5: return { label: 'Right Result!', color: '#FFD600' }
    case 1: return { label: 'Participated', color: '#90A4AE' }
    default: return { label: '', color: '#90A4AE' }
  }
}
