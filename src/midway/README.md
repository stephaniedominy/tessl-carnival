# The midway

The walkable map every booth stands on. See `AGENTS.md` for how the files fit
together.

## Time of day

The sky and the lights follow the visitor's own clock, read from the browser
every frame, so the midway catches up straight away after a background tab.
The times are fixed local clock times, not sunrise and sunset where the
visitor lives: the midway asks for no location and calls no weather service.

| Local time     | What you see                                                    |
| -------------- | --------------------------------------------------------------- |
| 06:00 to 08:00 | Dawn: the sky warms and brightens, the lights go off by 07:30   |
| 08:00 to 17:00 | Day: blue sky, the bulbs hang unlit                             |
| 17:00 to 20:00 | Dusk: a warm sunset into deep blue, the lights come on by 19:00 |
| 20:00 to 06:00 | Night: dark scene, every light on                               |

At dusk and night one shade darkens the whole scene together, and pools of
warm light keep the booth signs and the player easy to see. Bulbs hang round
the hedge and round every booth (coming-soon booths too), tent, the big top
and the ticket booth. They come on one by one and twinkle out of step; with
`prefers-reduced-motion: reduce` they hold steady.

The schedule and the light placement are plain functions in `lighting.ts`,
tested in `lighting.test.ts`. Colours live in `palette.ts`.

## Previewing a time

Add `midwayTime=H:MM` or `midwayTime=HH:MM` (24-hour) to the query string to see the midway at that
time, for example <http://localhost:5173/?midwayTime=19:30>. A missing or
invalid time, such as `24:00` or `7pm`, uses the real clock. The preview holds
that time still; it doesn't run on from it.
