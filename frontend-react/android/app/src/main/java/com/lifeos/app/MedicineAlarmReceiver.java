package com.lifeos.app;
import android.content.*;

public class MedicineAlarmReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (intent.hasExtra("payload")) MedicineAlarmStore.receive(context, intent);
        else MedicineAlarmStore.reconcile(context);
    }
}
