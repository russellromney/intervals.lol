# Deploying intervals.lol

intervals.lol is a fully static, client-side React app. It can be deployed to any static hosting platform with just a few commands.

## Local Development

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`

## Building for Production

```bash
npm install
npm run build
```

This creates a `dist/` folder with all static files ready for deployment.

## Deployment Options

### Option 1: Vercel (Easiest)

```bash
npm install -g vercel
vercel
```

Follow the prompts. Vercel automatically handles SPA routing and caching.

### Option 2: Netlify

1. Build locally:
   ```bash
   npm run build
   ```

2. Upload via CLI or drag `dist/` folder to Netlify dashboard

Or connect your repo and it auto-deploys on push.

### Option 3: Fly.io

Create `Dockerfile`:

```dockerfile
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `nginx.conf`:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Deploy:
```bash
fly launch
fly deploy
```

### Option 4: GitHub Pages

1. Add to `vite.config.js`:
   ```javascript
   export default {
     base: '/intervals.lol/',
   }
   ```

2. Build and deploy:
   ```bash
   npm run build
   # Push dist/ folder to gh-pages branch
   ```

### Option 5: AWS S3 + CloudFront

```bash
npm run build
aws s3 sync dist/ s3://your-bucket/
```

Configure CloudFront distribution pointing to your S3 bucket with SPA routing.

### Option 6: Any Other Static Host

The `dist/` folder contains everything needed. Just:

1. Upload contents of `dist/` folder
2. Configure server to serve `index.html` for all routes (SPA routing)
3. Set cache headers:
   - `index.html`: no cache
   - `assets/*`: long cache (1 year)

## Key Requirements

All static hosts must:

1. **Serve `index.html` for 404s** (SPA routing)
   - This allows React Router to handle all URL paths

2. **Support HTTPS** (browsers require it for localStorage)

3. **Cache headers** (optional but recommended):
   - HTML: `Cache-Control: no-cache`
   - Assets: `Cache-Control: public, max-age=31536000`

## Environment Variables

None required! intervals.lol needs:
- ✅ No backend
- ✅ No API keys
- ✅ No configuration

Everything runs locally in the browser.

## Testing the Build Locally

```bash
npm run build
npm run preview
```

This starts a local server with your production build at `http://localhost:4173`

## Troubleshooting

**Routes return 404:**
- Your host isn't configured for SPA routing
- Solution: Make sure `index.html` is served for all non-file routes

**Styling/assets broken:**
- Clear browser cache (Ctrl+Shift+R)
- Check that all files in `dist/` were uploaded
- Verify file paths in built HTML

**localStorage not working:**
- Site must be on HTTPS (some browsers block HTTP localStorage)
- Check browser's privacy settings

**App won't load:**
- Check browser console for errors
- Ensure all files in `dist/` folder were deployed
- Try in incognito/private mode

## Security

intervals.lol is designed with security in mind:

✅ **No external API calls** - everything is local
✅ **No user tracking** - no analytics
✅ **Open source** - audit the code yourself
✅ **No secrets needed** - no credentials in code

## Development

See [README.md](./README.md) for feature list and tech stack.

## License

MIT - Deploy and modify as needed!
