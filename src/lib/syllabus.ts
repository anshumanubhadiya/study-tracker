/* ============================================================================
   Syllabus Scanner — text → structured GTU syllabus
   ----------------------------------------------------------------------------
   OCR (Tesseract, in the browser) hands us a noisy blob of text from a photo or
   a PDF page of the GTU syllabus. This turns it into subject → units → topics
   with marks weightage, which is then shown in an EDITABLE form before anything
   touches the library. Deterministic and dependency-free, so the same parser
   runs on the client (instant preview) and on the server (import endpoint).
   ========================================================================== */

import type { ParsedSyllabus } from "./types";

const ROMAN: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
};

const UNIT_RE = /^\s*(?:unit|module|chapter)\s*[-–—:.]?\s*([ivx]+|\d+)\s*[-–—:.)]?\s*(.*)$/i;
const NUMBERED_TOPIC_RE = /^\s*(\d{1,2})[.)]\s*(\d{1,2})\s*[.)]?\s+(.+)$/;
const BULLET_RE = /^\s*(?:[•▪◦o*·\-–—]|\(\w\))\s+(.+)$/;
const CODE_RE = /\b(\d{6,8})\b/;
const MARKS_TRAIL_RE = /(?:\(|\[|\s)(\d{1,2})\s*(?:marks?|m)?\s*[)\]]?\s*$/i;

function clean(line: string): string {
  return line
    .replace(/[|]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[”“]/g, '"')
    .trim();
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => {
      if (w.length < 2) return w.toUpperCase();
      // capitalise the first LETTER, not the first character — OCR leaves
      // brackets and bullets glued to words ("(big" → "(Big")
      const i = w.search(/[a-z]/);
      if (i === -1) return w;
      const head = w.slice(0, i);
      const rest = w.slice(i);
      return rest.length > 2 || i > 0 ? `${head}${rest[0].toUpperCase()}${rest.slice(1)}` : w;
    })
    .join(" ")
    .trim();
}

function pullMarks(text: string): { text: string; marks: number } {
  const m = text.match(MARKS_TRAIL_RE);
  if (m) {
    const value = Number(m[1]);
    if (value > 0 && value <= 80) {
      return { text: text.slice(0, m.index).trim().replace(/[-–—:,]$/, "").trim(), marks: value };
    }
  }
  return { text: text.trim(), marks: 0 };
}

export type ScanReport = {
  parsed: ParsedSyllabus;
  stats: { lines: number; units: number; topics: number; marksFound: boolean };
  warnings: string[];
};

export function parseSyllabusText(raw: string, fallbackSemester = 3): ScanReport {
  const lines = raw
    .split(/\r?\n/)
    .map(clean)
    .filter((l) => l.length > 1);

  const warnings: string[] = [];
  const parsed: ParsedSyllabus = {
    subject: "",
    code: "",
    semester: fallbackSemester,
    credits: 4,
    units: [],
  };

  // ---- header block: subject name / code / semester ------------------------
  for (const line of lines.slice(0, 22)) {
    const low = line.toLowerCase();
    if (!parsed.code) {
      const codeLine = /code/.test(low) ? line : "";
      const m = (codeLine || "").match(CODE_RE);
      if (m) parsed.code = m[1];
    }
    if (!parsed.subject && /(course|subject)\s*(title|name)/i.test(line)) {
      const val = line.split(/[:\-–—]/).slice(1).join(" ").trim();
      if (val.length > 3) parsed.subject = titleCase(val);
    }
    const semM = low.match(/sem(?:ester)?\s*[-–—:]?\s*([ivx]+|\d)/i);
    if (semM) {
      const token = semM[1].toLowerCase();
      const n = ROMAN[token] ?? Number(token);
      if (n >= 1 && n <= 6) parsed.semester = n;
    }
    const credM = low.match(/credits?\s*[:\-–—]?\s*(\d{1,2})/);
    if (credM) parsed.credits = Math.min(10, Number(credM[1]) || 4);
  }

  if (!parsed.subject) {
    // best-effort: the longest ALL-CAPS-ish line above the first unit header
    const firstUnit = lines.findIndex((l) => UNIT_RE.test(l));
    const head = lines.slice(0, firstUnit === -1 ? 8 : firstUnit);
    const guess = head
      .filter((l) => l.length > 6 && l.length < 70 && !/\d{5,}/.test(l) && !/code|scheme|hours|marks|gujarat|university|diploma|page/i.test(l))
      .sort((a, b) => b.length - a.length)[0];
    if (guess) parsed.subject = titleCase(guess.replace(/[^a-zA-Z0-9&+ .-]/g, ""));
    else warnings.push("Subject name not detected — type it in below.");
  }
  if (!parsed.code) {
    const anyCode = lines.slice(0, 15).join(" ").match(CODE_RE);
    if (anyCode) parsed.code = anyCode[1];
  }

  // ---- unit / topic body ---------------------------------------------------
  let current: ParsedSyllabus["units"][number] | null = null;

  for (const line of lines) {
    const unitM = line.match(UNIT_RE);
    if (unitM) {
      const token = unitM[1].toLowerCase();
      const num = ROMAN[token] ?? Number(token) ?? parsed.units.length + 1;
      const { text, marks } = pullMarks(unitM[2] || "");
      current = {
        number: num || parsed.units.length + 1,
        title: text ? titleCase(text) : `Unit ${num}`,
        weightage: marks,
        topics: [],
      };
      parsed.units.push(current);
      continue;
    }

    const numbered = line.match(NUMBERED_TOPIC_RE);
    if (numbered) {
      const unitNo = Number(numbered[1]);
      let target = parsed.units.find((u) => u.number === unitNo);
      if (!target) {
        target = { number: unitNo, title: `Unit ${unitNo}`, weightage: 0, topics: [] };
        parsed.units.push(target);
      }
      const { text, marks } = pullMarks(numbered[3]);
      if (text.length > 2) target.topics.push({ title: titleCase(text), weightage: marks });
      current = target;
      continue;
    }

    if (current) {
      const bullet = line.match(BULLET_RE);
      const body = bullet ? bullet[1] : line;
      if (
        body.length > 3 &&
        body.length < 140 &&
        !/^(sr|no|topics?|hours?|marks?|total|teaching|course outcome|reference|page)\b/i.test(body) &&
        /[a-z]/i.test(body)
      ) {
        const { text, marks } = pullMarks(body);
        if (text.length > 2 && current.topics.length < 24) {
          current.topics.push({ title: titleCase(text), weightage: marks });
        }
      }
    }
  }

  parsed.units = parsed.units
    .filter((u) => u.topics.length > 0 || u.title.length > 6)
    .sort((a, b) => a.number - b.number);

  // ---- weightage clean-up --------------------------------------------------
  const marksFound = parsed.units.some((u) => u.weightage > 0 || u.topics.some((t) => t.weightage > 0));
  if (!marksFound && parsed.units.length) {
    // GTU theory paper is 70 marks — spread it evenly as a starting guess
    const per = Math.round(70 / parsed.units.length);
    parsed.units.forEach((u) => (u.weightage = per));
    warnings.push("No marks column found — 70 marks split evenly across units (editable).");
  }
  for (const u of parsed.units) {
    if (!u.topics.length) {
      u.topics.push({ title: u.title, weightage: u.weightage });
      continue;
    }
    const assigned = u.topics.reduce((a, t) => a + t.weightage, 0);
    if (assigned === 0 && u.weightage > 0) {
      const per = u.weightage / u.topics.length;
      u.topics.forEach((t) => (t.weightage = Math.round(per * 10) / 10));
    }
  }

  if (!parsed.units.length) warnings.push("No units detected. Add them manually or rescan a sharper photo.");

  return {
    parsed,
    stats: {
      lines: lines.length,
      units: parsed.units.length,
      topics: parsed.units.reduce((a, u) => a + u.topics.length, 0),
      marksFound,
    },
    warnings,
  };
}
