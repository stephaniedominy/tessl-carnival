/**
 * The carnival's colours, fonts and sizes. Games draw with these rather than
 * their own values, so every booth on the midway looks like it belongs.
 */
export const theme = {
  colors: {
    background: '#293f3d',
    surface: '#3a514b',
    text: '#fff2d6',
    muted: '#bbadbf',
    accent: '#e6c780',
    danger: '#cf8a80',
    stripeA: '#be8276',
    stripeB: '#f7edda',
    water: '#93bdc6',
    wood: '#97765b',
    paper: '#fbf4e4',
    paperInk: '#344c46',
    paperMuted: '#63756a',
    paperEdge: '#c9cdb7',
    forest: '#38574d',
  },
  font: {
    family: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
    heading: 'Georgia, "Times New Roman", serif',
    small: 14,
    body: 18,
    title: 32,
  },
  radius: 16,
  canvas: {
    width: 800,
    height: 500,
  },
} as const;

/** Canvas font string: bookish titles and clear, friendly body lettering. */
export function canvasFont(size: 'small' | 'body' | 'title', weight: 'normal' | 'bold' = 'normal') {
  return `${weight} ${theme.font[size]}px ${size === 'title' ? theme.font.heading : theme.font.family}`;
}

/** Exposes the theme to CSS as custom properties, e.g. --color-accent. */
export function applyTheme(root: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--color-${name}`, value);
  }
  root.style.setProperty('--font-family', theme.font.family);
  root.style.setProperty('--font-heading', theme.font.heading);
  root.style.setProperty('--radius', `${theme.radius}px`);
}
