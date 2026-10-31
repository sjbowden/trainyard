/**
 * Where each piece of art sits in the original's atlas (assets/FullAtlasHD.png in the APK), mapped by
 * hand because the atlas's own index (FullAtlasHD.atl, FullAtlas.m) doesn't match the image. Only these
 * numbers are kept in the repo; the art itself stays on the phone.
 *
 * The art is grayscale: stations' train icons, trains and painters are tinted per color when drawn.
 * Board tiles are 96 px with their grid line baked in. Track tiles come in six base forms, turned and
 * mirrored to fit any cell. Not in the atlas, so built when drawing: the empty floor (from the empty
 * quarter of the curve tile), two curves that don't share a side, goals entered from opposite sides
 * (from per-side quarters of the open and closed goal tiles), and the splitter's three-way track
 * (from the cross). The colorblind letters on icons and trains are left out.
 */
export interface Frame { x: number; y: number; w: number; h: number }

export const ATLAS_SIZE = 2048;
export const TILE = 96;

const tile = (x: number, y: number): Frame => ({ x, y, w: TILE, h: TILE });
const square = (x: number, y: number, s: number): Frame => ({ x, y, w: s, h: s });

export const FRAMES = {
  /** The curve tile's top-right quarter, which has no rail: four mirrored copies make the floor. */
  floorQuarter: { x: 598 + TILE / 2, y: 1896, w: TILE / 2, h: TILE / 2 },
  /** TopBottom. */
  straight: tile(598, 1704),
  /** BottomLeft. */
  curve: tile(598, 1896),
  /** TopBottom and LeftRight. */
  cross: tile(1386, 1560),
  /** BottomLeft bright, BottomRight dim: a switch between two curves. */
  switchCurves: tile(1482, 1464),
  /** BottomLeft bright, TopBottom dim. */
  curveStraight: tile(882, 1780),
  /** TopBottom bright, BottomLeft dim. */
  straightCurve: tile(598, 1800),
  rock: tile(882, 1684),
  /** An outlet's floor, leaving by the bottom. */
  outlet: tile(1086, 1880),
  /** A goal's floor open on all four sides; each side's quarter is used where the goal takes trains. */
  goalOpen: tile(1250, 1464),
  /** A goal's floor open at the bottom only; its top quarter is a closed side. */
  goalClosed: tile(1250, 1752),
  outletBox: square(381, 1849, 78),
  goalBox: square(1491, 1569, 78),
  goalDone: square(1587, 1473, 78),
  /** Train icons in a station, for grids of 1, 2×2, 3×3 and 4×4: plus signs in outlets, rings in goals. */
  outletNub1: square(696, 1898, 52),
  outletNub4: square(566, 1650, 24),
  outletNub9: square(470, 1746, 16),
  outletNub16: square(1880, 1274, 12),
  goalNub1: square(884, 1974, 52),
  goalNub4: square(980, 1878, 24),
  goalNub9: square(600, 1994, 16),
  goalNub16: square(792, 1802, 12),
  train: { x: 1580, y: 1562, w: 34, h: 60 },
  /** The painter's paint box, tinted with its color. */
  painter: square(796, 1362, 68),
  /** The splitter's scissors box, handles at the bottom. */
  splitter: square(704, 1810, 78),
} satisfies Record<string, Frame>;

export type FrameName = keyof typeof FRAMES;
