// Recortes de fruta sobre public/games/snake/fruits.png: la fila pixel-art (y = 136–295) de
// references/started-games/05-snake-assets/fruits.png. Coordenadas de su sprites.js, en el mismo
// orden; sin nombres porque los del atlas original están desplazados una posición.

export type Frame = { sx: number; sy: number; sw: number; sh: number };

export const FRUIT_URL = "/games/snake/fruits.png";

const ROW: ReadonlyArray<readonly [sx: number, sw: number]> = [
  [34, 110],
  [186, 150],
  [378, 110],
  [540, 130],
  [712, 130],
  [894, 110],
  [1066, 110],
  [1228, 130],
  [1400, 130],
  [1582, 110],
  [1734, 150],
  [1906, 150],
  [2068, 170],
  [2250, 140],
  [2432, 130],
  [2604, 130],
  [2786, 110],
  [2948, 130],
  [3110, 150],
  [3302, 110],
  [3454, 150],
  [3637, 130],
];

export const FRUIT_FRAMES: readonly Frame[] = ROW.map(([sx, sw]) => ({ sx, sy: 0, sw, sh: 160 }));
