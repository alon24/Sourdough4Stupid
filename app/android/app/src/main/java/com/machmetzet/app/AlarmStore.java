package com.machmetzet.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** What the phone's alarm clock currently holds for us, plus actions taken on the alarm screen. */
final class AlarmStore {
    private static final String PREFS = "alarms";
    private static final String ALARMS = "alarms";
    private static final String EVENTS = "events";

    private final SharedPreferences prefs;

    AlarmStore(Context ctx) {
        prefs = ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private JSONObject load(String key) {
        try {
            return new JSONObject(prefs.getString(key, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    synchronized void put(String id, long at, String title, String note) {
        JSONObject all = load(ALARMS);
        try {
            all.put(id, new JSONObject().put("at", at).put("title", title).put("note", note == null ? "" : note));
        } catch (JSONException ignored) {
        }
        prefs.edit().putString(ALARMS, all.toString()).apply();
    }

    synchronized void remove(String id) {
        JSONObject all = load(ALARMS);
        all.remove(id);
        prefs.edit().putString(ALARMS, all.toString()).apply();
    }

    synchronized JSONObject get(String id) {
        return load(ALARMS).optJSONObject(id);
    }

    synchronized List<String> ids() {
        List<String> out = new ArrayList<>();
        JSONObject all = load(ALARMS);
        java.util.Iterator<String> it = all.keys();
        while (it.hasNext()) out.add(it.next());
        return out;
    }

    /** Remember an action (snooze, delay, done) for the web app to apply to its plan. */
    synchronized void addEvent(String id, String action, int minutes, long at) {
        JSONArray events;
        try {
            events = new JSONArray(prefs.getString(EVENTS, "[]"));
        } catch (JSONException e) {
            events = new JSONArray();
        }
        try {
            events.put(new JSONObject().put("id", id).put("action", action).put("minutes", minutes).put("at", at));
        } catch (JSONException ignored) {
        }
        prefs.edit().putString(EVENTS, events.toString()).apply();
    }

    synchronized JSONArray takeEvents() {
        JSONArray events;
        try {
            events = new JSONArray(prefs.getString(EVENTS, "[]"));
        } catch (JSONException e) {
            events = new JSONArray();
        }
        prefs.edit().putString(EVENTS, "[]").apply();
        return events;
    }
}
