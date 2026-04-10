
'use server';

import { logSms } from './smsLogService';

export async function sendSmsViaSmsq(
    to: string, 
    message: string, 
    apiKey: string, 
    clientId: string, 
    senderId: string
): Promise<void> {
    
    const endpoint = 'http://api.smsq.global/api/v2/SendSMS';

    if (!message || message.trim() === "") {
        throw new Error("Message body cannot be empty.");
    }

    const partyNameMatch = message.match(/Dear (.*?)[,]/) || message.match(/প্রিয় (.*?)[,]/);
    const partyName = partyNameMatch ? partyNameMatch[1] : 'Unknown';

    try {
        const queryString = new URLSearchParams({
            ApiKey: apiKey,
            ClientId: clientId,
            SenderId: senderId,
            Message: message,
            MobileNumbers: to,
            Is_Unicode: 'true'
        }).toString();

        const finalUrl = `${endpoint}?${queryString}`;

        const response = await fetch(finalUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            cache: 'no-store', 
        });

        const responseText = await response.text();
        let responseData;
        
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Invalid JSON response from API: ${responseText.substring(0, 100)}`);
        }

        if (responseData.ErrorCode !== 0) {
            throw new Error(`SMSQ API Error (${responseData.ErrorCode}): ${responseData.ErrorDescription}`);
        }
        
        await logSms({ provider: 'SMSQ', to, partyName, message: message, status: 'success' });

    } catch (error: any) {
        console.error("Production SMS Error:", error.message);
        await logSms({ 
            provider: 'SMSQ', 
            to, 
            partyName, 
            message: message, 
            status: 'failed', 
            error: error.message 
        });
        throw error;
    }
}
