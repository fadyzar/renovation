

**Project**  
- **Name:** Renovation Marketplace (M.G.BIT) — a Vite + React + TypeScript front-end for matching homeowners with vetted contractors.  
- **Summary:** Clean, responsive UI with Tailwind and Framer Motion, Supabase integration for auth and serverless functions, and DB migrations under migrations. Designed for posting projects, receiving bids, and milestone payments.

**Features**  
- **Home / Landing:** polished hero, feature cards, kickstart form, testimonials, FAQ (Landing.tsx).  
- **Auth:** modal-driven sign in / sign up with Supabase (supabase.ts, supabase.ts).  
- **Project flow:** create projects, contractor bids, milestone tracking (UI scaffolding present).  
- **Serverless:** lightweight server logic in functions (example: index.ts).  
- **Migrations:** SQL schema and policy changes in migrations.

**Tech Stack**  
- **Framework:** `React` + `TypeScript` (Vite)  
- **Styling:** `Tailwind CSS`  
- **Animations:** `framer-motion`  
- **Icons:** `lucide-react`  
- **Backend-as-a-Service:** Supabase (Auth, Database, Functions)  
- **Tooling:** `ESLint`, `TypeScript`, `PostCSS`, `Vite`

**Repository Structure (high level)**  
- **Source:** src/ — React app and components.  
- **Landing:** Landing.tsx — main marketing UI and flow.  
- **Supabase client:** supabase.ts and supabase.ts.  
- **Supabase functions:** functions — serverless handlers.  
- **Migrations:** migrations — DB schema & policies.  
- **Config & tooling:** vite.config.ts, tailwind.config.js, postcss.config.js, `tsconfig*.json`, package.json

**Getting Started (Local Development)**  
- **Prerequisites:** Node.js (recommended >= 18), npm or pnpm, Supabase account/CLI for serverless functions.  
- **Install:**  
  - `npm install`  
- **Dev server:**  
  - `npm run dev` — starts Vite dev server.  
- **Build / Preview:**  
  - `npm run build`  
  - `npm run preview`  
- **Static checks:**  
  - `npm run lint`  
  - `npm run typecheck`

**Environment**  
- **Primary env vars:** set in a local .env or `.env.local`:  
  - `VITE_SUPABASE_URL` — your Supabase project URL  
  - `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key  
  - (If server-side tasks need elevated privileges) `SUPABASE_SERVICE_ROLE_KEY` — keep secure, never expose in client bundles.  
- **Notes:** Front-end uses `VITE_*` prefixes to expose variables to the browser. Service role keys belong only in server runtime or CI.

**Supabase: Migrations & Functions**  
- **Migrations:** apply DB schema and RLS policies found in migrations using the Supabase CLI or via your preferred workflow.  
- **Functions:** serverless endpoint example at index.ts. Deploy with the Supabase CLI:  
  - `supabase functions deploy analyze-project --project-ref <project-ref>`  
- **Local testing:** use Supabase local emulator or the Supabase dashboard for direct testing.

**Deployment**  
- **Static front-end:** host the built assets on Vercel, Netlify, or any static host. Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in the deploy environment.  
- **Serverless:** deploy Supabase Functions via Supabase CLI or use a server/edge function platform that can securely use service keys.

**Contributing**  
- **Guidelines:** open issues for bugs or features, submit PRs against main. Keep changes focused and include typechecks/linting.  
- **Local checks:** run `npm run lint` and `npm run typecheck` before proposing a PR.

**Useful Files**  
- **Landing UI:** Landing.tsx  
- **Supabase client helpers:** supabase.ts, supabase.ts  
- **Serverless example:** index.ts  
- **Migrations:** migrations  
- **Project scripts and dependencies:** package.json


