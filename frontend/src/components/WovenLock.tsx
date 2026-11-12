import { useEffect, useRef } from 'react'
import { Icon } from './Icon.tsx'

type Point = [x: number, y: number, z: number]
const colors = ['#70f2dd', '#8699ff', '#d7aaff', '#ffe0bc']

function lockPoints() {
  const shackle: Point[] = []
  const body: Point[] = []

  // Sweep a circular cross-section along the arch and down both straight legs.
  for (let step = 0; step <= 104; step += 1) {
    const distance = step / 104 * (Math.PI * .56 + .72)
    const angle = Math.min(Math.PI, Math.max(0, (distance - .36) / .56))
    const leg = Math.max(.36 - distance, distance - .36 - Math.PI * .56, 0)
    for (let strand = 0; strand < 16; strand += 1) {
      const twist = strand * Math.PI / 8 + distance * 3.4
      const radius = .56 + .115 * Math.cos(twist)
      shackle.push([radius * Math.cos(angle), .47 + radius * Math.sin(angle) - leg, .115 * Math.sin(twist)])
    }
  }

  // Connect front and back faces with rounded sides. Leave the keyhole open on both faces.
  for (const z of [-.26, .26]) {
    for (let row = 0; row <= 34; row += 1) {
      const y = -.93 + row * .036
      for (let column = 0; column <= 44; column += 1) {
        const x = -.792 + column * .036 + (row % 2) * .018
        const corner = Math.hypot(Math.max(Math.abs(x) - .63, 0), Math.max(Math.abs(y + .318) - .45, 0))
        const keyhole = Math.hypot(x, y + .23) < .12 || (y < -.23 && y > -.61 && Math.abs(x) < .055 + (-y - .23) * .13)
        if (corner <= .16 && !keyhole) body.push([x, y, z])
      }
    }
  }
  for (let step = 0; step < 152; step += 1) {
    const angle = step / 152 * Math.PI * 2
    const x = Math.cos(angle), y = Math.sin(angle)
    const scale = 1 / Math.max(Math.abs(x) / .63, Math.abs(y) / .45)
    for (let strand = 0; strand <= 12; strand += 1) {
      body.push([x * (scale + .15), y * (scale + .15) - .318, -.24 + strand * .04])
    }
  }

  return [body.filter(([, , z]) => z < 0), shackle, body.filter(([, , z]) => z >= 0)].map((points) => {
    const threads: Point[][] = colors.map(() => [])
    for (const point of points) {
      const [x, y, z] = point
      const tone = Math.sin(x * 79.2 + y * 61.9 + z * 48.4) * 4271.3
      threads[Math.floor((tone - Math.floor(tone)) * colors.length)].push(point)
    }
    return threads
  })
}

export function WovenLock() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const scene = canvas.closest('section')
    const strands = lockPoints()
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let lastFrame = 0
    let visible = false
    let targetX = 0
    let targetY = 0
    let tiltX = 0
    let tiltY = 0

    function draw(now: number) {
      frame = 0
      if (!canvas || !context || !visible || document.hidden) return
      if (motion.matches || now - lastFrame >= 31) {
        const { clientWidth, clientHeight } = canvas
        const ratio = Math.min(window.devicePixelRatio, 1.5)
        const width = Math.round(clientWidth * ratio)
        const height = Math.round(clientHeight * ratio)
        if (!width || !height) return
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }
        const time = motion.matches ? 0 : now * .001
        tiltX += (targetX - tiltX) * .10
        tiltY += (targetY - tiltY) * .10
        const yaw = -.30 + Math.sin(time * .55) * .15 + tiltX * .28
        const pitch = .13 + tiltY * .20
        const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw)
        const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch)
        const scale = Math.min(width, height) * .34
        const centerX = width * .50
        const centerY = height * .52
        context.clearRect(0, 0, width, height)

        for (const [layer, threads] of strands.entries()) {
          for (const [thread, points] of threads.entries()) {
            context.fillStyle = colors[thread]
            for (const [x, y, z] of points) {
              const wave = Math.sin(y * 5 + z * 7 - time * 1.35)
              const depth = z * cosYaw - x * sinYaw
              const projectedX = x * cosYaw + z * sinYaw + wave * .022
              const projectedY = y * cosPitch - depth * sinPitch
              const perspective = 3.8 / (3.8 - depth)
              const shimmer = Math.sin(x * 9 + y * 6 + z * 14 - time * 2.6)
              const size = (1.10 + .51 * (1 + shimmer)) * ratio * perspective
              context.globalAlpha = layer === 0 ? .28 : .59 + shimmer * .31
              context.fillRect(centerX + projectedX * scale * perspective, centerY - projectedY * scale * perspective, size, size)
            }
          }
        }

        context.globalAlpha = .70
        context.fillStyle = colors[3]
        const sweep = Math.sin(time * .62) * .69
        for (let i = 0; i < 54; i += 1) {
          const angle = i * Math.PI * 2 / 54 + sweep
          const x = Math.cos(angle) * scale * 1.27
          const y = Math.sin(angle) * scale * .45
          context.globalAlpha = .13 + .38 * Math.pow((1 + Math.cos(angle + time)) / 2, 4)
          context.fillRect(centerX + x * .96 + y * .28, centerY + y - x * .28, ratio, ratio)
        }
        context.globalAlpha = 1
        if (!canvas.dataset.ready) canvas.dataset.ready = 'true'
        lastFrame = now
      }
      if (!motion.matches) frame = requestAnimationFrame(draw)
    }

    function schedule() {
      if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw)
    }

    function track(event: PointerEvent) {
      if (motion.matches || !canvas) return
      const bounds = canvas.getBoundingClientRect()
      targetX = (event.clientX - bounds.left) / bounds.width * 2 - 1
      targetY = (event.clientY - bounds.top) / bounds.height * 2 - 1
    }

    function reset() {
      targetX = targetY = 0
      if (motion.matches) tiltX = tiltY = 0
      schedule()
    }

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      schedule()
    })
    const resize = new ResizeObserver(schedule)
    intersection.observe(canvas)
    resize.observe(canvas)
    motion.addEventListener('change', reset)
    document.addEventListener('visibilitychange', schedule)
    scene?.addEventListener('pointermove', track)
    scene?.addEventListener('pointerleave', reset)
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      intersection.disconnect()
      motion.removeEventListener('change', reset)
      document.removeEventListener('visibilitychange', schedule)
      scene?.removeEventListener('pointermove', track)
      scene?.removeEventListener('pointerleave', reset)
    }
  }, [])

  return <div className="woven-lock" aria-hidden="true">
    <span className="woven-lock-fallback"><Icon name="lock" size={136} /></span>
    <canvas ref={ref} />
  </div>
}
