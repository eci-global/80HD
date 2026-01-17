/**
 * API endpoint for sending push notifications.
 * 
 * This endpoint is called by Edge Functions or background jobs to send
 * notifications to users when escalations occur.
 */

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import webpush from 'web-push';

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@80hd.app';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export async function POST(request: Request) {
  try {
    // This endpoint should be protected - only service role can call it
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    // Verify the token matches the service role key
    const token = authHeader.replace('Bearer ', '');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error: Service role key not set' },
        { status: 500 }
      );
    }

    if (token !== serviceRoleKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid service role key. Only Edge Functions with SUPABASE_SERVICE_ROLE_KEY can send notifications.' },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();
    const { userId, title, body, url, tag, requireInteraction } = await request.json();

    if (!userId || !title || !body) {
      return NextResponse.json(
        { error: 'userId, title, and body are required' },
        { status: 400 }
      );
    }

    // Get user's push subscriptions
    const { data: subscriptions, error } = await supabase
      .from('notification_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to fetch subscriptions: ${error.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No subscriptions found for user',
        sent: 0,
      });
    }

    // Send notifications to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify({
            title,
            body,
            url: url || '/focus-pager',
            tag: tag || '80hd-escalation',
            requireInteraction: requireInteraction ?? true,
            data: {
              url: url || '/focus-pager',
            },
          })
        )
      )
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    // Remove failed subscriptions (likely expired)
    const failedSubscriptions = subscriptions.filter(
      (_, i) => results[i].status === 'rejected'
    );
    if (failedSubscriptions.length > 0) {
      await supabase
        .from('notification_subscriptions')
        .delete()
        .in(
          'endpoint',
          failedSubscriptions.map((s) => s.endpoint)
        );
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: subscriptions.length,
    });
  } catch (error) {
    console.error('Error sending notifications:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

