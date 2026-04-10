
'use server';

import { logSms } from './smsLogService';

export async function sendSmsViaPushbullet(
  to: string,
  message: string,
  accessToken: string,
  deviceId?: string
): Promise<void> {
  const endpoint = 'https://api.pushbullet.com/v2/texts';

  if (!message || message.trim() === "") {
    throw new Error("Message body cannot be empty.");
  }
  
  if (!deviceId) {
      throw new Error("Pushbullet Device ID is not configured in settings.");
  }

  const partyNameMatch = message.match(/Dear (.*?)[,]/) || message.match(/প্রিয় (.*?)[,]/);
  const partyName = partyNameMatch ? partyNameMatch[1] : 'Unknown';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
            target_device_iden: deviceId,
            addresses: [to],
            message: message,
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
      const errorMessage = errorData.error?.message || 'Unknown Pushbullet API error';
      throw new Error(`Pushbullet API Error: ${errorMessage}`);
    }

    console.log(`SMS sent successfully via Pushbullet to ${to}.`);
    await logSms({
        provider: 'Pushbullet',
        to: to,
        partyName,
        message: message,
        status: 'success'
    });

  } catch (error) {
    console.error("Failed to send SMS via Pushbullet:", error);
     await logSms({
        provider: 'Pushbullet',
        to: to,
        partyName,
        message: message,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error) {
      throw new Error(`Could not send SMS via Pushbullet. Error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while trying to send the SMS via Pushbullet.");
  }
}
