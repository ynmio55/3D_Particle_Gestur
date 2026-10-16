# 3D Particle Gesture

An interactive real-time particle sculpture in your browser, inspired by a 3D gesture-visualization reference video. Uses Three.js/WebGL for rendering and MediaPipe Hands for local webcam tracking.

## Start

Requires Node.js 20.19+ or 22.12+.

```bash
git clone https://github.com/ynmio55/3D_Particle_Gestur.git
cd 3D_Particle_Gestur
npm install
npm run dev
```

Open the local URL printed by Vite (typically http://localhost:5173).

## Controls

- **Enable Camera**: grant permission to use hand tracking (browser requires localhost or HTTPS).
- **Open palm**: expand particle field.
- **Pinch thumb & index**: compress particles.
- **Fist**: trigger a shockwave burst (once per fist).
- **Move hand**: steer the orbital camera.
- **Move mouse**: orbit scene in demo mode.
- **Scroll**: zoom.
- **Select form**: sphere, torus, galaxy, helix, heart.
- **Appearance controls**: particles (12k–100k), palette, motion speed.

The project works without a webcam in mouse-demo mode. For best results, run on a computer with an accelerated WebGL implementation. Camera frames are processed **locally** in the browser; no upload/storage feature is implemented. Note: the MediaPipe library is fetched from jsDelivr CDN at runtime.

## Production

```bash
npm run build
npm run preview
```

Deploy the generated `dist/` to any HTTPS static host (Vercel/Netlify/Cloudflare Pages). Use build command `npm run build`, output `dist`.

## Notes

This is an original interactive implementation, not a pixel-perfect reproduction. Performance and tracking accuracy depend on GPU, lighting, webcam and browser. Use 12k particles on weaker GPUs; 100k is optional. Hand tracking requires stable frontal camera lighting; motion is smoothed to reduce flicker.
