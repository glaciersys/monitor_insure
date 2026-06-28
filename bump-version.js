#!/usr/bin/env node
// bump-version.js — รันอัตโนมัติก่อน "firebase deploy" ทุกครั้ง (ผ่าน predeploy hook ใน firebase.json)
// หน้าที่: เปลี่ยนค่า CACHE_VERSION ใน sw.js ให้เป็นค่าใหม่เสมอ
// เพื่อบังคับให้ browser เจอว่า sw.js "เปลี่ยน" แล้วโชว์ banner "อัปเดตเลย" ให้ผู้ใช้ทุกครั้งที่มีการ deploy จริง
// (ไม่ต้องแก้ sw.js ด้วยมือเองอีกต่อไป)

const fs = require('fs');

// หาไฟล์ sw.js อัตโนมัติจากตำแหน่งที่โปรเจกต์ Firebase Hosting มักเก็บไว้
// ถ้าโปรเจกต์ของคุณเก็บ sw.js ไว้ที่อื่น ให้เพิ่ม path นั้นต่อท้าย array นี้ได้เลย
const candidates = [
  'sw.js',
  'public/sw.js',
  'dist/sw.js',
  'build/sw.js',
  'www/sw.js'
];

let swPath = null;
for (const c of candidates) {
  if (fs.existsSync(c)) { swPath = c; break; }
}

if (!swPath) {
  console.error('❌ bump-version.js: หา sw.js ไม่เจอในตำแหน่งที่ลองไว้: ' + candidates.join(', '));
  console.error('   แก้ path ใน candidates array ของไฟล์นี้ให้ตรงกับโปรเจกต์ของคุณ');
  process.exit(1); // ทำให้ deploy หยุด ป้องกัน deploy โดยไม่ bump เวอร์ชันแบบไม่รู้ตัว
}

const now = new Date();
const stamp = now.getFullYear().toString()
  + String(now.getMonth() + 1).padStart(2, '0')
  + String(now.getDate()).padStart(2, '0')
  + '-' + String(now.getHours()).padStart(2, '0')
  + String(now.getMinutes()).padStart(2, '0')
  + String(now.getSeconds()).padStart(2, '0');

const content = fs.readFileSync(swPath, 'utf8');
const newContent = content.replace(
  /const CACHE_VERSION\s*=\s*'[^']*'/,
  `const CACHE_VERSION = 'monitor-insure-${stamp}'`
);

if (newContent === content) {
  console.error('❌ bump-version.js: ไม่พบ "const CACHE_VERSION = \'...\'" ใน ' + swPath + ' (รูปแบบในไฟล์อาจถูกแก้ไป) — ไม่ได้แก้ไขอะไร');
  process.exit(1); // ทำให้ deploy หยุด เพื่อให้รู้ตัวว่าต้องไปเช็ค sw.js
}

fs.writeFileSync(swPath, newContent, 'utf8');
console.log('✅ bump CACHE_VERSION ใน ' + swPath + ' เป็น monitor-insure-' + stamp);
