# LevelForge AI - Product Design Document

## 1. Executive Summary

**LevelForge AI** is an AI-powered level design assistant that generates, iterates, and exports game levels for Godot, Unity, and Unreal Engine. It bridges the gap between AI concept generators and playable game content, enabling developers to quickly prototype, test, and refine game levels.

**Mission:** Empower game developers to accelerate level design through intelligent automation while maintaining creative control.

**Current Status:** Concept / Pre-development

---

## 2. Problem Statement

Game developers face three core challenges in level design:

1. **Time-Consuming Prototyping** - Manually building level prototypes takes hours/days before playtesting can begin
2. **Lack of Inspiration** - Starting from a blank canvas is difficult; iteration on existing ideas is slow
3. **No Viable Monetization for Godot** - Godot's asset library doesn't support paid plugins, limiting tool developers

**Market Gap:** Existing AI tools generate level *concepts* (text descriptions, rough layouts) but produce nothing a developer can actually *use* in their engine. The gap between "AI idea" and "playable level" remains unfilled.

---

## 3. Target Audience

### Primary Users
- **Indie Game Developers** (1-3 person teams)
- **Solo Hobbyist Developers**
- **Game Design Students**
- **Prototyping Studios** (rapid MVP development)

### Secondary Users
- **Game Design Educators** (teaching level design principles)
- **Modding Communities** (user-generated content)

### Platform Preference
- Primary: Godot (free, open-source)
- Secondary: Unity, Unreal (for broader market reach)

---

## 4. Product Vision

**V1 (Free):** A functional level generator that creates playable platformer levels from text prompts, exportable as JSON/ASCII maps. Focus on linear single-path levels.

**V2 (Paid):** Full level design suite with:
- Multiple genre support (platformer, puzzle, shooter, RPG)
- Engine-native export (Godot scenes, Unity prefabs, Unreal blueprints)
- AI iteration & refinement (describe what to change → AI adjusts)
- Auto-playtesting feedback (difficulty analysis, bottleneck detection)
- Visual level editor

**V2.5 (Paid Expansion):** Metroidvania & Complex Maps
- Multiple goals and objectives
- Soft gating (ability/item based)
- Hard gating (story/progression based)
- Multi-path branching maps

**V3 (Future):** Multiplayer collaboration, community sharing, ML-based difficulty balancing

---

## 5. Feature Specifications

### V1 - Free Version (Linear Levels)

| Feature | Description | Output Format |
|---------|-------------|---------------|
| **Text-to-Level** | Describe a level in plain English → AI generates a playable layout | JSON, ASCII |
| **Genre Templates** | Pre-built prompts for platformer, puzzle, shooter basics | Built-in |
| **Basic Iteration** | "Make it harder" / "Add more enemies" - single refinement | JSON update |
| **Playable Preview** | Built-in HTML5 mini-player to test immediately | Browser |
| **Export: JSON** | Raw level data for custom importers | .json |
| **Export: ASCII** | Visual text representation | .txt |

**Pricing:** Free (Itch.io, GitHub)

**Revenue Model:** Build audience, demonstrate value for V2

---

### V2 - Paid Version ($15-25)

| Feature | Description |
|---------|-------------|
| **Multi-Genre Support** | Platformer, Puzzle, Shooter, Top-down RPG, Dungeon crawler |
| **Godot Export** | Native .tscn generation with nodes, collisions, entities |
| **Unity Export** | Prefab bundles with components |
| **Unreal Export** | Blueprint-compatible data |
| **AI Iteration** | Unlimited refinements with natural language |
| **Auto-Playtest Analysis** | AI-simulated playthrough → difficulty score, estimated completion time |
| **Bottleneck Detection** | Identifies impossible jumps, stuck points, dead ends |
| **Theme/Style Presets** | "Cyberpunk city", "Haunted forest", "Desert temple" - applies visual context |
| **Parameter Controls** | Difficulty slider, length slider, enemy density, puzzle complexity |
| **Save/Load Projects** | Local project files for ongoing work |
| **Tileset Analyzer** | Upload a tileset → AI analyzes and generates tilemap connection rules automatically |
| **Priority Support** | Discord/email support |

**Pricing:** $19.99 (one-time) or $4.99/month subscription

**Platforms:** Itch.io (primary), Gumroad (backup)

---

### V2 - Tileset Analyzer Feature

| Feature | Description |
|---------|-------------|
| **Upload Tileset** | Drag & drop PNG/JPG tileset image |
| **Auto Tile Detection** | AI detects tile size (16x16, 32x32, etc.) and splits into individual tiles |
| **Edge Analysis** | Computer vision analyzes each tile's edges to determine connections |
| **Connection Rules** | Automatically generates tilemap rules (which tiles connect to which) |
| **Preview & Confirm** | Visual preview of tile connections; user confirms or adjusts |
| **Export Rules** | Outputs Godot TileSet resource or Unity Tilemap JSON |
| **Tagging** | AI suggests tile tags (grass, wall, water, door) based on visual patterns |

**Technical Approach:**

```
1. Load tileset image
2. Detect grid (find repeating tile boundaries via pattern recognition)
3. Split into individual tile images
4. For each tile:
   - Extract edge pixels (top, bottom, left, right)
   - Classify each edge as: solid, open, corner, T-junction
   - Match against known tile patterns
5. Build connection graph
6. Generate engine-specific tilemap rules
7. User reviews, adjusts, confirms
```

**AI Classification Logic:**
- **Solid:** Edge is fully opaque → connects to other solids
- **Open:** Edge is fully transparent → connects to open edges
- **Corner:** L-shaped edge pattern → connects at corners
- **T-Junction:** T-shaped pattern → connects on 3 sides

**Supported Tile Types:**
- Platformer: ground, platforms, walls, hazards, collectibles
- Top-down: floor, wall, door, water, grass
- General: animated tiles, decorative layers

---

### V2.5 - Metroidvania Expansion

| Feature | Description |
|---------|-------------|
| **Multiple Goals** | Design levels with 2+ objectives (collect all keys, defeat all bosses, reach all exits) |
| **Soft Gating** | Ability-based barriers (double jump, wall jump, dash, grapple) |
| **Hard Gating** | Story/progression gates (requires key item, story flag, boss defeat) |
| **Multi-Path Branching** | Non-linear maps with multiple routes to objectives |
| **Backtracking Routes** | Areas accessible only after acquiring new abilities |
| **Ability Graph** | Visual representation of progression path |
| **Lock & Key Placement** | Strategic key/door placement with logical flow |
| **Metroidvania Templates** | Pre-built prompts: "metroidvania with 3 abilities", "backtrack-heavy dungeon" |

**Pricing:** Add-on ($9.99) or included in subscription

---

## 6. Technical Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     LevelForge AI                           │
├─────────────────────────────────────────────────────────────┤
│  User Interface (Web/Desktop)                               │
│  ├── Prompt Input (Natural Language)                        │
│  ├── Visual Editor (Canvas-based)                          │
│  ├── Preview Player (HTML5/WebGL)                          │
│  └── Export Panel                                          │
├─────────────────────────────────────────────────────────────┤
│  AI Processing Layer                                         │
│  ├── LLM Prompt Engineering (OpenAI Codex, z.ai, Ollama)  │
│  ├── Level Schema Validation                               │
│  ├── Difficulty Scoring Model                              │
│  ├── Playtest Simulation                                   │
│  └── Gating Logic Validator                                │
├─────────────────────────────────────────────────────────────┤
│  Export Engine                                              │
│  ├── JSON Serializer                                       │
│  ├── Godot Scene Generator (.tscn)                        │
│  ├── Unity Prefab Builder                                  │
│  └── Unreal Data Parser                                    │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React + Electron OR Tauri | Cross-platform desktop app |
| AI Backend | OpenAI API (primary), z.ai (backup), Ollama (offline) | Flexibility, cost control |
| Level Data | Custom JSON schema | Engine-agnostic intermediate |
| Local Storage | SQLite or local files | Projects, settings |

### AI Model Strategy

| Task | Model | Rationale |
|------|-------|-----------|
| Level generation | Codex (GPT-5.3) | Best for structured, technical output |
| Metroidvania logic | Codex (GPT-5.3) | Complex gating relationships |
| Refinement/iteration | z.ai (GLM-5) | Cost-effective, good coding ability |
| Offline mode | Ollama (small models) | No API dependency |
| Difficulty analysis | Lightweight model | Fast, doesn't need reasoning |

---

## 7. User Flows

### V1 Flow (Free - Linear)

```
1. User opens app
2. Selects genre template (Platformer default)
3. Types prompt: "A medium-difficulty platformer level with 5 platforms and 3 enemies"
4. AI generates level → JSON + ASCII preview
5. User clicks "Play Preview" → HTML5 mini-game loads
6. User optionally refines: "Add 2 more platforms"
7. User exports as JSON or ASCII
8. User imports into their own Godot project manually
```

### V2 Flow (Paid - Full Features)

```
1. User opens app
2. Selects genre + adjusts sliders (difficulty, length, enemy density)
3. Types prompt with theme: "Haunted forest, spooky atmosphere, 3 puzzles"
4. AI generates level with theme applied
5. Auto-playtest runs → shows difficulty score (7.2/10), estimated time (4 min)
6. User clicks "Make harder" or "Add a checkpoint"
7. AI refines → re-runs playtest analysis
8. User exports directly to Godot (.tscn) or Unity (.prefab)
9. Opens Godot → level is a ready scene
```

### V2.5 Flow (Metroidvania)

```
1. User selects "Metroidvania" mode
2. Selects abilities for the game: Double Jump, Wall Jump, Dash, Grapple
3. Types prompt: "A Metroidvania with 3 ability gates, 2 keys, and a final boss"
4. AI generates:
   - Multiple branching paths
   - Soft gates tied to abilities (locked until player has ability)
   - Hard gates tied to items (collect key to open door)
   - Backtrack routes (areas accessible only after getting new ability)
5. User reviews ability graph visualization
6. AI validates gating logic (no impossible locks)
7. User refines: "Add a shortcut after getting dash"
8. Auto-playtest analyzes ability unlock sequence
9. Exports to Godot with proper ability/gate nodes
```

---

## 8. Monetization Strategy

### Revenue Projections (Conservative)

| Month | Users | Conversion | Revenue |
|-------|-------|------------|---------|
| 1 (Launch) | 500 | 2% | $200 |
| 3 | 2,000 | 3% | $1,200 |
| 6 | 5,000 | 4% | $4,000 |
| 12 | 15,000 | 5% | $15,000 |

*Assumes $19.99 one-time price, 30% Itch.io fee*

### Pricing Tiers

**Free Tier ($0)**
- Linear levels only
- JSON/ASCII export
- Basic preview

**Pro Tier ($19.99)**
- Full V2 features
- Engine exports
- Auto-playtest
- Parameter sliders

**Metroidvania Add-on ($9.99)**
- OR included in $4.99/mo subscription

**Subscription ($4.99/mo)**
- All features
- Early access to new features
- Priority support

### Pricing Psychology

- **$19.99** feels like "serious tool" vs. $9.99 "hobby toy"
- Include early-bird discount ($14.99) for first 500 buyers
- Bundle with tutorial videos ($24.99) for impulse upsell

### Secondary Revenue

- **Patreon ($5/mo):** Early access to V3 features, Discord community
- **Custom commissions:** Level design services for studios (high-ticket, rare)

---

## 9. Development Roadmap

### Phase 1: V1 - MVP (Weeks 1-4)
- [ ] Basic prompt input UI
- [ ] LLM integration for level generation
- [ ] JSON output schema (linear only)
- [ ] ASCII visualizer
- [ ] HTML5 preview player
- [ ] Basic iteration (1-2 refinements)
- [ ] Itch.io release (free)

**Time Investment:** ~40 hours
**Deliverable:** Working free tool

### Phase 2: V2 - Production (Weeks 5-12)
- [ ] Multi-genre support
- [ ] Godot .tscn exporter
- [ ] Unity prefab exporter
- [ ] Visual editor (canvas-based)
- [ ] Auto-playtest analysis
- [ ] Bottleneck detection
- [ ] Parameter sliders
- [ ] Paid release ($19.99)
- [ ] Tileset analyzer (upload tileset → auto-generate tilemap rules)

**Time Investment:** ~120 hours
**Deliverable:** Sellable product

### Phase 2.5: Metroidvania (Weeks 13-18)
- [ ] Multiple goals system
- [ ] Soft gating (ability-based)
- [ ] Hard gating (item/story-based)
- [ ] Multi-path branching logic
- [ ] Ability graph visualization
- [ ] Gating validation (no impossible locks)
- [ ] Backtrack route detection

**Time Investment:** ~80 hours
**Deliverable:** Complete metroidvania support

### Phase 3: V3 - Growth (Weeks 19-24)
- [ ] Unreal export
- [ ] Community features (share levels)
- [ ] Subscription model test
- [ ] Video tutorial course
- [ ] Patreon launch

**Time Investment:** ~200 hours
**Deliverable:** Sustainable business

---

## 10. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AI produces invalid levels | Medium | Medium | Schema validation, fallback to templates |
| AI produces impossible gating | Medium | High | Gating validator, ability graph analysis |
| API costs too high | High | High | Ollama offline mode, token budgeting |
| Low conversion | Medium | High | Free V1 builds audience, email capture |
| Platform engine changes break export | Medium | Medium | Version-specific exporters, tests |
| Competition emerges | Low | Medium | First-mover advantage, community lock-in |

### Cost Controls

- **Monthly API budget:** $100/month cap
- **Ollama fallback** when API limit hit
- **Token optimization:** Use structured schemas, not freeform

---

## 11. Success Metrics

| Metric | V1 Goal | V2.5 Goal | V3 Goal |
|--------|---------|------------|---------|
| Downloads (Itch.io) | 1,000 | 10,000 | 20,000 |
| GitHub Stars | 200 | 1,000 | 2,000 |
| Email List | 100 | 1,000 | 2,000 |
| Paid Sales | - | 300/month | 500/month |
| Revenue | $0 | $3,000/month | $5,000/month |

---

## 12. Next Steps

1. **Week 1:** Build V1 prototype (prompt → JSON → ASCII)
2. **Week 2:** Add HTML5 preview player
3. **Week 3:** Test with 5-10 indie devs, gather feedback
4. **Week 4:** Launch V1 free on Itch.io + GitHub
5. **Week 5:** Begin V2 development with email list warm-up
6. **Week 8:** Pre-launch V2 waitlist
7. **Week 12:** V2 launch
8. **Week 13:** Start metroidvania features
9. **Week 18:** V2.5 launch
10. **Week 19:** Begin V3 features

---

## Appendix A: Level JSON Schema (V1 - Linear)

```json
{
  "version": "1.0",
  "genre": "platformer",
  "type": "linear",
  "theme": "default",
  "difficulty": "medium",
  "platforms": [
    { "x": 0, "y": 480, "width": 500, "height": 30 },
    { "x": 50, "y": 400, "width": 120, "height": 15 }
  ],
  "entities": [
    { "type": "player_spawn", "x": 50, "y": 450 },
    { "type": "goal", "x": 450, "y": 80 },
    { "type": "enemy", "x": 200, "y": 380, "patrol": [150, 250] },
    { "type": "coin", "x": 100, "y": 350 }
  ],
  "metadata": {
    "estimated_duration_seconds": 120,
    "difficulty_score": 5.5
  }
}
```

---

## Appendix B: Level JSON Schema (V2.5 - Metroidvania)

```json
{
  "version": "2.5",
  "genre": "platformer",
  "type": "metroidvania",
  "theme": "ancient ruins",
  "difficulty": "medium",
  "abilities": ["double_jump", "wall_jump", "dash", "grapple"],
  
  "goals": [
    { "id": "exit_main", "type": "exit", "x": 800, "y": 100 },
    { "id": "key_red", "type": "collectible", "x": 200, "y": 300, "item_id": "key_red" },
    { "id": "key_blue", "type": "collectible", "x": 600, "y": 400, "item_id": "key_blue" },
    { "id": "boss_tutorial", "type": "enemy", "x": 400, "y": 200, "enemy_type": "boss_mini" }
  ],
  
  "gates": [
    {
      "id": "gate_dash",
      "type": "soft",
      "requires_ability": "dash",
      "position": { "x": 500, "y": 250 },
      "blocks_path": "upper_route"
    },
    {
      "id": "door_red",
      "type": "hard",
      "requires_item": "key_red",
      "position": { "x": 700, "y": 150 },
      "leads_to": "exit_main"
    },
    {
      "id": "gate_grapple",
      "type": "soft",
      "requires_ability": "grapple",
      "position": { "x": 300, "y": 100 },
      "blocks_path": "treasure_path"
    }
  ],
  
  "regions": [
    {
      "id": "starting_area",
      "bounds": { "x": 0, "y": 400, "width": 250, "height": 150 },
      "accessible_abilities": [],
      "required_for_completion": ["key_red"]
    },
    {
      "id": "upper_platforms",
      "bounds": { "x": 250, "y": 150, "width": 300, "height": 200 },
      "accessible_abilities": ["dash", "double_jump"],
      "required_for_completion": []
    }
  ],
  
  "backtrack_opportunities": [
    {
      "after_ability": "dash",
      "newly_accessible": ["upper_platforms", "key_blue"],
      "shortcut_to": "starting_area"
    }
  ],
  
  "platforms": [
    { "x": 0, "y": 480, "width": 500, "height": 30 },
    { "x": 50, "y": 400, "width": 150, "height": 15 }
  ],
  
  "entities": [
    { "type": "player_spawn", "x": 50, "y": 450 },
    { "type": "ability_pickup", "x": 150, "y": 380, "ability": "double_jump" }
  ],
  
  "ability_unlock_sequence": [
    "double_jump",
    "dash", 
    "grapple"
  ],
  
  "metadata": {
    "estimated_duration_seconds": 480,
    "difficulty_score": 6.5,
    "gating_valid": true,
    "no_impossible_locks": true
  }
}
```

---

## Appendix C: Gating Logic Validation Rules

### Soft Gating Rules
1. Player must have ability BEFORE encountering gate
2. Ability must be obtainable BEFORE the gate in progression
3. No soft-gated areas should be required for main progression

### Hard Gating Rules
1. Key/item must be obtainable BEFORE the locked door
2. Key placement must not require the ability the door unlocks
3. No circular dependencies (A→B→A locks)

### Progression Validation
1. Player can always reach at least one goal from spawn
2. All gates can be unlocked through normal play
3. No dead ends (areas with no return and no objective)

---

*Document Version: 2.0*  
*Created: 2026-02-21*  
*Author: LevelForge AI Design*  
*Changelog: Added V2.5 Metroidvania features, expanded schema*
