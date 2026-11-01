from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlsplit

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError
from places.management_api import MediaSerializer, PlaceSerializer


class MediaUploadTests(TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.directory.name)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.staff = get_user_model().objects.create_user('media-manager', password='test-only', is_staff=True)
        self.client = APIClient()
        self.client.force_login(self.staff)

    def upload(self, path, data, cover=False, name='place.jpg'):
        return self.client.post(path, {
            'file': SimpleUploadedFile(name, data),
            'is_cover': str(cover),
        }, format='multipart')

    def test_admin_upload_saves_image_under_media_root_and_returns_url(self):
        response = self.upload('/api/admin/places/media/', b'\xff\xd8\xffimage', cover=True)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['media_type'], 'image')
        self.assertTrue(response.data['is_cover'])
        relative_path = urlsplit(response.data['file_url']).path.removeprefix('/media/')
        stored_file = Path(self.directory.name) / relative_path
        self.assertTrue(stored_file.is_file())
        self.assertEqual(stored_file.read_bytes(), b'\xff\xd8\xffimage')

    def test_public_submission_upload_is_available_without_staff_session(self):
        self.client.logout()
        response = self.upload('/api/place-submissions/media/', b'\x89PNG\r\n\x1a\nimage', name='place.png')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['media_type'], 'image')

    def test_rejects_unsupported_extension_and_mismatched_content(self):
        response = self.client.post('/api/admin/places/media/', {
            'file': SimpleUploadedFile('place.gif', b'GIF89a')
        }, format='multipart')
        self.assertEqual(response.status_code, 400)
        response = self.client.post('/api/admin/places/media/', {
            'file': SimpleUploadedFile('place.jpg', b'not an image')
        }, format='multipart')
        self.assertEqual(response.status_code, 400)

    def test_rejects_images_over_five_megabytes(self):
        response = self.upload('/api/admin/places/media/', b'\xff\xd8\xff' + b'x' * (5 * 1024 * 1024))
        self.assertEqual(response.status_code, 400)

    def test_accepts_mp4_with_valid_size_and_rejects_video_cover(self):
        video = b'\x00\x00\x00\x18ftypisom' + b'x' * (15 * 1024 * 1024 - 12)
        response = self.client.post('/api/admin/places/media/', {
            'file': SimpleUploadedFile('clip.mp4', video),
            'is_cover': 'false',
        }, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['media_type'], 'video')
        response = self.client.post('/api/admin/places/media/', {
            'file': SimpleUploadedFile('clip.mp4', video),
            'is_cover': 'true',
        }, format='multipart')
        self.assertEqual(response.status_code, 400)

    def test_cover_must_belong_to_one_image(self):
        image = MediaSerializer(data={'file_url': 'https://example.org/photo.jpg', 'media_type': 'image', 'is_cover': True})
        self.assertTrue(image.is_valid(), image.errors)
        video = MediaSerializer(data={'file_url': 'https://example.org/clip.mp4', 'media_type': 'video', 'is_cover': True})
        self.assertFalse(video.is_valid())
        with self.assertRaises(ValidationError):
            PlaceSerializer().validate_media([
                {'is_cover': True}, {'is_cover': True},
            ])

    def test_staff_access_is_required_for_management_uploads(self):
        self.client.logout()
        self.assertEqual(self.upload('/api/admin/places/media/', b'\xff\xd8\xffimage').status_code, 403)
