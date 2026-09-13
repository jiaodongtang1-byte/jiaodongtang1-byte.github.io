package com.explorationatlas.app;

import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * 把 APK 里的 assets/www 当作 https://atlas.local/ 提供。两个要点：
 *
 *   1. HTML 里注入定位桥（原生 GPS → navigator.geolocation），见 LocationShim。
 *   2. 媒体文件支持 Range：开场影片 20MB，WebView 的播放器要靠 206 才能正常播放与 seek。
 *      被 aapt 压缩过的资源（js/css）拿不到 fd，直接顺序返回即可。
 *
 * 用 https 这个伪造域名而不是 file://：页面于是处在安全上下文里，Service Worker、
 * localStorage、相机等功能的行为跟线上完全一致，网页代码不用为「本地版」写分支。
 */
class AssetServer {

    private static final String HOST = "atlas.local";
    private final AssetManager assets;
    private final String shim;

    AssetServer(AssetManager assets, String shim) {
        this.assets = assets;
        this.shim = shim;
    }

    WebResourceResponse handle(WebResourceRequest request) {
        Uri url = request.getUrl();
        if (url == null || !HOST.equals(url.getHost())) {
            return null;
        }
        String path = url.getPath();
        if (path == null || path.isEmpty() || "/".equals(path)) {
            path = "/index.html";
        }
        String assetPath = "www" + path;
        if (!exists(assetPath)) {
            if (looksLikeFile(path)) {
                return null;                       // 真的缺文件：别吞掉，按 404 处理
            }
            assetPath = "www/index.html";          // 其余当 SPA 路由回落
        }
        try {
            if (assetPath.endsWith(".html")) {
                return html(assetPath);
            }
            return content(assetPath, request.getRequestHeaders().get("Range"));
        } catch (IOException error) {
            return null;
        }
    }

    private WebResourceResponse html(String assetPath) throws IOException {
        String source = new String(readAll(assets.open(assetPath)), "UTF-8");
        byte[] bytes = source.replace("<head>", "<head><script>" + shim + "</script>").getBytes("UTF-8");
        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Length", String.valueOf(bytes.length));
        headers.put("Cache-Control", "no-store");
        return new WebResourceResponse("text/html", "utf-8", 200, "OK", headers, new ByteArrayInputStream(bytes));
    }

    private WebResourceResponse content(String assetPath, String range) throws IOException {
        String mime = mimeOf(assetPath);
        AssetFileDescriptor descriptor;
        try {
            descriptor = assets.openFd(assetPath);
        } catch (IOException compressed) {
            // 被 aapt 压缩过的资源（js/css 等）拿不到 fd，也就没有 Range 可谈
            return new WebResourceResponse(mime, null, assets.open(assetPath));
        }

        long total = descriptor.getLength();
        long start = 0;
        long end = total - 1;
        boolean partial = false;
        if (range != null && range.startsWith("bytes=")) {
            String spec = range.substring("bytes=".length()).split(",")[0].trim();
            int dash = spec.indexOf('-');
            try {
                if (dash > 0) {
                    start = Long.parseLong(spec.substring(0, dash));
                    if (dash + 1 < spec.length()) {
                        end = Long.parseLong(spec.substring(dash + 1));
                    }
                } else if (dash == 0 && spec.length() > 1) {
                    start = total - Long.parseLong(spec.substring(1));
                }
                if (start < 0) {
                    start = 0;
                }
                if (end >= total) {
                    end = total - 1;
                }
                partial = start <= end;
            } catch (NumberFormatException malformed) {
                partial = false;
            }
        }
        if (!partial) {
            start = 0;
            end = total - 1;
        }

        long length = end - start + 1;
        ParcelFileDescriptor file = descriptor.getParcelFileDescriptor().dup();
        descriptor.close();
        FileInputStream stream = new FileInputStream(file.getFileDescriptor());
        stream.getChannel().position(start);

        Map<String, String> headers = new HashMap<>();
        headers.put("Accept-Ranges", "bytes");
        headers.put("Content-Length", String.valueOf(length));
        if (partial) {
            headers.put("Content-Range", "bytes " + start + "-" + end + "/" + total);
        }
        return new WebResourceResponse(mime, null, partial ? 206 : 200,
                partial ? "Partial Content" : "OK", headers, new LimitedStream(stream, length));
    }

    private boolean exists(String assetPath) {
        try {
            assets.open(assetPath).close();
            return true;
        } catch (IOException missing) {
            return false;
        }
    }

    private static boolean looksLikeFile(String path) {
        int slash = path.lastIndexOf('/');
        return path.indexOf('.', slash) > slash;
    }

    private static byte[] readAll(InputStream stream) throws IOException {
        try (InputStream input = stream) {
            java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int read;
            while ((read = input.read(chunk)) > 0) {
                buffer.write(chunk, 0, read);
            }
            return buffer.toByteArray();
        }
    }

    private static String mimeOf(String assetPath) {
        String name = assetPath.toLowerCase(Locale.US);
        if (name.endsWith(".html")) return "text/html";
        if (name.endsWith(".js") || name.endsWith(".mjs")) return "text/javascript";
        if (name.endsWith(".css")) return "text/css";
        if (name.endsWith(".json")) return "application/json";
        if (name.endsWith(".webmanifest")) return "application/manifest+json";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        if (name.endsWith(".webp")) return "image/webp";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".mp4")) return "video/mp4";
        if (name.endsWith(".mp3")) return "audio/mpeg";
        if (name.endsWith(".woff2")) return "font/woff2";
        if (name.endsWith(".wasm")) return "application/wasm";
        if (name.endsWith(".task")) return "application/octet-stream";
        if (name.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    /** 只暴露前 limit 个字节，且随响应体关闭底层流。 */
    private static final class LimitedStream extends InputStream {
        private final InputStream inner;
        private long remaining;

        LimitedStream(InputStream inner, long limit) {
            this.inner = inner;
            this.remaining = limit;
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int value = inner.read();
            if (value >= 0) {
                remaining -= 1;
            }
            return value;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int allowed = (int) Math.min(length, remaining);
            int read = inner.read(buffer, offset, allowed);
            if (read > 0) {
                remaining -= read;
            }
            return read;
        }

        @Override
        public void close() throws IOException {
            inner.close();
        }
    }
}
