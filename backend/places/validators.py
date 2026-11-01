import re
from urllib.parse import urlparse

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator

PHONE_RE = re.compile(r"^\d{7}$")
MOBILE_RE = re.compile(r"^09\d{8}$")
GMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@gmail\.com$")

SOCIAL_DOMAINS = {
    "facebook": "facebook.com",
    "instagram": "instagram.com",
    "telegram": "t.me",
}


def _validate_http_url(value):
    if not value.startswith(("http://", "https://")):
        raise ValidationError("الرابط يجب أن يبدأ بـ http:// أو https://")
    URLValidator(schemes=["http", "https"])(value)


def validate_contact_value(contact_type, value):
    value = (value or "").strip()

    if contact_type == "phone":
        if not PHONE_RE.match(value):
            raise ValidationError("رقم الهاتف يجب أن يتكون من 7 أرقام فقط.")
    elif contact_type in ("mobile", "whatsapp"):
        if not MOBILE_RE.match(value):
            raise ValidationError("الرقم يجب أن يتكون من 10 أرقام ويبدأ بـ 09.")
    elif contact_type == "email":
        if not GMAIL_RE.match(value):
            raise ValidationError("البريد الإلكتروني يجب أن يكون بالشكل example@gmail.com")
    elif contact_type == "website":
        _validate_http_url(value)
    elif contact_type in SOCIAL_DOMAINS:
        _validate_http_url(value)
        domain = SOCIAL_DOMAINS[contact_type]
        host = (urlparse(value).hostname or "").lower()
        if host != domain and not host.endswith("." + domain):
            raise ValidationError(f"الرابط يجب أن يكون من {domain}")
    else:
        raise ValidationError("نوع وسيلة التواصل غير معروف.")