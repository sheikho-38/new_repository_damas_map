
# Register your models here.
from django.contrib import admin
from buses.models import Bus, BusRoute

@admin.register(Bus)
class BusAdmin(admin.ModelAdmin):
    list_display = ('name', 'color', 'old_price', 'new_price', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name',)


@admin.register(BusRoute)
class BusRouteAdmin(admin.ModelAdmin):
    list_display = ('bus', 'direction', 'version', 'is_active')
    list_filter = ('direction', 'is_active')
