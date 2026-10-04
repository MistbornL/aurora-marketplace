// The hero's sound, synthesised with Web Audio: a quiet room tone, a soft bid
// chime and the gavel knock on "Sold.". Nothing is downloaded (0 bytes), and
// nothing plays until the visitor turns sound on (browsers require a click).

type Ctx = AudioContext

let ctx: Ctx | null = null
let master: GainNode | null = null
let room: { src: AudioBufferSourceNode; gain: GainNode } | null = null
let enabled = false
let roomLevel = 0

const KEY = "tsiskari.heroSound"

export function soundPreferred() {
  try {
    return localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

/** True only if the visitor actively turned the hero sound off. */
export function soundMuted() {
  try {
    return localStorage.getItem(KEY) === "0"
  } catch {
    return false
  }
}

function ensure() {
  if (ctx) return ctx
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(ctx.destination)
  return ctx
}

function noiseBuffer(c: Ctx, seconds: number, brown = false) {
  const len = Math.floor(c.sampleRate * seconds)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    } else d[i] = w
  }
  return buf
}

/** Low, warm hall ambience: brown noise through a lowpass, looped. */
function startRoom() {
  const c = ensure()
  if (!c || !master || room) return
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 4, true)
  src.loop = true
  const lp = c.createBiquadFilter()
  lp.type = "lowpass"
  lp.frequency.value = 420
  const gain = c.createGain()
  gain.gain.value = 0
  src.connect(lp).connect(gain).connect(master)
  src.start()
  room = { src, gain }
  setRoomLevel(roomLevel)
}

function stopRoom() {
  if (!room || !ctx) return
  const r = room
  room = null
  r.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.2)
  window.setTimeout(() => r.src.stop(), 900)
}

/** 0..1, eased; the hero fades the room in and out with the film. */
export function setRoomLevel(level: number) {
  roomLevel = level
  if (!room || !ctx) return
  room.gain.gain.setTargetAtTime(0.11 * level, ctx.currentTime, 0.35)
}

export function isSoundOn() {
  return enabled
}

export async function setSound(on: boolean) {
  enabled = on
  try {
    localStorage.setItem(KEY, on ? "1" : "0")
  } catch {
    /* private mode */
  }
  if (on) {
    const c = ensure()
    if (!c) return
    if (c.state === "suspended") await c.resume().catch(() => {})
    startRoom()
  } else {
    stopRoom()
  }
}

/** Gavel on the block: a wooden click on top of a short low thump. */
export function playGavel(force = false) {
  if (!enabled && !force) return
  const c = ensure()
  if (!c || !master) return
  if (c.state === "suspended") void c.resume().catch(() => {})
  const t = c.currentTime + 0.01
  // body
  const o = c.createOscillator()
  o.type = "sine"
  o.frequency.setValueAtTime(150, t)
  o.frequency.exponentialRampToValueAtTime(62, t + 0.18)
  const og = c.createGain()
  og.gain.setValueAtTime(0.0001, t)
  og.gain.exponentialRampToValueAtTime(0.9, t + 0.004)
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
  o.connect(og).connect(master)
  o.start(t)
  o.stop(t + 0.35)
  // wood
  const n = c.createBufferSource()
  n.buffer = noiseBuffer(c, 0.08)
  const bp = c.createBiquadFilter()
  bp.type = "bandpass"
  bp.frequency.value = 1900
  bp.Q.value = 3.5
  const ng = c.createGain()
  ng.gain.setValueAtTime(0.0001, t)
  ng.gain.exponentialRampToValueAtTime(0.7, t + 0.002)
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
  n.connect(bp).connect(ng).connect(master)
  n.start(t)
  // hall tail
  const tail = c.createBufferSource()
  tail.buffer = noiseBuffer(c, 1.2, true)
  const tlp = c.createBiquadFilter()
  tlp.type = "lowpass"
  tlp.frequency.value = 700
  const tg = c.createGain()
  tg.gain.setValueAtTime(0.25, t + 0.01)
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)
  tail.connect(tlp).connect(tg).connect(master)
  tail.start(t)
}

/** A soft two-tone bell, used when the lot appears. */
export function playChime() {
  if (!enabled) return
  const c = ensure()
  if (!c || !master) return
  const t = c.currentTime + 0.01
  ;[
    [880, 0.11, 0],
    [1318.5, 0.07, 0.09],
  ].forEach(([f, v, d]) => {
    const o = c.createOscillator()
    o.type = "sine"
    o.frequency.value = f
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t + d)
    g.gain.exponentialRampToValueAtTime(v, t + d + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 1.4)
    o.connect(g).connect(master!)
    o.start(t + d)
    o.stop(t + d + 1.5)
  })
}
