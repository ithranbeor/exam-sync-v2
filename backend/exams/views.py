from rest_framework import viewsets
from .models import *
from .serializers import *


class TblUsersViewSet(viewsets.ModelViewSet):
    queryset = TblUsers.objects.all()
    serializer_class = TblUsersSerializer


class TblCollegeViewSet(viewsets.ModelViewSet):
    queryset = TblCollege.objects.all()
    serializer_class = TblCollegeSerializer


class TblDepartmentViewSet(viewsets.ModelViewSet):
    queryset = TblDepartment.objects.all()
    serializer_class = TblDepartmentSerializer


class TblProgramViewSet(viewsets.ModelViewSet):
    queryset = TblProgram.objects.all()
    serializer_class = TblProgramSerializer


class TblCourseViewSet(viewsets.ModelViewSet):
    queryset = TblCourse.objects.all()
    serializer_class = TblCourseSerializer


class TblTermViewSet(viewsets.ModelViewSet):
    queryset = TblTerm.objects.all()
    serializer_class = TblTermSerializer


class TblExamperiodViewSet(viewsets.ModelViewSet):
    queryset = TblExamperiod.objects.all()
    serializer_class = TblExamperiodSerializer


class TblExamdetailsViewSet(viewsets.ModelViewSet):
    queryset = TblExamdetails.objects.all()
    serializer_class = TblExamdetailsSerializer


class TblRoomsViewSet(viewsets.ModelViewSet):
    queryset = TblRooms.objects.all()
    serializer_class = TblRoomsSerializer


class TblInboxViewSet(viewsets.ModelViewSet):
    queryset = TblInbox.objects.all()
    serializer_class = TblInboxSerializer
