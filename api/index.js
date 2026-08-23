const crypto = require('crypto');
const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('OK');

  const { event, payload } = req.body || {};
  const ZOOM_SECRET = process.env.ZOOM_WEBHOOK_SECRET;
  const SLACK_URL = process.env.SLACK_WEBHOOK_URL;

  // 1. Zoom Security Handshake (CRC Validation)
  if (event === 'endpoint.url_validation') {
    const hash = crypto
      .createHmac('sha256', ZOOM_SECRET)
      .update(payload.plainToken)
      .digest('hex');

    return res.status(200).json({
      plainToken: payload.plainToken,
      encryptedToken: hash
    });
  }

  // 2. Customer Joined Event
  if (event === 'meeting.participant_joined') {
    const participant = payload.object.participant;
    const meetingTopic = payload.object.topic;

    // Filter internal engineers (change @yourcompany.com to your actual domain)
    if (participant.email && participant.email.endsWith('@yourcompany.com')) {
      return res.status(200).send('Internal user ignored');
    }

    await axios.post(SLACK_URL, {
      text: `🚨 *H&M Customer joined War Room!*\n👤 *Name:* ${participant.user_name}\n📧 *Email:* ${participant.email || 'N/A'}\n📌 *Meeting:* ${meetingTopic}\n👉 <https://zoom.us/j/${payload.object.id}|Join Call Now>`
    });
  }

  // 3. Customer Chat Message Event
  if (event === 'meeting.chat_message_sent') {
    const chat = payload.object.chat_message;

    if (chat.sender && chat.sender.endsWith('@yourcompany.com')) {
      return res.status(200).send('Internal chat ignored');
    }

    await axios.post(SLACK_URL, {
      text: `💬 *New Chat Message in H&M War Room!*\n👤 *From:* ${chat.sender}\n💬 *Message:* "${chat.message}"\n👉 <https://zoom.us/j/${payload.object.id}|Open Zoom>`
    });
  }

  return res.status(200).send('Event Processed');
};
