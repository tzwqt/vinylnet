# VinylNet 🎵

Y2K cyberpunk offline music player — built with Electron.

## Setup (do this once)

### 1. Install Node.js
Download from https://nodejs.org (get the LTS version)

### 2. Install dependencies
Open Terminal, navigate to this folder:
```bash
cd path/to/vinylnet
npm install
```

### 3. Run the app
```bash
npm start
```

That's it! VinylNet opens as a real Mac app window.

---

## Build a real .app you can put in your Dock

```bash
npm run build
```

This creates a `dist/` folder with:
- `VinylNet.dmg` — drag to Applications, done
- `VinylNet.app` — run directly or put in dock

---

## Features
- Opens any folder of MP3/WAV/OGG/FLAC/M4A files
- Remembers your folder and last track between sessions
- Spinning record + tonearm animation
- Real-time audio visualizer
- Shuffle + loop
- Fully offline — no internet needed

## Push to GitHub
```bash
git init
git add .
git commit -m "vinylnet first commit"
# create repo on github.com then:
git remote add origin https://github.com/YOURUSERNAME/vinylnet.git
git push -u origin main
```
