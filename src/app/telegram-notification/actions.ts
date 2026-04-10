'use server';

const TELEGRAM_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

interface SendOptions {
  priority: 'normal' | 'urgent' | 'success';
  taskId: string; // টাস্ক আইডি জরুরি, যাতে সার্ভার বোঝে কোন টাস্কটি আপডেট করতে হবে
}

export async function sendTelegramNotification(message: string, options: SendOptions) {
  if (!TELEGRAM_TOKEN || !CHAT_ID) return { success: false, error: 'Telegram credentials not configured' };

  let finalMessage = message;
  
  // প্রায়োরিটি অনুযায়ী ইমোজি যোগ করা
  if (options.priority === 'urgent') finalMessage = `🚨 <b>URGENT ALERT</b>\n\n${message}`;
  if (options.priority === 'success') finalMessage = `✅ <b>SUCCESS</b>\n\n${message}`;
  if (options.priority === 'normal') finalMessage = `🔔 <b>NOTIFICATION</b>\n\n${message}`;


  // 5, 10, 15, 30 মিনিটের বাটন সেটআপ
  const keyboard = {
    inline_keyboard: [
      [
        { text: "⏰ 5 Min", callback_data: `snooze_${options.taskId}_5` },
        { text: "⏰ 10 Min", callback_data: `snooze_${options.taskId}_10` },
      ],
      [
        { text: "⏰ 15 Min", callback_data: `snooze_${options.taskId}_15` },
        { text: "⏰ 30 Min", callback_data: `snooze_${options.taskId}_30` },
      ],
      [
        { text: "✅ Mark as Done", callback_data: `done_${options.taskId}` }
      ]
    ]
  };

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: finalMessage,
        parse_mode: 'HTML',
        reply_markup: keyboard
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      return { success: false, error: data.description };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
