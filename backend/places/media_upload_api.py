from pathlib import Path
from uuid import uuid4

from django.core.files.storage import default_storage
from rest_framework import serializers
from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView


MB = 1024 * 1024
SIGNATURES = {
    'jpg': lambda data: data.startswith(b'\xff\xd8\xff'),
    'jpeg': lambda data: data.startswith(b'\xff\xd8\xff'),
    'png': lambda data: data.startswith(b'\x89PNG\r\n\x1a\n'),
    'webp': lambda data: data.startswith(b'RIFF') and data[8:12] == b'WEBP',
    'mp4': lambda data: data[4:8] == b'ftyp',
}


class MediaUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    is_cover = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        file = attrs['file']
        extension = Path(file.name).suffix.lower().lstrip('.')
        if extension not in SIGNATURES:
            raise serializers.ValidationError({'file': 'الصيغ المقبولة: JPG وJPEG وPNG وWEBP وMP4.'})
        if extension == 'mp4':
            if not 15 * MB <= file.size <= 35 * MB:
                raise serializers.ValidationError({'file': 'حجم الفيديو يجب أن يكون بين 15 و35 ميغابايت.'})
            if attrs['is_cover']:
                raise serializers.ValidationError({'is_cover': 'يمكن اختيار صورة فقط كغلاف.'})
        elif file.size > 5 * MB:
            raise serializers.ValidationError({'file': 'حجم الصورة يجب ألا يتجاوز 5 ميغابايت.'})
        signature = file.read(12)
        file.seek(0)
        if not SIGNATURES[extension](signature):
            raise serializers.ValidationError({'file': 'محتوى الملف لا يطابق امتداده.'})
        attrs['extension'] = extension
        return attrs


class MediaUploadThrottle(AnonRateThrottle):
    scope = 'place-media-uploads'
    rate = '20/hour'


class MediaUploadBase(APIView):
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = MediaUploadSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        file = serializer.validated_data['file']
        extension = serializer.validated_data['extension']
        path = default_storage.save(f'place_media/{uuid4().hex}.{extension}', file)
        media_type = 'video' if extension == 'mp4' else 'image'
        return Response({
            'file_url': request.build_absolute_uri(default_storage.url(path)),
            'media_type': media_type,
            'caption': '',
            'is_cover': serializer.validated_data['is_cover'],
        }, status=201)


class AdminMediaUpload(MediaUploadBase):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAdminUser]


class SubmissionMediaUpload(MediaUploadBase):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [MediaUploadThrottle]
