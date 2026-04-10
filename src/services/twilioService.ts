
'use server';

import { logSms } from './smsLogService';

export async function sendSmsViaTwilio(to: string, message: string, accountSid?: string, authToken?: string, messagingServiceSid?: string): Promise<void> {
    if (!accountSid || !authToken || !messagingServiceSid) {
        throw new Error("Twilio credentials are not configured in environment variables.");
    }

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    let formattedTo = to.replace(/\s+/g, '');
    if (!formattedTo.startsWith('+')) {
        if (formattedTo.length === 11 && formattedTo.startsWith('0')) {
            formattedTo = `+88${formattedTo}`;
        } else if (formattedTo.length === 10) {
            formattedTo = `+880${formattedTo}`;
        } else {
             formattedTo = `+${formattedTo}`;
        }
    }
    
    const params = new URLSearchParams();
    params.append('To', formattedTo);
    params.append('MessagingServiceSid', messagingServiceSid);
    params.append('Body', message);

    const partyNameMatch = message.match(/Dear (.*?)[,]/) || message.match(/প্রিয় (.*?)[,]/);
    const partyName = partyNameMatch ? partyNameMatch[1] : 'Unknown';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(`Twilio API Error (${responseData.code || response.status}): ${responseData.message || 'Unknown error'}`);
        }
        
        console.log(`SMS sent successfully via Twilio. SID: ${responseData.sid}`);
        await logSms({ provider: 'Twilio', to, partyName, message, status: 'success' });

    } catch (error) {
        console.error("Failed to send SMS via Twilio:", error);
        await logSms({ provider: 'Twilio', to, partyName, message, status: 'failed', error: error instanceof Error ? error.message : String(error) });
        if (error instanceof Error) {
            throw new Error(`Could not send SMS via Twilio. Error: ${error.message}`);
        }
        throw new Error("An unknown error occurred while trying to send the SMS via Twilio.");
    }
}
