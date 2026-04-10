import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; // আপনার ফায়ারবেস কনফিগ পাথ দিন
import { doc, updateDoc, getDoc } from 'firebase/firestore';

const TELEGRAM_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;

export async function POST(req: Request) {
  const body = await req.json();

  // বাটনে ক্লিক হ্যান্ডেল করা (Callback Query)
  if (body.callback_query) {
    const { id, data, message } = body.callback_query;
    const chatId = message.chat.id;

    // ডাটা ফরম্যাট: action_taskId_value (যেমন: snooze_task123_10)
    const parts = data.split('_');
    const action = parts[0];
    const taskId = parts[1];

    try {
      const taskRef = doc(db, "reminders", taskId); // আপনার কালেকশনের নাম 'reminders' বা যা আছে তাই দিন

      if (action === 'snooze') {
        const minutes = parseInt(parts[2]);
        const newTime = new Date();
        newTime.setMinutes(newTime.getMinutes() + minutes);

        // ১. ডাটাবেসে সময় বাড়ানো এবং স্ট্যাটাস পেন্ডিং করা
        await updateDoc(taskRef, {
          dueDate: newTime.toISOString(),
          status: 'pending' // আবার পেন্ডিং করা যাতে অ্যাপ আবার চেক করে
        });

        await sendMessage(chatId, `✅ রিমাইন্ডারটি ${minutes} মিনিট পিছিয়ে দেওয়া হয়েছে।`);
      } 
      else if (action === 'done') {
        // ২. কাজ শেষ মার্ক করা
        await updateDoc(taskRef, { status: 'sent', note: 'Completed via Telegram' });
        await sendMessage(chatId, `🎉 রিমাইন্ডারটি কমপ্লিট করা হয়েছে।`);
      }

      // লোডিং আইকন বন্ধ করা
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: id })
      });

    } catch (error) {
      console.error("Firebase update failed:", error);
      await sendMessage(chatId, "⚠️ এরর: টাস্কটি খুঁজে পাওয়া যায়নি বা ডাটাবেস এরর।");
    }
  }

  return NextResponse.json({ status: 'ok' });
}

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text }),
  });
}
