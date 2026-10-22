# Candy Floss

Spin candy floss onto a stick to match each customer's order.

## How to play

- The game opens on a controls screen. Press Space, or click or tap **Start**, to begin.
- Each round has five orders. Each order shows a target size, drawn as a dashed ring around
  the stick and as a line on the size meter on the right.
- Hold Space, or press and hold the **Hold to spin** button with the mouse or a finger, to grow
  the floss. Let go to serve it.
- The floss grows by 40 size units a second, up to a cap of 100. If you hold it until it reaches
  100 it collapses and is served for 0 points, so the round always moves on.
- After each order you see your points and a note: Perfect!, Lovely!, Too small, Too big or
  It collapsed!. The next order starts on an empty stick a moment later.
- Each order is served once. Holding Space doesn't repeat the press, and presses or releases
  while an order is being served are ignored.
- After the fifth order you see every order's target, size and points, and the round total.
  Press Space or **Play again** to start a new round.

## Scoring

Targets are whole numbers from 25 to 85. Your size is rounded to a whole number when you serve.
Each order scores 100 points for an exact match, and 2.5 fewer points for every size unit you are
off, rounded to the nearest point and never below 0:

| Off by   | Points |
| -------- | ------ |
| 0        | 100    |
| 4        | 90     |
| 10       | 75     |
| 20       | 50     |
| 40+      | 0      |
| Collapse | 0      |

A round is five orders, so the best total is 500. Your total is saved to the carnival's score
board once, when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `restart`, `press`, `release`, `serve`, `step`,
  `scoreForOrder`, `claimFinalScore`) and the `candyFloss` entry the midway registers.
- `game.test.ts`: tests for the game logic.
