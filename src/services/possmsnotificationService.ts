
'use server';

import { Party, Transaction, AppSettings } from '@/types';
import { getAppSettings } from './settingsService';
import { formatAmount, formatDate } from '@/lib/utils';
import { format as formatFns, parseISO, parse, isValid } from 'date-fns';
import { sendSmsViaSmsq } from './smsqService';
import { sendSmsViaTwilio } from './twilioService';
import { sendSmsViaPushbullet } from './pushbulletService';
import { getPartyBalanceEffect } from '@/lib/utils';
import { db } from '@/lib/firebase';

export async function handleSmsNotification(
    transaction: Transaction,
    party: Party,
    paidAmount: number = 0,
    previousDue: number
) {
    if (!party.phone || !db) return;

    try {
        const appSettings = await getAppSettings();
        if (!appSettings?.smsServiceEnabled || !Array.isArray(appSettings.smsTemplates)) return;
        
        let templateType: 'cashSale' | 'creditSale' | 'receivePayment' | 'givePayment' | 'creditSaleWithPartPayment' | undefined;
        
        switch (transaction.type) {
            case 'sale':
                templateType = 'cashSale';
                break;
            case 'credit_sale':
                templateType = paidAmount > 0 ? 'creditSaleWithPartPayment' : 'creditSale';
                break;
            case 'receive':
                templateType = 'receivePayment';
                break;
            case 'give':
            case 'spent':
                templateType = 'givePayment';
                break;
        }
        
        if (!templateType) return;

        let template = appSettings.smsTemplates.find(t => t.type === templateType);

        if (!template && templateType === 'creditSaleWithPartPayment') {
            console.warn("Template 'creditSaleWithPartPayment' not found, falling back to 'creditSale'");
            template = appSettings.smsTemplates.find(t => t.type === 'creditSale');
        }

        if (!template || !template.message) {
            console.warn(`No SMS template found for type: ${templateType}`);
            return;
        }
        
        // This is where the balance calculation was wrong.
        // It needs to account for the new transaction's effect on the balance.
        let currentBalance;
        if (transaction.type === 'credit_sale') {
            currentBalance = previousDue - transaction.amount + paidAmount;
        } else {
             currentBalance = previousDue + getPartyBalanceEffect(transaction, false);
        }

        const businessName = appSettings.businessProfiles.find(p => p.name === transaction.via)?.name || appSettings.businessProfiles[0]?.name || 'our company';
        
        // Updated to show only signs (+/-) without text
        const partyBalanceText = (balance: number) => {
            if (balance > 0.01) return `+${formatAmount(balance, false)}`; 
            if (balance < -0.01) return `-${formatAmount(Math.abs(balance), false)}`; 
            return formatAmount(0, false);
        };

        const previousBalanceStr = partyBalanceText(previousDue);
        const currentBalanceStr = partyBalanceText(currentBalance);
        
        const safeFormatDate = (dateStr: string) => {
            try {
                if (!dateStr) return '';
                const isoDate = parseISO(dateStr);
                if (isValid(isoDate)) return formatFns(isoDate, "dd/MM/yyyy");
                const parsedDate = parse(dateStr, 'yyyy-MM-dd', new Date());
                if (isValid(parsedDate)) return formatFns(parsedDate, "dd/MM/yyyy");
                return dateStr;
            } catch (e) {
                return dateStr;
            }
        };

        const paymentAmountForSms = transaction.type === 'receive' ? transaction.amount : paidAmount;

        let message = template.message
            .replace(/{partyName}/g, party.name)
            .replace(/{amount}/g, formatAmount(transaction.amount, false))
            .replace(/{billAmount}/g, formatAmount(transaction.amount, false))
            .replace(/{date}/g, safeFormatDate(transaction.date))
            .replace(/{businessName}/g, businessName)
            .replace(/{invoiceNumber}/g, transaction.invoiceNumber?.replace('INV-', '') || '')
            .replace(/{invoiceNo}/g, transaction.invoiceNumber?.replace('INV-', '') || '')
            .replace(/{previousDue}/g, previousBalanceStr)
            .replace(/{currentBalance}/g, currentBalanceStr)
            .replace(/{PartPaymentAmount}/g, formatAmount(paymentAmountForSms, false))
            .replace(/{paidAmount}/g, formatAmount(paymentAmountForSms, false));

        const smsProvider = appSettings.smsProvider || 'twilio';
        
        if (smsProvider === 'smsq' && appSettings.smsqApiKey && appSettings.smsqClientId && appSettings.smsqSenderId) {
            await sendSmsViaSmsq(party.phone!, message, appSettings.smsqApiKey, appSettings.smsqClientId, appSettings.smsqSenderId);
        } else if (smsProvider === 'twilio' && appSettings.twilioAccountSid && appSettings.twilioAuthToken && appSettings.twilioMessagingServiceSid) {
            await sendSmsViaTwilio(party.phone!, message, appSettings.twilioAccountSid, appSettings.twilioAuthToken, appSettings.twilioMessagingServiceSid);
        } else if (smsProvider === 'pushbullet' && appSettings.pushbulletAccessToken) {
            await sendSmsViaPushbullet(party.phone!, message, appSettings.pushbulletAccessToken, appSettings.pushbulletDeviceId);
        } else {
             console.warn("SMS provider not configured or credentials missing.");
        }
        
    } catch (err) {
        console.warn(`Could not prepare SMS for transaction. Error: `, err);
    }
}
