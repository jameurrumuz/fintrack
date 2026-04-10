

'use server';

import { getAppSettings } from '@/services/settingsService';
import { sendSmsViaSmsq } from '@/services/smsqService';
import { sendSmsViaPushbullet } from '@/services/pushbulletService';
import { sendSmsViaTwilio } from '@/services/twilioService';


export async function sendSmsAction(to: string, message: string): Promise<{ success: boolean; error?: string }> {
  const appSettings = await getAppSettings();

  if (!appSettings?.smsServiceEnabled) {
    return { success: false, error: "SMS Service is currently disabled in settings." };
  }
  
  const providerPriority: ('Pushbullet' | 'SMSQ' | 'Twilio')[] = ['Pushbullet', 'SMSQ', 'Twilio'];
  const errorMessages: string[] = [];

  for (const provider of providerPriority) {
    try {
      console.log(`Attempting to send SMS via ${provider}...`);
      
      if (provider === 'Pushbullet') {
        if (appSettings.pushbulletAccessToken) {
          await sendSmsViaPushbullet(to, message, appSettings.pushbulletAccessToken, appSettings.pushbulletDeviceId);
          console.log(`SMS sent successfully via Pushbullet.`);
          return { success: true };
        }
      } else if (provider === 'SMSQ') {
        if (appSettings.smsqApiKey && appSettings.smsqClientId && appSettings.smsqSenderId) {
          await sendSmsViaSmsq(to, message, appSettings.smsqApiKey, appSettings.smsqClientId, appSettings.smsqSenderId);
          console.log(`SMS sent successfully via SMSQ.`);
          return { success: true };
        }
      } else if (provider === 'Twilio') {
        if (appSettings.twilioAccountSid && appSettings.twilioAuthToken && appSettings.twilioMessagingServiceSid) {
          await sendSmsViaTwilio(to, message, appSettings.twilioAccountSid, appSettings.twilioAuthToken, appSettings.twilioMessagingServiceSid);
          console.log(`SMS sent successfully via Twilio.`);
          return { success: true };
        }
      }
    } catch (error: any) {
      const errorMessage = `${provider}: ${error.message}`;
      errorMessages.push(errorMessage);
      console.warn(`Failed to send SMS via ${provider}. Trying next provider... Error: ${error.message}`);
    }
  }

  // If the loop completes, it means either no provider was configured or all configured providers failed.
  if (errorMessages.length > 0) {
    const combinedErrorMessage = `All configured SMS providers failed. Errors: [${errorMessages.join('; ')}]`;
    console.error(combinedErrorMessage);
    return { success: false, error: combinedErrorMessage };
  } else {
    const noProviderError = "No SMS provider is configured. Please configure at least one provider in settings.";
    console.error(noProviderError);
    return { success: false, error: noProviderError };
  }
}

