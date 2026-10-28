# منصة خرائط محافظة دمشق الموحدة (Damascus Map Platform)

## تحديث مخطط البيانات

ترحيلات تطبيق `places` تبدأ بملف `0001_initial.py` واحد مطابق للنماذج الحالية، ومخصص لإنشاء قاعدة جديدة فارغة.
بعد حذف قاعدة البيانات القديمة وإعادة إنشائها، شغّل `python manage.py migrate` من مجلد `backend`. حذف السجلات فقط لا يكفي؛ يجب أن تكون الجداول وسجل الترحيلات قد أُعيد إنشاؤها أيضاً.
هذا الترحيل ينشئ البنية فقط ولا يضيف تصنيفات أو بيانات تجريبية تلقائياً.
لإضافة التصنيفات الرئيسية والفرعية من الملف المعتمد، شغّل `python manage.py seed_categories` بعد `migrate`. البيانات محفوظة في `backend/places/data/categories.json` (8 تصنيفات رئيسية و36 فرعياً). يمكن تكرار الأمر بدون تكرار السجلات؛ يحدّث الأسماء حسب الملف ويحافظ على العلاقات والبيانات الأخرى الموجودة.
أوامر الاستيراد تستخدم `title_ar` و`SubCategory` وعلاقة `BusRoute.bus`؛ الاستيراد الثقافي يتجاوز الأماكن التي لا يذكر المصدر إحداثياتها ويطبع تنبيهاً لكل منها.
تحافظ واجهة API على `title` و`contact` والقطاع `public` لتوافق الخريطة، وتعيد أيضاً قائمة `communication_info` الكاملة في تفاصيل المكان.

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

# SEED EVERYTHING:
python manage.py seed_admin_areas & python manage.py seed_categories & python manage.py seed_poi_rich_details & python manage.py seed_streets

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


للتواصل مع الداشبورد
python -m pip install django-cors-headers