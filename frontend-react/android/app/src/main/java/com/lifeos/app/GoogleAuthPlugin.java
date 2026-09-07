package com.lifeos.app;

import android.os.CancellationSignal;
import androidx.core.content.ContextCompat;
import androidx.credentials.*;
import androidx.credentials.exceptions.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.*;

@CapacitorPlugin(name = "GoogleAuth")
public class GoogleAuthPlugin extends Plugin {
    private CancellationSignal pending;

    @PluginMethod public void signIn(PluginCall call) {
        String clientId = call.getString("clientId", "");
        if (clientId.isBlank()) { call.reject("Google sign-in is not configured."); return; }
        getActivity().runOnUiThread(() -> {
            if (pending != null) { call.reject("Google sign-in is already open."); return; }
            pending = new CancellationSignal();
            GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(new GetSignInWithGoogleOption.Builder(clientId).build()).build();
            CredentialManager.create(getContext()).getCredentialAsync(getActivity(), request, pending,
                ContextCompat.getMainExecutor(getContext()),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override public void onResult(GetCredentialResponse response) {
                        pending = null;
                        try {
                            Credential credential = response.getCredential();
                            if (!(credential instanceof CustomCredential) ||
                                !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                                call.reject("Google returned an unsupported sign-in response."); return;
                            }
                            GoogleIdTokenCredential token = GoogleIdTokenCredential.createFrom(credential.getData());
                            JSObject result = new JSObject();
                            result.put("credential", token.getIdToken());
                            call.resolve(result);
                        } catch (Exception error) { call.reject("Could not read the Google sign-in response.", error); }
                    }
                    @Override public void onError(GetCredentialException error) {
                        pending = null;
                        if (error instanceof GetCredentialCancellationException) {
                            call.reject("Google sign-in cancelled.", "CANCELLED");
                        } else {
                            call.reject("Google sign-in could not start. Check the Android OAuth client for com.lifeos.app and this APK's signing certificate in Google Cloud.", error);
                        }
                    }
                });
        });
    }

    @PluginMethod public void signOut(PluginCall call) {
        CredentialManager.create(getContext()).clearCredentialStateAsync(new ClearCredentialStateRequest(), null,
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override public void onResult(Void result) { call.resolve(); }
                @Override public void onError(ClearCredentialException error) { call.reject("Could not clear Google session.", error); }
            });
    }

    @Override protected void handleOnDestroy() {
        if (pending != null) pending.cancel();
    }
}
