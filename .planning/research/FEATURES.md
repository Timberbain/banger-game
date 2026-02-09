# Feature Landscape

**Domain:** Browser-based multiplayer arena games
**Researched:** 2026-02-09
**Confidence:** LOW (based on training data only, web search unavailable)

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Instant play (no download) | Core value prop of browser games | Low | Users expect to play within seconds of visiting URL |
| Responsive controls | Players judge game quality immediately | Medium | Acceleration-based movement requires tight input handling |
| Low-latency netcode | Competitive games unplayable with lag | High | Critical for projectile combat with collision penalties |
| Match/lobby system | Players need way to find games | Medium | Room codes already planned, supports private matches |
| Basic HUD (health, ammo, score) | Players need game state visibility | Low | Essential for decision-making in combat |
| Match end screen with stats | Players expect closure and feedback | Low | Shows winner, kills, deaths, accuracy, etc. |
| Reconnection handling | Browser tabs get refreshed/closed | Medium | Graceful disconnect handling prevents frustration |
| Mobile-responsive UI | Many users play on phones/tablets | Medium | Controls and UI must work on touch |
| Username/identity system | Players want recognition | Low | Light accounts already planned |
| Tutorial/controls screen | Players need to learn mechanics | Low | Especially for acceleration-based movement |
| Audio feedback | Expected for actions and events | Medium | Shooting, hits, deaths, match events |
| Visual feedback on hits | Players need immediate damage confirmation | Low | Hit markers, damage numbers, or visual effects |
| Spectator mode | Dead players/observers need something to do | Low | Common in asymmetric games |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Asymmetric 1v2 gameplay | Unique team structure vs typical 1v1 or symmetric teams | High | Core differentiator, requires careful balance |
| Acceleration-based movement | Higher skill ceiling than click-to-move | Medium | Creates skill differentiation, learning curve |
| Multiple hand-crafted maps | Variety and strategic depth | Medium | vs procedural or single arena |
| Character-specific abilities | Role differentiation (Faran/Baran/Paran) | High | Makes asymmetry more than just numbers |
| Collision-based gameplay | Physical interaction beyond shooting | Medium | Adds tactical dimension (body blocking, bumping) |
| Matchmaking system | Quality matches vs random rooms | High | Most .io games lack true skill-based matching |
| Stat tracking & progression | Long-term engagement | Medium | Light accounts support this |
| Ranked/competitive mode | Aspirational goal for skilled players | High | Requires matchmaking + rating system |
| Replay system | Learning tool and shareable content | High | Post-match replay of interesting games |
| Custom game modes | Community engagement | Medium | 2v2, FFA, time trials, etc. |
| Map editor | User-generated content | Very High | Massive scope increase |
| Cosmetic customization | Self-expression and monetization | Medium | Skins, trails, emotes for characters |
| Friend system & parties | Social play with known players | Medium | Queue together, track friends |
| Leaderboards | Competitive motivation | Low | Daily/weekly/all-time rankings |
| Seasonal content | Retention through fresh content | Medium | New maps, modes, cosmetics per season |
| In-game chat | Coordination (guardians) and social | Low | Text or quick chat wheel |
| Tournament/event system | Community building | High | Organized competitive play |
| Observer mode with camera control | Esports/streaming friendly | Medium | Beyond basic spectator |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Pay-to-win mechanics | Destroys competitive integrity | Cosmetic-only monetization |
| Loot boxes/gacha | Regulatory risk, negative perception | Direct purchase or battle pass |
| Voice chat | Toxicity management burden | Text chat or quick chat wheel |
| Auto-matchmaking only | Removes social/casual play | Keep room codes alongside matchmaking |
| Single map at launch | Becomes stale quickly | Ship with 3-5 maps minimum |
| Complex account system | Friction for browser game | Keep accounts light/optional |
| Mobile app version | Development/maintenance overhead | Focus on responsive web |
| Persistent world/MMO elements | Scope creep, session-based works better | Match-based gameplay |
| Procedural map generation | Quality control issues for competitive | Hand-crafted balanced maps |
| AI bots for asymmetric roles | Very hard to balance, feels artificial | Human-only matches, maybe bots for tutorial |
| Cross-game currency | Complexity with no benefit | Single-game economy |
| NFT/blockchain integration | Negative community reaction | Traditional systems |
| Single-player campaign | Wrong scope for arena game | Tutorial/practice mode only |
| Destructible environments | Complexity for competitive balance | Static map elements |

## Feature Dependencies

```
Account System → Stat Tracking
Account System → Leaderboards
Account System → Friend System
Account System → Ranked Mode

Match System → Spectator Mode
Match System → Replay System

Matchmaking → Ranked Mode
Stat Tracking → Matchmaking (skill rating)

Character Abilities → Balance System (ongoing)
Multiple Maps → Map Selection UI

Cosmetics → Account System (to save)
Cosmetics → Shop/Monetization

Friend System → Party Queueing
```

## MVP Recommendation

### Phase 1: Core Loop (Must ship together)
1. **Instant play** - Browser game requirement
2. **Responsive controls** - Core experience
3. **Basic netcode** - Multiplayer foundation
4. **Room codes** - Way to play together
5. **Basic HUD** - Game state visibility
6. **Match end screen** - Session closure
7. **Username system** - Player identity
8. **Tutorial/controls** - Onboarding
9. **Audio/visual feedback** - Polish for feel
10. **Spectator mode** - Dead player experience

### Phase 2: Polish & Retention
1. **Stat tracking** - Long-term engagement
2. **Leaderboards** - Competitive motivation
3. **Multiple maps (3-5)** - Variety to prevent staleness
4. **Reconnection handling** - Quality of life
5. **Mobile responsive** - Audience expansion

### Phase 3: Competitive Depth
1. **Matchmaking system** - Quality matches
2. **Ranked mode** - Aspirational play
3. **Character abilities** - Depth beyond asymmetric numbers

### Defer to Post-Launch
- **Cosmetics** - Defer until core loop proven
- **Friend system** - Room codes sufficient initially
- **Seasonal content** - Needs active playerbase first
- **Tournament system** - Needs competitive scene
- **Replay system** - High complexity, low initial value
- **Custom game modes** - Core mode must be solid first

## Feature Sizing

| Feature | Estimated Complexity | Reasoning |
|---------|---------------------|-----------|
| Low-latency netcode | 3-4 weeks | Client prediction, server reconciliation, lag compensation |
| Matchmaking | 2-3 weeks | Queue system, skill rating, party support |
| Character abilities | 2-4 weeks per character | Design, implementation, balance iteration |
| Ranked mode | 1-2 weeks | Rating system, matchmaking integration, UI |
| Replay system | 3-4 weeks | Recording, playback, storage, UI |
| Map editor | 6-8+ weeks | Tool creation, validation, sharing system |
| Mobile responsive | 2-3 weeks | Touch controls, UI adaptation, testing |

## Critical Path Features

These features must be excellent or the game fails:

1. **Low-latency netcode** - Competitive shooter unplayable with lag
2. **Responsive controls** - Acceleration-based movement must feel good
3. **Asymmetric balance** - 1v2 must feel fair to both sides
4. **Multiple maps** - Single arena gets stale too quickly

## Notes on Browser Game Market (2025)

**Confidence: LOW** - Cannot verify with current sources

Based on training data:
- .io games (agar.io, slither.io, krunker.io) established instant-play expectations
- Successful browser shooters (krunker.io, shell shockers) prioritized netcode quality
- Most lack matchmaking beyond random room joining (opportunity)
- Mobile traffic significant for .io games (50%+)
- Discord integration common for community building
- Cosmetics proven monetization for free browser games

**Verification needed:**
- Current state of browser game market in 2026
- Recent successful launches and their feature sets
- WebGL/WebGPU adoption rates
- WebRTC vs WebSocket for netcode (current best practices)

## Sources

**WARNING: This research is based entirely on training data (knowledge cutoff January 2025) due to web search being unavailable. All findings should be considered LOW confidence and require verification with:**
- Current successful browser arena games (krunker.io, etc.)
- Recent game design post-mortems
- Browser game developer communities
- WebSocket/WebRTC performance comparisons for real-time games

**Recommended verification:**
1. Check what features top 10 .io games have in 2026
2. Review recent browser shooter launches
3. Validate technical assumptions about netcode
4. Confirm mobile usage statistics for browser games
