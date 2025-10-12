from rest_framework import serializers
from .models import (
    TblUsers, TblCollege, TblDepartment, TblProgram, TblCourse,
    TblTerm, TblSectioncourse, TblExamperiod, TblExamdetails,
    TblModality, TblRooms, TblBuildings, TblInbox, TblReplies,
    TblNotifications, TblSystemNotification, TblRoles, TblUserRole,
    TblUserRoleHistory
)


class TblUsersSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblUsers
        fields = "__all__"


class TblCollegeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblCollege
        fields = "__all__"


class TblDepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblDepartment
        fields = "__all__"


class TblProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblProgram
        fields = "__all__"


class TblCourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblCourse
        fields = "__all__"


class TblTermSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblTerm
        fields = "__all__"


class TblSectioncourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblSectioncourse
        fields = "__all__"


class TblExamperiodSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblExamperiod
        fields = "__all__"


class TblExamdetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblExamdetails
        fields = "__all__"


class TblModalitySerializer(serializers.ModelSerializer):
    class Meta:
        model = TblModality
        fields = "__all__"


class TblRoomsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblRooms
        fields = "__all__"


class TblBuildingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblBuildings
        fields = "__all__"


class TblInboxSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblInbox
        fields = "__all__"


class TblRepliesSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblReplies
        fields = "__all__"


class TblNotificationsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblNotifications
        fields = "__all__"


class TblSystemNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblSystemNotification
        fields = "__all__"


class TblRolesSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblRoles
        fields = "__all__"


class TblUserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = TblUserRole
        fields = "__all__"


class TblUserRoleHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TblUserRoleHistory
        fields = "__all__"
