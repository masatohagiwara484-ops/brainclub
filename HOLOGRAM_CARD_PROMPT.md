# BrainClub 3D Hologram Card Selector Prompt

## Goal
Rebuild the BrainClub home selector as a premium mobile-first 3D collectible-card showcase. Each game must feel like a floating holographic trading card: a real 3D card body with thickness, bevels, animated iridescent surface, glow, depth, and a game-specific 3D model emerging from the card face.

## Implementation Stack
- React + TypeScript + Vite
- React Three Fiber for the home selector scene
- Three.js geometry/materials/shaders for card body, hologram surface, light rings, and per-frame motion
- DOM overlay only for readable game name, tagline, CTA, and app navigation

## Interaction Rules
- Horizontal drag/swipe rotates the game carousel.
- Short tap on the 3D stage starts the currently selected game.
- The hint must explicitly say both verbs.
- The primary Play button remains as a clear fallback.
- Reduced-motion users keep a 2D fallback.

## Visual Direction
- Think premium digital trading-card app rather than flat web card grid.
- The selected/front game card is the hero: larger, closer to the camera, brighter, and slightly floating.
- Side cards are visible but smaller and quieter, like a rotating showroom.
- Cards must use actual 3D structure: extruded rounded card body, bevel, transparent/metallic material, shader-driven rainbow scan, edge glow, floating particles, and a light ring.
- Game models should sit in front of the card surface so they feel like they are coming out of the card.

## Mobile Constraints
- Target 390x844 first.
- No 3D object may collide with the app header, Play button, quick-pick strip, or bottom nav.
- Front card should be dramatic but not cropped.
- Controls must remain readable and tappable.

## Anti-Patterns
- A mostly flat translucent rectangle behind the model.
- Tiny visual changes that are only visible in code.
- UI cards inside UI cards.
- Text-heavy overlays over the 3D scene.
- Tap behavior that feels ambiguous.

## Acceptance Criteria
- On mobile, the user immediately sees floating 3D hologram cards.
- The front card clearly has depth, shine, and a game model protruding from it.
- Tapping the 3D object navigates into the selected game.
- Dragging switches games without accidental navigation.
- `npm run build` passes.
- Browser playtest screenshots show a visible difference from the previous Vercel version.
