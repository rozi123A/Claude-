# 🚀 نشر على GitHub و Render

## ✅ تم تحضير المشروع!

المشروع الآن جاهز للنشر على GitHub بدون مشاكل.

---

## 📋 الخطوة 1: إعداد Git محلياً

```bash
cd adsgram-pro-app

# تهيئة Git
git init
git add .
git commit -m "Initial commit - Adsgram Pro App"
git branch -M main
```

---

## 📋 الخطوة 2: إنشاء مستودع على GitHub

1. اذهب إلى: https://github.com/new
2. أنشئ مستودع جديد باسم: `adsgram-pro`
3. **لا تختر**: Initialize with README (لأن لدينا ملفات بالفعل)
4. انسخ الأمر الذي يظهر

---

## 📋 الخطوة 3: رفع على GitHub

```bash
# استبدل YOUR_USERNAME بـ اسم المستخدم الخاص بك
git remote add origin https://github.com/YOUR_USERNAME/adsgram-pro.git
git push -u origin main
```

---

## 🎯 الخطوة 4: إعداد Render

### 4.1 إنشاء Web Service

1. اذهب إلى: https://dashboard.render.com
2. اختر: **New ➜ Web Service**
3. اختر: **Deploy an existing Git repository**
4. اختر مستودع: `adsgram-pro`

### 4.2 الإعدادات

```
Name: adsgram-pro
Environment: Node
Region: Choose closest to you
Branch: main
```

### 4.3 Build & Start Commands

```
Build Command: pnpm install && pnpm run build
Start Command: pnpm start
```

### 4.4 متغيرات البيئة

انقر على **Environment** وأضف:

```env
DATABASE_URL=mysql://root:AQdAADUhpvdHeaUpXvojHFvZOJJHxjDg@switchyard.proxy.rlwy.net:18411/railway
BOT_TOKEN=YOUR_BOT_TOKEN
ADMIN_CHAT_ID=YOUR_ADMIN_ID
ADMIN_KEY=YOUR_ADMIN_KEY
FRONTEND_URL=https://your-app.render.com
WEBAPP_URL=https://your-app.render.com
NODE_ENV=production
```

### 4.5 النشر

انقر على: **Create Web Service**

**الانتظار:** 5-10 دقائق للبناء والنشر

---

## ✅ بعد النشر الناجح

### 1. إنشاء الجداول

```bash
# استخدم SSH على Render أو:
curl https://your-app.render.com/api/system.health
```

### 2. تحديث Telegram Mini App

1. افتح @BotFather
2. اختر البوت الخاص بك
3. اختر: Edit Bot ➜ Edit Webapp URL
4. أدخل: `https://your-app.render.com`

### 3. اختبار

افتح البوت على Telegram واضغط على "فتح التطبيق"

---

## 🐛 استكشاف الأخطاء

### ❌ خطأ: "Build failed"

```bash
# تحقق محلياً
pnpm install
pnpm run build
```

### ❌ خطأ: "Cannot connect to database"

تحقق من `DATABASE_URL` في متغيرات البيئة

### ❌ خطأ: "Module not found"

```bash
rm -rf node_modules
pnpm install
```

---

## 📊 الملفات المعدلة

✅ `.env.example` - تم إضافة رابط Railway  
✅ `.gitignore` - تم إضافة `pnpm-lock.yaml`  
✅ `.gitattributes` - تم إنشاء لتجنب مشاكل الأسطر الجديدة  

---

## 🎉 تم!

المشروع الآن جاهز للنشر على GitHub و Render! 🚀
