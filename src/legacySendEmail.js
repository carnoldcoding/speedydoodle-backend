// The old route. It sends any message to any address, so it must go.
// It stays only until the frontend uses POST /api/quotes. Then this file is deleted.
function mountLegacySendEmail(app, { mailer, sender, log }) {
  app.post('/api/send-email', async (req, res) => {
    const { to, subject, text, html } = req.body;
    try {
      const info = await mailer.sendMail({ from: sender, to, subject, text, html });
      res.status(200).json({ message: 'Email sent successfully', messageId: info.messageId });
    } catch (error) {
      log.error('Error sending email:', error);
      res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
  });
}

module.exports = { mountLegacySendEmail };
