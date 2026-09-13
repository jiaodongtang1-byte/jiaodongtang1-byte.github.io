package com.explorationatlas.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * 生日探索地图的安卓壳：把打包好的网页放进 WebView，用系统原生定位喂坐标。
 *
 * 为什么要做这个壳：生日当天的手机是国行安卓（OPPO / 华为，都没有 Google 服务），
 * Chromium 系浏览器在安卓上的网页定位要经 Google Play 服务取位置，实测「权限 granted
 * 但一直超时」。壳里直接读系统 provider，再把坐标注入页面的 navigator.geolocation，
 * 于是不挑品牌、不挑有没有 GMS，也不需要现场有任何服务器。
 */
public class MainActivity extends Activity implements LocationListener {

    private static final String TAG = "ExplorationAtlas";
    private static final String START_URL = "https://" + "atlas.local/index.html";
    private static final int REQUEST_PERMISSIONS = 1;
    private static final int REQUEST_FILE = 2;

    private WebView webView;
    private LocationManager locationManager;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraOutputUri;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);          // 只作为回落：首选是下面的原生注入
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        WebView.setWebContentsDebuggingEnabled(true);  // 出问题时可以 chrome://inspect

        AssetServer server = new AssetServer(getAssets(), LocationShim.SOURCE);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse response = server.handle(request);
                return response != null ? response : super.shouldInterceptRequest(view, request);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                return startFileChoice(callback);
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                Log.i(TAG, message.message() + " @" + message.lineNumber());
                return true;
            }
        });

        webView.loadUrl(START_URL);
        requestAppPermissions();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (locationManager != null) {
            try {
                locationManager.removeUpdates(this);
            } catch (SecurityException ignored) {
                // 权限被撤销时无能为力，退出即可
            }
        }
        super.onDestroy();
    }

    // ---------------------------------------------------------------- 权限

    private void requestAppPermissions() {
        List<String> wanted = new ArrayList<>();
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            wanted.add(Manifest.permission.ACCESS_FINE_LOCATION);
            wanted.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            wanted.add(Manifest.permission.CAMERA);
        }
        if (wanted.isEmpty()) {
            startLocation();
            return;
        }
        requestPermissions(wanted.toArray(new String[0]), REQUEST_PERMISSIONS);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        if (requestCode != REQUEST_PERMISSIONS) {
            super.onRequestPermissionsResult(requestCode, permissions, results);
            return;
        }
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            startLocation();
        } else {
            Toast.makeText(this, "没有定位权限：雷达与靠近解锁用不了（长按指南针可用制图人暗门兜底）",
                    Toast.LENGTH_LONG).show();
        }
    }

    // ---------------------------------------------------------------- 原生定位

    private void startLocation() {
        if (locationManager == null) {
            locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        }
        if (locationManager == null) {
            return;
        }
        boolean gpsOn = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
        if (!gpsOn) {
            Toast.makeText(this, "手机的定位开关没打开：到「设置 → 定位」打开后再回到 App", Toast.LENGTH_LONG).show();
        }
        try {
            if (gpsOn) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 1f, this,
                        Looper.getMainLooper());
            }
            for (String provider : locationManager.getProviders(true)) {
                if (!LocationManager.GPS_PROVIDER.equals(provider)) {
                    locationManager.requestLocationUpdates(provider, 2000L, 3f, this, Looper.getMainLooper());
                }
            }
        } catch (SecurityException denied) {
            Log.w(TAG, "定位权限不可用: " + denied.getMessage());
        }
        Location last = null;
        try {
            last = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
        } catch (SecurityException ignored) {
            // 没权限就没有最后已知位置
        }
        if (last != null) {
            onLocationChanged(last);
        }
    }

    @Override
    public void onLocationChanged(Location location) {
        if (webView == null || location == null) {
            return;
        }
        // 一定要用 Locale.US：某些区域设置会把小数写成逗号，注入的 JS 直接语法错误
        String script = String.format(Locale.US,
                "window.__atlasNativeFix && window.__atlasNativeFix(%.6f, %.6f, %.1f, %d, %s, %s);",
                location.getLatitude(),
                location.getLongitude(),
                location.hasAccuracy() ? location.getAccuracy() : 999.0f,
                location.getTime(),
                location.hasBearing() ? String.format(Locale.US, "%.1f", location.getBearing()) : "undefined",
                location.hasSpeed() ? String.format(Locale.US, "%.1f", location.getSpeed()) : "undefined");
        webView.evaluateJavascript(script, null);
    }

    // ---------------------------------------------------------------- 拍照 / 选图

    private boolean startFileChoice(ValueCallback<Uri[]> callback) {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
        }
        fileCallback = callback;
        cameraOutputUri = null;

        Intent gallery = new Intent(Intent.ACTION_GET_CONTENT);
        gallery.addCategory(Intent.CATEGORY_OPENABLE);
        gallery.setType("image/*");

        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (camera.resolveActivity(getPackageManager()) != null) {
            try {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, "atlas-" + System.currentTimeMillis() + ".jpg");
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                cameraOutputUri = getContentResolver()
                        .insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraOutputUri);
            } catch (Exception noStore) {
                camera = null;
                cameraOutputUri = null;
            }
        } else {
            camera = null;
        }

        Intent chooser = Intent.createChooser(gallery, "拍一张复刻照片 · 或从相册选择");
        if (camera != null) {
            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
        }
        try {
            startActivityForResult(chooser, REQUEST_FILE);
            return true;
        } catch (ActivityNotFoundException missing) {
            fileCallback = null;
            callback.onReceiveValue(null);
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQUEST_FILE) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        Uri[] result = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getData() != null) {
                result = new Uri[]{data.getData()};
            } else if (cameraOutputUri != null) {
                result = new Uri[]{cameraOutputUri};
            }
        }
        if (fileCallback != null) {
            fileCallback.onReceiveValue(result);
            fileCallback = null;
        }
    }
}
