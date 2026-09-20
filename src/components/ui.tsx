"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { Icon } from "./Icons";

export function Header({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="hdr">
      <div>
        <h1>{title}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      {actions ? <div className="hdr-actions">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`card ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Section({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  return (
    <div className="sect">
      {title ? <span className="sect-t">{title}</span> : null}
      <div className="sect-b">{children}</div>
      {footer ? <div className="sect-f">{footer}</div> : null}
    </div>
  );
}

export function Row({
  icon,
  tint,
  title,
  sub,
  value,
  chevron,
  right,
  onClick,
  danger,
}: {
  icon?: string;
  tint?: string;
  title: string;
  sub?: string;
  value?: string;
  chevron?: boolean;
  right?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`lrow ${onClick ? "tap" : ""} ${danger ? "danger" : ""}`} onClick={onClick} type={onClick ? "button" : undefined}>
      {icon ? (
        <span className="lrow-i" style={{ background: tint ?? "var(--acc)" }}>
          <Icon name={icon} />
        </span>
      ) : null}
      <span className="lrow-m">
        <span className="lrow-t">{title}</span>
        {sub ? <span className="lrow-s">{sub}</span> : null}
      </span>
      {value ? <span className="lrow-v">{value}</span> : null}
      {right}
      {chevron ? <Icon name="chevron" className="lrow-c" /> : null}
    </Tag>
  );
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className={`sw ${on ? "on" : ""}`} onClick={() => onChange(!on)} aria-pressed={on}>
      <span className="knob" />
    </button>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  value,
  step = 5,
  min = 0,
  max = 600,
  suffix = "",
  onChange,
}: {
  value: number;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="stp">
      <button type="button" onClick={() => onChange(Math.max(min, value - step))}>
        <Icon name="minus" />
      </button>
      <span className="num">
        {value}
        {suffix}
      </span>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))}>
        <Icon name="plus" />
      </button>
    </div>
  );
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="mroot">
      <div className="mback" onClick={onClose} />
      <div className="sheet">
        <div className="grab" />
        <div className="row between" style={{ marginBottom: 6 }}>
          <h3 style={{ marginBottom: 0 }}>{title}</h3>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div style={{ paddingTop: 10 }}>{children}</div>
      </div>
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ico">
        <Icon name={icon} />
      </div>
      <div className="t-head" style={{ marginBottom: 6 }}>
        {title}
      </div>
      {body ? <div>{body}</div> : null}
      {action ? <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>{action}</div> : null}
    </div>
  );
}

export function MasteryPill({ mastery }: { mastery: string }) {
  const idx = ["not_started", "learning", "revised", "exam_ready"].indexOf(mastery);
  const label = ["Not Started", "Learning", "Revised", "Exam-Ready"][Math.max(0, idx)];
  return (
    <span className={`mast m${Math.max(0, idx)}`}>
      <i />
      {label}
    </span>
  );
}

export function Bar({ value, thick }: { value: number; thick?: boolean }) {
  return (
    <span className={`bar ${thick ? "thick" : ""}`}>
      <i style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </span>
  );
}
