# WC2026 Predictions

A World Cup 2026 prediction game for friends.

## Setup

1. Clone this repo
2. Copy `.env.example` to `.env` and fill in your keys
3. Run `npm install`
4. Run `npm run dev`

## Environment Variables

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_or_secret_key
```

`SUPABASE_SERVICE_ROLE_KEY` is required for admin member and score management. In newer
Supabase projects, you can use a server-side Secret key for this value. The API
also accepts `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_KEY` if you prefer either
name. Keep this key server-side only; never expose it with a `VITE_` prefix.

On Vercel, add these variables under Project Settings → Environment Variables
for the environment you are visiting, usually Production for the live domain and
Preview for branch/PR URLs, then redeploy. Add at least:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`

## Scoring

- Exact score: 10 points
- Correct winner with correct goal difference, or correct draw without exact score: 7 points
- Correct winning team only: 5 points
- Participation: 2 points

## Admin Setup

After deploying, set `is_admin = true` on your own profile row in Supabase.

Admins can enter or update final match scores from the Admin page. Saving a final
score marks the match as finished, scores every prediction for that match, and
updates leaderboard totals.

If predictions are inserted directly into Supabase after a match is finished,
use **Recalculate All Scores** on the Admin page to score them and refresh every
leaderboard total.

Admins can also create, edit, and remove members. Public sign-up is disabled.
