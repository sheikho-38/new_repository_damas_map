# 1. Backend — Django

**Terminal 1**

# الإعداد لأول مرة فقط

cd backend

python -m venv venv

.\venv\Scripts\Activate.ps1

pip install -r requirements.txt

## تهيئة قاعدة البيانات وتعبئة البيانات لأول مرة

python manage.py migrate


نفّذ الأوامر التالية بالتسلسل، وتوقف عند أي خطأ قبل متابعة الأمر التالي:

```powershell
python manage.py migrate
python manage.py seed_routing
python manage.py seed_categories
python manage.py seed_admin_areas
python manage.py seed_streets
python manage.py seed_rubble_dump_sites
python manage.py seed_industry_facilities
python manage.py seed_education_directorate
python manage.py seed_citizen_service_centers
python manage.py seed_social_affairs_institutes
python manage.py seed_health_facilities_2026
python manage.py seed_damascus_service_departments
python manage.py seed_cultural_directorate
python manage.py seed_form_added_places
```

يتضمن `seed_routing` بيانات الباصات ومساراتها؛ لذلك لا تشغّل `seed_transit_lines` ضمن هذه التهيئة. يجب أن تكون جداول التوجيه والباصات الثمانية فارغة أو مطابقة بالكامل للنسخة المصدّرة؛ إذا سبق استيراد بيانات مختلفة، فإن إعادة ترتيب الأوامر وحدها لا تعالج التعارض. أما `seed_poi_rich_details` فهو لإضافة تفاصيل تجريبية إلى أماكن موجودة، وليس مطلوبًا لتهيئة البيانات.

# التشغيل اليومي

cd backend

.\venv\Scripts\Activate.ps1

python manage.py runserver 8000
            
            OR

python manage.py runserver 8001

- ***

# 2. Frontend — Next.js

**Terminal 2**

# الإعداد لأول مرة فقط

cd frontend
npm install
npm run dev

# التشغيل اليومي

cd frontend
npm run dev

# -----------------------------------------------------------------------------------------------

## 3. BRouter

يستخدم الـ backend خدمة BRouter HTTP على المنفذ `17777` لحساب مسارات الباصات. ملفات `brouter/segments4` و`brouter/profiles2` هي بيانات الخرائط والبروفايلات. شغّل Docker Desktop، ثم افتح PowerShell من جذر المشروع وشغّل الحاوية:

cd brouter

java -cp brouter-1.7.10-all.jar btools.server.RouteServer segments4 profiles2 customprofiles 17777 1

# -------------------------------------------------------------------------------------------------------------------

# 4. Dashboard — Vite

**Terminal 3**

# الإعداد لأول مرة فقط

cd dashboard
Copy-Item .env.example .env
npm install

### التشغيل اليومي

cd dashboard
npm run dev
