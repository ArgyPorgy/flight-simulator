## Packages
leaflet | Core map rendering engine for the radar
react-leaflet | React bindings for Leaflet map
@types/leaflet | TypeScript definitions for Leaflet

## Notes
- Leaflet requires CSS to be imported for correct rendering, handled in the map component.
- The map uses CartoDB DarkMatter tiles to fit the ATC aesthetic.
- Aircraft agent positions are polled every 2s, and Leaflet markers use CSS transitions for smooth interpolation.
- Auth is mocked via a custom Privy/Wallet overlay that posts to `/api/auth/login`.
