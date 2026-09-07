package com.lifeos.app;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Private on-device recurrence and action journal. No network or JS timer required. */
public final class MedicineAlarmStore {
    static final String CHANNEL = "lifeos_medicines";
    static android.content.SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("medicine_reminders", Context.MODE_PRIVATE);
    }
    static JSONObject object(String text) {
        try { return new JSONObject(text); } catch (Exception e) { return new JSONObject(); }
    }
    static JSONArray array(String text) {
        try { return new JSONArray(text); } catch (Exception e) { return new JSONArray(); }
    }
    static void channel(Context c) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Medicine reminders", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Scheduled doses and refill reminders");
            ch.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
        }
    }
    static boolean allowed(Context c) {
        channel(c);
        boolean allowed = NotificationManagerCompat.from(c).areNotificationsEnabled();
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = c.getSystemService(NotificationManager.class).getNotificationChannel(CHANNEL);
            allowed &= ch.getImportance() != NotificationManager.IMPORTANCE_NONE;
        }
        return allowed;
    }
    static boolean exact(Context c) {
        return Build.VERSION.SDK_INT < 31 || c.getSystemService(AlarmManager.class).canScheduleExactAlarms();
    }
    static PendingIntent broadcast(Context c, String slot, JSONObject payload, String action) {
        Intent i = new Intent(c, MedicineAlarmReceiver.class).setAction(action)
            .setData(Uri.parse("lifeos-reminder://event/" + Uri.encode(slot)))
            .putExtra("payload", payload.toString());
        return PendingIntent.getBroadcast(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static void schedule(Context c, String slot, JSONObject payload, long at, JSONArray slots) {
        PendingIntent pi = broadcast(c, slot, payload, "DOSE");
        AlarmManager am = c.getSystemService(AlarmManager.class);
        try {
            if (exact(c)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
        slots.put(slot);
    }
    static void cancelAlarms(Context c) {
        JSONArray slots = array(prefs(c).getString("slots", "[]"));
        for (int i = 0; i < slots.length(); i++) {
            PendingIntent pi = broadcast(c, slots.optString(i), new JSONObject(), "DOSE");
            c.getSystemService(AlarmManager.class).cancel(pi);
            pi.cancel();
        }
        prefs(c).edit().putString("slots", "[]").apply();
    }
    static synchronized void clear(Context c) {
        cancelAlarms(c);
        NotificationManagerCompat.from(c).cancelAll();
        prefs(c).edit().clear().commit();
    }
    static synchronized void configure(Context c, JSONObject config) throws JSONException {
        JSONObject previous = object(prefs(c).getString("config", "{}"));
        if (!previous.optString("user_id").equals(config.optString("user_id"))) clear(c);
        if (!prefs(c).contains("activated")) prefs(c).edit().putLong("activated", System.currentTimeMillis()).apply();
        prefs(c).edit().putString("config", config.toString()).commit();
        reconcile(c);
        checkRefills(c);
    }
    static synchronized void reconcile(Context c) {
        cancelAlarms(c);
        JSONObject config = object(prefs(c).getString("config", "{}"));
        if (!config.optBoolean("enabled") || !allowed(c)) return;
        JSONArray slots = new JSONArray();
        prefs(c).edit().remove("schedule_error").apply();
        JSONObject states = object(prefs(c).getString("states", "{}"));
        JSONObject delivered = object(prefs(c).getString("delivered", "{}"));
        long now = System.currentTimeMillis();
        long activated = prefs(c).getLong("activated", now);
        try {
            ZoneId zone = ZoneId.of(config.getString("timezone"));
            LocalDate today = Instant.ofEpochMilli(now).atZone(zone).toLocalDate();
            JSONArray rules = config.optJSONArray("rules");
            if (rules == null) rules = new JSONArray();
            Set<String> validMedicines = new HashSet<>();
            for (int r = 0; r < rules.length(); r++) {
                JSONObject rule = rules.getJSONObject(r);
                String medId = rule.getString("id");
                validMedicines.add(medId);
                LocalDate start = LocalDate.parse(rule.getString("start_date"));
                LocalDate end = rule.isNull("end_date") ? null : LocalDate.parse(rule.getString("end_date"));
                JSONArray times = rule.getJSONArray("times");
                for (int t = 0; t < times.length(); t++) {
                    String clock = times.getString(t);
                    for (int offset = -1; offset <= 8; offset++) {
                        LocalDate day = today.plusDays(offset);
                        if (day.isBefore(start) || (end != null && day.isAfter(end))) continue;
                        if (rule.optString("frequency").equals("once_weekly") && ChronoUnit.DAYS.between(start, day) % 7 != 0) continue;
                        long due = day.atTime(LocalTime.parse(clock)).atZone(zone).toInstant().toEpochMilli();
                        if (due < activated || due < now - config.optInt("grace_minutes", 120) * 60000L) continue;
                        String key = medId + ":" + day + ":" + clock;
                        JSONObject state = states.optJSONObject(key);
                        if (state != null && !state.optString("status").equals("pending")) continue;
                        if (delivered.has(key)) continue;
                        JSONObject event = new JSONObject().put("dose_id", key).put("medicine_id", medId)
                            .put("name", rule.getString("name")).put("dosage", rule.optString("dosage"))
                            .put("user_id", config.getString("user_id")).put("scheduled_at", due);
                        schedule(c, "rule:" + medId + ":" + clock, event, Math.max(now + 1000, due), slots);
                        break;
                    }
                }
            }
            for (Iterator<String> it = states.keys(); it.hasNext();) {
                String key = it.next();
                JSONObject state = states.getJSONObject(key);
                if (!state.optString("status").equals("snoozed") || !validMedicines.contains(state.optString("medicine_id"))) continue;
                long due = state.optLong("snoozed_until");
                if (due < now - config.optInt("grace_minutes", 120) * 60000L) continue;
                if (delivered.optLong("snooze:" + key) == due) continue;
                JSONObject event = new JSONObject(state.toString()).put("dose_id", key).put("is_snooze", true);
                schedule(c, "snooze:" + key, event, Math.max(now + 1000, due), slots);
            }
            prefs(c).edit().putString("slots", slots.toString()).commit();
        } catch (Exception e) {
            android.util.Log.e("LifeOSReminders", "Unable to schedule medicine alarms", e);
            prefs(c).edit().putString("schedule_error", "Unable to schedule. Check medicine times and timezone.").apply();
        }
    }
    static synchronized void receive(Context c, Intent intent) {
        JSONObject event = object(intent.getStringExtra("payload"));
        JSONObject config = object(prefs(c).getString("config", "{}"));
        if (!event.optString("user_id").equals(config.optString("user_id")) || !config.optBoolean("enabled")) return;
        try {
            String action = intent.getAction();
            if (!"DOSE".equals(action)) {
                event.put("action_id", UUID.randomUUID().toString()).put("occurred_at", Instant.now().toString())
                    .put("status", "TAKEN".equals(action) ? "taken" : "SKIP".equals(action) ? "skipped" : "snoozed")
                    .put("minutes", 15);
                record(c, event);
                return;
            }
            JSONObject delivered = object(prefs(c).getString("delivered", "{}"));
            String key = event.getString("dose_id");
            if (event.optBoolean("is_snooze")) delivered.put("snooze:" + key, event.getLong("snoozed_until"));
            else delivered.put(key, System.currentTimeMillis());
            prefs(c).edit().putString("delivered", delivered.toString()).commit();
            long due = event.optBoolean("is_snooze") ? event.optLong("snoozed_until") : event.optLong("scheduled_at");
            if (System.currentTimeMillis() <= due + config.optInt("grace_minutes", 120) * 60000L) show(c, event, false);
            reconcile(c);
        } catch (Exception e) { android.util.Log.e("LifeOSReminders", "Reminder action failed", e); }
    }
    static synchronized void record(Context c, JSONObject event) throws JSONException {
        JSONObject config = object(prefs(c).getString("config", "{}"));
        if (!config.optString("user_id").equals(event.optString("user_id"))) throw new JSONException("Account mismatch");
        JSONObject states = object(prefs(c).getString("states", "{}"));
        String key = event.getString("dose_id");
        if (event.optString("status").equals("snoozed")) {
            event.put("snoozed_until", Instant.parse(event.getString("occurred_at")).toEpochMilli() + event.optInt("minutes", 15) * 60000L);
        }
        states.put(key, event);
        JSONArray queue = array(prefs(c).getString("queue", "[]"));
        queue.put(event);
        prefs(c).edit().putString("states", states.toString()).putString("queue", queue.toString()).commit();
        NotificationManagerCompat.from(c).cancel(key, 1);
        reconcile(c);
        checkRefills(c);
    }
    static synchronized void checkRefills(Context c) throws JSONException {
        JSONObject config = object(prefs(c).getString("config", "{}"));
        if (!config.optBoolean("enabled")) return;
        JSONArray stocks = config.optJSONArray("stocks");
        if (stocks == null) return;
        JSONObject notified = object(prefs(c).getString("refills", "{}"));
        JSONObject used = new JSONObject();
        JSONArray doses = config.optJSONArray("doses");
        if (doses != null) for (int i = 0; i < doses.length(); i++) {
            JSONObject dose = doses.getJSONObject(i); used.put(dose.getString("id"), dose.optInt("stock_used"));
        }
        JSONArray queue = array(prefs(c).getString("queue", "[]"));
        for (int m = 0; m < stocks.length(); m++) {
            JSONObject stock = stocks.getJSONObject(m);
            String medId = stock.getString("id");
            int remaining = stock.getInt("remaining");
            for (int i = 0; i < queue.length(); i++) {
                JSONObject a = queue.getJSONObject(i);
                if (!medId.equals(a.optString("medicine_id"))) continue;
                String key = a.getString("dose_id");
                int before = used.optInt(key);
                int after = a.optString("status").equals("taken") ? Math.min(stock.optInt("units_per_dose", 1), remaining + before) : 0;
                remaining += before - after; used.put(key, after);
            }
            if (remaining > stock.optInt("threshold", 5) || !stock.optBoolean("refill_enabled", true)) {
                notified.remove(medId); NotificationManagerCompat.from(c).cancel("refill:" + medId, 1);
            } else if (!notified.has(medId)) {
                show(c, new JSONObject().put("dose_id", "refill:" + medId).put("name", "Refill " + stock.getString("name"))
                    .put("dosage", remaining + " units remaining. Check your supply.").put("refill", true), false);
                notified.put(medId, true);
            }
        }
        prefs(c).edit().putString("refills", notified.toString()).commit();
    }
    static synchronized void acknowledge(Context c, JSONArray ids, JSONArray doses) throws JSONException {
        Set<String> done = new HashSet<>();
        for (int i = 0; i < ids.length(); i++) done.add(ids.getString(i));
        JSONArray queue = array(prefs(c).getString("queue", "[]")), kept = new JSONArray();
        Set<String> pending = new HashSet<>();
        for (int i = 0; i < queue.length(); i++) {
            JSONObject item = queue.getJSONObject(i);
            if (!done.contains(item.getString("action_id"))) { kept.put(item); pending.add(item.getString("dose_id")); }
        }
        JSONObject states = object(prefs(c).getString("states", "{}"));
        JSONObject config = object(prefs(c).getString("config", "{}"));
        for (int i = 0; i < doses.length(); i++) {
            JSONObject d = doses.getJSONObject(i);
            String key = d.getString("id"), status = d.getString("status");
            if (pending.contains(key)) continue;
            if (Arrays.asList("taken", "skipped", "snoozed", "cancelled").contains(status)) {
                d.put("dose_id", key).put("user_id", config.optString("user_id"));
                if (!d.isNull("snoozed_until")) d.put("snoozed_until", Instant.parse(d.getString("snoozed_until")).toEpochMilli());
                states.put(key, d);
                if (!status.equals("snoozed")) NotificationManagerCompat.from(c).cancel(key, 1);
            } else states.remove(key);
        }
        prefs(c).edit().putString("queue", kept.toString()).putString("states", states.toString()).commit();
        reconcile(c);
    }
    static void show(Context c, JSONObject event, boolean test) {
        channel(c);
        if (!allowed(c)) return;
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra("medicine_reminder", true);
        PendingIntent content = PendingIntent.getActivity(c, 71, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String key = event.optString("dose_id", "test");
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_medicine_notification).setContentTitle(test ? "LifeOS reminders are ready" : event.optString("name"))
            .setContentText(test ? "This is your medicine reminder test." : event.optString("dosage") + (event.optBoolean("refill") ? "" : " · Record your scheduled dose"))
            .setContentIntent(content).setAutoCancel(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPriority(NotificationCompat.PRIORITY_HIGH).setCategory(NotificationCompat.CATEGORY_REMINDER);
        if (!test && !event.optBoolean("refill")) {
            b.addAction(0, "Taken", broadcast(c, "taken:" + key, event, "TAKEN"));
            b.addAction(0, "Skip", broadcast(c, "skip:" + key, event, "SKIP"));
            b.addAction(0, "Snooze 15m", broadcast(c, "snooze-action:" + key, event, "SNOOZE"));
        }
        try { NotificationManagerCompat.from(c).notify(key, 1, b.build()); } catch (SecurityException ignored) {}
    }
}
