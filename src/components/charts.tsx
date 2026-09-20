"use client";

import { useMemo, useRef, useState } from "react";
import { toDayKey } from "@/lib/srs";

/* ----------------------------------------------------------- line chart -- */

export type Point = { label: string; value: number };

export function LineChart({
  points,
  goal,
  unit = "min",
  height = 150,
}: {
  points: Point[];
  goal?: number;
  unit?: string;
  height?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 320;
  const H = height;
  const padT = 14;
  const padB = 20;

  const max = Math.max(goal ?? 0, ...points.map((p) => p.value), 10) * 1.15;
  const stepX = points.length > 1 ? W / (points.length - 1) : W;
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);

  const path = points.map((p, i) => `${i ? "L" : "M"}${(i * stepX).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${path} L${W},${H - padB} L0,${H - padB} Z`;

  const onMove = (clientX: number) => {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
  };

  return (
    <div
      className="chart"
      style={{ position: "relative" }}
      ref={wrap}
      onMouseMove={(e) => onMove(e.clientX)}
      onMouseLeave={() => setHover(null)}
      onTouchStart={(e) => onMove(e.touches[0].clientX)}
      onTouchMove={(e) => onMove(e.touches[0].clientX)}
      onTouchEnd={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
        <defs>
          <linearGradient id="lcFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--acc)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--acc)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {goal ? (
          <line
            x1="0"
            x2={W}
            y1={y(goal)}
            y2={y(goal)}
            stroke="var(--label-3)"
            strokeWidth="1"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <path d={area} fill="url(#lcFill)" />
        <path
          d={path}
          fill="none"
          stroke="var(--acc)"
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {hover !== null && points[hover] ? (
          <>
            <line
              x1={hover * stepX}
              x2={hover * stepX}
              y1={padT}
              y2={H - padB}
              stroke="var(--label-4)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={hover * stepX} cy={y(points[hover].value)} r="3.6" fill="var(--acc)" />
          </>
        ) : null}
      </svg>
      <div className="row between small dim" style={{ marginTop: 2 }}>
        <span>{points[0]?.label}</span>
        {goal ? <span className="dim">goal {goal} {unit}</span> : <span />}
        <span>{points.at(-1)?.label}</span>
      </div>
      {hover !== null && points[hover] ? (
        <div
          className="ctip"
          style={{
            left: `clamp(0px, ${(hover / Math.max(1, points.length - 1)) * 100}% - 40px, calc(100% - 92px))`,
            top: 0,
          }}
        >
          {points[hover].label} · {Math.round(points[hover].value)} {unit}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- ring --- */

export function Ring({
  value,
  size = 132,
  stroke = 12,
  label,
  sub,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="dial" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--acc)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * pct) / 100} ${c}`}
          style={{ transition: "stroke-dasharray 400ms var(--ease)" }}
        />
      </svg>
      <div className="read">
        <div className="t">{label ?? `${Math.round(pct)}%`}</div>
        {sub ? <div className="l">{sub}</div> : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- heatmap -- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function Heatmap({ minutesByDay, onPick }: { minutesByDay: Record<string, number>; onPick?: (d: string) => void }) {
  const { columns, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay()));
    const start = new Date(end);
    start.setDate(start.getDate() - 7 * 52 - 6);

    const cols: { key: string; minutes: number; future: boolean; today: boolean }[][] = [];
    const labels: { index: number; text: string }[] = [];
    const cursor = new Date(start);
    let lastMonth = -1;

    for (let w = 0; w < 53; w++) {
      const col: { key: string; minutes: number; future: boolean; today: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const key = toDayKey(cursor);
        col.push({
          key,
          minutes: minutesByDay[key] ?? 0,
          future: cursor > today,
          today: key === toDayKey(today),
        });
        if (d === 0 && cursor.getMonth() !== lastMonth) {
          lastMonth = cursor.getMonth();
          labels.push({ index: w, text: MONTHS[lastMonth] });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      cols.push(col);
    }
    return { columns: cols, monthLabels: labels };
  }, [minutesByDay]);

  const level = (m: number) => (m <= 0 ? "" : m < 30 ? "l1" : m < 60 ? "l2" : m < 120 ? "l3" : "l4");

  return (
    <div className="hm-wrap">
      <div style={{ minWidth: 53 * 14 + 28 }}>
        <div className="hm-months">
          {monthLabels.map((l, i) => {
            const next = monthLabels[i + 1]?.index ?? 53;
            return (
              <span key={`${l.text}-${l.index}`} style={{ width: (next - l.index) * 14 }}>
                {l.text}
              </span>
            );
          })}
        </div>
        <div className="hm-body">
          <div className="hm-days">
            <span />
            <span>Mon</span>
            <span />
            <span>Wed</span>
            <span />
            <span>Fri</span>
            <span />
          </div>
          <div className="hm-grid">
            {columns.map((col, i) => (
              <div className="hm-col" key={i}>
                {col.map((cell) => (
                  <div
                    key={cell.key}
                    className={`hm-c ${level(cell.minutes)} ${cell.today ? "today" : ""}`}
                    style={cell.future ? { opacity: 0.25 } : undefined}
                    title={`${cell.key} · ${cell.minutes} min`}
                    onClick={() => onPick?.(cell.key)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="hm-legend">
          Less
          <span className="hm-c" />
          <span className="hm-c l1" />
          <span className="hm-c l2" />
          <span className="hm-c l3" />
          <span className="hm-c l4" />
          More
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- bars -- */

export function Bars({ points, unit = "min" }: { points: Point[]; unit?: string }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div className="row" style={{ alignItems: "flex-end", gap: 8, height: 110 }}>
      {points.map((p) => (
        <div key={p.label} className="grow" style={{ textAlign: "center" }}>
          <div
            title={`${p.value} ${unit}`}
            style={{
              height: Math.max(3, (p.value / max) * 82),
              background: p.value ? "var(--acc)" : "var(--surface-2)",
              borderRadius: 5,
              transition: "height var(--med) var(--ease)",
            }}
          />
          <div className="t-cap dim" style={{ marginTop: 6 }}>
            {p.label}
          </div>
        </div>
      ))}
    </div>
  );
}
