"""Account-free place submissions and edits from the place form."""
from django.conf import settings
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from .management_api import PlaceSerializer, Pagination, filtered_places, place_metadata
from .models import Place

LINK_SALT = 'places.create-only.v1'


class SubmissionThrottle(AnonRateThrottle):
    scope = 'place-submissions'
    rate = '60/hour'


class SubmissionAccess:
    # The standalone place form works without a staff session.
    authentication_classes = []
    permission_classes = [AllowAny]


class SubmissionMetadata(SubmissionAccess, APIView):
    def get(self, request):
        return Response({**place_metadata(), 'auto_publish': settings.PLACES_SUBMISSION_AUTO_PUBLISH})


class SubmitPlace(SubmissionAccess, generics.CreateAPIView):
    serializer_class = PlaceSerializer
    throttle_classes = [SubmissionThrottle]

    def perform_create(self, serializer):
        # Submitters cannot self-verify or change the owner's publication policy.
        serializer.save(is_verified=False, is_visible=settings.PLACES_SUBMISSION_AUTO_PUBLISH)


class SubmissionPlaceList(SubmissionAccess, generics.ListAPIView):
    serializer_class = PlaceSerializer
    pagination_class = Pagination

    def get_queryset(self):
        return filtered_places(self.request.query_params, Place.objects.select_related('sub_category__category', 'admin_area').prefetch_related('communication_info', 'media').order_by('id'))


class SubmissionPlaceDetail(SubmissionAccess, generics.RetrieveUpdateAPIView):
    serializer_class = PlaceSerializer
    queryset = Place.objects.select_related('sub_category__category', 'admin_area').prefetch_related('communication_info', 'media')
    throttle_classes = [SubmissionThrottle]

    def perform_update(self, serializer):
        serializer.save(is_verified=False)
