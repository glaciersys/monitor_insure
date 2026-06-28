// sw.js — Monitor Insure 28/06/69
// อัปเดตเลขเวอร์ชันนี้ทุกครั้งที่ deploy เพื่อบังคับให้ผู้ใช้ได้ไฟล์ใหม่
const CACHE_VERSION = 'monitor-insure-20260628-205703';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      return cache.addAll(APP_SHELL);
    })
    // หมายเหตุ: ไม่เรียก skipWaiting() ที่นี่แล้ว — รอให้หน้าเว็บส่งสัญญาณ
    // 'SKIP_WAITING' มาก่อน (ตอนผู้ใช้กดปุ่ม "อัปเดตเลย" ในแถบแจ้งเตือน)
    // เพื่อไม่ให้สลับเวอร์ชันแบบไม่ทันตั้งตัวระหว่างที่กำลังกรอกข้อมูลอยู่
  );
});

// รับสัญญาณจากหน้าเว็บให้ activate เวอร์ชันใหม่ทันที
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_VERSION; })
            .map(function(key) { return caches.delete(key); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // ข้าม request ที่ไม่ใช่ http/https (เช่น chrome-extension://) — Cache API ไม่รองรับ
  if (url.indexOf('http') !== 0) return;

  // อย่า cache คำขอไปยัง Firebase/Firestore/Storage — ให้ข้อมูลสดเสมอ
  if (url.indexOf('firestore.googleapis.com') !== -1 ||
      url.indexOf('firebasestorage.googleapis.com') !== -1 ||
      url.indexOf('firebaseapp.com') !== -1 ||
      url.indexOf('googleapis.com') !== -1) {
    return; // ปล่อยผ่านไป network ตามปกติ ไม่ intercept
  }

  // เฉพาะ GET request เท่านั้นที่ cache ได้
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var networkFetch = fetch(event.request).then(function(response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_VERSION).then(function(cache) {
            cache.put(event.request, clone).catch(function(err) {
              console.warn('Cache put skipped:', err);
            });
          });
        }
        return response;
      }).catch(function() {
        return cached; // ออฟไลน์: ใช้ของที่ cache ไว้
      });

      // cache-first สำหรับ app shell, แต่ยังอัปเดต cache เบื้องหลัง (stale-while-revalidate)
      return cached || networkFetch;
    })
  );
});
