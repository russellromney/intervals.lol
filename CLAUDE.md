# Claude Development Guidelines

Guidelines for AI assistants working on intervals.lol. See README.md for full setup details.

## Core Principles

### 1. Use Make Commands
Always use `make` commands - never run npm or other tools directly:
```bash
make dev          # Start frontend dev server
make build        # Build for production
make test         # Run e2e tests
make clean        # Clean build artifacts
make backend-dev  # Run backend dev server
make help         # Show all commands
```

### 2. Package Manager
All Node.js execution through npm scripts:
```bash
npm install       # Install dependencies
npm run dev       # Start Vite dev server
npm run build     # Build with Vite
npm run preview   # Preview production build
```

Backend uses Go:
```bash
cd backend && go run ./cmd/server   # Run backend dev
```

### 3. Write Tests
- Write tests for all new features (especially interval logic and sync features)
- Run `make test` before completing features
- Tests must pass before marking task complete
- E2E tests use Playwright

### 4. Git Operations
🚨 **NEVER run git commands without explicit user permission.**
Always ask first: "Should I create a commit/push/PR?"

### 5. Secrets
- Backend sync password via `SYNC_PASSWORD` env var
- Frontend uses LocalStorage (no secrets needed)
- Use `.env.local` for local backend overrides (git-ignored)
- Never commit `.env` files or `SYNC_PASSWORD`

### 6. Code Style
- Concise over verbose
- No over-engineering or premature abstractions
- Edit existing files, only Write for new files
- Watch for XSS vulnerabilities (especially in voice announcement handling)

## Project Structure

**Frontend:**
- `src/` - React/Preact components (JSX)
- `src/IntervalTimer.jsx` - Main timer component
- `src/IntervalEditor.jsx` - Create/edit workout presets
- `src/IntervalHistory.jsx` - Track workout history
- `src/IntervalSettings.jsx` - App settings
- `src/SyncService.js` - Cloud sync client
- `src/WorkoutContext.jsx` - React context for state

**Backend (Optional):**
- `backend/cmd/server/` - Go server entry point
- `backend/` - Cloud sync server (password-protected)

**Configuration:**
- `Makefile` - All development commands
- `vite.config.js` - Vite bundler config
- `.env.local` - Local overrides (git-ignored)

## Common Patterns

### State Management
Uses React Context for global state:
```javascript
import { WorkoutContext } from './WorkoutContext.jsx'
const { workouts, addWorkout } = useContext(WorkoutContext)
```

### Voice Announcements
Web Speech API integration (sanitize text to prevent XSS):
```javascript
const utterance = new SpeechSynthesisUtterance(textToSpeak)
speechSynthesis.speak(utterance)
```

### LocalStorage
Workouts stored in browser LocalStorage:
```javascript
const saved = JSON.parse(localStorage.getItem('workouts') || '[]')
localStorage.setItem('workouts', JSON.stringify(workouts))
```

### Cloud Sync
Optional self-hosted sync via backend:
```javascript
import { SyncService } from './SyncService.js'
await SyncService.syncWorkouts(workouts, syncPassword)
```

## What NOT to Do

❌ Run npm commands directly (use `make dev`, `make build`, etc.)
❌ Run Playwright tests manually (use `make test`)
❌ Git commits/push without asking
❌ Skip writing tests for new features
❌ Commit `.env` or `SYNC_PASSWORD`
❌ Over-engineer or add unnecessary abstractions
❌ Don't sanitize voice announcement text (XSS risk)

## Quick Reference

```bash
make dev          # Start dev on localhost:5173
make build        # Build to dist/
make test         # Run e2e tests
make clean        # Remove all build files
make backend-dev  # Start backend on localhost:8000
make help         # Show all commands
```

## Technology Stack

- **Frontend:** React 18 / Preact, Vite, React Router
- **Styling:** CSS modules / inline styles
- **Testing:** Playwright (e2e)
- **Backend:** Go, SQLite/Turso, self-hosted
- **APIs:** Web Speech API, LocalStorage, fetch
