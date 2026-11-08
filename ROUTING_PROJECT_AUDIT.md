# تدقيق مشروع خريطة دمشق استعدادًا للتوجيه بالسيارة

تاريخ الفحص: 2026-11-08. هذا تقرير قراءة وتحليل فقط. المسارات أدناه نسبية إلى جذر المستودع. نتائج قاعدة البيانات تخص ملف `backend/db.sqlite3` المرفق وحده؛ إعداد التشغيل الافتراضي يشير إلى PostgreSQL، ولم يُفحص خادمه. لا تُعدّ تعليقات الكود أو وصف README إثباتًا لوجود بيانات قابلة للتوجيه.

## 1. Executive Summary

المشروع منصة خريطة دمشق تفاعلية ذات واجهة عامة Next.js ولوحة إدارة React/Vite وواجهة Django. الخريطة الأساسية تُعرض من بلاطات PBF متجهة محلية؛ أسماء الطرق تأتي من جدول `Street` عبر GeoJSON، والحدود والأماكن من API وقيم محلية احتياطية. توجد ملفات BRouter وشبكة `.rd5` وبروفايل سيارات، ويستخدمها **محرر خطوط النقل في لوحة الإدارة** لطلب هندسة طريق بين نقاط. أما `/api/routing/?mode=car` الذي تستخدمه الواجهة العامة فيصنع خطًا بخمس نقاط ومسافة وزمنًا تقديريين من المسافة المستقيمة؛ ليس توجيهًا حقيقيًا على الشوارع. [الدليل: `frontend/src/components/MapViewer.tsx:803-816`، `frontend/src/lib/database-map-style.ts:3-20`، `backend/buses/views.py:165-238`، `backend/places/views.py:741-792`].

لا يوجد ملف `.osm.pbf` أصلي في الملفات المفحوصة. تشير metadata داخل `brouter/damascus_2026.mbtiles` إلى OpenMapTiles وحقوق OSM وتحديثات Geofabrik Syria، لكن مصدر ملف الشوارع GeoJSON وسلسلة توليده **غير مؤكدين**. ملف MBTiles وملفات البلاطات ليست مصدرًا مناسبًا بذاتها لبناء شبكة توجيه كاملة؛ شبكة BRouter `.rd5` قد تسمح بتجربة عملية أسرع بعد اختبارها، بينما يحتاج OSRM أو Valhalla إلى مقتطف OSM أصلي موثوق، ويحتاج pgRouting إلى بناء شبكة موجّهة جديدة. التوصية الأولية: اختبار BRouter الموجود لمسارات سيارة حقيقية في دمشق أولًا، مع الحصول على مقتطف OSM موثّق قبل اختيار محرك طويل الأمد. [الدليل: فحص أسماء الملفات، metadata للـ MBTiles، `brouter/profiles2/car-eco.brf:14,110`].

## 2. Project Architecture

```text
frontend/                 Next.js 16.4.2 + React 19.3 + TypeScript + MapLibre GL 6.15
  src/components/MapViewer.tsx       إنشاء الخريطة وطبقات الحدود والأماكن والمسار
  src/components/RoutingPanel.tsx    طلب /api/routing/ وعرض النتيجة
  src/components/UserLocationButton.tsx  إظهار وتتبع موقع المستخدم على الخريطة
  src/lib/database-map-style.ts      استبدال تسميات الطرق فقط ببيانات Street
  public/damascus-*-style.json       أنماط الخريطة
  public/vector-tiles/               بلاطات PBF محلية
  public/data/                       GeoJSON للطرق والحدود والمعالم
dashboard/                React + Vite + MapLibre، لإدارة الأماكن وخطوط النقل
  src/hooks/useRouteEditor.ts        نقاط محرر خطوط الباص وطلب BRouter
  src/map/setup.ts                   خريطة الإدارة من API البلاطات
backend/                  Django 5.2.18 + DRF 3.18.3
  config/settings.py                 اختيار PostgreSQL/SQLite ومسار MBTiles
  config/urls.py                     تركيب /api/
  places/models.py                   AdminArea وStreet وPlace وBus وغيرها
  places/views.py                    API الخريطة و«التوجيه» العام
  places/tile_views.py               قراءة MBTiles للعرض
  buses/views.py                     طلب BRouter وحفظ هندسة خطوط النقل
  data/                            GeoJSON الشوارع والحدود
  db.sqlite3                       نسخة قاعدة بيانات SQLite مرفقة
brouter/                 ملفات MBTiles وJAR وملفات .rd5 وبروفايلات
```

المكتبات والإصدارات موثّقة في `frontend/package.json` و`dashboard/package.json` و`backend/requirements.txt`. يختار `backend/config/settings.py:99-117` PostgreSQL افتراضيًا عبر `USE_POSTGRES=true`، أو SQLite عند تعطيله. `psycopg` موجود في المتطلبات، ولا تظهر `django.contrib.gis` أو `GeometryField` في النماذج المفحوصة؛ **وجود PostgreSQL/PostGIS وإصدارهما في بيئة التشغيل غير مؤكد**. لا تظهر ملفات Docker Compose في المستودع، وتذكر `README.md:106-112` تشغيل BRouter بأمر Java مستقل؛ `start.sh` و`Damascus_Map_Platform_Run_Guide.md` ملفات تشغيل. الواجهة العامة تتصل بـ `/api/` من خلال `frontend/src/lib/api-config.ts`؛ لوحة الإدارة تستخدم `dashboard/src/api.ts` و`dashboard/src/config.ts`. [الدليل: `backend/config/settings.py:48-60,99-117`، `backend/config/urls.py:35-39`، `frontend/src/components/RoutingPanel.tsx:71-80`، `dashboard/src/api.ts:35-49`].

## 3. Actual Map Data Source

الخريطة الأساسية في الواجهة العامة ليست طلبًا حيًا لطرق من OSM: `MapViewer` يحمّل `damascus-clean-style.json` ثم يحوّل مصدر `openmaptiles` إلى `/vector-tiles/{z}/{x}/{y}.pbf`. نمط العرض يحوي طبقات `transportation` للطرق و`building` للمباني. `useDatabaseMapData` يضيف `/api/streets/geojson/` ويحوّل طبقات `transportation_name` إلى الشوارع من قاعدة البيانات، ويحذف طبقة `boundary` الأصلية؛ الحدود الإدارية تُحمّل من `/api/admin-areas/` مع احتياطي `public/data/damascus_admin_areas.geojson`، والأماكن من `/api/places/geojson/`. لوحة الإدارة تستخدم `/api/tiles/damascus/{z}/{x}/{y}` الذي يقرأ `brouter/damascus_2026.mbtiles` قراءة SQLite فقط ويحوّل Y إلى TMS. [الدليل: `frontend/src/components/MapViewer.tsx:149-174,484-529,803-812,844-848`، `frontend/src/lib/database-map-style.ts:3-20`، `dashboard/src/map/setup.ts:20-28`، `backend/places/tile_views.py:12-45`، `backend/config/settings.py:20`].

فحص metadata في MBTiles للقراءة فقط: `name=OpenMapTiles`، `format=pbf`، `minzoom=0`، `maxzoom=14`، `bounds=35.9,33.2,36.65,33.85`، `center=36.275,33.525,9`، 1,649 بلاطة، طبقات متجهة منها `transportation` و`transportation_name` و`building` و`boundary`. تسجل `planetiler:version=0.10.2` و`planetiler:osm:osmosisreplicationurl=https://download.geofabrik.de/asia/syria-updates` ووقت replication `2026-10-12T20:21:35Z`. هذا **دليل قوي على اشتقاق البلاطات من OSM**، لكنه لا يحدد ملف الإدخال الأصلي أو تاريخ توليد ملف `backend/data/damascus_streets.geojson`، ولا يثبت أن البلاطات المحلية المنفصلة مطابقة تمامًا لـ MBTiles. `backend/data/admin_boundary_corrections.json:3-4` و`تقرير_تصحيح_الحدود_وفق_OSM.md:4-8` يوثّقان أن تصحيحات الحدود من OSM، وليس أصل كل طبقات الطرق. يوجد أيضًا مصدر raster خارجي `tiles.openfreemap.org` لخريطة `natural_earth` عند التصغير في الأنماط؛ لذا وصف الخريطة بأنها محلية بالكامل في `README.md:12-14` أوسع من التكوين الفعلي. [الدليل: فحص جدول `metadata` و`tiles` في MBTiles؛ `frontend/public/damascus-clean-style.json`].

## 4. Geographic Data Files and Layers

| الملف | الموجود فعليًا | الدور والحدود |
|---|---|---|
| `brouter/damascus_2026.mbtiles` | MBTiles متجهي مضغوط gzip، نحو 9.97 MB، 1,649 بلاطة، zoom 0–14 | خريطة إدارة للعرض؛ مخطط الطبقات مستمد من metadata، وليس شبكة توجيه |
| `frontend/public/vector-tiles/{z}/{x}/{y}.pbf` | بلاطات محلية | خريطة الواجهة العامة الأساسية؛ لم يُتحقق من مطابقتها الثنائية لـ MBTiles |
| `backend/data/damascus_streets.geojson` | 580 معلمًا، 439 LineString و141 MultiLineString، 3,401 نقطة؛ مجال الإحداثيات 36.2031848–36.3548951 طولًا و33.4499645–33.5618195 عرضًا | مدخل `seed_streets` لجدول البحث/التسمية؛ ليس شبكة كل الطرق |
| `frontend/public/data/damascus_streets.geojson` | 580 معلمًا بالمخطط نفسه؛ المحتوى JSON غير مطابق بالكامل لملف backend | ملف عرض محلي؛ الاستعمال المباشر له في مسار الخريطة الحالية غير ظاهر |
| `backend/data/damascus_admin_areas.geojson` | 114 عنصرًا، منها عنصر بلا geometry؛ `backend/db.sqlite3` يضم 113 منطقة | مدخل تقسيمات إدارية وتصحيحات حدود |
| `frontend/public/data/damascus_admin_areas.geojson` | GeoJSON محلي | احتياطي API الحدود |
| `frontend/public/data/damascus_neighborhoods.geojson` | 98 مضلع حي | بيانات أحياء محلية إضافية |
| `frontend/public/data/damascus_permanent_landmarks.geojson` | 42 نقطة | معالم ثابتة للعرض |
| `brouter/segments4/*.rd5` | أربعة ملفات: `E35_N30`, `E35_N35`, `E40_N30`, `E40_N35` | شبكة BRouter بصيغته الخاصة؛ تاريخ ومصدر إنشائها **غير مؤكدين** |
| `brouter/profiles2/car-eco.brf` وغيره | بروفايلات سيارات ودراجات ومشي | قواعد حساب الكلفة والوصول في BRouter |

المصدر: قراءة ملفات GeoJSON وmetadata وlisting للامتدادات؛ `backend/places/management/commands/seed_streets.py:10-21`. لم يظهر `.osm.pbf` أو `.pmtiles` في جرد الملفات. إحداثيات GeoJSON وطلبات API مرتبة `[lon,lat]` وتبدو WGS84/‏EPSG:4326؛ لا يوجد تصريح SRID داخل ملفات GeoJSON، لذا التعيين الرسمي **غير مؤكد**. بلاطات XYZ تُعرض بإسقاط Web Mercator المعتاد؛ SRID الأصلي لسلسلة التوليد **غير مؤكد**. مجال MBTiles أوسع من مجال شوارع GeoJSON، ولا يعني تغطية طرق قابلة للتوجيه في كل المجال. [الدليل: `backend/places/models.py:66-69`، `backend/places/views.py:100-127`، metadata `bounds`].

## 5. Road Data Schema and Properties

`backend/data/damascus_streets.geojson` يحتوي لكل معلم على `id`, `name_ar`, `name_en`, `highway_type`, `neighborhood`, `center`, `bbox` و`geometry` فقط؛ جميع المفاتيح السبعة موجودة في المعالم الـ580، و`geometry` فعلية. `id` فريد داخل الملف، لكن نسبته إلى OSM Way ID **غير مؤكدة**: لا اسم حقل أو توثيق يربطه بـ OSM. الأنواع تشمل 213 `residential` و98 `secondary` و66 `service` و54 `tertiary` و50 `primary`، وكذلك 25 `footway` و26 `pedestrian` و12 `steps`؛ أي أن الملف يخلط طرق سيارات بممرات غير مناسبة. ملف SQLite المرفق يحوي 580 سجلًا في `streets` بالحقول المناظرة. [الدليل: فحص خصائص GeoJSON والأنواع؛ `backend/places/management/commands/seed_streets.py:31-63`؛ استعلام قراءة فقط لـ`streets`].

| خاصية مطلوبة للتوجيه | `Street`/GeoJSON | طبقة MBTiles `transportation` بحسب metadata | الاستنتاج |
|---|---|---|---|
| OSM way ID | غير مثبت | غير مُدرج في schema | لا يمكن وصل السجلات بأصل OSM يقينًا |
| `highway` | `highway_type` بقيم فعلية | `class`/`subclass` | تصنيف للعرض، يتطلب تحويلًا واعتمادًا |
| `oneway` | غائب | حقل عددي في schema؛ القيم الفعلية غير مفحوصة | لا تكفي شوارع DB للاتجاهات |
| `maxspeed` | غائب | غير مُدرج | يلزم المصدر الأصلي أو قواعد تقدير معلنة |
| `access`, `motor_vehicle`, `vehicle` | غائبة | `access` موجود في schema فقط؛ الحقلان الآخران غير مُدرجين | وصول السيارة غير محسوم |
| `junction`, `bridge`, `tunnel`, `layer` | غائبة | `brunnel` و`layer` في schema؛ القيم غير مفحوصة | خطر وصل جسور وأنفاق خطأ |
| `surface` | غائب | موجود في schema؛ القيم غير مفحوصة | لا يكفي لتحديد صلاحية الطريق |
| turn restrictions | غائبة | لا توجد relations في schema | لا يمكن احترام قيود الانعطاف من بيانات العرض |
| تقاطعات وعقد edge/source/target | غائبة | غائبة | لا توجد topology قابلة للحساب مباشرة |
| `geometry` | موجودة: LineString/MultiLineString | بلاطات مقصوصة ومبسطة حسب zoom | للعرض والبحث؛ لا يُثبت الاتصال المروري |

`transportation_name` في MBTiles طبقة أسماء منفصلة؛ في الواجهة العامة تستبدلها أسماء `Street`. لا يُفترض أن وجود حقل في metadata يعني امتلاءه في كل بلاطة. لم تُفك شيفرة البلاطات PBF للتحقق من قيم `oneway/access/surface` الفعلية؛ حالتها **غير مؤكدة**. تقاطع خطين هندسيًا لا يثبت وجود تقاطع مروري، ولا تحدد GeoJSON مواضع الانقسام عند التقاطعات أو مستويات الجسور. ملفات `.rd5` قابلة للاستخدام بواسطة BRouter لكن لم يُشغّل المحرك أو يُختبر نجاح مسار فيها؛ صلاحيتها الفعلية لدمشق **غير مؤكدة**. [الدليل: metadata `vector_layers`، `backend/places/models.py:51-82`، `brouter/profiles2/car-eco.brf:59-110`].

## 6. Database and Django Models

| النموذج/الجدول | الحقول المكانية ووظيفته | علاقته بالتوجيه |
|---|---|---|
| `AdminArea` / `admin_areas` | `boundary` JSONField و`parent`؛ 113 سجلًا في SQLite | تحديد المنطقة والبحث/الفلترة، وليس شبكة طرق |
| `Street` / `streets` | `geometry`, `bbox` JSONField ومركز lat/lon، `highway_type`؛ 580 سجلًا | أسماء وتحديد شارع على الخريطة والبحث؛ لا يحوي عقدًا أو اتجاهًا |
| `Category`, `SubCategory` | تصنيف وفئة فرعية وعلاقات | فلترة أماكن، لا تدخل في كلفة الطريق |
| `Place` / `places` | `latitude`, `longitude` FloatField وعنوان نصي؛ 323 سجلًا | الوجهة هي نقطة المكان، ولا يوجد حقل مدخل/نقطة إرساء على شارع |
| `Bus` / `buses` | خط نقل وسعر؛ 0 سجل في SQLite | خطوط عامة، لا شبكة سيارات |
| `BusRoute` / `bus_routes` | `geometry` JSONField في عمود `lineString`، مسافة/وقت/اتجاه/version؛ 0 سجل في SQLite | خط رحلة محفوظ، ليس edge graph |
| `Notification` / `notifications` | موقع اختياري lat/lon، زمن وصنف تنبيه؛ 0 سجل في SQLite | يمكنه إعلام المستخدم، ولا يربط إغلاقًا بحافة طريق |

الدليل: `backend/places/models.py:6-82,95-139,177-299,444-541` و`backend/places/migrations/0001_initial.py:51-194`؛ تعداد واستعلام schema وفهارس من `backend/db.sqlite3` بوضع `mode=ro`. جداول `Street`/`AdminArea`/`BusRoute` لا تستخدم `GeometryField`/`PointField`. لا توجد فهارس R-tree أو GiST/مكانية على طرق SQLite؛ الفهارس الظاهرة نصية وعلاقة `admin_area_id`. ليس في ملف SQLite جداول طرق خارج ORM مثل edges/vertices/restrictions. حال PostgreSQL الفعلي، جدوله، امتداد PostGIS، إصداره، وفهارسه **غير مؤكدة** لعدم اتصال مُتحقَّق به. لا تُعدّ عبارة `PostgreSQL` في توثيق `backend/places/views.py:101` إثباتًا لاتصال حالي به.

التعليق `TODO` في `backend/places/models.py:5` يقترح استبدال `AdminArea` و`Street` بقاعدة جديدة، لكن لا يوجد في المستودع موصل أو مخطط مثبت لتلك القاعدة؛ الاعتماد الحالي على `Street` واضح في `backend/places/views.py:100-127,405-435` و`frontend/src/lib/database-map-style.ts:9-19`. لذلك إبقاء `Street` حاليًا للبحث والتسميات مع فصل شبكة التوجيه المقترحة عنه أفضل من حذفه اعتمادًا على تعليق. تُحدَّد الوجهة من إحداثيات `Place` (`frontend/src/components/PlaceDetailDrawer.tsx:633-636`)؛ مدخل المبنى أو أقرب شارع قابل للقيادة غير مخزّن.

## 7. Existing Map APIs and Frontend

`backend/config/urls.py:35-39` يركّب `places.urls` و`buses.urls` تحت `/api/`. نقاط الخريطة: `/api/streets/geojson/`, `/api/admin-areas/`, `/api/categories/`, `/api/places/geojson/`, `/api/places/<id>/`, `/api/search/`, `/api/transit/lines/`, `/api/transit/all-routes-geojson/`, `/api/routing/`, `/api/notifications/`, `/api/tiles/damascus/...` و`/api/fonts/...`؛ أدلتها `backend/places/urls.py:19-55`. محرر الإدارة يستدعي `/api/admin/routes/brouter-waypoints` بـPOST ونقاط `{lon,lat}`، ثم يحفظ خطوط الباص عبر API الإدارة. [الدليل: `backend/buses/urls.py:6-15`، `dashboard/src/api.ts:39-49`، `dashboard/src/hooks/useRouteEditor.ts:70-105`].

واجهة المستخدم لديها اختيار وجهة من بطاقة مكان، أوضاع `transit/car/walk`، عرض مسافة/وقت وخط GeoJSON. أصل الطلب في `RoutingPanel` قيمة ثابتة `33.5132,36.2954` ولا يربط GPS المعروض في `UserLocationButton` بطلب المسار؛ لا يظهر اختيار أصل حر أو وجهة بالنقر على خريطة الواجهة العامة. GPS يستخدم `watchPosition` و`getCurrentPosition` لتحديث علامة وتمركز الخريطة فقط. `MapViewer` يستطيع رسم GeoJSON وملاءمة حدود المشهد، ويمكن إعادة استخدامه مع خط طريق حقيقي. [الدليل: `frontend/src/components/RoutingPanel.tsx:20-96,145-185,204-223`، `frontend/src/components/UserLocationButton.tsx:61-116`، `frontend/src/components/MapViewer.tsx:1221-1243,1654-1705,2225-2240`].

## 8. Existing Routing Capabilities

1. **واجهة السيارة العامة موجودة شكليًا**: `/api/routing/` يستقبل البداية والنهاية و`mode`. في وضع السيارة يحسب `straight_distance × 1.25` ويقدر الوقت بضرب الناتج، وينشئ خطًا بإحداثيات وسطية مصطنعة وتعليمات ثابتة. لا يستعلم عن `Street` أو BRouter؛ لا يراعي اتجاه السير أو التقاطعات. [الدليل: `backend/places/views.py:656-675,741-792`].
2. **BRouter مدمج في إدارة النقل**: `calculate_geometry` يرسل نقاطًا إلى `BROUTER_URL` (افتراضيًا localhost:17777) مع `profile=car-eco`, `format=geojson`، ويقرأ `track-length` و`total-time`. نقطة `/api/admin/routes/brouter-waypoints` تعرض النتيجة للوحة الإدارة؛ مسارات الباص تُخزّن في `BusRoute`. هذا مسار كود حقيقي نحو محرك، لكنه لم يُثبت أنه متاح وقت التشغيل أو أنه يغطي نقاط دمشق المطلوبة. [الدليل: `backend/buses/views.py:165-238,366-390,404-433`، `backend/buses/urls.py:9-11`].
3. **النقل العام في الواجهة العامة تقريبي أيضًا**: يختار خط `BusRoute` قريبًا من أطرافه ويضيف وصلات مستقيمة؛ ملف SQLite المرفق لا يحتوي أي `BusRoute`. [الدليل: `backend/places/views.py:677-739`، فحص `bus_routes`].
4. **GPS وعرض المسار متوفران جزئيًا**؛ إعادة الحساب الحي، مطابقة الموقع بالطريق، اختيار نقطتين بحرية، إغلاق edges، تعليمات انعطاف مشتقة من شبكة، وAPI مسار سيارة حقيقي: غير متوفرة في المسار العام المفحوص. `Notification` ليس نموذج إغلاق طريق. البحث عن OSRM/pgRouting/Valhalla/GraphHopper في كود المشروع لم يكشف دمجًا لها. [الدليل: `frontend/src/components/UserLocationButton.tsx:61-116`، `frontend/src/components/MapViewer.tsx:1654-1697`، `backend/places/models.py:519-541`].

## 9. Routing Readiness Assessment

| المتطلب | الحالة | الدليل | النقص أو الإجراء المطلوب |
|---|---|---|---|
| مصدر طرق صالح للتوجيه | متوفر جزئيًا | `.rd5` وبروفايل سيارة ودمج BRouter في `backend/buses/views.py:165-238` | اختبار تغطية الشبكة ومصدرها وتاريخها؛ GeoJSON وMBTiles للعرض |
| اتجاهات السير | غير مؤكد | بروفايل `car-eco.brf:110` يقرأ `oneway`؛ `Street` لا يحويه | اختبار مخرجات BRouter مقابل تقاطعات حقيقية وتوثيق أصل `.rd5` |
| قيود الانعطاف | غير مؤكد | لا relation في GeoJSON/MBTiles metadata؛ `.rd5` لم تُفك | اختبار قيود محددة ومصدر OSM الأصلي |
| اتصال شبكة الطرق | غير مؤكد | ملفات `.rd5` موجودة؛ `Street` بلا source/target | اختبار مسارات متنوعة، الجسور والأنفاق والأحياء |
| تحديد نقطة البداية والوجهة | متوفر جزئيًا | بطاقة Place + أصل ثابت، `RoutingPanel.tsx:37-63` | اختيار أصل حقيقي ووجهة حرة وربط GPS |
| إرساء النقاط على شارع قابل للقيادة | غير مؤكد | لا API snapping في المسار العام؛ BRouter يقبل waypoints | تحديد حد مسافة الإرساء واستجابة الإخفاق |
| حساب مسار سيارة حقيقي | غير متوفر | `backend/places/views.py:741-792` يصنع خطًا | وصل API العام بمحرك مُختبر |
| عرض خط المسار | متوفر | `MapViewer.tsx:1654-1697` | تمرير GeoJSON الحقيقي وضبط إعادة الرسم |
| مسافة ووقت من الشبكة | متوفر جزئيًا | BRouter يرجع `track-length/total-time` في الإدارة؛ العام يقدر | استخدام مخرجات المحرك والتحقق من ETA محليًا |
| إعادة حساب المسار | غير متوفر | لا ربط بين GPS وطلب `RoutingPanel.tsx:71-96` | مراقبة الانحراف وإعادة الطلب بحدود معدل |
| إغلاقات مستقبلية | غير متوفر | `Notification` نقطة وتنبيه فقط، `models.py:519-541` | ربط الإغلاق بمعرف edge وفترة زمنية، وفق المحرك |
| تحديث بيانات الطرق | متوفر جزئيًا | `seed_streets.py:10-66` يحدّث شوارع العرض | خط تحديث مستقل لمصدر الشبكة، وإعادة بناء/تحديث محرك |

## 10. Missing Data and Technical Risks

- **سلسلة مصدر الطرق**: metadata تشير إلى OSM/Geofabrik للبلاطات، لكنها لا تعطي `.osm.pbf` أصليًا ولا رابط ملف/تاريخ إنشاء `.rd5` أو GeoJSON. يجب حفظ provenance وترخيص الإسناد وتاريخ اللقطة لكل نسخة توجيه. [الدليل: metadata MBTiles؛ جرد الامتدادات].
- **فقدان خصائص المرور في Street**: غياب one-way/access/maxspeed/turn restrictions والعقد وOSM IDs يمنع تحويل السجلات الـ580 مباشرة إلى graph موثوق، خاصة أن الملف يستبعد طرقًا بلا اسم محتملًا ويحتوي ممرات مشاة. الاستبعاد بسبب الاسم يُستنتج من `seed_streets.py:33-36`؛ مدى شمول الملف الأصلي **غير مؤكد**. [الدليل: schema وGeoJSON].
- **تضليل المستخدم الحالي**: `mode=car` يعطي خطًا قد يقطع مباني أو يسير عكس الاتجاه، بينما يصفه النص بالشوارع الرئيسية. يلزم عدم تقديمه بوصفه ملاحة قيادة موثوقة في أي إطلاق للتوجيه. [الدليل: `backend/places/views.py:741-792`].
- **اختلاف نسخ البيانات**: بلاطات الواجهة العامة المحلية وMBTiles للإدارة و`Street` و`.rd5` قد تكون من لقطات مختلفة؛ لا يوجد manifest يربطها. يلزم اختبار محاذاة بصري ومكاني قبل الدمج. [الدليل: `MapViewer.tsx:803-812`، `dashboard/src/map/setup.ts:20-28`، `backend/config/settings.py:20`].
- **بيئة الإنتاج غير مثبتة**: PostgreSQL افتراضي في الإعدادات، وSQLite المرفق فقط قابل للفحص هنا. لا يمكن الجزم بجداول أو فهارس أو بيانات خادم الإنتاج أو إصدار PostgreSQL/PostGIS. [الدليل: `backend/config/settings.py:99-117`].
- **تغطية التشغيل**: وجود `.rd5` وJAR لا يثبت صحة خدمة BRouter أو حداثة الطرق أو احترام القيود المحلية. يلزم عينة رحلات على أرض الواقع ومراجعة حالات جسور/أنفاق/اتجاه واحد. [الدليل: `brouter/segments4/`، `brouter/profiles2/car-eco.brf`].

## 11. OSRM vs pgRouting vs Valhalla

| الخيار | البيانات المطلوبة وإمكان استعمال الموجود | بنية التشغيل والجداول | الدمج، التحديث، الملاءمة الأولية |
|---|---|---|---|
| OSRM | مقتطف OSM `.osm.pbf` مع علاقات القيود؛ MBTiles/Street الحاليان لا يكفيان. `.rd5` لا يُستخدم مباشرة | خدمة مستقلة وملفات graph مولدة؛ لا يلزم جدول Django جديد للمسار الأساسي | Django يستهلك HTTP ويحوّل geometry/legs. مناسب لمسارات سيارة سريعة؛ تحديث الطرق يتطلب إعادة معالجة/تخصيص حسب pipeline، والإغلاقات تحتاج تصميم تغذية/تحديث واضح. [وثائق OSRM](https://project-osrm.org/docs/v26.4.0/tools) |
| pgRouting | شبكة edges/vertices موجّهة مع `cost/reverse_cost`، هندسة وقيود؛ يجب بناؤها من OSM أصلي أو مصدر مكافئ. `Street` لا تكفي | PostgreSQL مع pgRouting، ويفضل PostGIS وفهارس مكانية؛ جداول edges/vertices وربما turn restrictions وفق الخوارزمية | ينسجم مع backend PostgreSQL إذا ثبت توفره؛ يعطي تحكمًا كبيرًا بإغلاقات edges والتحديثات، لكن إعداد topology والقيود والملاحة أكبر جهدًا. [وثائق pgRouting](https://docs.pgrouting.org/latest/en/pgr_dijkstra.html) |
| Valhalla | مقتطف OSM `.osm.pbf` وعلاقات، يبني graph tiles خاصة؛ MBTiles/Street/`.rd5` لا تكفي مباشرة | خدمة مستقلة وملفات tiles؛ لا تحتاج جداول Django أساسية | دعم rich costing وتعليمات قيادة، والدمج HTTP. تحديث الشبكة يتطلب pipeline بناء tiles؛ خيارات إغلاق/مرور تحتاج إثباتها في نشر محدد. [وثائق البناء](https://valhalla.github.io/valhalla/start/building/) و[API السيارة](https://valhalla.github.io/valhalla/api/route/api-reference/) |

هذه مقارنة هندسية أولية وفق وثائق المحركات والملفات المحلية، وليست اختبار أداء أو جودة تغطية في دمشق. بما أن المشروع **يملك BRouter بالفعل**، اختباره أولًا أقل تغييرًا للبنية؛ لا يختزل ذلك تقييم OSRM/Valhalla إذا ظهرت حاجة لتعليمات أدق أو إغلاقات متغيرة أو تحميل أكبر. اختيار محرك نهائي **غير مؤكد** قبل الحصول على مصدر OSM موثق واختبار عينات دمشق واحتياجات التحديث.

## 12. Suggested Database Changes

| الفئة | المقترح المشروط |
|---|---|
| إعادة استخدام | إبقاء `Street` للبحث والتسمية و`Place` للوجهات و`AdminArea` للفلترة؛ تخزين إعداد المحرك خارجها. لا حذف دون جرد الاعتمادات. |
| ضروري فقط مع pgRouting | جداول شبكة موجّهة: `road_edges` بهوية مصدرية، هندسة، `source/target`, `cost/reverse_cost`, access/oneway/level؛ `road_vertices`؛ قيود انعطاف إذا ستُحترم؛ فهارس مكانية بعد اختيار PostgreSQL/PostGIS. يجب تصميم schema وفق مصدر فعلي لا من GeoJSON الحالي. |
| غير ضروري مع OSRM/Valhalla/BRouter الأساسي | لا حاجة لإضافة `Route` أو graph tables في Django لمجرد حساب مسار لحظي؛ يمكن الاكتفاء بمحول API وخدمة مستقلة. |
| اختياري لاحقًا | `road_closures` مربوط بمعرف edge مستقر ونطاق زمني وسبب، مع آلية ترجمة إلى المحرك؛ حفظ نقاط دخول الأماكن/إرسائها إذا ثبتت الحاجة؛ سجل نسخ بيانات الخريطة ومصدرها؛ cache مسارات محدود وفق الاستخدام. |
| بيانات خارجية لازمة | مقتطف OSM أصلي يتضمن الطرق وعلاقات القيود، أو مصدر مرور مكافئ مرخص ومحدث؛ لا تُنشأ اتجاهات/قيود يدويًا من رسم MBTiles. |

لا تتضمن هذه المرحلة أي migration أو تعديل نموذج. `backend/places/models.py:5` تعليق عن استبدال جدول الشوارع وليس خطة ترحيل مُثبتة. قواعد البيانات التشغيلية يجب فحصها قبل أي تصميم نهائي.

## 13. Recommended Implementation Phases

1. **تثبيت المصدر والتغطية**: تحديد أصل `.rd5` وMBTiles وطلب مقتطف دمشق/Syria OSM موثق، ثم اختيار 20–30 رحلة تحقق تشمل اتجاهات أحادية وجسورًا وأنفاقًا ومداخل أماكن ونقاطًا خارج التغطية. لا تشغيل أو استيراد في هذه المرحلة التحليلية.
2. **إثبات محرك**: في مرحلة تنفيذ لاحقة، اختبار BRouter الحالي ببروفايل `car-eco` على العينة ومراجعة المسافة والزمن والهندسة والتعليمات؛ مقارنة OSRM/Valhalla فقط إذا لم يحقق المتطلبات. توثيق ترخيص وتاريخ بيانات المحرك.
3. **Routing API حقيقي**: استبدال فرع `mode=car` التخييلي باستدعاء محرك، تحقق حدود الإحداثيات ومواضع snap، أخطاء واضحة، مهلة، شكل استجابة GeoJSON ثابت، وقياس نجاح/فشل. حفظ النقل والمشي بمعنى واضح وعدم خلطهما مع توجيه السيارة.
4. **تجربة الواجهة**: اختيار بداية من GPS أو نقطة خريطة أو مكان، ووجهة من مكان أو الخريطة، عرض خط المحرك والمسافة/ETA وتعليماته، حالة عدم وجود مسار، وإرساء الوجهة على طريق قابل للقيادة.
5. **فحص جودة القيادة**: اختبارات حقيقية لاتجاه السير، قيود الانعطاف، جسور/أنفاق، الطرق المغلقة، أطراف التغطية، ومطابقة طبقة العرض مع طريق المحرك.
6. **الإغلاقات والتحديثات**: بعد اختيار المحرك، تحديد دورة تحديث بيانات OSM وإغلاق edges وفترات الصلاحية؛ قياس زمن تحديث graph ونشر نسخة قابلة للرجوع.
7. **الملاحة الحية لاحقًا**: ربط GPS بإعادة الحساب عند الانحراف، معالجة دقة الموقع ومعدل الطلبات، وتعليمات آمنة مع التحقق الميداني.

المخاطر السابقة للبدء: انعدام ملف OSM أصلي موثوق، عدم توثيق `.rd5`، عدم معرفة قاعدة الإنتاج، واحتمال اختلاف نسخة العرض عن نسخة الشبكة. أول إجراء عملي هو **جرد منشأ ملف BRouter واختبار مسارات سيارة بعينة تحقق على نسخة تشغيل معزولة** مع الحصول على مقتطف OSM مرخص؛ ذلك يحدد قرار المحرك دون افتراض إمكان إعادة بناء graph من البلاطات.

## 14. Important File Paths and Evidence

| المسار | موضع الدليل |
|---|---|
| `backend/config/settings.py` | 20–21 مسار MBTiles؛ 99–117 PostgreSQL/SQLite |
| `backend/config/urls.py` و`backend/places/urls.py` | 35–39 تركيب API؛ 19–55 نقاط الخريطة والتوجيه |
| `backend/places/models.py` | 5 تعليق TODO؛ 6–82 المناطق والشوارع؛ 177–299 الأماكن؛ 444–541 الباصات والإشعارات |
| `backend/places/migrations/0001_initial.py` | 51–194 إنشاء النماذج والجداول |
| `backend/places/management/commands/seed_streets.py` | 10–66 مصدر الشوارع وشرط الاسم والاستيراد |
| `backend/places/views.py` | 100–127 GeoJSON الشوارع؛ 656–839 خوارزمية المسار العام |
| `backend/places/tile_views.py` | 12–45 قراءة البلاطات من MBTiles |
| `backend/buses/views.py` و`backend/buses/urls.py` | 165–238 BRouter؛ 9–11 API محرر المسار |
| `frontend/src/lib/database-map-style.ts` | 3–20 إحلال تسميات Street |
| `frontend/src/components/MapViewer.tsx` | 803–812 بلاطات الواجهة؛ 1654–1697 رسم المسار |
| `frontend/src/components/RoutingPanel.tsx` | 54–96 أصل ثابت وAPI؛ 204–223 المسافة والزمن |
| `frontend/src/components/UserLocationButton.tsx` | 61–116 تتبع GPS والعلامة |
| `dashboard/src/map/setup.ts` و`dashboard/src/hooks/useRouteEditor.ts` | 20–28 خريطة الإدارة؛ 70–105 طلب BRouter |
| `frontend/public/damascus-clean-style.json` | مصدر vector محلي وطبقات transportation/building |
| `brouter/damascus_2026.mbtiles` | metadata و`tiles` بفحص SQLite `mode=ro` |
| `backend/data/damascus_streets.geojson` و`backend/db.sqlite3` | تعداد خصائص وهندسة الشوارع؛ schema/counts بفحص `mode=ro` |
| `README.md`, `Damascus_Map_Platform_Run_Guide.md`, `start.sh` | إرشادات التشغيل؛ الادعاءات التوثيقية تُراجع مقابل الكود |

لم تُشغَّل migrations أو أوامر seed أو خدمات أو حاويات، ولم تُنشأ بيانات تجريبية. تم فحص metadata وschema والتعدادات بطريقة قراءة فقط؛ لم يُختبر خادم PostgreSQL أو خدمة BRouter.

## 15. Questions That Cannot Be Answered From the Repository

1. **غير مؤكد**: ما ملف `.osm.pbf` الأصلي ورخصته ووقت لقطته المحدد؟ metadata تثبت سلسلة تحديث للبلاطات فقط، والملف الأصلي غير موجود.
2. **غير مؤكد**: كيف أُنتج GeoJSON الشوارع الـ580 وما معنى `id` فيه؟ لا يوجد سكربت توليده أو حقل `osm_way_id`.
3. **غير مؤكد**: متى وبأي OSM snapshot بُنيت `.rd5` الأربعة، وهل تغطي كل دمشق بخصائص الانعطاف والاتجاه المطلوبة؟ لا manifest أو اختبار تشغيل موثق.
4. **غير مؤكد**: هل بلاطات `frontend/public/vector-tiles` والـ MBTiles و`Street` متزامنة؟ لا بصمات/manifest ربط بينها.
5. **غير مؤكد**: ما نسخة PostgreSQL/PostGIS والجداول وفهارسها وعدد سجلاتها في بيئة الإنتاج؟ لم تتوفر قراءة موثقة لخادمها.
6. **غير مؤكد**: جودة اتجاهات السير والإغلاقات اليومية في دمشق ومدى ملاءمة ETA. تتطلب مصدر بيانات محدثًا وعينة تحقق ميدانية.
7. **غير مؤكد**: متطلبات السعة والتوفر والعمل دون اتصال ودقة تعليمات الملاحة والإغلاقات؛ لا مواصفات تشغيل قابلة للقياس في المستودع.

## Critical Findings for Routing Implementation

| السؤال | الجواب المباشر |
|---|---|
| المصدر الأصلي للخريطة؟ | بلاطات العرض مشتقة على الأرجح من OSM عبر OpenMapTiles/Planetiler وتحديثات Geofabrik بحسب metadata؛ ملف الإدخال الأصلي **غير مؤكد**. حدود المشروع المصححة موثقة من OSM، لكن أصل GeoJSON الشوارع **غير مؤكد**. |
| هل نملك OSM الأصلي؟ | لا يظهر `.osm.pbf`؛ نملك بيانات عرض PBF/MBTiles وGeoJSON وشبكة BRouter `.rd5`، ولا يمكن مساواتها بمقتطف OSM خام. |
| هل تكفي بيانات الطرق الحالية؟ | `Street` لا تكفي لبناء توجيه سيارات. `.rd5` قد تكفي عبر BRouter بعد اختبار التغطية والقيود؛ ذلك **غير مؤكد** الآن. |
| ما الناقص؟ | إثبات الأصل والنسخة، اتجاهات وقيود السير، graph مترابط أو محرك مثبت، إرساء نقاط، اختبارات جسور/أنفاق وإغلاقات، وربط GPS بالطلب. |
| هل نحتاج ملفًا جغرافيًا جديدًا؟ | نعم إذا اختير OSRM أو Valhalla أو بناء pgRouting موثوق: مقتطف OSM أصلي/مكافئ. للتجربة الأولية مع BRouter، افحص `.rd5` الموجود قبل جلب ملف جديد. |
| المحرك الأنسب مبدئيًا؟ | BRouter الموجود لأقصر تجربة عملية؛ اختيار إنتاج نهائي بينه وOSRM/Valhalla/pgRouting **غير مؤكد** قبل الاختبار ومتطلبات التحديث. |
| ما الجداول الواجب إضافتها؟ | لا جداول graph إلزامية عند استخدام محرك مستقل؛ pgRouting فقط يتطلب edges/vertices وقيودًا حسب التصميم. جداول الإغلاقات والنسخ اختيارية ومشروطة. |
| هل نعدّل `Street`؟ | أبقه مستقلًا للبحث والتسميات في البداية؛ لا تُحمّل عليه شبكة التوجيه ولا تحذفه قبل تدقيق الاعتمادات. |
| أول إجراء؟ | توثيق أصل `.rd5` وإجراء عينة مسارات قيادة حقيقية على BRouter، بالتوازي مع الحصول على مقتطف OSM موثق لاستخدامه عند الحاجة. |
