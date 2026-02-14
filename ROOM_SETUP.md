# Room Mode Setup (Supabase + optional Airtable)

## Supabase (required for rooms)

1. Create a free project at [supabase.com](https://supabase.com)
2. In Supabase SQL Editor, run:

```sql
create table rooms (
  id text primary key,
  puzzle jsonb not null,
  game_mode text default 'normal',
  admin_secret text,
  requires_auth boolean default false,
  created_at timestamptz default now()
);

create table results (
  id uuid default gen_random_uuid() primary key,
  room_id text not null,
  player_name text,
  score int,
  time_seconds int,
  won boolean,
  created_at timestamptz default now()
);

alter table rooms enable row level security;
alter table results enable row level security;

create policy "rooms_all" on rooms for all using (true) with check (true);
create policy "results_all" on results for all using (true) with check (true);
```

3. In Supabase: Settings → API → copy **Project URL** and **anon public** key
4. Edit `js/room-config.js` and set:
   - `SUPABASE_URL`: your Project URL
   - `SUPABASE_ANON_KEY`: your anon key

## Airtable (optional export)

1. Create an Airtable base with a table named **Results**
2. Add columns: Room (text), Player (text), Score (number), TimeSeconds (number), Won (checkbox), Date (date)
3. Get your [API key](https://airtable.com/account) and Base ID (from base URL: `airtable.com/APPxxx/...` → Base ID is `APPxxx`)
4. In room-config.js set `AIRTABLE_BASE_ID` and `AIRTABLE_API_KEY`, **or** when creating a room, use the "Export to Airtable" option and enter them there (stored in localStorage)
