# REALISTIC OPEN-WORLD CAR GAME — MASTER DEVELOPMENT PROMPT

## IMPORTANT

You are working on my **existing car racing game project**.

I will provide a **map image** as the visual reference for the open-world layout.

Use the attached map image as the **primary layout reference**. Recreate its major roads, districts, terrain shape, coastline, important locations and overall composition as a real, playable 3D world.

Do NOT treat the image as a texture.
Do NOT simply place the image on the ground.
Do NOT create a completely different random map.

Turn the map design into a believable, connected and fully drivable open world.

The goal is not just to make the game look good.

The goal is to make it feel like a **real place that happens to be designed for an arcade racing game**.

---

# 1. FIRST UNDERSTAND THE EXISTING GAME

Before making major changes:

1. Inspect the existing architecture.
2. Find the current world/map code.
3. Find the terrain and road systems.
4. Find the car controller and physics.
5. Find the NASCAR/Raceway track.
6. Find the pit-stop, fuel and tire systems.
7. Find AI, races/events and current UI.
8. Find the camera and any existing map/navigation system.

Reuse existing working systems whenever possible.

Do not rebuild the entire game from scratch.

Do not replace working systems unnecessarily.

---

# 2. PRIMARY DESIGN GOAL

Build a:

**REALISTIC + BELIEVABLE + DRIVABLE + INTERESTING + COMPACT OPEN WORLD**

The world should feel like a small real region/city rather than a collection of decorative objects.

Everything should have a reason to exist.

Examples:

- Roads should lead somewhere.
- Buildings should have entrances.
- Houses should have driveways.
- Shops should have parking.
- Factories should have loading areas.
- Gas stations should have entrances and exits.
- The Raceway should have an access road.
- Hills should have roads that realistically climb them.
- Bridges should connect roads across water.
- Restricted facilities should have fences and controlled entrances.
- Utility infrastructure should connect logically.

Use **common sense** when designing everything.

---

# 3. USE THE MAP IMAGE CORRECTLY

Analyze the provided map image and reproduce its important structure.

Pay attention to:

- overall map shape
- coastline
- water
- road placement
- major roads
- intersections
- district locations
- terrain regions
- Raceway location
- industrial areas
- residential areas
- forest
- hills
- quarry
- harbor
- beach
- open areas

Preserve the **relative relationships** between these areas.

Do not randomly rearrange them.

Do not make the world enormous.

Keep it compact enough for a casual open-world driving game.

---

# 4. MAKE THE WORLD 3D

The world must NOT be a flat plane.

Create meaningful elevation:

- flat urban terrain
- coastal lowlands
- rolling hills
- elevated hills
- forest terrain
- quarry excavation
- industrial flatland
- suburban rolling terrain
- open grassland
- Raceway terrain

Terrain should transition naturally.

Avoid random mountains, giant cliffs, impossible slopes and sudden height changes.

---

# 5. ROAD NETWORK — EXTREMELY IMPORTANT

The road network is one of the most important parts of the game.

Create real, fully drivable roads based on the map image.

Use:

### Main roads
Wide roads connecting major districts.

### Secondary roads
Medium roads connecting neighborhoods and districts.

### Local streets
Smaller roads inside residential areas.

### Service roads
Industrial, quarry, harbor and Raceway roads.

### Scenic roads
Coastal, hill and forest routes.

Every major location should have a logical route from the main road network.

---

# 6. ROAD REALISM

Depending on road type, use:

- lane markings
- center lines
- edge lines
- turn arrows
- crosswalks
- stop lines
- traffic signs
- speed-limit signs
- traffic lights
- road reflectors
- curbs
- sidewalks
- drainage
- guardrails
- barriers
- streetlights
- road shoulders

Do not put every feature on every road.

A highway should not look like a residential street, and a forest road should not have Downtown-level infrastructure.

---

# 7. ROAD INTERSECTIONS

Create believable intersections with appropriate:

- traffic lights
- stop/yield signs
- turning lanes
- pedestrian crossings
- lane markings
- sidewalks
- corner curbs

Avoid roads simply crossing each other without proper intersection design.

---

# 8. ROAD CONNECTIVITY

Perform a complete connectivity check.

The player should be able to logically drive between:

- Downtown
- Beach
- Harbor
- Suburbs
- Hills
- Quarry
- Forest
- Industrial Zone
- Wind Farm
- Raceway

Avoid roads ending randomly, entering buildings, stopping at terrain, invisible walls, impossible jumps or disconnected segments.

---

# 9. RACEWAY ACCESS — CRITICAL

The NASCAR Raceway must be properly connected to the open world.

There must be a clearly visible and fully drivable access road:

```text
MAIN WORLD ROAD
       ↓
RACEWAY ACCESS ROAD
       ↓
ENTRY GATE
       ↓
RACEWAY FACILITY
       ↓
PARKING / PIT / TRACK ACCESS
```

The player must NOT get stuck against the Raceway boundary.

Keep the perimeter, but add a proper gate and correct collision.

There should be one obvious public vehicle entrance. Other sides should remain restricted using fencing, barriers, walls or guardrails.

Test both:

```text
OPEN WORLD → RACEWAY
RACEWAY → OPEN WORLD
```

---

# 10. REUSE THE EXISTING NASCAR TRACK

If the project already contains the NASCAR track:

**REUSE IT.**

Do not create another unrelated NASCAR system.

Preserve its existing track geometry, banking, collision, barriers, pit lane, pit boxes, grandstands and race logic.

Integrate it naturally into the open world.

---

# 11. RACEWAY FACILITY

Make the Raceway feel like a real motorsport facility.

Include where appropriate:

- main entrance
- security/checkpoint
- ticket/event entrance
- parking lots
- staff parking
- service roads
- fencing
- signs
- grandstands
- media/service areas
- maintenance buildings
- team garages
- pit facilities
- lighting towers

---

# 12. PIT LANE & TRACK SIDE — CRITICAL

Make the pit lane and track side look exactly like a real NASCAR track.

The pit lane must be placed **parallel to the main track on the right side**, separated from the track by a **concrete pit wall**. The pit lane should look professional, realistic, and immersive.

## 12.1 PIT LANE LAYOUT

- Pit lane runs **parallel to the main track on the right side**.
- Separate the pit lane from the main track using a **concrete pit wall**.
- Add **pit entry** and **pit exit** like real NASCAR.
- Pit lane should be **slightly narrower** than the main track.
- Add a **continuous yellow line** on the right side of the pit lane.
- Add a **pit speed limit zone** — speed is automatically limited when inside the pit lane.
- Cars can enter the pit lane voluntarily.
- All cars (player + AI) must use the same pit lane.

## 12.2 PIT LANE VISUAL DETAILS

- Realistic **concrete pit wall**.
- **Pit boxes / marks on the ground** for each team.
- **Garages, pit crew areas, and team equipment**.
- **Fuel stations, tire racks, tool carts, and boards**.
- **Pit crew members** (animated or idle).
- **Sponsor banners, team logos, and flags**.
- **Timing & scoring tower** near the pit lane.
- **Safety barriers** at pit entry and pit exit.
- Make the environment detailed, clean, and professional like a real NASCAR track.

## 12.3 PIT ENTRY & EXIT

- Realistic **pit entry**: a curved section before the pit lane.
- Realistic **pit exit**: a curved merge back onto the main track.
- Clear signage: **"PIT ENTRY"** and **"PIT EXIT"**.
- **Speed limit boards** (e.g. 50 km/h) at pit entry.
- **Cones or barriers** to guide cars smoothly.
- Smooth transition from track to pit lane and vice versa.

## 12.4 ENVIRONMENT & ATMOSPHERE

- **Grandstands full of spectators**.
- **Crowd animations and sounds**.
- **Team garages and pit buildings**.
- **Realistic lighting** (day/night as required).
- **Ambient sounds**: engines, pit crews, crowd, tools, announcements.
- **Realistic asphalt texture** for both track and pit lane.
- **Rubber marks, oil stains, and wear** on the pit lane.

## 12.5 PIT GAMEPLAY BEHAVIOR

- When entering pit lane, **reduce speed automatically**.
- Car **stops at the assigned pit box**.
- Pit crew performs: **fuel refill, tire change, and inspection**.
- Show a **pit stop timer**.
- After service, car **exits pit lane and merges back to the track safely**.
- All AI cars must use the same pit lane and follow pit rules.

## 12.6 KEY VISUAL ELEMENTS TO MATCH THE REFERENCE

- Pit lane parallel to track
- Concrete pit wall
- Pit entry and pit exit
- Pit boxes with crews
- Garages and team equipment
- Scoring tower
- Grandstands
- Sponsor banners
- Flags
- Realistic asphalt
- Crowded environment

**GOAL:** Create a realistic NASCAR-style pit lane and track side with the same layout, scale, details, and atmosphere as a real NASCAR track. It should look professional, immersive, and feel like a real NASCAR race when playing.

---

# 13. DOWNTOWN

Create a compact believable Downtown:

- offices
- apartments
- shops
- restaurants
- small businesses
- sidewalks
- crosswalks
- traffic lights
- parking
- streetlights
- street signs
- parked cars
- bus stops
- benches
- trees
- utility infrastructure

Buildings should be placed along streets logically.

Do not create a giant city.

---

# 14. RESIDENTIAL / SUBURBAN AREA

Create realistic neighborhoods:

- houses
- apartments
- driveways
- garages
- gardens
- fences
- sidewalks
- parked cars
- streetlights
- parks
- playgrounds
- local streets
- mailboxes

Homes should face streets logically.

---

# 15. BEACH

Create a believable coastal area:

- sand
- palm trees
- vegetation
- beach access
- parking
- small shops
- benches
- umbrellas
- lifeguard station where appropriate
- coastal road
- viewpoints

Do not make the beach empty or overcrowded.

---

# 16. HARBOR

Make the harbor feel functional:

- docks
- piers
- boats
- warehouses
- containers
- cranes
- service roads
- trucks
- parking
- fences
- harbor lights
- loading areas

Give it clear vehicle access.

---

# 17. INDUSTRIAL AREA

Create:

- factories
- warehouses
- loading docks
- storage yards
- containers
- trucks
- employee parking
- fences
- utility structures
- service roads
- security gates

Use wider roads where appropriate.

---

# 18. FOREST

Create a natural forest using:

- multiple tree types
- different tree sizes
- bushes
- grass
- rocks
- clearings
- dirt paths
- winding roads
- scenic viewpoints

Keep roads visible.

---

# 19. HILLS

Create rolling terrain with:

- winding roads
- guardrails
- warning signs
- rocks
- grass
- scattered vegetation
- viewpoints

Roads should naturally follow elevation.

---

# 20. QUARRY

Make the quarry visually distinct:

- excavated terrain
- terraced rock walls
- gravel roads
- rock piles
- mining machinery
- excavators
- service buildings
- barriers
- dirt areas

Give it a real road connection.

---

# 21. WIND FARM

Create a small wind farm with approximately 5–8 turbines.

Include:

- turbine foundations
- maintenance roads
- fences
- maintenance building
- grassland
- utility equipment

Space turbines naturally.

---

# 22. GAS STATIONS

Add realistic gas stations in sensible locations.

Each should have:

- road entrance
- road exit
- fuel pumps
- canopy
- convenience store
- parking
- signs
- lighting
- service area

Integrate the existing fuel system if available.

---

# 23. GARAGE / PLAYER HUB

Create a meaningful player garage:

- garage building
- parking
- vehicle spawn area
- service area
- entrance/exit
- signage

Integrate existing customization/tuning systems.

---

# 24. VEHICLE SERVICE / TUNING

Add believable service locations such as:

- tuning shop
- tire service
- repair garage
- performance workshop

Connect existing tire/fuel mechanics to these locations where appropriate.

---

# 25. TRAFFIC

If AI traffic exists, improve it:

- cars stay on roads
- follow lanes
- stop at traffic lights
- slow near intersections
- avoid buildings
- avoid cliffs
- avoid random stopping

Use varied vehicles where appropriate:

- normal cars
- SUVs
- trucks
- delivery vehicles
- buses

Do not overload the map.

---

# 26. PEDESTRIANS

If technically compatible and performance allows, add lightweight pedestrians around:

- Downtown
- Beach
- Harbor
- Raceway
- shops
- parking

Keep pedestrians outside vehicle lanes except at appropriate crossings.

---

# 27. PARKING

Add sensible parking:

- parking lots
- street parking
- business parking
- residential parking
- Raceway parking
- harbor parking
- industrial parking

Use parking lines, signs, lighting and parked vehicles.

---

# 28. UTILITIES AND INFRASTRUCTURE

Add believable:

- utility poles
- electrical lines
- transformers
- streetlights
- drainage
- communication towers
- utility buildings
- road maintenance objects

Place them logically.

---

# 29. SMALL DETAILS

Use contextual details sparingly:

- trash bins
- benches
- road cones
- construction barriers
- signs
- mailboxes
- fences
- bollards
- dumpsters
- advertisements
- bus stops
- parking meters
- subtle tire marks
- road wear
- rooftop equipment
- loading pallets
- shipping containers

Every detail should fit its location.

---

# 30. WEATHER / ATMOSPHERE

If supported, add optional:

- clear weather
- cloudy weather
- light fog
- changing sky
- atmospheric haze

Keep driving visibility good.

---

# 31. DAY / NIGHT

If the existing game supports time:

- daylight
- sunset
- evening
- night

At night use:

- streetlights
- building lights
- Raceway lighting
- gas station lighting
- harbor lighting
- headlights

Keep the world playable at night.

---

# 32. MATERIAL QUALITY

Improve:

- asphalt
- concrete
- dirt
- grass
- sand
- rocks
- buildings
- metal
- glass
- water

Use subtle material variation.

Roads can have slight wear, industrial areas can look more used, quarry areas can be dusty, and Downtown can be more maintained.

---

# 33. VEHICLE-ENVIRONMENT INTERACTION

Where supported, add:

- vehicle shadows
- tire contact
- dust on dirt roads
- subtle tire marks
- suspension response to terrain
- different grip on different surfaces

Keep effects subtle and gameplay-friendly.

---

# 34. WORLD MAP

Create a full-world map representing the actual game world.

Show:

- roads
- terrain
- water
- districts
- major buildings
- Raceway
- gas stations
- garage
- shops
- events
- player position
- selected location

Do NOT use a static screenshot.

Synchronize it with the actual world.

---

# 35. MAP ZOOM

Add smooth:

- zoom in
- zoom out

Use mouse wheel and touch pinch if supported.

Set sensible minimum and maximum zoom levels.

---

# 36. MAP PAN

Allow:

- click-and-drag
- touch drag where supported

Provide a way to return to the player's current location.

---

# 37. LOCATION SELECTION

When the player selects a location:

- highlight it
- show a marker
- store selected-location state
- make it visually obvious

Only valid locations should be selectable.

---

# 38. BOTTOM-LEFT LOCATION CONTROL

When a location is selected, activate a control in the **bottom-left corner**:

```text
[ DISCARD / CLEAR LOCATION ]
```

When no location is selected:

- hide or disable the button.

When a location is selected:

- activate the button.

When pressed:

- clear selected location
- remove highlight
- clear selection state
- update the map immediately

This must NOT delete the actual world object.

---

# 39. MAP POI TYPES

Use clear icons for:

- Raceway
- Garage
- Gas Station
- Tuning Shop
- Race
- Drift Event
- Time Trial
- Harbor
- Beach
- Downtown
- Quarry
- Wind Farm
- Player

Avoid excessive markers.

---

# 40. ADD OPTIONAL GAMEPLAY ACTIVITIES

Add activities that make exploration worthwhile:

### Street races
Short point-to-point races.

### Time trials
Beat a target time.

### Checkpoint challenges
Reach checkpoints quickly.

### Drift zones
Score points through marked sections.

### Speed zones
Maintain high speed through marked areas.

### Hill climbs
Race through winding elevated roads.

### Quarry challenges
Off-road/gravel driving.

### Raceway events
Use the NASCAR track for proper races.

### Delivery missions
Drive between locations under a time/objective.

### Exploration rewards
Reward discovering important locations.

Keep activities optional and integrate them into the world.

---

# 41. DISCOVERY SYSTEM

When the player reaches a major location:

- mark it discovered
- unlock its map icon
- optionally show a small notification

Examples:

- Raceway
- Harbor
- Beach
- Quarry
- Wind Farm
- Garage
- Tuning Shop

---

# 42. WORLD EVENTS

If the architecture supports it, add occasional dynamic events:

- temporary street race
- checkpoint event
- time trial
- special race
- drift challenge

Keep them limited and meaningful.

---

# 43. FAST TRAVEL — OPTIONAL

If suitable for the game:

Allow fast travel only to discovered major locations.

Do not make fast travel mandatory.

---

# 44. COLLISION AUDIT

Check:

- terrain
- roads
- buildings
- bridges
- fences
- barriers
- Raceway
- gates
- parking
- rocks
- water boundaries

Invisible collision must not block valid roads.

Do not give every tiny decorative object expensive collision.

---

# 45. PLAYER SHOULD NOT GET RANDOMLY STUCK

Fix problems caused by:

- invisible walls
- terrain seams
- decorative objects
- incorrect building collision
- road gaps
- Raceway boundaries
- elevation mismatches

If a location is intended to be accessible, verify the route with the actual player car.

---

# 46. PERFORMANCE

This is a browser game.

Use:

- instancing
- LOD
- frustum culling
- asset reuse
- optimized textures
- optimized shadows
- simplified distant objects
- efficient collision
- object pooling where appropriate

Do not create thousands of unique high-poly objects.

Aim for high visual quality through smart asset reuse, lighting, materials and composition.

---

# 47. WORLD SCALE

Keep the world **small/medium**, not enormous.

Avoid:

- huge empty fields
- extremely long empty roads
- massive distances between districts
- unnecessary terrain

Every area should provide visual or gameplay value.

---

# 48. FINAL TEST

After implementation, test:

```text
SPAWN
→ DOWNTOWN
→ BEACH
→ HARBOR
→ HILLS
→ QUARRY
→ FOREST
→ INDUSTRIAL
→ WIND FARM
→ SUBURBS
→ RACEWAY
→ RETURN TO DOWNTOWN
```

Verify:

- roads exist
- roads connect
- terrain works
- buildings are accessible
- Raceway entrance works
- Raceway exit works
- no invisible walls block roads
- no major collision bugs exist
- map works
- zoom works
- pan works
- location selection works
- bottom-left discard button works
- player marker works
- POI markers correspond to real locations

---

# 49. IMPLEMENTATION RULE

Do not attempt to blindly build everything in one enormous change.

Work in logical stages:

1. Inspect existing project.
2. Analyze the map image.
3. Fix world structure.
4. Build/fix terrain.
5. Build/fix roads.
6. Fix Raceway access.
7. Fix collision.
8. Make all major locations reachable.
9. Add buildings and infrastructure.
10. Add environmental details.
11. Add gameplay activities.
12. Build the world map.
13. Add zoom/pan.
14. Add location selection.
15. Add the bottom-left discard button.
16. Polish graphics.
17. Optimize performance.
18. Test the complete world.

After each major stage, test and fix obvious problems before continuing.

---

# 50. FINAL VISION

The finished game should feel like a:

**BELIEVABLE COMPACT OPEN-WORLD ARCADE RACING GAME**

The player should be able to:

- freely drive around the world
- explore different environments
- discover locations
- visit Downtown
- drive along the coast
- explore the harbor
- climb hills
- enter the quarry
- drive through forests
- visit industrial areas
- reach the wind farm
- enter the NASCAR Raceway
- use pit facilities
- manage fuel and tires
- participate in races
- find events
- open the world map
- zoom in/out
- pan around
- select locations
- clear selected locations

The world should look good from far away **and** remain believable when the player drives close to roads, buildings and facilities.

---

# FINAL PRINCIPLE

Use this rule for every feature:

> **If it exists in the world, it should make sense. If the player can see it, there should generally be a logical way to reach or interact with it. If a road exists, it should lead somewhere useful. If a location is important, it must be accessible.**

Prioritize:

**WORLD STRUCTURE → TERRAIN → ROAD NETWORK → RACEWAY ACCESS → COLLISION → CONNECTIVITY → BUILDINGS → ENVIRONMENT → GAMEPLAY → MAP → GRAPHICS → POLISH → PERFORMANCE**

Do not sacrifice gameplay connectivity just to make the world look impressive.
