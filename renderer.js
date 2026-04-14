const audio = document.getElementById('audio')
const btnFolder = document.getElementById('btn-folder')
const btnPlay = document.getElementById('btn-play')
const btnPrev = document.getElementById('btn-prev')
const btnNext = document.getElementById('btn-next')
const btnShuf = document.getElementById('btn-shuf')
const btnLoop = document.getElementById('btn-loop')
const seek = document.getElementById('seek')
const curEl = document.getElementById('cur')
const durEl = document.getElementById('dur')
const volSlider = document.getElementById('vol')
const volOut = document.getElementById('vol-out')
const queueList = document.getElementById('queue-list')
const trackName = document.getElementById('track-name')
const trackSub = document.getElementById('track-sub')
const tonearm = document.getElementById('tonearm')
const grooves = document.getElementById('record-grooves')
const sdot = document.getElementById('sdot')
const stxt = document.getElementById('stxt')
const strack = document.getElementById('strack')
const trackCount = document.getElementById('track-count')
const folderPath = document.getElementById('folder-path')
const vizRow = document.getElementById('viz-row')
const searchEl = document.getElementById('search')
const searchClear = document.getElementById('search-clear')

let tracks = [], cur = -1, shuffle = false, loop = false
let rotAngle = 0, rotFrame = null
let vizBars = [], audioCtx = null, analyser = null, source = null

const EQ_FREQS  = [60, 170, 310, 600, 1000, 3000, 6000, 12000]
const EQ_LABELS = ['60', '170', '310', '600', '1k', '3k', '6k', '12k']
let eqFilters = [], eqGains = new Array(8).fill(0)

for (let i = 0; i < 28; i++) {
  const d = document.createElement('div')
  d.className = 'vdot'
  d.style.height = '4px'
  vizRow.appendChild(d)
  vizBars.push(d)
}

function fmt(s) {
  if (isNaN(s) || s === Infinity) return '0:00'
  return Math.floor(s / 60) + ':' + (Math.floor(s % 60) < 10 ? '0' : '') + Math.floor(s % 60)
}

function clean(n) { return n.replace(/\.[^/.]+$/, '') }

function setupAudio() {
  if (audioCtx) return
  audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  analyser = audioCtx.createAnalyser()
  analyser.fftSize = 64
  source = audioCtx.createMediaElementSource(audio)
  eqFilters = EQ_FREQS.map((freq, i) => {
    const f = audioCtx.createBiquadFilter()
    f.type = i === 0 ? 'lowshelf' : i === EQ_FREQS.length - 1 ? 'highshelf' : 'peaking'
    f.frequency.value = freq
    f.Q.value = 1.2
    f.gain.value = eqGains[i]
    return f
  })
  source.connect(eqFilters[0])
  for (let i = 0; i < eqFilters.length - 1; i++) eqFilters[i].connect(eqFilters[i + 1])
  eqFilters[eqFilters.length - 1].connect(analyser)
  analyser.connect(audioCtx.destination)
}

function animViz() {
  if (!analyser) { vizBars.forEach(b => b.style.height = '4px'); return }
  const data = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(data)
  const n = vizBars.length
  for (let i = 0; i < n; i++) {
    const v = data[Math.floor(i * data.length / n)]
    const h = Math.max(4, Math.round(v / 255 * 36))
    const col = i < n / 2 ? '#00ffe7' : '#ff00c8'
    vizBars[i].style.height = h + 'px'
    vizBars[i].style.background = col
    vizBars[i].style.boxShadow = h > 8 ? `0 -3px 7px ${col}` : 'none'
  }
  requestAnimationFrame(animViz)
}

function rotateRecord() {
  rotAngle = (rotAngle + 1.2) % 360
  if (grooves) grooves.setAttribute('transform', `rotate(${rotAngle} 110 110)`)
  rotFrame = requestAnimationFrame(rotateRecord)
}

function stopRotate() { cancelAnimationFrame(rotFrame); rotFrame = null }

function setPlaying(playing) {
  btnPlay.innerHTML = playing ? '&#9646;&#9646;' : '&#9654;'
  document.getElementById('record-svg').classList.toggle('record-playing', playing)
  const syncEl = document.getElementById('hud-sync')
  if (syncEl) syncEl.innerHTML = playing ? 'SYNC <b class="hv">LOCKED</b>' : 'SYNC <b class="hv hv-dim">——</b>'
  if (playing) { tonearm.classList.add('playing'); sdot.classList.add('on'); stxt.textContent = 'PLAYING'; if (!rotFrame) rotateRecord(); animViz() }
  else { tonearm.classList.remove('playing'); sdot.classList.remove('on'); stxt.textContent = 'PAUSED'; stopRotate(); vizBars.forEach(b => { b.style.height = '4px'; b.style.boxShadow = 'none' }) }
}

function loadTrack(i) {
  if (i < 0 || i >= tracks.length) return
  cur = i
  const t = tracks[i]
  audio.src = t.url
  trackName.textContent = clean(t.name).toUpperCase()
  trackSub.textContent = t.name
  strack.textContent = clean(t.name).toUpperCase()
  audio.load()
  audio.play().then(() => { setupAudio(); if (audioCtx.state === 'suspended') audioCtx.resume() }).catch(() => {})
  setPlaying(true)
  renderQueue()
  savePrefs()
}

function togglePlay() {
  if (!tracks.length) return
  if (cur === -1) { loadTrack(0); return }
  if (audio.paused) { audio.play().then(() => { setupAudio(); if (audioCtx.state === 'suspended') audioCtx.resume() }).catch(() => {}); setPlaying(true) }
  else { audio.pause(); setPlaying(false) }
}

function nextTrack() {
  if (!tracks.length) return
  loadTrack(shuffle ? Math.floor(Math.random() * tracks.length) : (cur + 1) % tracks.length)
}

function prevTrack() {
  if (!tracks.length) return
  if (audio.currentTime > 3) { audio.currentTime = 0; return }
  loadTrack((cur - 1 + tracks.length) % tracks.length)
}

function renderQueue() {
  if (!tracks.length) {
    queueList.innerHTML = '<li><div class="empty-q">NO TRACKS LOADED<br>open a music folder<br>to get started</div></li>'
    return
  }
  queueList.innerHTML = ''
  tracks.forEach((t, i) => {
    const li = document.createElement('li')
    if (i === cur) li.classList.add('active')
    li.dataset.idx = i
    li.dataset.name = clean(t.name).toLowerCase()
    li.innerHTML = `<span class="qnum">${String(i + 1).padStart(2, '0')}</span><span class="qname">${clean(t.name).toUpperCase()}</span><span class="qdur" id="qd${i}">--:--</span>`
    li.onclick = () => loadTrack(i)
    queueList.appendChild(li)
    const tmp = new Audio(); tmp.src = t.url
    tmp.addEventListener('loadedmetadata', () => { const el = document.getElementById('qd' + i); if (el) el.textContent = fmt(tmp.duration) })
  })
  trackCount.textContent = tracks.length + ' track' + (tracks.length !== 1 ? 's' : '')
  applySearch()
}

function applySearch() {
  const q = searchEl.value.trim().toLowerCase()
  searchClear.style.display = q ? 'block' : 'none'
  const items = queueList.querySelectorAll('li[data-idx]')
  items.forEach(li => {
    li.style.display = !q || li.dataset.name.includes(q) ? '' : 'none'
  })
}

searchEl.addEventListener('input', applySearch)
searchClear.addEventListener('click', () => { searchEl.value = ''; applySearch(); searchEl.focus() })

async function savePrefs() {
  if (!window.vinylnet) return
  await window.vinylnet.savePrefs({
    folderPath: folderPath.textContent === 'no folder loaded' ? null : folderPath.textContent,
    currentIndex: cur,
    volume: audio.volume,
    shuffle, loop
  })
}

async function loadPrefs() {
  if (!window.vinylnet) return
  const prefs = await window.vinylnet.loadPrefs()
  if (!prefs) return
  if (prefs.volume !== undefined) { audio.volume = prefs.volume; volSlider.value = Math.round(prefs.volume * 100); volOut.textContent = Math.round(prefs.volume * 100) + '%' }
  if (prefs.shuffle) { shuffle = true; btnShuf.classList.add('active') }
  if (prefs.loop) { loop = true; audio.loop = true; btnLoop.classList.add('active') }
  if (prefs.folderPath) {
    folderPath.textContent = prefs.folderPath
    const scanned = await window.vinylnet.scanFolder(prefs.folderPath)
    if (scanned && scanned.length) {
      tracks = scanned
      renderQueue()
      if (prefs.currentIndex >= 0 && prefs.currentIndex < tracks.length) {
        cur = prefs.currentIndex
        const t = tracks[cur]
        audio.src = t.url
        trackName.textContent = clean(t.name).toUpperCase()
        trackSub.textContent = t.name
        strack.textContent = clean(t.name).toUpperCase()
        renderQueue()
      }
    }
  }
}

btnFolder.addEventListener('click', async () => {
  if (!window.vinylnet) return
  const folder = await window.vinylnet.openFolder()
  if (!folder) return
  folderPath.textContent = folder
  stxt.textContent = 'SCANNING...'
  const scanned = await window.vinylnet.scanFolder(folder)
  tracks = scanned || []
  cur = -1
  renderQueue()
  stxt.textContent = tracks.length ? 'READY' : 'NO AUDIO FILES FOUND'
  if (tracks.length) loadTrack(0)
  savePrefs()
})

btnPlay.addEventListener('click', togglePlay)
btnPrev.addEventListener('click', prevTrack)
btnNext.addEventListener('click', nextTrack)
btnShuf.addEventListener('click', () => { shuffle = !shuffle; btnShuf.classList.toggle('active', shuffle); savePrefs() })
btnLoop.addEventListener('click', () => { loop = !loop; audio.loop = loop; btnLoop.classList.toggle('active', loop); savePrefs() })

audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return
  seek.value = (audio.currentTime / audio.duration * 100).toFixed(1)
  curEl.textContent = fmt(audio.currentTime)
})
audio.addEventListener('loadedmetadata', () => { durEl.textContent = fmt(audio.duration) })
audio.addEventListener('ended', () => { if (!loop) nextTrack() })
seek.addEventListener('input', () => { if (audio.duration) audio.currentTime = seek.value / 100 * audio.duration })
volSlider.addEventListener('input', () => { audio.volume = volSlider.value / 100; volOut.textContent = volSlider.value + '%'; savePrefs() })

audio.volume = 0.8
loadPrefs()

// ─── BACKGROUND CANVAS ───────────────────────────────────────────────────────
;(function() {
  const c = document.getElementById('bg-canvas')
  const cx = c.getContext('2d')

  function resize() { c.width = c.offsetWidth; c.height = c.offsetHeight }
  resize()
  window.addEventListener('resize', resize)

  // Stars
  const STARS = Array.from({length: 140}, () => ({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 1.4 + 0.3,
    spd: Math.random() * 0.00012 + 0.00003,
    bright: Math.random() * 0.55 + 0.15,
    col: ['#00ffe7','#00ffe7','#ff00c8','#ffffff','#ffe600'][Math.floor(Math.random()*5)]
  }))

  // Data streams (vertical neon trails)
  const STREAMS = Array.from({length: 10}, () => ({
    x: Math.random(),
    y: Math.random() * 2 - 1,
    spd: Math.random() * 0.0025 + 0.0008,
    len: Math.random() * 0.18 + 0.06,
    col: Math.random() < 0.6 ? '#00ffe7' : '#ff00c8',
    alpha: Math.random() * 0.35 + 0.08
  }))

  // Floating geometric shapes (cyberdeck debris)
  const SHAPES = Array.from({length: 9}, () => ({
    x: Math.random(), y: Math.random(),
    sz: Math.random() * 28 + 12,
    sides: [3,4,6,6][Math.floor(Math.random()*4)],
    rot: Math.random() * Math.PI * 2,
    rotSpd: (Math.random() - 0.5) * 0.006,
    vx: (Math.random() - 0.5) * 0.00025,
    vy: (Math.random() - 0.5) * 0.00025,
    col: ['#00ffe7','#ff00c8','#ffe600','#aa00ff'][Math.floor(Math.random()*4)],
    alpha: Math.random() * 0.12 + 0.04
  }))

  // Nebula blobs
  const NEBULAE = Array.from({length: 4}, () => ({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 180 + 80,
    col: Math.random() < 0.5 ? '0,255,231' : '255,0,200',
    pulse: Math.random() * Math.PI * 2,
    pulseSpd: Math.random() * 0.008 + 0.003
  }))

  let gridOff = 0

  function poly(x, y, r, n, rot) {
    cx.beginPath()
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2
      i === 0 ? cx.moveTo(x + Math.cos(a)*r, y + Math.sin(a)*r)
               : cx.lineTo(x + Math.cos(a)*r, y + Math.sin(a)*r)
    }
    cx.closePath()
  }

  function frame() {
    const W = c.width, H = c.height
    cx.clearRect(0, 0, W, H)

    // ── Nebula glow ──
    NEBULAE.forEach(n => {
      n.pulse += n.pulseSpd
      const alpha = (Math.sin(n.pulse) * 0.03 + 0.05).toFixed(3)
      const g = cx.createRadialGradient(n.x*W, n.y*H, 0, n.x*W, n.y*H, n.r)
      g.addColorStop(0, `rgba(${n.col},${alpha})`)
      g.addColorStop(1, 'transparent')
      cx.fillStyle = g
      cx.fillRect(0, 0, W, H)
    })

    // ── Stars ──
    STARS.forEach(s => {
      s.y += s.spd
      if (s.y > 1) { s.y = 0; s.x = Math.random() }
      cx.beginPath()
      cx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
      cx.fillStyle = s.col
      cx.globalAlpha = s.bright
      cx.fill()
    })
    cx.globalAlpha = 1

    // ── Perspective grid (lower 50%) ──
    const gTop = H * 0.5, gBot = H
    const vx = W * 0.5, vy = gTop
    gridOff = (gridOff + 0.5) % (H * 0.08)

    // horizontal lines
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      const rawY = gTop + t * (gBot - gTop)
      const y = rawY + gridOff * (t * 1.5)
      if (y > gBot) continue
      const spread = 0.08 + t * 0.92
      cx.strokeStyle = `rgba(42,0,96,${t * 0.7})`
      cx.lineWidth = 0.5
      cx.beginPath()
      cx.moveTo(vx - W * spread, y)
      cx.lineTo(vx + W * spread, y)
      cx.stroke()
      // cyan horizon flash on the topmost visible line
      if (i === 1) {
        cx.strokeStyle = `rgba(0,255,231,${t * 0.25})`
        cx.lineWidth = 0.5
        cx.beginPath(); cx.moveTo(vx - W * spread, y); cx.lineTo(vx + W * spread, y); cx.stroke()
      }
    }
    // converging verticals
    const cols = 14
    for (let i = 0; i <= cols; i++) {
      const t = i / cols
      const bx = W * t
      cx.strokeStyle = `rgba(42,0,96,0.35)`
      cx.lineWidth = 0.5
      cx.beginPath(); cx.moveTo(vx, vy); cx.lineTo(bx, gBot); cx.stroke()
    }

    // ── Data streams ──
    STREAMS.forEach(s => {
      s.y += s.spd
      if (s.y - s.len > 1) { s.y = -s.len; s.x = Math.random() }
      const sx = s.x * W
      const sy1 = (s.y - s.len) * H, sy2 = s.y * H
      const gr = cx.createLinearGradient(sx, sy1, sx, sy2)
      gr.addColorStop(0, 'transparent')
      gr.addColorStop(0.6, s.col.replace(')', `,${s.alpha * 0.4})`).replace('rgb', 'rgba'))
      gr.addColorStop(1, s.col)
      cx.strokeStyle = gr
      cx.globalAlpha = s.alpha
      cx.lineWidth = 1
      cx.beginPath(); cx.moveTo(sx, sy1); cx.lineTo(sx, sy2); cx.stroke()
    })
    cx.globalAlpha = 1

    // ── Floating shapes ──
    SHAPES.forEach(s => {
      s.x += s.vx; s.y += s.vy; s.rot += s.rotSpd
      if (s.x < -0.15) s.x = 1.15
      if (s.x > 1.15)  s.x = -0.15
      if (s.y < -0.15) s.y = 1.15
      if (s.y > 1.15)  s.y = -0.15
      cx.strokeStyle = s.col
      cx.lineWidth = 0.8
      cx.globalAlpha = s.alpha
      poly(s.x * W, s.y * H, s.sz, s.sides, s.rot)
      cx.stroke()
      // inner shape (double-ring on hexagons)
      if (s.sides === 6) {
        cx.globalAlpha = s.alpha * 0.5
        poly(s.x * W, s.y * H, s.sz * 0.55, s.sides, s.rot + Math.PI/6)
        cx.stroke()
      }
    })
    cx.globalAlpha = 1

    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
})()

// ─── EQUALIZER UI ────────────────────────────────────────────────────────────
;(function() {
  const container = document.getElementById('eq-bands')

  function resetEQ() {
    EQ_FREQS.forEach((_, i) => {
      eqGains[i] = 0
      if (eqFilters[i]) eqFilters[i].gain.value = 0
      const slider = document.getElementById('eqs' + i)
      const dbEl = document.getElementById('eqdb' + i)
      if (slider) slider.value = 0
      if (dbEl) { dbEl.textContent = '0'; dbEl.style.color = '' }
    })
  }

  // bands: [60, 170, 310, 600, 1k, 3k, 6k, 12k]
  const EQ_PRESETS = [
    { name: 'BASS',     gains: [8, 6, 4, 1, 0, -1, -1, -2] },
    { name: 'ROCK',     gains: [5, 4, 2, -1, -1, 2, 4, 5] },
    { name: 'POP',      gains: [-1, 2, 4, 5, 3, 1, -1, -1] },
    { name: 'JAZZ',     gains: [3, 2, 1, 2, -1, -1, 1, 3] },
    { name: 'HIP-HOP',  gains: [6, 5, 2, 3, -1, -1, 1, 2] },
    { name: 'LOFI',     gains: [4, 3, 1, -2, -3, -2, 1, -4] },
    { name: 'TREBLE',   gains: [-2, -2, -1, 0, 2, 4, 6, 8] },
    { name: 'FLAT',     gains: [0, 0, 0, 0, 0, 0, 0, 0] },
  ]

  let activePreset = null

  function applyPreset(preset) {
    activePreset = preset
    preset.gains.forEach((g, i) => {
      eqGains[i] = g
      if (eqFilters[i]) eqFilters[i].gain.value = g
      const slider = document.getElementById('eqs' + i)
      const dbEl = document.getElementById('eqdb' + i)
      if (slider) slider.value = g
      if (dbEl) {
        dbEl.textContent = (g > 0 ? '+' : '') + g
        dbEl.style.color = g > 0 ? 'var(--cyan)' : g < 0 ? 'var(--magenta)' : ''
      }
    })
    document.querySelectorAll('.eq-preset').forEach(b => b.classList.toggle('active', b.dataset.preset === preset.name))
  }

  const presetsEl = document.getElementById('eq-presets')
  EQ_PRESETS.forEach(preset => {
    const btn = document.createElement('button')
    btn.className = 'eq-preset'
    btn.textContent = preset.name
    btn.dataset.preset = preset.name
    btn.addEventListener('click', () => applyPreset(preset))
    presetsEl.appendChild(btn)
  })

  document.getElementById('eq-reset').addEventListener('click', () => {
    activePreset = null
    document.querySelectorAll('.eq-preset').forEach(b => b.classList.remove('active'))
    resetEQ()
  })

  EQ_LABELS.forEach((label, i) => {
    const col = document.createElement('div')
    col.className = 'eq-col'
    col.innerHTML =
      `<span class="eq-db" id="eqdb${i}">0</span>` +
      `<div class="eq-sw"><input type="range" class="eq-slider" id="eqs${i}" min="-12" max="12" value="0" step="0.5"></div>` +
      `<span class="eq-freq">${label}</span>`
    container.appendChild(col)
    col.querySelector('input').addEventListener('input', e => {
      const v = parseFloat(e.target.value)
      eqGains[i] = v
      if (eqFilters[i]) eqFilters[i].gain.value = v
      const dbEl = document.getElementById('eqdb' + i)
      dbEl.textContent = (v > 0 ? '+' : '') + v
      dbEl.style.color = v > 0 ? 'var(--cyan)' : v < 0 ? 'var(--magenta)' : ''
    })
  })
})()

// ─── PLANET CANVAS ───────────────────────────────────────────────────────────
;(function() {
  const pc = document.getElementById('planet-canvas')
  const ctx = pc.getContext('2d')

  function resize() { pc.width = pc.offsetWidth; pc.height = pc.offsetHeight }
  resize()
  window.addEventListener('resize', resize)

  const PLANETS = [
    { x:0.10, y:0.20, r:44, rot:0,   rotSpd:0.003,  vx:0.000055, vy:0.000040,
      c1:'#0d001f', c2:'#290060', acc:'#9900ff', rings:true,  ringCol:'rgba(120,0,220,0.5)' },
    { x:0.82, y:0.14, r:26, rot:1.0, rotSpd:-0.005, vx:-0.000045, vy:0.000065,
      c1:'#001520', c2:'#003348', acc:'#00ffe7', rings:false, ringCol:null },
    { x:0.90, y:0.62, r:20, rot:0.8, rotSpd:0.009,  vx:-0.000080, vy:-0.000050,
      c1:'#200010', c2:'#480020', acc:'#ff00c8', rings:false, ringCol:null },
    { x:0.16, y:0.78, r:32, rot:2.0, rotSpd:-0.004, vx:0.000060, vy:-0.000030,
      c1:'#141000', c2:'#2c2200', acc:'#ffe600', rings:true,  ringCol:'rgba(180,150,0,0.45)' },
  ]

  let dragging = null, lastMX = 0, velX = 0

  function hitTest(mx, my) {
    for (let i = PLANETS.length - 1; i >= 0; i--) {
      const p = PLANETS[i]
      const dx = mx - p.x * pc.width, dy = my - p.y * pc.height
      if (dx*dx + dy*dy <= (p.r * 1.3) ** 2) return p
    }
    return null
  }

  // Use document-level events so drags never get "stuck"
  document.addEventListener('mousemove', e => {
    const rect = pc.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    if (dragging) {
      velX = mx - lastMX
      dragging.x = Math.max(0.04, Math.min(0.96, mx / pc.width))
      dragging.y = Math.max(0.04, Math.min(0.96, my / pc.height))
      dragging.rotSpd = velX * 0.009
      lastMX = mx
    } else {
      const over = hitTest(mx, my)
      pc.style.pointerEvents = over ? 'auto' : 'none'
      pc.style.cursor = over ? 'grab' : 'default'
    }
  })

  pc.addEventListener('mousedown', e => {
    const rect = pc.getBoundingClientRect()
    const p = hitTest(e.clientX - rect.left, e.clientY - rect.top)
    if (p) { dragging = p; lastMX = e.clientX - rect.left; velX = 0; pc.style.cursor = 'grabbing'; e.preventDefault() }
  })

  document.addEventListener('mouseup', () => {
    if (dragging) { dragging.rotSpd = velX * 0.013; dragging = null; pc.style.pointerEvents = 'none' }
  })

  function drawPlanet(p) {
    const W = pc.width, H = pc.height
    const px = p.x * W, py = p.y * H, r = p.r

    if (p !== dragging) {
      p.x += p.vx; p.y += p.vy
      if (p.x < -0.12) p.x = 1.12
      if (p.x >  1.12) p.x = -0.12
      if (p.y < -0.12) p.y = 1.12
      if (p.y >  1.12) p.y = -0.12
      if (Math.abs(p.rotSpd) > 0.0008) p.rotSpd *= 0.994
    }
    p.rot = (p.rot + p.rotSpd) % (Math.PI * 2)

    // Ring — back half
    if (p.rings) {
      ctx.save(); ctx.translate(px, py); ctx.scale(1, 0.28)
      ctx.beginPath(); ctx.arc(0, 0, r * 1.75, Math.PI, Math.PI * 2)
      ctx.strokeStyle = p.ringCol; ctx.lineWidth = r * 0.28; ctx.globalAlpha = 0.5; ctx.stroke()
      ctx.restore(); ctx.globalAlpha = 1
    }

    // Sphere
    const grd = ctx.createRadialGradient(px - r*0.3, py - r*0.35, r*0.08, px, py, r)
    grd.addColorStop(0, p.c2); grd.addColorStop(0.6, p.c2); grd.addColorStop(1, p.c1)
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2)
    ctx.fillStyle = grd; ctx.globalAlpha = 1; ctx.fill()

    // Atmosphere rim
    const atm = ctx.createRadialGradient(px, py, r*0.72, px, py, r*1.28)
    atm.addColorStop(0, 'transparent')
    atm.addColorStop(0.5, p.acc + '28')
    atm.addColorStop(1, 'transparent')
    ctx.beginPath(); ctx.arc(px, py, r*1.28, 0, Math.PI*2)
    ctx.fillStyle = atm; ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1

    // Surface bands (clipped)
    ctx.save()
    ctx.beginPath(); ctx.arc(px, py, r*0.97, 0, Math.PI*2); ctx.clip()
    for (let b = 0; b < 5; b++) {
      const by = py - r + (b/5)*r*2
      const hw = Math.sqrt(Math.max(0, r*r - (by-py)**2))
      const wave = Math.sin(p.rot*2 + b*1.4) * r*0.07
      ctx.beginPath(); ctx.ellipse(px+wave, by, hw, r*0.13, 0, 0, Math.PI*2)
      ctx.fillStyle = p.acc; ctx.globalAlpha = 0.06 + (b%2)*0.04; ctx.fill()
    }
    ctx.restore(); ctx.globalAlpha = 1

    // Ring — front half
    if (p.rings) {
      ctx.save(); ctx.translate(px, py); ctx.scale(1, 0.28)
      ctx.beginPath(); ctx.arc(0, 0, r*1.75, 0, Math.PI)
      ctx.strokeStyle = p.ringCol; ctx.lineWidth = r*0.28; ctx.globalAlpha = 0.65; ctx.stroke()
      ctx.restore(); ctx.globalAlpha = 1
    }

    // Specular highlight
    const sg = ctx.createRadialGradient(px-r*0.27, py-r*0.3, 0, px-r*0.27, py-r*0.3, r*0.2)
    sg.addColorStop(0, 'rgba(255,255,255,0.20)'); sg.addColorStop(1, 'transparent')
    ctx.beginPath(); ctx.arc(px-r*0.27, py-r*0.3, r*0.2, 0, Math.PI*2)
    ctx.fillStyle = sg; ctx.fill()
  }

  function frame() {
    ctx.clearRect(0, 0, pc.width, pc.height)
    PLANETS.forEach(drawPlanet)
    requestAnimationFrame(frame)
  }
  frame()
})()

// ─── RECORD CANVAS FX ────────────────────────────────────────────────────────
;(function() {
  const rc = document.getElementById('record-canvas')
  const rctx = rc.getContext('2d')
  // Set intrinsic pixel size to match CSS size
  rc.width = 300; rc.height = 300
  const CX = 150, CY = 150  // canvas center (record center is 40px offset inside 300px canvas)
  // Record outer radius in canvas pixels: record is 220px wide centered at 150,150 → r=106
  const BR = 107

  let scan = 0

  function drawRFX() {
    rctx.clearRect(0, 0, 300, 300)
    const isPlaying = !audio.paused && tracks.length > 0

    // Always-on: thin static rings just outside the record
    ;[[BR + 5, 'rgba(0,255,231,0.10)'], [BR + 9, 'rgba(255,0,200,0.07)']].forEach(([r, col]) => {
      rctx.beginPath()
      rctx.arc(CX, CY, r, 0, Math.PI * 2)
      rctx.strokeStyle = col
      rctx.lineWidth = 0.8
      rctx.stroke()
    })

    if (isPlaying) {
      scan = (scan + 0.022) % (Math.PI * 2)

      // Rotating scan sweep
      const sweepLen = Math.PI * 0.5
      for (let r = BR - 2; r <= BR + 22; r += 1.5) {
        const t = (r - (BR - 2)) / 24
        rctx.beginPath()
        rctx.arc(CX, CY, r, scan, scan + sweepLen)
        rctx.strokeStyle = `rgba(0,255,231,${((1 - t) * 0.16).toFixed(3)})`
        rctx.lineWidth = 1.5
        rctx.stroke()
      }
      // Bright leading ray
      const la = scan + sweepLen
      rctx.beginPath()
      rctx.moveTo(CX + Math.cos(la) * (BR - 8), CY + Math.sin(la) * (BR - 8))
      rctx.lineTo(CX + Math.cos(la) * (BR + 24), CY + Math.sin(la) * (BR + 24))
      rctx.strokeStyle = 'rgba(0,255,231,0.65)'
      rctx.lineWidth = 1
      rctx.stroke()

      // Radial frequency bars
      let fd = null
      if (analyser) {
        fd = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(fd)
      }

      const N = 80
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2 - Math.PI / 2
        const v = fd ? fd[Math.floor(i * fd.length / N)] / 255 : 0
        const bh = 2 + v * 30
        const col = i % 4 === 0 ? '#ff00c8' : '#00ffe7'
        rctx.globalAlpha = 0.3 + v * 0.65
        rctx.strokeStyle = col
        rctx.lineWidth = 1.5
        rctx.beginPath()
        rctx.moveTo(CX + Math.cos(angle) * BR, CY + Math.sin(angle) * BR)
        rctx.lineTo(CX + Math.cos(angle) * (BR + bh), CY + Math.sin(angle) * (BR + bh))
        rctx.stroke()
      }
      rctx.globalAlpha = 1

      // Beat-reactive outer halo glow
      if (fd) {
        const avg = fd.reduce((a, b) => a + b, 0) / fd.length / 255
        if (avg > 0.01) {
          const g = rctx.createRadialGradient(CX, CY, BR + 12, CX, CY, BR + 50)
          g.addColorStop(0, `rgba(0,255,231,${(avg * 0.22).toFixed(3)})`)
          g.addColorStop(1, 'transparent')
          rctx.fillStyle = g
          rctx.fillRect(0, 0, 300, 300)
        }
      }

    } else {
      // Idle: slow pulsing ring
      const p = Math.sin(Date.now() * 0.0009) * 0.5 + 0.5
      rctx.beginPath()
      rctx.arc(CX, CY, BR + 7, 0, Math.PI * 2)
      rctx.strokeStyle = `rgba(0,255,231,${(0.04 + p * 0.07).toFixed(3)})`
      rctx.lineWidth = 1
      rctx.stroke()
    }

    requestAnimationFrame(drawRFX)
  }

  drawRFX()
})()
