import type { CSSProperties } from "react";

/* A hand-drawn stroke icon set — deliberately not emoji, so the app looks the
   same on every phone. All glyphs live on a 24×24 grid, inherit `currentColor`
   and their optical size from the context via the `.icn` class. */

const P: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.5 20v-5.5h5V20",
  calendar: "M4 6.5h16v14H4zM4 10.5h16M8 3.5v4M16 3.5v4M8 14h2M8 17h2M14 14h2",
  play: "M8 5.5 19 12 8 18.5z",
  pause: "M9 5.5v13M15 5.5v13",
  library: "M4 5h5v15H4zM10.5 5h5v15h-5zM17.4 6.2l3.1.8-3 14.2-3.1-.8",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  settings:
    "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 13.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1z",
  chevron: "M9 5l7 7-7 7",
  back: "M15 5l-7 7 7 7",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "M4.5 12.5 9.5 17.5 19.5 6.5",
  close: "M6 6l12 12M18 6 6 18",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5.2l3.3 2",
  flame: "M12 22c3.9 0 6.5-2.5 6.5-6 0-4.5-4.5-6.3-3.6-11C11.5 6 9.8 8.2 9.8 11c0 1.2.4 2 .4 2S9 12.2 8.5 10.5C6.6 12.4 5.5 14.2 5.5 16.2 5.5 19.6 8.1 22 12 22z",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 13.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z",
  brain:
    "M9.5 3.5A3 3 0 0 0 6.6 6 2.9 2.9 0 0 0 4 8.9c0 1 .5 1.9 1.2 2.4A3 3 0 0 0 6.7 16c.3 2 2 3.4 3.9 3.4h.4V3.6a2 2 0 0 0-1.5-.1zM14.5 3.5A3 3 0 0 1 17.4 6 2.9 2.9 0 0 1 20 8.9c0 1-.5 1.9-1.2 2.4a3 3 0 0 1-1.5 4.7c-.3 2-2 3.4-3.9 3.4H13V3.6a2 2 0 0 1 1.5-.1z",
  scan: "M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5M4 12h16",
  book: "M5 4.5h9.5A2.5 2.5 0 0 1 17 7v13H7.5A2.5 2.5 0 0 1 5 17.5zM17 7l2.5-1v14L17 20",
  code: "M9 8.5 5 12l4 3.5M15 8.5l4 3.5-4 3.5M13.4 5.5l-2.8 13",
  network: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM3.5 12h17M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5S14.2 18.2 12 20.5c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5z",
  chip: "M7.5 7.5h9v9h-9zM4.5 10h3M4.5 14h3M16.5 10h3M16.5 14h3M10 4.5v3M14 4.5v3M10 16.5v3M14 16.5v3",
  spark: "M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.4l-1.9-5.6L4.5 11 10.1 9zM18.5 4v3M20 5.5h-3",
  eye: "M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  sigma: "M17.5 5H6.5l6 7-6 7h11",
  timer: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM9.5 2.5h5M12 9v4l2.5 1.5",
  refresh: "M20 11a8 8 0 1 0-1.3 5.5M20 5v5h-5",
  download: "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14",
  upload: "M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14",
  share: "M12 3.5v12M8 7.5 12 3.5l4 4M5 13.5V20h14v-6.5",
  printer: "M7 9V4h10v5M7 17H5.5A1.5 1.5 0 0 1 4 15.5v-4A2.5 2.5 0 0 1 6.5 9h11a2.5 2.5 0 0 1 2.5 2.5v4a1.5 1.5 0 0 1-1.5 1.5H17M7 14h10v6H7z",
  bell: "M18 9a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16S18 15 18 9zM13.7 20a2 2 0 0 1-3.4 0",
  moon: "M20 14.2A8.5 8.5 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 2v2M12 20v2M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2 12h2M20 12h2M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5",
  user: "M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1-3.4 4-5.5 7.5-5.5s6.5 2.1 7.5 5.5",
  users: "M9 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.9-3 3.4-4.8 6.5-4.8s5.6 1.8 6.5 4.8M16 6.2a3.2 3.2 0 0 1 0 6.2M18 15.6c2 .8 3.2 2.3 3.7 4.4",
  trash: "M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6M13.5 10.5v6",
  edit: "M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17zM14.5 7.5l3 3",
  alert: "M12 3.5 21.5 20h-19zM12 9.5v5M12 17.2v.3",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.6v.3",
  cap: "M2.5 8.5 12 4l9.5 4.5L12 13zM6.5 10.5V16c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-5.5M20.5 9v5",
  layers: "M12 3.5 2.5 8 12 12.5 21.5 8zM2.5 12.5 12 17l9.5-4.5M2.5 17 12 21.5l9.5-4.5",
  filter: "M3.5 5.5h17l-6.5 8v6l-4 2v-8z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16.2 16.2 21 21",
  coffee: "M4.5 7.5h12v6a4.5 4.5 0 0 1-9 0zM16.5 9h1.8a2.2 2.2 0 1 1 0 4.5h-1.8M4 20.5h13",
  logout: "M14.5 8V5.5h-9v13h9V16M10 12h10.5M17.5 8.5 21 12l-3.5 3.5",
  lock: "M6.5 10.5h11v9h-11zM8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3",
  ai: "M12 4.5 13.4 9l4.6 1.5-4.6 1.5L12 16.5l-1.4-4.5L6 10.5 10.6 9zM5.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7zM18.5 3.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L16.5 5.5 18 5z",
  flag: "M6 21V4.5h12l-2.5 4 2.5 4H6",
  bolt: "M13.5 3 5.5 13.5h6L10.5 21l8-10.5h-6z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  stack: "M7 5h13M7 12h13M7 19h13M3.5 5v.01M3.5 12v.01M3.5 19v.01",
  camera: "M4 8h3l1.5-2.5h7L17 8h3v11.5H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  doc: "M6.5 3.5h7l4.5 4.5v12h-11.5zM13.5 3.5V8H18M9 13h6M9 16.5h6",
  link: "M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7l-1.2 1.2M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 0 0 5.7 5.7l1.2-1.2",
};

export type IconName = keyof typeof P | string;

export function Icon({
  name,
  className = "",
  style,
}: {
  name: IconName;
  className?: string;
  style?: CSSProperties;
}) {
  const d = P[name] ?? P.doc;
  return (
    <svg className={`icn ${className}`} viewBox="0 0 24 24" style={style} aria-hidden="true">
      {d.split("M").filter(Boolean).map((seg, i) => (
        <path key={i} d={`M${seg}`} />
      ))}
    </svg>
  );
}

export const SUBJECT_ICONS: Record<string, string> = {
  code: "code",
  network: "network",
  chip: "chip",
  spark: "spark",
  eye: "eye",
  sigma: "sigma",
  book: "book",
};

export const COLOR_VAR: Record<string, string> = {
  blue: "var(--blue)",
  orange: "var(--orange)",
  purple: "var(--purple)",
  pink: "var(--pink)",
  teal: "var(--teal)",
  indigo: "var(--indigo)",
  green: "var(--green)",
  red: "var(--red)",
  yellow: "var(--yellow)",
};
