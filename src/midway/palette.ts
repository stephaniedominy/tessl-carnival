import { theme } from '../carnival';

const { colors } = theme;

/**
 * The midway map's daytime palette. Tent reds, creams and golds come from the
 * carnival theme; the sky, grass, paths and other scenery shades only the map
 * uses live here.
 */
export const palette = {
  sky: '#b8d5d0',
  skyHigh: '#8bb2bd',
  cloud: '#f9f2df',
  cloudShade: '#dce7dd',
  haze: '#c6d1ae',
  mountainFar: '#a6bec0',
  mountainMiddle: '#91adaa',
  mountainNear: '#809d96',

  grass: '#b1be91',
  grassDark: '#96a87f',
  grassEdge: '#92a17b',
  grassLight: '#c0c99c',
  path: '#e8d8b1',
  pathShade: '#d4c39c',
  flowerPetal: '#f8eed7',
  flowerRose: '#d6a29a',
  flowerCentre: '#c6aa70',
  hedge: '#819b76',
  hedgeDark: '#668368',
  hedgeLight: '#a1b68a',
  shrub: '#7b9874',
  shrubShade: '#607f65',
  shrubLight: '#a7b98a',
  shadow: 'rgba(65, 78, 61, 0.16)',

  red: colors.stripeA,
  redShade: '#9d6b63',
  cream: colors.stripeB,
  creamShade: '#ded2b9',
  gold: colors.accent,
  goldShade: '#c4a36d',
  blue: '#789eac',
  blueShade: '#5c8292',
  sky2: colors.water,
  pink: '#d8a6ab',
  pinkShade: '#ba8a93',
  wood: colors.wood,
  woodDark: '#755c4a',
  woodLight: '#b99a73',
  board: '#c9ae84',
  metal: '#ede9da',
  metalShade: '#b0b6ac',
  ink: colors.background,
  opening: '#4c4840',
  closed: '#a3b3ae',
  closedShade: '#869b95',
  white: '#fff9eb',

  skins: ['#f1c27d', '#c68642', '#8d5524', '#e0ac69', '#ffdbac'],
  hairs: ['#514036', '#384640', '#986d4e', '#d5bb7b', '#755c4a'],
  shirts: [colors.water, '#9eBA95', '#b5a3bd', colors.danger, '#789eac', colors.stripeB],
  pants: ['#566b72', '#685b70', '#766752'],
  bunting: [colors.stripeA, colors.accent, '#789eac', colors.stripeB],
  balloons: [colors.stripeA, colors.accent, '#789eac', colors.water, '#d8a6ab'],

  // The same gentle palette after dark, consumed by the time-of-day lighting.
  duskHigh: '#697d8b',
  duskLow: '#e5b49c',
  nightHigh: '#243e4a',
  nightLow: '#607b7d',
  duskShade: '#69515a',
  nightShade: '#18353d',
  wire: '#615b4b',
  bulbOff: '#e8dfc9',
  bulbs: [colors.accent, colors.stripeB, colors.stripeA, colors.water],
  perimeterBulbs: [colors.accent, '#e8bf84', colors.stripeB],
  lampGlow: 'rgba(255, 205, 142, 0.55)',
  lampFade: 'rgba(255, 205, 142, 0)',
} as const;
