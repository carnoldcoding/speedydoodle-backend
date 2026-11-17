const { formatPrice } = require('./pricing');

const SERVICE_NAMES = {
  live: 'Live Event',
  custom: 'Custom Caricatures',
  lni: 'Illustrations and Logos',
};

const BACKGROUND_NAMES = { none: 'None', simple: 'Simple', complex: 'Complex' };

// Each form value passes through this before it enters HTML. A value such as
// <b>x</b> then shows as text and does not become markup.
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// "13:30" becomes "01:30 PM".
function formatTime(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(hour12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

// The rows of the "Quote Details" block, as plain values. Nothing is escaped here.
function quoteRows(quote, price) {
  const { details } = quote;
  const rows = [
    ['Customer Name', `${quote.firstName} ${quote.lastName}`],
    ['Email', quote.email],
    ['Service Type', SERVICE_NAMES[quote.type]],
  ];
  if (quote.type === 'live') {
    rows.push(
      ['Address', details.location],
      ['Event Details', details.event],
      [
        'Event Date & Time',
        `${details.date} | ${formatTime(details.startTime)} - ${formatTime(details.endTime)}`,
      ],
      ['Expected Headcount', String(details.headcount)],
    );
    if (price.breakdown.roundTripMiles === null) {
      rows.push(['Travel', 'The travel cost is not in the estimate. The distance was not available.']);
    }
  } else if (quote.type === 'custom') {
    rows.push(
      ['Number of People', String(details.personCount)],
      ['Background Style', BACKGROUND_NAMES[details.background]],
      ['Description', details.description],
    );
    if (details.text) rows.push(['Text Content', details.textContent]);
  } else {
    rows.push(['Selection', details.selection === 'logo' ? 'Logo' : 'Illustration']);
  }
  rows.push(['Additional Information', quote.additionalInfo], ['Estimated Price', formatPrice(price)]);
  return rows;
}

function layout({ title, heading, intro, rows, closing, footer }) {
  const rowsHtml = rows
    .map(
      ([label, value]) => `
                      <div style="margin-bottom: 15px; border-bottom: 1px solid #e9ecef; padding-bottom: 12px;">
                        <strong style="color: #333333; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(label)}:</strong>
                        <div style="color: #555555; margin-top: 5px; font-size: 16px; white-space: pre-wrap;">${escapeHtml(value)}</div>
                      </div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">SpeedyDoodle</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${escapeHtml(title)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px;">${escapeHtml(heading)}</h2>
              <p style="color: #666666; line-height: 1.6; margin: 0 0 30px 0; font-size: 16px;">${escapeHtml(intro)}</p>
              <div style="background-color: #f8f9fa; padding: 25px; border-radius: 6px; margin: 20px 0;">
                <h3 style="color: #333333; margin: 0 0 20px 0; font-size: 20px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">Quote Details</h3>${rowsHtml}
              </div>
              <div style="background-color: #e8f4fd; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; color: #333333; font-size: 16px;">${escapeHtml(closing)}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #333333; padding: 30px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="color: #ffffff; margin: 0; font-size: 14px; line-height: 1.5;">
                <strong>SpeedyDoodle Studio</strong><br>
                Professional Caricatures &amp; Illustrations
              </p>
              <p style="color: #cccccc; margin: 15px 0 0 0; font-size: 12px;">${escapeHtml(footer)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function plainText({ title, heading, intro, rows, closing, footer }) {
  return [
    `SPEEDYDOODLE - ${title}`,
    '==================================',
    '',
    heading,
    '',
    intro,
    '',
    'QUOTE DETAILS:',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    closing,
    '',
    '---',
    'SpeedyDoodle Studio',
    'Professional Caricatures & Illustrations',
    '',
    footer,
  ].join('\n');
}

// The confirmation that the customer receives.
function customerEmail(quote, price, { contactAddress }) {
  const parts = {
    title: 'Quote Confirmation',
    heading: 'Thank you for your inquiry!',
    intro:
      "We've received your quote request and our team is reviewing the details. You can expect a personalized response within 24 hours.",
    rows: quoteRows(quote, price),
    closing:
      "What's next? Our team will review your requirements and send you a detailed proposal with pricing, timeline, and next steps.",
    footer: `This is an automated confirmation email. If you have any immediate questions, please contact us directly at ${contactAddress}. You're receiving this because you requested a quote through our website.`,
  };
  return {
    subject: `Quote Confirmation - ${SERVICE_NAMES[quote.type]} | SpeedyDoodle`,
    html: layout(parts),
    text: plainText(parts),
  };
}

// The notice that the artist receives. A reply goes to the customer.
function artistEmail(quote, price, { quoteId }) {
  const parts = {
    title: 'New Quote Request',
    heading: `Quote request #${quoteId}`,
    intro: `${quote.firstName} ${quote.lastName} sent a quote request through the website.`,
    rows: quoteRows(quote, price),
    closing: 'Reply to this email to answer the customer directly.',
    footer: 'This is an automated email from the speedydoodle.com quote form.',
  };
  return {
    subject: `New quote request - ${SERVICE_NAMES[quote.type]} - ${quote.firstName} ${quote.lastName}`,
    html: layout(parts),
    text: plainText(parts),
    replyTo: quote.email,
  };
}

module.exports = { escapeHtml, formatTime, customerEmail, artistEmail };
