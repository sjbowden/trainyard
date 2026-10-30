# Trainyard rules and code format

These are the rules as implemented in `src/engine/`. They match the original game's rules, except for leaving the board (below). They were worked out from the original's solution viewer and are confirmed by replaying 1,667 real player solutions covering all 233 original puzzles (`tests/accuracy.test.ts`).

## Codes

Alphabet (character → value): `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_`

| Enum | Values |
|------|--------|
| Side | top 0, right 1, bottom 2, left 3 |
| Color | red 0, yellow 1, blue 2, orange 3, green 4, purple 5, brown 6 |
| Segment | Empty 0, TopRight 1, TopLeft 2, BottomLeft 3, BottomRight 4, TopBottom 5, LeftRight 6 |

A code is `width height puzzle[_solution]`. Each part covers cells row by row from the top-left:

- **Run digits:** `1`–`9` skip that many cells, and `0` skips ten. A run of ten is always written `0`. A trailing run is not written, so a part may end early, and the remaining cells are empty.
- **Puzzle tokens:**
  - `R`: rock.
  - `S`+side: a splitter entered from that side. It exits on the next side clockwise first, then the next anticlockwise.
  - `P`+color+(a·7+b): a painter joining sides a and b.
  - `O`+(side·9+n−1)+colors: an outlet sending n trains, in order, out of that side.
  - `G`+mask+(n−1)+colors: a goal entered from the sides in the mask (top 1, right 2, bottom 4, left 8) and needing n trains.
- **Colors** are packed two per character as first·7+second. With an odd count, the last character's second color is ignored.
- **Solution tokens:** one character per track cell, primary·7+secondary.

Example: Red Line `hh002Oja3Giaa00` has a red outlet at column 1, row 3, sending one train right, and a goal at column 5, row 3, entered from the left, needing red.

## Colors

Two trains of the same color stay that color. Red+yellow = orange, yellow+blue = green, red+blue = purple. Any other pair is brown. A splitter turns orange into yellow and red, green into blue and yellow, and purple into blue and red, in that order. Any other color splits into two of itself.

## A run

Time moves in half-steps that alternate between *center* and *edge*. It starts with a center half-step. A *step* is one edge half-step.

**Center half-step**

1. Each train acts on the piece it is in:
   - A painter repaints it.
   - A splitter absorbs it and queues two new trains: the first leaves on the side clockwise from the entry, the second on the side anticlockwise.
   - A goal takes it if the goal still needs that color, crossing off one instance. Otherwise the train is destroyed and the run has **crashed**.
2. Two trains in the same piece on the same segment, or crossing on a `+`, both become the mix of their colors.
3. In cell order, each outlet with trains left sends its next one, and each splitter releases its queued pair.
4. If every goal has received everything it needs, the run is over. It is **won** if nothing has crashed. Trains still in outlets or on the track don't matter.

**Edge half-step**

1. For each pair of trains, in creation order:
   - In the same piece and leaving by the same side: they merge into one train of the mixed color.
   - Swapping cells head-on: both become the mixed color.
   After the pairs for a train are checked, if that train is on a switch, the switch flips. A switch is a track cell whose two segments share a side. It flips once per train on the cell, so two trains together leave it as it was.
2. Each train moves to the neighboring cell and enters it by the facing side:
   - Track: it follows the primary segment if that segment uses the entry side, otherwise the secondary. If neither does, it crashes. (A cell may hold its only segment as the secondary. It carries trains normally and never switches.)
   - Painter: it must enter by one of the painter's two sides.
   - Goal: it must enter by one of the goal's sides.
   - Splitter: it must enter by its entry side.
   - Rock, outlet, empty cell, or off the board: it crashes.

A run with no trains left, nothing waiting to leave an outlet or splitter, and unfinished goals has **stalled**. A run is *ended* once it is won, stalled, or crashed and finished moving. `simulate` reports **timeout** if it hits its half-step limit first.

## Counts

- **Track count** `major+minor`: major is the number of track cells, and minor the number of track cells with a non-empty secondary segment. A cell whose only segment is stored as its secondary counts in both. trainyard.ca stores it as major·1000+minor.
- **Steps:** the number of edge half-steps before the winning center half-step.

## Where we differ from the original viewer

The viewer has no edge check. A train leaving the left or right edge reappears on the adjacent row, and one leaving the top or bottom edge is fed back into its own cell. Both are viewer bugs. Here leaving the board always crashes.
