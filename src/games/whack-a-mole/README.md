# Whack-a-mole: The Bonking Bureau

A 30-second shift dealing with smug, unionised moles. Start from the instructions
with a click, tap or Space. Click/tap a hole or use the matching keyboard key:

```text
Q W E
A S D
Z X C
```

Bonk ordinary brown moles. Spare the **blue-hatted safety inspectors**, also
marked with a **NO BONK** sign. Hole targets include the head and opening, so
precise face aiming is unnecessary. Each press is a swing; holding a key does
not repeat it. Swings have a 140 ms recovery, so indiscriminate mashing hurts.

Targets start out visible for 900 ms; by the end they last only 420 ms. New
arrivals accelerate from every 520 ms to every 240 ms, with up to four visible
at once. About 22% of arrivals are inspectors. Escaping moles break your streak;
letting inspectors leave is safe. Fast fingers and selective bonking are essential.

## Scoring

- Each mole earns 10 points, plus 2 per preceding hit in the current streak
  (streak bonus capped at 20).
- Hit within 200 ms of appearance for another 5 points.
- An empty-hole swing costs 5 points; an inspector costs 25. Either breaks the streak.
- Scores never fall below zero. Escapes break the streak without deducting points.
- At 30 seconds the final score is recorded once through the shared carnival
  scores module. The results show hits, escapes, mistakes and best streak.
- Click/tap or press Space on the results to start a fresh shift.

The game pauses its effective clock when the browser stops animating in a
background tab, rather than charging the player for unseen targets.

## Files

- `game.ts`: browser-free state, event timing, scoring and hit areas; the game's
  `start` method owns all canvas drawing, input listeners and animation cleanup.
- `game.test.ts`: scoring, penalties, timing, spawning, frame-rate consistency,
  hit areas and once-only round completion tests.
