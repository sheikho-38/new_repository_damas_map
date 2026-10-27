# منصة خرائط محافظة دمشق الموحدة (Damascus Map Platform)

مشروع سيادي متكامل لنظام خرائط دمشق التفاعلي (Offline-First & Open-Source):
- **الواجهة الأمامية (Frontend)**: مبنية باستخدام Next.js (App Router) + TypeScript + Tailwind CSS v4 + MapLibre GL.
- **الخريطة المتجهة المعتمدة**: خريطة متجهات محلية 100% (Vector PBF Tiles) فائقة الدقة، نقية وخالية تماماً من المحلات والدكاكين والمطاعم العشوائية والإعلانات، ومقتصرة على:
  - شبكة الشوارع والأوتوسترادات والأزقة الرسمية.
  - الساحات والجادات العامة ونهر بردى وفروعه.
  - المعالم الكبرى التاريخية والدينية (كالجامع الأموي، قلعة دمشق، التكية السليمانية).
  - الأبنية والكتل المعمارية.
- **الباكيند (Backend)**: مبني باستخدام Django + Django REST Framework، يدعم العمل المباشر عبر SQLite محلياً (مع قاعدة بيانات جاهزة تحوي 2,886 منشأة و114 حياً و42 خط باص)، أو عبر PostgreSQL للإنتاج الموسع.
- **محرك التوجيه (Multi-modal Routing)**: يدعم التنقل بالسيارة، مشياً على الأقدام، وشبكة سرافيس وباصات النقل الداخلي لدمشق (خطوات المشي، الركوب، التعرفة الرسمية، النزول).

---

## 🚀 التشغيل السريع (macOS / Linux / Windows)

### 1. تشغيل الباكيند (Django Backend)

من المجلد الرئيسي للمشروع:

```bash
cd backend

# إنشاء وتفعيل البيئة الافتراضية
python3 -m venv venv
# لنظام macOS / Linux:
source venv/bin/activate
# لنظام Windows (PowerShell):
# .\venv\Scripts\Activate.ps1

# تثبيت المتطلبات
pip install -r requirements.txt

# تطبيق ترحيلات قاعدة البيانات
python manage.py migrate

# استيراد الحدود والتقسيمات الإدارية الرسمية لدمشق (16 بلدية و 98 حي)
python manage.py seed_admin_areas

# إنشاء حساب المدير (لإدارة التصنيفات والمنشآت من لوحة التحكم /admin/)
python manage.py createsuperuser

# تشغيل خادم التطوير
python manage.py runserver 8000
```

- رابط فحص الـ API: `http://localhost:8000/api/health/`
- تصنيفات المنشآت: `http://localhost:8000/api/categories/`
- نقاط الخريطة (GeoJSON): `http://localhost:8000/api/places/geojson/`
- التقسيمات الإدارية: `http://localhost:8000/api/admin-areas/`
- شبكة المواصلات: `http://localhost:8000/api/transit/lines/`

---

### 2. تشغيل الواجهة الأمامية (Next.js Frontend)

من مجلد الواجهة:

```bash
cd frontend

# تثبيت الحزم
npm install

# تشغيل خادم التطوير
npm run dev
```

- رابط الخريطة الرئيسي: `http://localhost:3000/` أو `http://localhost:3000/viewer`
- الخريطة تعمل **محلياً 100% Offline** بدون الحاجة لأي اتصال خارجي.
