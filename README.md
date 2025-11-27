# intervals.lol

A simple, customizable interval timer for workouts, pomodoro sessions, or any timed routine.

**Live at: [intervals.lol](https://intervals.lol)**

## Features

- Create custom interval sequences with work/rest periods
- Voice announcements for interval changes
- Save and load workout presets
- Track workout history
- Works offline (PWA-ready)
- No account required - data stored locally

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

## Deployment

Want to run your own instance? See [DEPLOY.md](./DEPLOY.md) for complete setup guide covering:

- **Vercel** (easiest, 2 minutes)
- **Netlify** (drag & drop deployment)
- **Fly.io** (with Dockerfile included)
- **GitHub Pages** (free, zero config)
- **AWS S3** (with CloudFront)
- **Any static host** (instructions included)

## Tech Stack

- React 18
- Vite
- React Router
- Web Speech API (for voice announcements)
- LocalStorage (for saving workouts)

## Security & Privacy

✅ **100% Client-Side** - No data ever sent to servers
✅ **LocalStorage Only** - All workouts saved in browser
✅ **Offline First** - Works without internet connection
✅ **Open Source** - Audit the code yourself

## License

MIT
