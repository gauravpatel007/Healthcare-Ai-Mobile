package com.lifeos.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(MedicineRemindersPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
