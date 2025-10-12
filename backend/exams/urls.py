from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from django.contrib import admin

router = DefaultRouter()
router.register(r'users', views.TblUsersViewSet)
router.register(r'college', views.TblCollegeViewSet)
router.register(r'departments', views.TblDepartmentViewSet)
router.register(r'programs', views.TblProgramViewSet)
router.register(r'courses', views.TblCourseViewSet)
router.register(r'terms', views.TblTermViewSet)
router.register(r'examperiods', views.TblExamperiodViewSet)
router.register(r'examdetails', views.TblExamdetailsViewSet)
router.register(r'rooms', views.TblRoomsViewSet)
router.register(r'inbox', views.TblInboxViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
