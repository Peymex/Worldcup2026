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
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
```

`SUPABASE_SERVICE_ROLE_KEY` is required for admin member management. Keep it
server-side only; never expose it with a `VITE_` prefix.

## Scoring

- Exact score: 10 points
- Correct goal difference + result: 7 points  
- Correct result (win/draw/loss): 5 points
- Just participating: 1 point

## Admin Setup

After deploying, set `is_admin = true` on your own profile row in Supabase.

Admins can enter or update final match scores from the Admin page. Saving a final
score marks the match as finished, scores every prediction for that match, and
updates leaderboard totals.

Admins can also create, edit, and remove members. Public sign-up is disabled.
