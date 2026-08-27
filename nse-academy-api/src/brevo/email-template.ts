/**
 * Shared branded HTML email template. Every transactional email in this
 * codebase used to hand-roll its own `<!DOCTYPE html>...` string
 * independently (duplicated ~9 times, each drifting slightly) - this module
 * is the one place that owns the NSE Academy visual identity for email, so
 * every send looks consistent and a brand tweak only happens in one file.
 *
 * Email HTML has to be table-based / inline-styled to render consistently
 * across Gmail, Outlook, and mobile mail clients - no flexbox, no external
 * CSS, no CSS variables. Keep that constraint in mind before editing.
 */

const BRAND_COLOR = '#047857'; // emerald-700, matches the web app's primary accent
const BRAND_COLOR_DARK = '#065f46'; // emerald-800, used for hover-style contrast (buttons don't hover in email, but darker looks better on some clients' link-color overrides)
const TEXT_COLOR = '#18181b';
const MUTED_COLOR = '#52525b';
const BORDER_COLOR = '#e4e4e7';
const BG_COLOR = '#f4f4f5';
const CARD_BG = '#ffffff';

export interface EmailButton {
  label: string;
  url: string;
}

export interface EmailLayoutInput {
  /** Short uppercase eyebrow line above the heading, e.g. "Welcome" or "Price Alert". Defaults to nothing. */
  eyebrow?: string;
  heading: string;
  /** Body paragraphs, rendered in order. Each string is one <p> block; wrap inline HTML (e.g. <strong>) as needed - not escaped. */
  bodyHtml: string[];
  /** Primary call-to-action button, shown centered below the body. */
  button?: EmailButton;
  /** Optional secondary line shown under the button in muted text, e.g. a "having trouble" note or a raw link fallback. */
  footNoteHtml?: string;
  /** Optional highlighted info box (light emerald background) for a key fact - amount, date, code, etc. */
  infoBox?: string;
  siteUrl: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders the full branded HTML document. Pass already-composed inline HTML
 * in bodyHtml/footNoteHtml/infoBox (they are not escaped) so callers can
 * bold/link within a paragraph; anything from user input should be escaped
 * by the caller before interpolating.
 */
export function renderEmailHtml(input: EmailLayoutInput): string {
  const { eyebrow, heading, bodyHtml, button, footNoteHtml, infoBox, siteUrl } = input;
  const bareSite = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const eyebrowHtml = eyebrow
    ? `<p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND_COLOR};">${escapeHtml(eyebrow)}</p>`
    : '';

  const paragraphsHtml = bodyHtml
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${TEXT_COLOR};word-break:break-word;overflow-wrap:anywhere;">${p}</p>`)
    .join('\n');

  const buttonHtml = button
    ? `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
    <tr>
      <td style="border-radius:12px;background:${BRAND_COLOR};">
        <a href="${button.url}" target="_blank"
           style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">
          ${escapeHtml(button.label)}
        </a>
      </td>
    </tr>
  </table>`
    : '';

  const infoBoxHtml = infoBox
    ? `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
    <tr>
      <td style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px 20px;font-size:15px;line-height:1.6;color:${BRAND_COLOR_DARK};word-break:break-word;overflow-wrap:anywhere;">
        ${infoBox}
      </td>
    </tr>
  </table>`
    : '';

  const footNoteHtmlBlock = footNoteHtml
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${MUTED_COLOR};word-break:break-word;overflow-wrap:anywhere;">${footNoteHtml}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BG_COLOR};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BG_COLOR};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
        <tr>
          <td style="padding:0 4px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;padding-right:8px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="28" height="28" style="background:${BRAND_COLOR};border-radius:8px;">
                    <tr><td align="center" valign="middle" style="font-size:15px;font-weight:800;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">N</td></tr>
                  </table>
                </td>
                <td style="vertical-align:middle;">
                  <span style="font-size:15px;font-weight:700;color:${TEXT_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">NSE Academy</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:${CARD_BG};border:1px solid ${BORDER_COLOR};border-radius:16px;padding:36px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
            ${eyebrowHtml}
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${TEXT_COLOR};">${escapeHtml(heading)}</h1>
            ${paragraphsHtml}
            ${infoBoxHtml}
            ${buttonHtml}
            ${footNoteHtmlBlock}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
            <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:${MUTED_COLOR};">
              - The NSE Academy team
            </p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#a1a1aa;">
              <a href="${siteUrl}" style="color:${MUTED_COLOR};text-decoration:none;">${bareSite}</a>
              &nbsp;&middot;&nbsp;
              Independent investor education, not affiliated with the Nairobi Securities Exchange.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Plain-text counterpart. Keep in rough sync with renderEmailHtml's content for the same input. */
export function renderEmailText(input: {
  heading: string;
  bodyText: string[];
  button?: EmailButton;
  footNoteText?: string;
  siteUrl: string;
}): string {
  const { heading, bodyText, button, footNoteText, siteUrl } = input;
  const lines = [heading, '', ...bodyText.map((p) => p + '\n')];
  if (button) {
    lines.push(`${button.label}: ${button.url}\n`);
  }
  if (footNoteText) {
    lines.push(footNoteText + '\n');
  }
  lines.push('- The NSE Academy team', siteUrl);
  return lines.join('\n');
}
