package com.machmetzet.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Notification buttons: snooze and done. */
public class ActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String id = intent.getStringExtra("id");
        String action = intent.getStringExtra("action");
        if (id == null || action == null) return;
        AlarmActions.handle(ctx, id, action, intent.getIntExtra("minutes", 10));
    }
}
