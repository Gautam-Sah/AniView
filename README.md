# AniView

Anime streaming web app that scrapes animepahe for anime data and video sources.

## Tech Stack

- **Backend**: Node.js, Express, Puppeteer (with stealth plugin)
- **Frontend**: React 19, Vite, React Router, Axios

## Prerequisites

- Node.js (v18+)
- npm

## Setup

### 1. Backend

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```env
PORT=5000
FRONTEND_URL=http://localhost:5173
CACHE_TTL_SECONDS=3000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
PUPPETEER_HEADLESS=true
```

Set `PUPPETEER_HEADLESS=false` if you need to see the browser (for debugging or solving Cloudflare challenges manually).

Start the server:

```bash
npm run dev
```

Runs on `http://localhost:5000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`.

## Usage

1. Start the backend first — it launches a Puppeteer browser instance and handles Cloudflare clearance automatically.
2. Start the frontend.
3. Open `http://localhost:5173` in your browser.
4. Search for anime, browse details, and watch episodes.
