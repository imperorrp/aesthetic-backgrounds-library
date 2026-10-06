/** The studio's few icons: 16px, stroked in the current color. */
const paths = {
  shuffle: 'M2 4h2.5c1.6 0 2.6.7 3.5 2l1 1.5M2 12h2.5c1.6 0 2.6-.7 3.5-2l2-3c.9-1.3 1.9-2 3.5-2H14M12 3l2 2-2 2M12 9l2 2-2 2M10.5 10c.8.8 1.6 1 3 1H14',
  link: 'M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1',
  play: 'M5 3.5v9l7-4.5z',
  pause: 'M5 3.5v9M11 3.5v9',
  soundOn: 'M2.5 6v4h2.5l3.5 3V3L5 6zM11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.8a6 6 0 0 1 0 8.4',
  soundOff: 'M2.5 6v4h2.5l3.5 3V3L5 6zM11 6l3.5 4M14.5 6L11 10',
  undo: 'M5.5 3.5L3 6l2.5 2.5M3 6h6.5a3.5 3.5 0 0 1 0 7H7',
  redo: 'M10.5 3.5L13 6l-2.5 2.5M13 6H6.5a3.5 3.5 0 0 0 0 7H9',
  close: 'M4 4l8 8M12 4l-8 8',
  panel: 'M2.5 3.5h11v9h-11zM9.5 3.5v9',
  grid: 'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z',
  keys: 'M1.5 4.5h13v7h-13zM4 7h1M7 7h1M10 7h1M5 9.5h6',
  info: 'M8 1.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13zM8 7.2v4.3M8 4.6v.4',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, title }: { name: IconName; title?: string }) {
  return (
    <svg className="demo-icon" viewBox="0 0 16 16" width="16" height="16" fill={name === 'play' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={paths[name]} />
    </svg>
  );
}
