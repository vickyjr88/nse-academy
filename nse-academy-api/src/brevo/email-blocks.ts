import { escapeHtml } from './email-template';

/**
 * Reusable block-level pieces for emails that need more than paragraphs
 * (admin alerts, the daily report). Same constraint as email-template.ts:
 * table-based, inline styles only, no flexbox/CSS variables, so they render
 * in Gmail, Outlook and mobile clients. Callers escape user-supplied text
 * with escapeHtml before passing it in; these helpers do not escape `html`
 * cells so a cell can contain <strong>/<span> markup.
 */

const TEXT = '#18181b';
const MUTED = '#52525b';
const BORDER = '#e4e4e7';
const GREEN = '#047857';
const RED = '#b91c1c';

export function sectionHeading(title: string, hint?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 10px;">
  <tr><td style="border-bottom:2px solid ${BORDER};padding:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${TEXT};">
    ${escapeHtml(title)}${hint ? ` <span style="font-weight:400;letter-spacing:0;text-transform:none;color:${MUTED};">${escapeHtml(hint)}</span>` : ''}
  </td></tr>
</table>`;
}

export interface TableColumn {
  header: string;
  align?: 'left' | 'right';
}

/** Rows are arrays of ready-to-render HTML cell strings, one per column. */
export function dataTable(columns: TableColumn[], rows: string[][], emptyMessage = 'Nothing to report.'): string {
  if (rows.length === 0) {
    return `<p style="margin:0 0 8px;font-size:14px;color:${MUTED};">${escapeHtml(emptyMessage)}</p>`;
  }
  const head = columns
    .map(
      (c) =>
        `<th align="${c.align ?? 'left'}" style="padding:8px 6px;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:${MUTED};border-bottom:1px solid ${BORDER};text-align:${c.align ?? 'left'};">${escapeHtml(c.header)}</th>`,
    )
    .join('');
  const body = rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (cell, i) =>
              `<td align="${columns[i]?.align ?? 'left'}" style="padding:9px 6px;font-size:14px;color:${TEXT};border-bottom:1px solid ${BORDER};text-align:${columns[i]?.align ?? 'left'};font-variant-numeric:tabular-nums;">${cell}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('\n');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;border-collapse:collapse;">
  <tr>${head}</tr>
  ${body}
</table>`;
}

/** Label/value rows - for the activity summary. Zero values are muted so real activity stands out. */
export function statRows(items: { label: string; value: string | number; note?: string }[]): string {
  const rows = items
    .map((it) => {
      const isZero = it.value === 0 || it.value === '0' || it.value === 'KSh 0';
      return `<tr>
    <td style="padding:8px 0;font-size:14px;color:${MUTED};border-bottom:1px solid ${BORDER};">${escapeHtml(it.label)}${it.note ? `<br><span style="font-size:12px;color:#a1a1aa;">${escapeHtml(it.note)}</span>` : ''}</td>
    <td align="right" style="padding:8px 0;font-size:16px;font-weight:700;color:${isZero ? '#a1a1aa' : TEXT};border-bottom:1px solid ${BORDER};font-variant-numeric:tabular-nums;">${escapeHtml(String(it.value))}</td>
  </tr>`;
    })
    .join('\n');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;border-collapse:collapse;">${rows}</table>`;
}

/** Amber callout for things the admin must act on. */
export function attentionBox(title: string, items: string[]): string {
  if (items.length === 0) return '';
  const lis = items.map((i) => `<li style="margin:0 0 6px;">${i}</li>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
  <tr><td style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;font-size:14px;line-height:1.6;color:#78350f;">
    <strong style="display:block;margin:0 0 8px;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">${escapeHtml(title)}</strong>
    <ul style="margin:0;padding-left:18px;">${lis}</ul>
  </td></tr>
</table>`;
}

/** Message body quoted verbatim (escaped, line breaks kept) - for contact messages. */
export function quoteBlock(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
  <tr><td style="border-left:3px solid ${BORDER};padding:4px 0 4px 16px;font-size:15px;line-height:1.6;color:${TEXT};white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(text)}</td></tr>
</table>`;
}

export function signedPct(n: number): string {
  const s = `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
  return `<span style="font-weight:700;color:${n > 0 ? GREEN : n < 0 ? RED : MUTED};">${s}</span>`;
}
