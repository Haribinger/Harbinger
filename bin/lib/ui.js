/**
 * Harbinger CLI — Terminal UI Primitives
 *
 * Box-drawing, tables, progress bars, and styled output matching the
 * Obsidian Command design system. Pure string manipulation — no extra deps.
 */

import chalk from 'chalk';

// ── Obsidian Command palette ────────────────────────────────────────────────
export const C = {
  gold:    chalk.hex('#f0c040'),
  dim:     chalk.hex('#6b7280'),
  border:  chalk.hex('#1a1a2e'),
  surface: chalk.hex('#0d0d15'),
  danger:  chalk.hex('#ef4444'),
  success: chalk.hex('#22c55e'),
  info:    chalk.hex('#3b82f6'),
  warn:    chalk.hex('#f59e0b'),
  white:   chalk.white,
  bold:    chalk.bold,
  muted:   chalk.gray,
};

// ── Icons ───────────────────────────────────────────────────────────────────
export const ICON = {
  ok:      C.success('[+]'),
  fail:    C.danger('[x]'),
  warn:    C.warn('[!]'),
  info:    C.info('[*]'),
  work:    C.gold('[~]'),
  bullet:  C.dim(' ·'),
  arrow:   C.gold(' →'),
};

// ── Banner ──────────────────────────────────────────────────────────────────
const ASCII_BANNER = `
  ██╗  ██╗ █████╗ ██████╗ ██████╗ ██╗███╗   ██╗ ██████╗ ███████╗██████╗
  ██║  ██║██╔══██╗██╔══██╗██╔══██╗██║████╗  ██║██╔════╝ ██╔════╝██╔══██╗
  ███████║███████║██████╔╝██████╔╝██║██╔██╗ ██║██║  ███╗█████╗  ██████╔╝
  ██╔══██║██╔══██║██╔══██╗██╔══██╗██║██║╚██╗██║██║   ██║██╔══╝  ██╔══██╗
  ██║  ██║██║  ██║██║  ██║██████╔╝██║██║ ╚████║╚██████╔╝███████╗██║  ██║
  ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝`;

export function banner(subtitle) {
  console.log(C.gold(ASCII_BANNER));
  if (subtitle) {
    console.log(C.dim(`  ${subtitle}`));
  }
  console.log();
}

// ── Box drawing ─────────────────────────────────────────────────────────────
// Draws a Unicode box around content lines.
//   ┌── TITLE ────────────────────────┐
//   │  line 1                         │
//   │  line 2                         │
//   └─────────────────────────────────┘

function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export function box(title, lines, { width = 56, padding = 2 } = {}) {
  const pad = ' '.repeat(padding);
  const innerW = width - 2; // minus left/right border chars

  // Top border
  const titleStr = title ? ` ${title} ` : '';
  const topFill = '─'.repeat(Math.max(0, innerW - titleStr.length));
  console.log(C.border('┌──') + C.gold(titleStr) + C.border(topFill + '┐'));

  // Content lines
  for (const line of lines) {
    const visible = stripAnsi(line);
    const fillLen = Math.max(0, innerW - padding * 2 - visible.length);
    console.log(C.border('│') + pad + line + ' '.repeat(fillLen) + pad + C.border('│'));
  }

  // Bottom border
  console.log(C.border('└' + '─'.repeat(innerW) + '┘'));
}

// ── Section divider ─────────────────────────────────────────────────────────
export function section(title, width = 56) {
  const titleStr = ` ${title} `;
  const fill = '─'.repeat(Math.max(0, width - titleStr.length - 2));
  console.log('\n' + C.border('──') + C.gold(titleStr) + C.border(fill));
}

// ── Status line ─────────────────────────────────────────────────────────────
// [+] Backend:  ONLINE
export function statusLine(icon, label, value) {
  const paddedLabel = label.padEnd(18);
  console.log(`  ${icon} ${C.white(paddedLabel)} ${value}`);
}

// ── Table ───────────────────────────────────────────────────────────────────
// Renders aligned columns with header separators.
export function table(headers, rows, { indent = 2 } = {}) {
  // Calculate column widths from headers + data
  const colWidths = headers.map((h, i) => {
    const dataMax = rows.reduce((max, row) => {
      const cell = String(row[i] ?? '');
      return Math.max(max, stripAnsi(cell).length);
    }, 0);
    return Math.max(stripAnsi(h).length, dataMax) + 2;
  });

  const pad = ' '.repeat(indent);

  // Header
  const headerLine = headers.map((h, i) => C.gold(h.padEnd(colWidths[i]))).join('');
  console.log(pad + headerLine);

  // Separator
  const sep = colWidths.map(w => '─'.repeat(w)).join('');
  console.log(pad + C.border(sep));

  // Rows
  for (const row of rows) {
    const line = row.map((cell, i) => {
      const str = String(cell ?? '');
      const visible = stripAnsi(str);
      const fill = Math.max(0, colWidths[i] - visible.length);
      return str + ' '.repeat(fill);
    }).join('');
    console.log(pad + line);
  }
}

// ── Progress bar ────────────────────────────────────────────────────────────
// [████████░░░░░░░░░░░░] 40%
export function progressBar(current, total, { width = 30, label = '' } = {}) {
  const pct = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = C.gold('█'.repeat(filled)) + C.dim('░'.repeat(empty));
  const pctStr = C.white(`${pct}%`.padStart(4));
  const labelStr = label ? C.dim(` ${label}`) : '';
  process.stdout.write(`\r  [${bar}] ${pctStr}${labelStr}`);
  if (current >= total) process.stdout.write('\n');
}

// ── Spinner (simple, single-frame replacement) ──────────────────────────────
const SPIN_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function spinner(message) {
  let i = 0;
  let active = true;
  const interval = setInterval(() => {
    if (!active) return;
    process.stdout.write(`\r  ${C.gold(SPIN_FRAMES[i % SPIN_FRAMES.length])} ${message}`);
    i++;
  }, 80);

  return {
    stop(finalMessage) {
      active = false;
      clearInterval(interval);
      process.stdout.write(`\r  ${ICON.ok} ${finalMessage || message}\n`);
    },
    fail(finalMessage) {
      active = false;
      clearInterval(interval);
      process.stdout.write(`\r  ${ICON.fail} ${finalMessage || message}\n`);
    },
  };
}

// ── Step counter ────────────────────────────────────────────────────────────
// [1/6] Checking prerequisites...
export function step(current, total, message) {
  const tag = C.gold(`[${current}/${total}]`);
  console.log(`  ${tag} ${message}`);
}

// ── Key-value pair ──────────────────────────────────────────────────────────
export function kv(key, value, { indent = 2 } = {}) {
  const pad = ' '.repeat(indent);
  console.log(`${pad}${C.dim(key.padEnd(20))} ${C.white(value)}`);
}

// ── Empty line helper ───────────────────────────────────────────────────────
export function nl() {
  console.log();
}
