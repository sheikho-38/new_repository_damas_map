# تسليم منصة خريطة دمشق

لخطوات التشغيل التفصيلية وحالات الفشل والنشر، اقرأ `RUNBOOK.md`.

## المكونات والمتطلبات

| المجلد | الوظيفة |
| --- | --- |
| `backend/` | Django API، GeoDjango، وخدمات التوجيه من PostgreSQL |
| `frontend/` | خريطة المستخدمين بـ Next.js |
| `dashboard/` | لوحة الإدارة وتحرير خطوط الباص بـ React/Vite |
| `brouter/` | BRouter وبياناته لتحرير خطوط الباص، وملف MBTiles لخريطة اللوحة |

الإصدارات في النسخة المعتمدة: Python 3.11.9، Django 5.2.18، Next.js 16.4.2، React 19.3.0 في الواجهة، Node.js 22.17.1، Java 21، BRouter 1.7.10. قاعدة المصدر: PostgreSQL 18 مع PostGIS 3.6.2 وpgRouting 4.0.1؛ ثبّت الامتدادين وفعّلهما في القاعدة **قبل تشغيل migrations**. تبعيات Python في `backend/requirements.txt`، وتبعيات JavaScript في ملفي `package.json` داخل الواجهة واللوحة. يحتاج GeoDjango إلى GDAL وGEOS وPROJ متوافقة مع نظام التشغيل ومعمارية Python. على Windows يشير `backend/config/settings.py` افتراضيًا إلى `C:\Program Files\PostgreSQL\18\bin` لملفي `libgdal-35.dll` و`libgeos_c.dll`؛ غيّر `POSTGIS_DLL_DIR` إذا كان التثبيت في موضع آخر، وتأكد من إمكانية تحميل DLL وتبعياتها. على Linux يجب توفير المكتبات المشتركة ومساراتها للنظام.

## قاعدة البيانات وRouting Seed

ثبّت PostgreSQL 18 وPostGIS 3.6.2 وpgRouting 4.0.1. أنشئ قاعدة PostgreSQL فارغة وفعّل الامتدادين داخلها بصلاحية مناسبة، مع تثبيت PostGIS في schema `public`. يحتاج مستخدم Django إلى صلاحية `CREATE` على `public` عند إنشاء جداول التوجيه أول مرة؛ إذا لم يملك صلاحية إنشاء الامتدادات، فعّلها بحساب مدير قاعدة البيانات قبل `migrate`:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;
```

في جهاز المصدر، بعد إعداد Backend للاتصال بقاعدة `damascus_guide_db` الحالية، نفّذ يدويًا من `backend/`:

```bash
python manage.py export_routing_seed
```

يُنشئ الأمر `backend/places/seed_data/routing/manifest.json` وثمانية ملفات `*.copy.gz`: جداول التوجيه الستة و`buses` و`bus_routes` اللازمة للمواصلات. أضفها إلى Git مع `schema.sql` وMigration `0004` وأمري Django. التصدير لم يُنفّذ أثناء إعداد هذا التوثيق؛ لذلك ملفات البيانات وmanifest غير موجودة بعد. حجم جداول التوجيه الحالي مع فهارسها نحو 63 MiB؛ افحص أحجام الملفات المضغوطة بعد التصدير قبل رفعها إلى المستودع. لا تحتوي ملفات الـSeed على بيانات اتصال أو كلمات مرور، لكنها تحتوي بيانات Graph وخطوط الباص الفعلية.

على جهاز المطور الجديد، بعد ضبط متغيرات اتصال Backend بقاعدة فارغة وتفعيل الامتدادات، نفّذ من `backend/`:

```bash
python manage.py migrate
python manage.py seed_routing
```

تنشئ Migration `places.0004_routing_tables` جداول التوجيه الستة من `schema.sql` بعد التأكد من وجود الامتدادات؛ إذا كانت الجداول موجودة، تتحقق من بنيتها دون لمس بياناتها. يُنشئ Django جدولي `buses` و`bus_routes` عبر migrations السابقة. التراجع عن `0004` لا يحذف جداول Graph تلقائيًا؛ يلزم قرار إداري صريح لأي إزالة لاحقة. يرفض `seed_routing` غياب أي جدول ويستورد ملفات binary COPY المضغوطة فقط، بالترتيب الذي يحفظ العلاقات والمعرّفات وPostGIS وJSONB، ويضبط تسلسلات الهوية. يرفض الملفات ذات البصمات غير المطابقة والبيانات الجزئية أو المختلفة، ويتخطى الاستيراد إذا كانت البيانات مطابقة بالكامل. جميع عمليات الإدخال ضمن معاملة واحدة. لا تشغّل سكربتات بناء Graph من OSM. بيانات التطبيق الأخرى، مثل الأماكن، تحتاج مصادرها الخاصة إذا أردت نقلها كما هي.

بعد الاستيراد تحقق يدويًا باستعلامات قراءة: `SELECT count(*) FROM routing_nodes;` وهكذا لبقية الجداول. الأعداد في المصدر قبل التصدير: nodes ‏25,494، edges ‏63,445، boarding_points ‏0، turn_restrictions ‏76، car_states ‏53,518، car_transitions ‏140,999، buses ‏6، bus_routes ‏8 (منها 3 نشطة). يجب أن تطابق الأعداد manifest، ثم يمكن تشغيل Backend وطلبات السيارة والمشي والمواصلات عبر PostgreSQL.

## Backend

من `backend/` أنشئ بيئة Python مستقلة وثبّت `requirements.txt`:

```bash
# Git Bash على Windows:
py -3.11 -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt
# على Linux/WSL: python3.11 -m venv .venv ثم ./.venv/bin/python -m pip install -r requirements.txt
```

ثم اضبط متغيرات `USE_POSTGRES=true`, `DB_NAME`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` لتشير إلى القاعدة الجديدة. اضبط أيضًا `DJANGO_SECRET_KEY` بقيمة سرية جديدة، `DJANGO_DEBUG=False`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ALLOWED_ORIGINS`, `DJANGO_CSRF_TRUSTED_ORIGINS` لعناوين النشر. اضبط `POSTGIS_DLL_DIR` على Windows عند الحاجة. لا تنقل قيم الأسرار في ملف التوثيق أو في حزمة عامة.

للتشغيل المحلي بعد الإعداد: `python manage.py runserver 8001`. للنشر العام استخدم خادم WSGI مناسبًا مع reverse proxy وTLS وخدمة الملفات الثابتة و`backend/media/`؛ `runserver` للتطوير فقط. يخدم Django بلاطات MBTiles من `brouter/damascus_2026.mbtiles` وخطوط الخريطة من `frontend/public/fonts/` عبر API. اضبط `BROUTER_URL` إذا لم يكن BRouter على `http://localhost:17777`.

## Frontend ولوحة الإدارة

في `frontend/` نفّذ `npm ci`، واضبط `NEXT_PUBLIC_API_URL` ليكون عنوان API المنتهي بـ`/api`، ثم `npm run build` و`npm run start`، أو `npm run dev` محليًا. اضبط `NEXT_PUBLIC_BASE_PATH` إذا نُشرت الواجهة تحت مسار فرعي. متغيرات `NEXT_PUBLIC_*` تدخل في البناء، لذلك أعد البناء عند تغييرها. ملف `frontend/.env.local` الحالي يشير إلى `127.0.0.1:8001` وهو صالح للجهاز المحلي فقط.

في `dashboard/` اضبط `VITE_API_URL` ليكون عنوان API المنتهي بـ`/api`، ثم نفّذ `npm ci` و`npm run build` للنشر أو `npm run dev` محليًا. ضمّن `dashboard/package-lock.json` عند التسليم؛ الملف متتبع في Git حاليًا. ملف `dashboard/.env` الحالي محلي أيضًا؛ متغيرات `VITE_*` تدخل في البناء. ملفات الخطوط في `dashboard/public/fonts/` مطلوبة للخريطة. محرر خطوط الباص في Dashboard يطلب `/api/admin/routes/brouter-waypoints`، والـBackend يرسله إلى BRouter مباشرة؛ لذلك يلزم تشغيل BRouter عند تحرير الخطوط. من مجلد `brouter/`:

```bash
java -cp brouter-1.7.10-all.jar btools.server.RouteServer segments4 profiles2 customprofiles 17777 1
```

## فصل محركات التوجيه والتحقق اليدوي

تطلب الواجهة العامة `GET /api/routing/` مع `engine=database` لكل من `mode=car`, `mode=walk`, `mode=transit`، فتستخدم خدمات PostgreSQL. يبقى `ROUTING_ENGINE=brouter` افتراضيًا للطلبات الأخرى، ويمكن تركه دون ضبط. لا يتأثر مسار Dashboard المنفصل بهذا الاختيار. لا تحذف BRouter أو `segments4` أو `profiles2` أو ملفات JAR.

بعد تشغيل الخدمات، اختر نقاطًا **داخل نطاق شبكة دمشق** وجرّب الأنماط الثلاثة من الواجهة أو من `/api/routing/?start_lat=...&start_lon=...&end_lat=...&end_lon=...&mode=car&engine=database` مع استبدال الإحداثيات والنمط. تحقق من HTTP 200 و`route_geojson` والمسافة والمدة، ومن `route_legs` و`recommended_mode` في المواصلات. طلب المواصلات الأطول من 100 متر قد يعيد عدم توفر مسار إذا لم توجد رحلة باص صالحة، وهذا سلوك مقصود. لم تُشغّل هذه التجارب أثناء تجهيز التسليم.

## ملفات البيانات والقيود المعروفة

تتطلب الحزمة: كود المجلدات الثلاثة، ملفات `frontend/public/` ومنها `vector-tiles/` والخطوط، ملفات `dashboard/public/`، `brouter/damascus_2026.mbtiles` وJAR و`segments4/` و`profiles2/`، ومجلد `backend/media/` كاملًا، وملفات Routing Seed **بعد التصدير**. لا تحتاج ملفات استخراج OSM أو سكربتات بناء Graph للتشغيل بعد تحميل Seed. لا تنقل `.venv/`, `node_modules/`, `.next/` أو أسرار البيئة ضمن حزمة عامة.

المسارات المحلية التي تتطلب ضبطًا عند النقل: `POSTGIS_DLL_DIR` الافتراضي على Windows، و`frontend/.env.local` و`dashboard/.env` اللذان يشيران إلى `127.0.0.1:8001`، و`BROUTER_URL` الافتراضي المحلي. مسارا MBTiles وmedia في إعدادات Django نسبيان إلى المشروع. ملفات `dashboard/src/assets/style.json` تتضمن عناوين `127.0.0.1:8000` قديمة للبلاطات والخطوط؛ `dashboard/src/map/setup.ts` يستبدل عنوان البلاطات وقت التشغيل من `VITE_API_URL` ويضبط عنوان الخطوط على أصل Dashboard. تأكد من نشر خطوط `dashboard/public/fonts/`.

تعدد الباصات مدعوم برمجيًا، لكن التبديل بين خطوط مستقلة لم يتحقق تشغيليًا لعدم توفر عدد كافٍ من الخطوط النشطة في حالات التحقق السابقة. خدمة توجيه السيارات تطبق قيود الانعطاف المخزنة؛ جودة المسار تعتمد على اكتمال شبكة OSM وبيانات Seed المصدّرة. راجع إعدادات النشر والأسرار وملفات البيانات على الجهاز الهدف قبل التسليم النهائي.
