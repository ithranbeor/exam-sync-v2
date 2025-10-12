# (backend/backend/url.py)

from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def home(request):
    return JsonResponse({"message": "ExamSync V2 Django backend is running ✅"})

urlpatterns = [
    path('', home),  # 👈 add this line
    path('admin/', admin.site.urls),
    path('api/', include('exams.urls')),  # (make sure exams/urls.py exists)
]
