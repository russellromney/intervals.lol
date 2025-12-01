# intervals.lol

A simple, customizable interval timer for workouts, pomodoro sessions, or any timed routine.

**Live at: [intervals.lol](https://intervals.lol)**

## Features

- ⏱️ Create custom interval sequences with work/rest periods
- 🔊 Voice announcements for interval changes
- 💾 Save and load workout presets
- 📊 Track workout history and stats
- 📱 Works offline (PWA-ready)
- 🔐 No account required - data stored locally in browser
- ☁️ Optional cloud sync across devices with self-hosted backend
- 👥 Multiple profiles for different users or use cases
- 🔒 Password-protected backend for secure sync

## Quick Start

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Development

Use the `Makefile` for common tasks:

```bash
make help      # Show all available commands
make dev       # Start frontend dev server
make build     # Build for production
make test      # Run e2e tests
make clean     # Clean build artifacts
make backend-dev  # Run backend dev server
```

### Backend Development

The backend is a Go server for optional cloud sync. To run it locally:

```bash
cd backend
go run ./cmd/server
```

The backend syncs timers and history across devices with optional password protection.

## Deployment

Want to run your own instance? See [DEPLOY.md](./DEPLOY.md) for complete setup guide covering:

- **Vercel** (easiest, 2 minutes)
- **Netlify** (drag & drop deployment)
- **Fly.io** (with Dockerfile included)
- **GitHub Pages** (free, zero config)
- **AWS S3** (with CloudFront)
- **Any static host** (instructions included)

## Tech Stack

**Frontend:**
- React 18 / Preact (aliased via React)
- Vite
- React Router
- Web Speech API (for voice announcements)
- LocalStorage (for saving workouts)

**Backend (Optional for cloud sync):**
- Go
- SQLite or Turso
- Password-based authentication
- Multi-profile support

## Security & Privacy

✅ **Client-First** - All data stored locally by default
✅ **LocalStorage** - All workouts saved in browser
✅ **Offline First** - Works without internet connection
✅ **Optional Cloud Sync** - Only enabled if you deploy your own backend
✅ **Optional Password** - Secure your backend with `SYNC_PASSWORD` (recommended for public access)
✅ **Open Source** - Audit the code yourself at any time

## License

MIT
