/**
 * Webhook payloads in the exact shapes the platforms deliver them. Field
 * names and nesting mirror real captures; ids and phone numbers are fake.
 */

/** Messenger: one inbound text, one echo of our own reply, one delivery receipt. */
export const messengerPayload = {
  object: "page",
  entry: [
    {
      id: "1563194670199327",
      time: 1756100000000,
      messaging: [
        {
          sender: { id: "24680135791234567" },
          recipient: { id: "1563194670199327" },
          timestamp: 1756100000000,
          message: { mid: "m_AbCdEf123", text: "Hello from a customer" }
        },
        {
          sender: { id: "1563194670199327" },
          recipient: { id: "24680135791234567" },
          timestamp: 1756100001000,
          message: { mid: "m_EchoXyz", text: "Our own reply", is_echo: true }
        },
        {
          sender: { id: "24680135791234567" },
          recipient: { id: "1563194670199327" },
          timestamp: 1756100002000,
          delivery: { mids: ["m_SentEarlier1"], watermark: 1756100001500 }
        }
      ]
    }
  ]
};

/** Messenger read event: a watermark, not a message — must produce nothing. */
export const messengerReadPayload = {
  object: "page",
  entry: [
    {
      id: "1563194670199327",
      time: 1756100003000,
      messaging: [
        {
          sender: { id: "24680135791234567" },
          recipient: { id: "1563194670199327" },
          timestamp: 1756100003000,
          read: { watermark: 1756100002000 }
        }
      ]
    }
  ]
};

/** WhatsApp Cloud API: inbound text with contact profile, plus a status update. */
export const whatsappPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "1234567890",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15551884340",
              phone_number_id: "1191055487432454"
            },
            contacts: [{ profile: { name: "Baizyd Bustami" }, wa_id: "8801940192494" }],
            messages: [
              {
                from: "8801940192494",
                id: "wamid.HBgNODgwMTk0MDE5MjQ5NBUCABIYFj",
                timestamp: "1756100000",
                text: { body: "Hello" },
                type: "text"
              }
            ]
          }
        },
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15551884340",
              phone_number_id: "1191055487432454"
            },
            statuses: [
              {
                id: "wamid.OutboundReply1",
                status: "read",
                timestamp: "1756100050",
                recipient_id: "8801940192494"
              }
            ]
          }
        }
      ]
    }
  ]
};

/** WhatsApp image message: media id must become our proxy URL, caption the body. */
export const whatsappImagePayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "1234567890",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "15551884340", phone_number_id: "1191055487432454" },
            messages: [
              {
                from: "8801940192494",
                id: "wamid.ImageMsg1",
                timestamp: "1756100100",
                type: "image",
                image: { id: "media-id-987", mime_type: "image/jpeg", caption: "look at this" }
              }
            ]
          }
        }
      ]
    }
  ]
};

/** LINE: one text message event, one non-message (follow) event. */
export const linePayload = {
  destination: "U67890abcdef1234567890abcdef1234",
  events: [
    {
      type: "message",
      message: { type: "text", id: "585814919846445465", text: "Hi from LINE" },
      webhookEventId: "01K3AE9WPYHMB9SGDBBBLK6M1P",
      deliveryContext: { isRedelivery: false },
      timestamp: 1756100000000,
      source: { type: "user", userId: "Uabcdef1234567890abcdef1234567890" },
      replyToken: "0f3779fba3b349968c5d07db31eab56f",
      mode: "active"
    },
    {
      type: "follow",
      webhookEventId: "01K3AE9WQZZZZ9SGDBBBLK6M2Q",
      deliveryContext: { isRedelivery: false },
      timestamp: 1756100001000,
      source: { type: "user", userId: "Uabcdef1234567890abcdef1234567890" },
      mode: "active"
    }
  ]
};

/** LINE verify button: signed request with an empty events array. */
export const lineVerifyPayload = {
  destination: "U67890abcdef1234567890abcdef1234",
  events: []
};
