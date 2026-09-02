package fr.ostryk.app;

import android.os.Bundle;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Android applique "force dark" au WebView quand le téléphone est en mode sombre système,
    // ce qui inverse le fond clair de l'app (--bg2) en fond sombre sans toucher au CSS — et rend
    // la barre de statut (icônes foncées, prévues pour un fond clair) illisible. On désactive
    // ce comportement pour que l'app garde toujours son propre thème clair.
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(getBridge().getWebView().getSettings(), false);
        } else if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
            WebSettingsCompat.setForceDark(getBridge().getWebView().getSettings(), WebSettingsCompat.FORCE_DARK_OFF);
        }
    }
}
