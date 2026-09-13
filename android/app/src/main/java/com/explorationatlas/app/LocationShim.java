package com.explorationatlas.app;

/**
 * 注入到页面 <head> 的一段 JS：把 navigator.geolocation 接到壳里读到的原生定位上。
 *
 * 为什么要这么做：安卓上 Chromium 系浏览器（Chrome/Edge）的网页定位要经过 Google
 * Play 服务取位置，国内机型没有 GMS，于是「权限给得了、位置拿不到」（实测：授权
 * granted + watchPosition 一直超时）。壳里用系统原生 provider 读 GPS 完全绕开这条
 * 链路，把坐标直接喂给页面，网页代码一行都不用改。
 *
 * 原生 4 秒内没给点就回落到浏览器自带的实现（有 GMS 的机器上也能用）。
 */
class LocationShim {

    static final String SOURCE = """
        (function () {
          if (!navigator.geolocation) { return; }
          var geo = navigator.geolocation;
          var origWatch = geo.watchPosition.bind(geo);
          var origClear = geo.clearWatch.bind(geo);
          var watchers = {};
          var seq = 0;
          var lastFix = null;
          var nativeSeen = false;
          var fellBack = false;

          window.__atlasNativeFix = function (lat, lon, acc, ts, heading, speed) {
            nativeSeen = true;
            lastFix = {
              coords: {
                latitude: lat,
                longitude: lon,
                accuracy: acc,
                altitude: null,
                altitudeAccuracy: null,
                heading: (typeof heading === "number" && isFinite(heading)) ? heading : null,
                speed: (typeof speed === "number" && isFinite(speed)) ? speed : null
              },
              timestamp: ts || Date.now()
            };
            for (var id in watchers) {
              if (Object.prototype.hasOwnProperty.call(watchers, id)) {
                try { watchers[id].success(lastFix); } catch (e) { }
              }
            }
          };

          function fallbackOnce(success, error, options) {
            if (nativeSeen || fellBack) { return; }
            setTimeout(function () {
              if (nativeSeen) { return; }
              fellBack = true;
              try {
                origWatch(success, function (failure) {
                  if (nativeSeen) { return; }
                  error(failure);
                }, options);
              } catch (e) { }
            }, 4000);
          }

          geo.watchPosition = function (success, error, options) {
            seq += 1;
            var id = "native-" + seq;
            watchers[id] = { success: success, error: error };
            if (lastFix) { try { success(lastFix); } catch (e) { } }
            fallbackOnce(success, error, options);
            return id;
          };

          geo.getCurrentPosition = function (success, error, options) {
            if (lastFix) { try { success(lastFix); } catch (e) { } return; }
            var id = geo.watchPosition(success, error, options);
            setTimeout(function () { geo.clearWatch(id); }, 15000);
          };

          geo.clearWatch = function (id) {
            if (watchers[id]) { delete watchers[id]; return; }
            try { origClear(id); } catch (e) { }
          };
        })();
        """;
}
