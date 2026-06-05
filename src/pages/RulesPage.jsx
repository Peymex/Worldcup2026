const scoringRules = [
  {
    points: 10,
    title: 'Exact score',
    description: 'Exact prediction of match result (win/draw) and correct score for both teams.',
  },
  {
    points: 7,
    title: 'Right margin',
    description: 'Correct prediction of the winning team with correct goal difference, or correct prediction of a draw without exact score.',
  },
  {
    points: 5,
    title: 'Right winner',
    description: 'Correct prediction of the winning team only, with incorrect goal difference and exact score.',
  },
  {
    points: 2,
    title: 'Participation',
    description: 'Participation in predicting each match.',
  },
]

const prizeDistribution = [
  { place: '1st Place', share: '50%', description: 'of the total amount' },
  { place: '2nd Place', share: '30%', description: 'of the total amount' },
  { place: '3rd Place', share: '20%', description: 'of the total amount' },
]

export default function RulesPage() {
  return (
    <div className="competition-rules-page">
      <header className="competition-rules-header">
        <div className="competition-rules-kicker">FIFA World Cup 2026</div>
        <h1 className="competition-rules-title">Prediction Competition Rules</h1>
        <p className="competition-rules-intro">
          Hello everyone, we are excited to organize a friendly and engaging contest to predict the outcomes of the FIFA World Cup 2026 matches. All interested participants are invited to join by submitting their predictions.
        </p>
      </header>

      <section className="competition-rules-section">
        <div className="competition-rules-section-label">How to Participate</div>
        <p>
          Participants must predict the result of each match by specifying the number of goals scored by each team. All predictions must be submitted or edited before the kickoff of each match.
        </p>
      </section>

      <section className="competition-rules-section">
        <div className="competition-rules-section-label">Scoring System</div>
        <div className="competition-scoring-grid">
          {scoringRules.map(rule => (
            <div key={rule.points} className="competition-score-rule">
              <div className="competition-score-points">{rule.points}</div>
              <div>
                <h2>{rule.title}</h2>
                <p>{rule.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="competition-rules-section">
        <div className="competition-rules-section-label">Additional Competition Notes</div>
        <div className="competition-notes-list">
          <p>A total of 72 group-stage matches will be available for prediction in the first round.</p>
          <p>Predictions must be submitted before the kickoff of each match.</p>
          <p>Once a match begins, all participants' predictions will be visible to others in a transparent table format.</p>
          <p>After kickoff, no new predictions or edits will be allowed under any circumstances.</p>
          <p>In the second stage of match predictions, and with the start of the knockout rounds, all prediction scoring will be calculated strictly based on the result at the end of the regular 90 minutes of the match only.</p>
        </div>
      </section>

      <section className="competition-rules-section">
        <div className="competition-rules-section-label">Prize Distribution</div>
        <p>
          The total prize amount, based on all participants' entry fees, will be distributed among the top three winners as follows:
        </p>
        <div className="competition-prize-grid">
          {prizeDistribution.map(prize => (
            <div key={prize.place} className="competition-prize-item">
              <span className="competition-prize-place">{prize.place}</span>
              <strong>{prize.share}</strong>
              <span>{prize.description}</span>
            </div>
          ))}
        </div>
        <div className="competition-tie-note">
          In the event of a tie in total points among participants for any of the top three positions, the corresponding prize will be fairly divided among the tied individuals based on adjusted percentages.
        </div>
      </section>
    </div>
  )
}
