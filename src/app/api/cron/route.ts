
import { NextResponse } from 'next/server';
import { checkAndSendReminders } from '@/services/reminderService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    
    // This secret key should be stored in environment variables for security
    const CRON_SECRET = process.env.CRON_SECRET || 'MY_SUPER_SECRET_CRON_KEY_123'; 

    if (key !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call the server-side function to check and send reminders
    const { sent, failed } = await checkAndSendReminders();
    
    return NextResponse.json({
      success: true,
      message: `Cron job completed. Sent: ${sent}, Failed: ${failed}.`,
      sent,
      failed,
    });
  } catch (error: any) {
    console.error('[CRON_JOB_ERROR]', error);
    return NextResponse.json(
      { success: false, error: `Cron job failed: ${error.message}` },
      { status: 500 }
    );
  }
}
