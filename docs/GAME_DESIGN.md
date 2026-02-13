# Banger - Game Design Document

## Concept

A 2D top-down asymmetric shooter set in a solarpunk world. Two guardians of serenity defend their harmony against an unstoppable force of nature. The guardians must cooperate to survive; the force must overwhelm them both.

**Players**: 1v2 asymmetric
**Win Condition**: Elimination - last side standing

---

## Theme

A lush, overgrown world where nature and civilization exist in fragile balance. **Faran** and **Baran** are guardians sworn to protect that balance. **Paran** is a raw elemental force - not evil, but relentless and indifferent. When nature surges, the guardians must hold the line.

---

## Characters

### Faran & Baran (Guardians of Serenity)

Agile protectors. Quick to react, responsive to control. They rely on coordination and sustained pressure to wear Paran down.

- Low health, high agility
- Fast acceleration - snappy starts and stops
- Rapid but weak attacks

### Paran (Force of Nature)

A precision predator. Builds terrifying speed and can redirect instantly, threading through tight gaps and lining up devastating strikes. But any collision kills momentum - a Paran that clips a wall or gets body-blocked loses all built-up speed and becomes vulnerable.

- High health, high top speed
- Slow to build speed, instant turning
- Powerful but infrequent attacks
- **Collision penalty** - loses speed on any collision

---

## Core Mechanics

**Movement**: Acceleration-based physics with friction. Facing follows movement direction.

**Combat**: Players fire projectiles in their facing direction. Damage is flat per hit. Characters die at zero health.

**Arena**: A single bounded arena. Players collide with the edges.

**Collision Penalty (Paran)**: When Paran hits a wall or obstacle, speed drops to zero. This is the central risk/reward mechanic - Paran must navigate precisely at high speed or pay the price.

---

## The Core Dynamic

Paran is fast and agile but fragile in a different way - not in health, but in momentum. The guardians are nimble but can't take many hits.

- **Guardians win** by splitting apart, forcing Paran into tight angles near walls, and punishing the moments after a collision
- **Paran wins** through mastery of speed and precision - weaving through the arena without touching anything, lining up shots while at full velocity

The skill expression for Paran is navigation under pressure. The skill expression for guardians is positioning and teamwork.

---

## Match Flow

1. Players join and select characters
2. Countdown
3. Combat until one side is eliminated
4. Victory screen, return to lobby

---

## Balance Levers

| Lever | What it controls |
|---|---|
| Paran's acceleration curve | How long it takes to become dangerous again after a collision |
| Paran's attack cooldown | How much each miss costs |
| Guardian health | How many mistakes guardians can survive |
| Projectile speed | How dodgeable attacks are |
| Projectile damage | Time-to-kill for both sides |
| Arena obstacles | How many collision threats Paran must navigate |
