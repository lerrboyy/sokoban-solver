# Sokoban Solver

[![make.fun · sokoban-solver-01-run-20261121](https://make.fun/badge/sokoban-solver-01-run-20261121.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![rank](https://make.fun/badge/sokoban-solver-01-run-20261121/lerrboyy/sokoban-solver/rank.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![reward](https://make.fun/badge/sokoban-solver-01-run-20261121/lerrboyy/sokoban-solver/reward.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)

A push-optimal Sokoban solver, built for the make.fun bounty
[Build the best Sokoban solver, 21 November 2026](https://make.fun/bounty/sokoban-solver-01-run-20261121).

The program reads a set of five Sokoban levels and writes one move string per
level. A level is solved only when every box ends on a goal, and it earns full
points only when the solution uses the push-optimal number of pushes. On the
bounty's practice set this solver hits the optimum on all five instances:
13, 16, 29, 47 and 60 pushes.

## How it works

Every generated level has the same shape: a one-square-wide hallway runs
across the board with the player starting in it, and one to four rooms hang
off the hallway, each opening onto it through a single door. A box pushed
through a door into the hallway can never be pushed back, so every room must
be solved in place, inside its own walls — and the push-optimal count for a
whole level is the sum of its rooms' push-optimal counts. The solver exploits
exactly that:

1. **Split.** The hallway row is the row with the player start. Each door is
   a floor square above or below a hallway square; each room is the connected
   region flood-filled from its door without stepping onto the hallway row.
   Rooms are visited left to right by door column.
2. **Solve each room push-optimally.** Each room gets its own A* search over
   pushes (not single steps): a state is the player's reachable region plus
   the set of box squares, a move is one push, and the cost of a push is one.
   The heuristic is the cheapest assignment of boxes to goals by box-only
   shortest-path distances, which never overestimates, so the first goal
   state removed from the queue is push-optimal. States are pruned when a box
   is provably stuck: corner deadlock, wall-run deadlock (only when the run
   holds no goal and is closed at both ends), a frozen two-by-two block, or a
   box from which no goal is reachable at all. The search starts with the
   player on the hallway square in front of the door — a box may start on the
   door square itself, and only from the hallway can it be pushed up into the
   room. The open queue is a binary heap with deterministic tie-breaking, and
   search budgets are counted in state expansions, never in wall-clock time.
3. **Stitch.** The room solutions are joined with plain walks along the
   hallway. Each push is expanded into the walking moves that put the player
   behind the box plus the pushing step, the player walks back out to the door
   and steps onto the hallway, and the next room is solved. The full move
   string is replayed internally before it is written out; a replay failure
   falls back to an empty solution for that instance rather than an illegal
   one.

The program is one file, `main.ts`, written in erasable TypeScript with only
the Node standard library. It is fully deterministic: no wall clock, no
randomness, no environment-dependent variation — two runs on the same set
write byte-identical outputs. It finishes the five-instance practice set in
about 15 seconds, well inside the 60-second budget.

## Running it

Requires Node 22 or newer (TypeScript types are stripped natively; no build
step, no dependencies).

```sh
# Against the practice set from the bounty kit (adjust the paths to your kit):
MAKEFUN_INPUT_DIR=/path/to/kit/practice/input \
MAKEFUN_OUTPUT_DIR=/tmp/sokoban-out \
node main.ts
```

This reads `<input>/<id>/level.txt` for each instance and writes
`<output>/<id>/solution.txt` (the player's moves as `u`, `d`, `l`, `r`, one
letter per step), creating the output directories itself. In the grading
sandbox it runs as `node /bot/main.ts` with the default `/input` and
`/output` directories.

## Files

- `main.ts` — the whole solver.
- `README.md` — this file.
- `LICENSE` — MIT licence.

## License

MIT. See [LICENSE](LICENSE).
