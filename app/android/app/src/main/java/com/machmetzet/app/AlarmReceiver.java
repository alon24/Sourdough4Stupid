package com.machmetzet.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import org.json.JSONObject;

/** Fires when an alarm is due: a loud notification with a full-screen alarm screen over the lock screen. */
public class AlarmReceiver extends BroadcastReceiver {
    static final String CHANNEL = "alarms";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String id = intent.getStringExtra("id");
        if (id == null) return;
        AlarmStore store = new AlarmStore(ctx);
        JSONObject a = store.get(id);
        String title = a == null ? "מחמצת לעד" : a.optString("title", "מחמצת לעד");
        String note = a == null ? "" : a.optString("note", "");

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "שעונים מעוררים", NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(sound, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[] {0, 600, 400, 600});
            ch.setBypassDnd(true);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent screen = new Intent(ctx, AlarmActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra("id", id).putExtra("title", title).putExtra("note", note);
        PendingIntent screenPi = PendingIntent.getActivity(ctx, id.hashCode(), screen, flags);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
        b.setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(note.isEmpty() ? "מחמצת לעד" : note)
                .setCategory(Notification.CATEGORY_ALARM)
                .setPriority(Notification.PRIORITY_MAX)
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(screenPi)
                .setFullScreenIntent(screenPi, true)
                .addAction(0, "נודניק 10", action(ctx, id, "snooze", 10, 1))
                .addAction(0, "בוצע", action(ctx, id, "done", 0, 2));
        if (Build.VERSION.SDK_INT < 26) {
            b.setSound(sound, AudioManagerStream.ALARM).setVibrate(new long[] {0, 600, 400, 600});
        }
        Notification n = b.build();
        n.flags |= Notification.FLAG_INSISTENT; // keep ringing until dismissed
        nm.notify(id.hashCode(), n);
    }

    private static PendingIntent action(Context ctx, String id, String action, int minutes, int slot) {
        Intent i = new Intent(ctx, ActionReceiver.class)
                .setAction("com.machmetzet.app." + action.toUpperCase())
                .putExtra("id", id).putExtra("action", action).putExtra("minutes", minutes);
        return PendingIntent.getBroadcast(ctx, id.hashCode() + slot, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** android.media.AudioManager.STREAM_ALARM, named for readability. */
    private static final class AudioManagerStream {
        static final int ALARM = android.media.AudioManager.STREAM_ALARM;
    }
}
