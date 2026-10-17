# OUR WORLD 🌿

A mobile-first cozy 3D multiplayer browser game starter. Explore a stylized little island, wander with keyboard or touch controls, build a tiny town, leave notes, change the atmosphere, and chat. Built with Three.js, Vite, and optional Supabase room sync.

## Included now
- 3D island with rolling hills, stream, trees, wildflowers, distant scenery, a plaza, and moving clouds.
- Third-person avatar, keyboard/joystick movement, tap-to-walk, camera orbit by dragging, wheel zoom, touch zoom-ready layout.
- Build catalogue with actual geometry for cottages/houses, castle towers, café, trees, flowers, pond, fountain, bench, lamp, balloons, paths, road, mailbox, campfire, gifts, castle walls, hedges and more.
- Placement preview, grid-snapped placement, shared object additions, atmosphere changes, emotes, note placement, nearby interactions, backup export/import.
- Chat UI with safe text rendering; online broadcasts and persisted chat RPC.
- Supabase anonymous auth, room codes, room membership cap of two, membership-checked RPCs and RLS policies.
- Local play without Supabase configuration.

## Important honest limitations
This is a playable first-stage project, not every feature in the full brief. The starter currently does **not** include voice-message recording/storage, live voice calls, true avatar customization, object move/rotate/recolor/delete UI, reliable undo/redo controls, blueprints, quests/unlocks, water swimming, screenshot capture, or a complete offline queue. Real-time movement and object-add events use Supabase Broadcast, while the shared world snapshot is saved through an RPC. Chat broadcasts in real time and attempts persistent storage. A full reconnect/replay protocol and server-authoritative object conflict resolution should be added before treating it as production software.

No Supabase credentials are included. Online play cannot work until you configure your own project. Do not put a service-role key in `.env.local`.

## Run locally in VS Code
1. Install Node.js LTS from https://nodejs.org/.
2. Unzip the project and open the `our-world` folder in VS Code.
3. Open Terminal → New Terminal and run:
   ```bash
   npm install
   npm run dev
   ```
4. Open the local URL Vite prints (usually `http://localhost:5173`).
5. Click **Explore my world** to play immediately. For a phone test on the same Wi-Fi, use the network URL printed by Vite; for browser microphone/secure APIs, use HTTPS.

## Enable shared online worlds with Supabase
1. Create a project at https://supabase.com/.
2. In Authentication → Sign In / Providers, enable **Anonymous Sign-Ins**. Set sensible rate limits and review abuse risks before public release.
3. Open SQL Editor and run all of `supabase/schema.sql`.
4. Copy `.env.example` to `.env.local`.
5. Fill in `VITE_SUPABASE_URL` and the publishable/anon key from Project Settings → API.
6. Stop and restart `npm run dev`.
7. Open the game on two different devices/browsers. Player A chooses **Create private world** and shares the 6-character code. Player B enters that code and chooses **Join a world**.
8. Test placing an object and sending chat. Check the status pill for online/saving state.

### Security notes
- Frontend uses only the publishable/anon key.
- Anonymous users are real Supabase Auth users, but anyone can create anonymous accounts unless you add anti-abuse protections.
- RPC functions are `SECURITY DEFINER` with a fixed search path and explicit membership checks. RLS is enabled; direct client writes are not allowed.
- A room code is a bearer secret. Share it only with the intended person. For a production release, add expiry/rotation, account recovery, invite tokens, stronger rate limits, audit logs, and server-side payload validation.
- Broadcast events are scoped by a room-specific channel name, but Broadcast is not an authorization boundary by itself. Use private Realtime channels and policies for `realtime.messages` before exposing this publicly. The current project is a prototype; do not claim high-security privacy for it.
- This version's `save_world` writes the full JSON snapshot. Simultaneous saves can overwrite each other; production should use transactional per-object upserts/revisions or CRDT-style reconciliation.
- Chat history table is persisted; this UI currently shows messages received during the current session rather than fetching all previous messages.

## Controls
- **Desktop:** WASD / arrow keys to move, click/tap ground to walk, drag to orbit camera, mouse wheel to zoom, `B` opens build, `E` interacts, `Esc` closes panels.
- **Mobile:** left virtual joystick to walk, tap ground to move/place, drag the world to rotate camera, scroll/pinch zoom support depends on browser gesture behavior.
- **Build:** choose Build or Nature, pick an item, then tap the ground. Place objects on the ground; object selection is cleared after placement.
- **Note:** choose Leave a note, type a message, then place it. A mailbox marker appears near your avatar; interact nearby to discover notes.
- **Atmosphere:** sun icon cycles morning, sunset, twilight and night. Gear opens settings.

## Deploy to a public HTTPS website
### Vercel (simple)
1. Push the project to a private or public GitHub repository.
2. Import it at https://vercel.com/.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Project Settings → Environment Variables.
4. Deploy. Vite builds with `npm run build`; output folder is `dist`.
5. Use the HTTPS URL on both devices.

### GitHub Pages
Vite needs a correct base path if deploying under a repository subpath. Set `base: '/YOUR-REPO-NAME/'` in `vite.config.js` (not included by default), then build and publish `dist` using GitHub Actions. Supabase keys must be set at build time. Vercel or Netlify is easier for this starter.

## Add assets later
- Use optimized GLTF/GLB assets and load them with `GLTFLoader` from Three.js for detailed models.
- Prefer low-poly models, compressed textures, instancing for repeated plants, and low-resolution shadows on mobile.
- Add sound files in `public/audio/` and load with Web Audio or Three.js Audio; browser audio requires a user gesture.
- Never use unlicensed assets. Keep downloaded assets small and credit them when required.

## Troubleshooting
- **Online connect fails:** verify `.env.local`, restart Vite, enable anonymous auth, run the SQL, and inspect the browser console.
- **Invalid room code:** codes are uppercase, 6 characters, and rooms allow up to two authenticated members.
- **Blank 3D view:** update the browser/GPU driver; try Lite graphics and inspect DevTools console.
- **No voice notes:** voice messaging is not implemented in this stage.
- **World changes seem overwritten:** the prototype saves full snapshots; simultaneous writes can race. Refresh and use backups while testing.
