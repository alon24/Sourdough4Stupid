package com.machmetzet.app;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Full-screen alarm over the lock screen: title, time, snooze, +30 and done. */
public class AlarmActivity extends Activity {
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);

        final String id = getIntent().getStringExtra("id");
        String title = getIntent().getStringExtra("title");
        String note = getIntent().getStringExtra("note");
        float d = getResources().getDisplayMetrics().density;

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(Color.parseColor("#2B1D3A"));
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        root.setPadding((int) (24 * d), (int) (64 * d), (int) (24 * d), (int) (32 * d));

        TextView time = text(new SimpleDateFormat("HH:mm", Locale.US).format(new Date()), 80, "#FFFFFF", true);
        TextView t = text(title == null ? "" : title, 34, "#FFFFFF", true);
        TextView n = text(note == null ? "" : note, 17, "#E4DAF0", false);
        root.addView(time);
        root.addView(t, params(d, 24));
        root.addView(n, params(d, 12));

        View spacer = new View(this);
        root.addView(spacer, new LinearLayout.LayoutParams(1, 0, 1f));

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        row.addView(button("נודניק 10", false, d, id, "snooze", 10), weight(d));
        row.addView(button("+30 דק'", false, d, id, "delay", 30), weight(d));
        root.addView(row, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(button("בוצע", true, d, id, "done", 0), params(d, 12));

        setContentView(root);
    }

    private TextView text(String s, int sp, String color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(s);
        v.setTextSize(sp);
        v.setTextColor(Color.parseColor(color));
        v.setGravity(Gravity.CENTER);
        if (bold) v.setTypeface(Typeface.DEFAULT_BOLD);
        return v;
    }

    private LinearLayout.LayoutParams params(float d, int topDp) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = (int) (topDp * d);
        return p;
    }

    private LinearLayout.LayoutParams weight(float d) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, (int) (60 * d), 1f);
        p.setMargins((int) (4 * d), 0, (int) (4 * d), 0);
        return p;
    }

    private Button button(String label, boolean primary, float d, final String id, final String action, final int minutes) {
        Button b = new Button(this);
        b.setText(label);
        b.setTextSize(primary ? 24 : 16);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setAllCaps(false);
        b.setMinHeight((int) (primary ? 80 * d : 60 * d));
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(60 * d);
        if (primary) {
            g.setColor(Color.parseColor("#FFC93C"));
            b.setTextColor(Color.parseColor("#2B1D3A"));
        } else {
            g.setColor(Color.TRANSPARENT);
            g.setStroke((int) (2 * d), Color.parseColor("#FFF6E5"));
            b.setTextColor(Color.WHITE);
        }
        b.setBackground(g);
        b.setOnClickListener(v -> {
            if (id != null) AlarmActions.handle(this, id, action, minutes);
            finish();
        });
        return b;
    }
}
