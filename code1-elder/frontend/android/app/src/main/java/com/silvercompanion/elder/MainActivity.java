package com.silvercompanion.elder;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() == null || getBridge().getWebView() == null) {
                    moveTaskToBack(true);
                    return;
                }
                getBridge().getWebView().evaluateJavascript(
                    "window.dispatchEvent(new Event('elder-back', {cancelable:true}))",
                    result -> {
                        // Vue prevents the event when it closes a dialog or navigates back.
                        if (!"false".equals(result)) moveTaskToBack(true);
                    }
                );
            }
        });
    }
}
