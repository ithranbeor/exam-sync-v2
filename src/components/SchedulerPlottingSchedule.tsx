/// <reference types="react" />
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import "../styles/SchedulerPlottingSchedule.css";
import Select, { components } from "react-select";
import { FaPlay, FaSpinner } from "react-icons/fa";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface ExamDetail {
  examdetails_id?: number;
  course_id: string;
  program_id: string;
  modality_id: number;
  user_id?: number | null;
  examperiod_id: number;
  exam_duration?: string | null;
  exam_start_time?: string | null;
  exam_end_time?: string | null;
  proctor_timein?: string | null;
  proctor_timeout?: string | null;
  section_name?: string | null;
  academic_year?: string | null;
  semester?: string | null;
  exam_category?: string | null;
  exam_period?: string | null;
  exam_date?: string | null;
  room_id?: string | null;
  selectedStartTime?: string;
  instructor_id?: number | null;
}

interface SchedulerProps {
  user: {
    user_id: number;
    email_address: string;
  } | null;
}

const SchedulerPlottingSchedule: React.FC<SchedulerProps> = ({ user }) => {
  const [formData, setFormData] = useState<ExamDetail & {
    selectedPrograms: string[];
    selectedCourses: string[];
    selectedModalities: number[];
    selectedExamDates: string[];
    exam_duration_hours?: number;
    exam_duration_minutes?: number;
  }>({
    course_id: "",
    program_id: "",
    modality_id: 0,
    examperiod_id: 0,
    exam_date: "",
    room_id: null,
    selectedPrograms: [],
    selectedCourses: [],
    selectedModalities: [],
    selectedExamDates: [],
    exam_duration_hours: 0,
    exam_duration_minutes: 0,
  });

  const [examPeriods, setExamPeriods] = useState<any[]>([]);
  const [modalities, setModalities] = useState<any[]>([]);
  const [_filteredModalities, setFilteredModalities] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [_filteredCourses, setFilteredCourses] = useState<any[]>([]);
  const [sectionCourses, setSectionCourses] = useState<any[]>([]);
  const [userCollegeIds, setUserCollegeIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [modalityPreviewSearchTerm, setModalityPreviewSearchTerm] = useState(''); 
  const [loading, setLoading] = useState(false);

  // Cache for rooms and buildings data
  const [roomsCache, setRoomsCache] = useState<any[]>([]);
  const [buildingsCache, setBuildingsCache] = useState<any[]>([]);
  const [collegesCache, setCollegesCache] = useState<any[]>([]);

  const handleSaveClick = async () => {
    setLoading(true);
    try {
      await handleSave();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const realUserId = user?.user_id;
        if (!realUserId) {
          console.warn("No user prop found — cannot fetch user-specific data.");
          return;
        }

        console.log("Using user_id from props:", realUserId);

        // ✅ STEP 1: Fetch colleges first
        const { data: allColleges, error: collegesError } = await supabase
          .from("tbl_college")
          .select("college_id, college_name");
        
        if (collegesError) {
          console.error("Error fetching colleges:", collegesError);
        }

        const colleges = allColleges || [];
        setCollegesCache(colleges);
        console.log("Colleges loaded:", colleges.length);

        // ✅ STEP 2: Get user roles (specifically role_id = 3 for Scheduler)
        const { data: userRoles, error: rolesError } = await supabase
          .from("tbl_user_role")
          .select("college_id, role_id")
          .eq("user_id", realUserId)
          .eq("role_id", 3);

        if (rolesError) {
          console.error("Error fetching user roles:", rolesError);
        }

        console.log("User roles (role_id=3):", userRoles);

        if (!userRoles || userRoles.length === 0) {
          console.warn("No scheduler role (role_id=3) found for this user.");
          setUserCollegeIds([]);
          alert("No scheduler role found for your account. Please contact administrator.");
          return;
        }

        // Extract college IDs from roles
        const collegeIdentifiers = userRoles
          .map((r: any) => r.college_id)
          .filter((id): id is string => Boolean(id))
          .map(id => String(id));

        // Remove duplicates
        const uniqueCollegeIdentifiers = Array.from(new Set(collegeIdentifiers));
        console.log("User college identifiers:", uniqueCollegeIdentifiers);
        
        setUserCollegeIds(uniqueCollegeIdentifiers);

        if (uniqueCollegeIdentifiers.length === 0) {
          console.warn("No valid college_id found in user roles.");
          alert("Your scheduler role has no college assigned. Please contact administrator.");
          return;
        }

        // ✅ STEP 3: Fetch all data in parallel
        const [
          { data: allExamPeriods },
          { data: allDepartments },
          { data: allPrograms },
          { data: mods },
          { data: crs },
          { data: trms },
          { data: sectCourses },
          { data: rooms },
          { data: buildings },
        ] = await Promise.all([
          supabase.from("tbl_examperiod").select("*"),
          supabase.from("tbl_department").select("department_id, college_id"),
          supabase.from("tbl_program").select("*"),
          supabase.from("tbl_modality").select("*"),
          supabase.from("tbl_course").select("*"),
          supabase.from("tbl_term").select("*"),
          supabase.from("tbl_sectioncourse").select("*"),
          supabase.from("tbl_rooms").select("room_id, building_id, room_capacity"),
          supabase.from("tbl_buildings").select("building_id, building_name"),
        ]);

        console.log("Raw data counts:", {
          examPeriods: allExamPeriods?.length || 0,
          departments: allDepartments?.length || 0,
          programs: allPrograms?.length || 0,
        });

        // ✅ STEP 4: Filter exam periods by user's college(s)
        const filteredExamPeriods = (allExamPeriods || []).filter((p: any) => {
          const collegeId = String(p.college_id);
          return uniqueCollegeIdentifiers.includes(collegeId);
        });

        console.log("Filtered exam periods:", filteredExamPeriods.length);
        if (filteredExamPeriods.length > 0) {
          console.log("Sample exam period:", filteredExamPeriods[0]);
        }

        // ✅ STEP 5: Filter departments by user's college(s)
        const filteredDepartments = (allDepartments || []).filter((d: any) => {
          const collegeId = String(d.college_id);
          return uniqueCollegeIdentifiers.includes(collegeId);
        });

        console.log("Filtered departments:", filteredDepartments.length);
        if (filteredDepartments.length > 0) {
          console.log("Sample department:", filteredDepartments[0]);
        }

        // Get department IDs
        const allowedDeptIds = filteredDepartments.map((d: any) => String(d.department_id));
        console.log("Allowed department IDs:", allowedDeptIds);

        // ✅ STEP 6: Filter programs by allowed departments
        const filteredPrograms = (allPrograms || []).filter((p: any) => {
          const deptId = String(p.department_id);
          return allowedDeptIds.includes(deptId);
        });

        console.log("Filtered programs:", filteredPrograms.length);
        if (filteredPrograms.length > 0) {
          console.log("Sample program:", filteredPrograms[0]);
        }

        // ✅ STEP 7: Set all state
        setExamPeriods(filteredExamPeriods);
        setDepartments(filteredDepartments);
        setPrograms(filteredPrograms);
        if (mods) setModalities(mods);
        if (crs) setCourses(crs);
        if (trms) setTerms(trms);
        if (sectCourses) setSectionCourses(sectCourses);
        if (rooms) setRoomsCache(rooms);
        if (buildings) setBuildingsCache(buildings);

        console.log("=== INITIAL DATA LOADED (CLIENT-SIDE FILTERED) ===", {
          examPeriods: filteredExamPeriods.length,
          departments: filteredDepartments.length,
          programs: filteredPrograms.length,
          userCollegeIds: uniqueCollegeIdentifiers,
        });

      } catch (err: any) {
        console.error("Failed to fetch data:", err);
        alert(err.message || "Failed to fetch data");
      }
    };

    fetchAll();
  }, [user]);

  const filteredCoursesByPrograms = useMemo(() => {
    if (formData.selectedPrograms.length === 0) return [];
    const courseIds = Array.from(
      new Set(
        sectionCourses
          .filter(sc => formData.selectedPrograms.includes(sc.program_id))
          .map(sc => sc.course_id)
      )
    );
    return courses.filter(c => courseIds.includes(c.course_id));
  }, [formData.selectedPrograms, sectionCourses, courses]);

  const filteredModalitiesBySelection = useMemo(() => {
    if (formData.selectedPrograms.length === 0 || formData.selectedCourses.length === 0) return [];
    return modalities.filter(
      m =>
        formData.selectedPrograms.includes(m.program_id) &&
        formData.selectedCourses.includes(m.course_id)
    );
  }, [formData.selectedPrograms, formData.selectedCourses, modalities]);

  const CheckboxOption = (props: any) => {
    return (
      <components.Option {...props}>
        <input
          type="checkbox"
          checked={props.isSelected}
          onChange={() => null}
        />{" "}
        <label>{props.label}</label>
      </components.Option>
    );
  };

  const addSelectAllOption = (options: any[], label = "Select All") => [
    { value: "__all__", label },
    ...options,
  ];

  const termNameById = useMemo(() => {
    const map = new Map<number | string, string>();
    terms.forEach((t) => {
      map.set(t.term_id, t.term_name ?? String(t.term_id));
    });
    return map;
  }, [terms]);

  useEffect(() => {
    if (!formData.program_id) {
      setFilteredCourses([]);
      return;
    }

    const courseIds = Array.from(
      new Set(
        sectionCourses
          .filter((sc) => sc.program_id === formData.program_id)
          .map((sc) => sc.course_id)
      )
    );

    const filtered = courses.filter((c) => courseIds.includes(c.course_id));
    setFilteredCourses(filtered);
    setFormData((prev) => ({ ...prev, course_id: "" }));
  }, [formData.program_id, courses, sectionCourses]);

  useEffect(() => {
    if (!formData.course_id || !formData.program_id) {
      setFilteredModalities([]);
      return;
    }
    const filtered = modalities.filter(
      (m) =>
        m.course_id === formData.course_id &&
        m.program_id === formData.program_id
    );
    setFilteredModalities(filtered);
    setFormData((prev) => ({
      ...prev,
      modality_id: 0,
      section_name: "",
      room_id: null,
    }));
  }, [formData.course_id, formData.program_id, modalities]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "modality_id" || name === "examperiod_id") {
      setFormData((prev) => ({
        ...prev,
        [name]: value === "" ? 0 : Number(value),
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const uniqueAcademicYearTermOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { key: string; label: string; value: string }[] = [];
    for (const p of examPeriods) {
      const termName = termNameById.get(p.term_id) ?? p.term_id ?? "Term";
      const key = `${p.academic_year}||${termName}`;
      if (!seen.has(key)) {
        seen.add(key);
        const label = `${p.academic_year} | ${termName}`;
        const value = `${p.academic_year} | ${termName}`;
        options.push({ key, label, value });
      }
    }
    return options;
  }, [examPeriods, termNameById]);

  const uniqueExamCategoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const p of examPeriods) {
      const cat = p.exam_category ?? "";
      if (cat && !seen.has(cat)) {
        seen.add(cat);
        options.push(cat);
      }
    }
    return options;
  }, [examPeriods]);

  useEffect(() => {
    if (uniqueAcademicYearTermOptions.length > 0 && !formData.academic_year) {
      const latestYearTerm = uniqueAcademicYearTermOptions[0].value;
      setFormData(prev => ({ ...prev, academic_year: latestYearTerm }));
    }

    if (uniqueExamCategoryOptions.length > 0 && !formData.exam_category) {
      const latestExamCategory = uniqueExamCategoryOptions[0];
      setFormData(prev => ({ ...prev, exam_category: latestExamCategory }));
    }
  }, [uniqueAcademicYearTermOptions, uniqueExamCategoryOptions]);

  const examDateOptions = useMemo(() => {
    if (!examPeriods.length || !userCollegeIds.length) return [];

    const allowedPeriods = examPeriods.filter((p) =>
      userCollegeIds.includes(String(p.college_id))
    );

    const days: { key: string; iso: string; label: string }[] = [];
    for (const period of allowedPeriods) {
      if (!period.start_date || !period.end_date) continue;
      const start = new Date(period.start_date);
      const end = new Date(period.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        days.push({ key: `${period.examperiod_id}-${iso}`, iso, label });
      }
    }

    const seen = new Set<string>();
    return days.filter((d) => {
      if (seen.has(d.iso)) return false;
      seen.add(d.iso);
      return true;
    });
  }, [examPeriods, userCollegeIds]);

  const handleSave = async () => {
    if (
      !formData.selectedPrograms.length ||
      !formData.selectedCourses.length ||
      !formData.selectedModalities.length
    ) {
      alert("Please complete program, course, and modality selection.");
      return;
    }

    if (!formData.selectedExamDates.length) {
      alert("Please select at least one exam date.");
      return;
    }

    await assignExamSchedules();
  };

  const assignExamSchedules = async () => {
    // ============================================================================
    // CONFIGURATION - OPTIMIZED FOR PERFORMANCE AND NO OVERLAPS
    // ============================================================================
    const POPULATION_SIZE = 50;
    const GENERATIONS = 100;
    const MUTATION_RATE = 0.25;
    const ELITE_SIZE = 5;
    const TOURNAMENT_SIZE = 3;
    const YIELD_EVERY_N_GENERATIONS = 10;

    // ============================================================================
    // DATA PREPARATION
    // ============================================================================
    
    let academicYear: string | null = null;
    let semester: string | null = null;
    if (formData.academic_year) {
      const [yearPart, semPart] = formData.academic_year.split("|").map((s) => s.trim());
      academicYear = yearPart ?? null;
      semester = semPart ?? null;
    }

    const sortedDates = [...formData.selectedExamDates].sort();
    const examPeriod =
      sortedDates.length > 1
        ? `${new Date(sortedDates[0]).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })} - ${new Date(sortedDates[sortedDates.length - 1]).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}`
        : new Date(sortedDates[0]).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });

    // ============================================================================
    // FETCH PROCTOR AVAILABILITY - OPTIMIZED
    // ============================================================================
    const { data: allAvailability, error: availError } = await supabase
      .from("tbl_availability")
      .select("user_id, days, time_slots")
      .eq("status", "available");

    if (availError) {
      console.error("Error fetching availability:", availError);
      toast.error("Failed to fetch proctor availability");
      return;
    }

    const TIME_SLOT_RANGES: Record<string, string[]> = {
      "7 AM - 1 PM (Morning)": ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"],
      "1 PM - 6 PM (Afternoon)": ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"],
      "6 PM - 9 PM (Evening)": ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30"]
    };

    const availabilityMap = new Map<string, Set<number>>();
    
    allAvailability?.forEach(a => {
      const proctorId = a.user_id;
      const daysArray = a.days || [];
      const timeSlotsArray = a.time_slots || [];

      daysArray.forEach((dayStr: string) => {
        timeSlotsArray.forEach((timeSlotPeriod: string) => {
          const specificTimes = TIME_SLOT_RANGES[timeSlotPeriod] || [];
          
          specificTimes.forEach(slot => {
            const key = `${dayStr}|${slot}`;
            if (!availabilityMap.has(key)) {
              availabilityMap.set(key, new Set());
            }
            availabilityMap.get(key)!.add(proctorId);
          });
        });
      });
    });

    // ============================================================================
    // BUILD OPTIMIZED LOOKUP STRUCTURES
    // ============================================================================
    
    const roomCapacityMap = new Map<string, number>();
    roomsCache.forEach(r => roomCapacityMap.set(r.room_id, r.room_capacity));

    const buildingMap = new Map<string, string>();
    buildingsCache.forEach(b => buildingMap.set(b.building_id, b.building_name));

    const roomToBuildingMap = new Map<string, string>();
    roomsCache.forEach(r => roomToBuildingMap.set(r.room_id, r.building_id));

    const schedulerCollegeId = userCollegeIds[0];
    const collegeObj = collegesCache?.find((c) => c.college_id === schedulerCollegeId);
    const collegeNameForCourse = collegeObj?.college_name ?? "Unknown College";

    const allSections: any[] = [];
    const sectionMap = new Map<number, any>();
    for (const modalityId of formData.selectedModalities) {
      const selectedModality = modalities.find((m) => m.modality_id === modalityId);
      if (selectedModality) {
        allSections.push(selectedModality);
        sectionMap.set(modalityId, selectedModality);
      }
    }

    const totalDurationMinutes = (duration.hours ?? 0) * 60 + (duration.minutes ?? 0);

    // ============================================================================
    // PRE-COMPUTE VALID TIMES AND ROOMS
    // ============================================================================

    const isValidTimeSlot = (startTime: string): boolean => {
      const [startHour, startMinute] = startTime.split(":").map(Number);
      const endMinutes = (startHour * 60 + startMinute) + totalDurationMinutes;
      return endMinutes <= (20 * 60 + 60);
    };

    const validTimes = times.filter(isValidTimeSlot);

    const sectionRoomsMap = new Map<number, string[]>();
    allSections.forEach(section => {
      const enrolledCount = section.enrolled_students ?? 0;
      const possibleRooms = section.possible_rooms ?? [];
      
      const allSuitable = Array.from(roomCapacityMap.entries())
        .filter(([_, capacity]) => capacity >= enrolledCount)
        .map(([id, _]) => id)
        .sort((a, b) => {
          const capA = roomCapacityMap.get(a) || 0;
          const capB = roomCapacityMap.get(b) || 0;
          const wasteA = Math.abs(capA - enrolledCount);
          const wasteB = Math.abs(capB - enrolledCount);
          return wasteA - wasteB;
        });
      
      const preferred = possibleRooms.filter((r: string) => allSuitable.includes(r));
      const others = allSuitable.filter(r => !preferred.includes(r));
      
      sectionRoomsMap.set(section.modality_id, [...preferred, ...others]);
    });

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================

    const extractYearLevel = (sectionName: string | null | undefined): string => {
      if (!sectionName) return "Unknown";
      const match = sectionName.match(/(\d)/);
      return match ? match[1] : "Unknown";
    };

    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const rangesOverlap = (start1: number, end1: number, start2: number, end2: number): boolean => {
      return start1 < end2 && start2 < end1;
    };

    const getTimeSlots = (startTime: string): string[] => {
      const [startHour, startMinute] = startTime.split(":").map(Number);
      const slots: string[] = [];
      for (let m = 0; m < totalDurationMinutes; m += 30) {
        const h = startHour + Math.floor((startMinute + m) / 60);
        const mi = (startMinute + m) % 60;
        slots.push(`${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`);
      }
      return slots;
    };

    const getAvailableProctors = (date: string, startTime: string): number[] => {
      const examTimeSlots = getTimeSlots(startTime);
      
      const proctorSets = examTimeSlots.map(slot => {
        const key = `${date}|${slot}`;
        return availabilityMap.get(key) || new Set<number>();
      });
      
      if (proctorSets.length === 0) return [];
      
      const availableProctors = Array.from(proctorSets[0]).filter(proctorId =>
        proctorSets.every(set => set.has(proctorId))
      );
      
      return availableProctors;
    };

    // ============================================================================
    // PRE-VALIDATION
    // ============================================================================
    
    const violations: string[] = [];
    
    const maxRoomCapacity = Math.max(...Array.from(roomCapacityMap.values()));
    for (const section of allSections) {
      const enrolledCount = section.enrolled_students ?? 0;
      if (enrolledCount > maxRoomCapacity) {
        violations.push(
          `Section ${section.course_id} - ${section.section_name} (${enrolledCount} students) exceeds maximum room capacity (${maxRoomCapacity})`
        );
      }
    }

    const datesWithoutProctors: string[] = [];
    for (const date of sortedDates) {
      let hasAnyProctors = false;
      for (const timeSlot of validTimes) {
        const proctors = getAvailableProctors(date, timeSlot);
        if (proctors.length > 0) {
          hasAnyProctors = true;
          break;
        }
      }
      if (!hasAnyProctors) {
        datesWithoutProctors.push(date);
      }
    }

    if (datesWithoutProctors.length > 0) {
      const formattedDates = datesWithoutProctors.map(d => new Date(d).toLocaleDateString()).join(", ");
      violations.push(
        `No proctors available for: ${formattedDates}\n\nPlease ensure proctors have set their availability.`
      );
    }

    if (violations.length > 0) {
      alert(`Cannot generate schedule:\n\n${violations.join("\n\n")}`);
      return;
    }

    // ============================================================================
    // GENETIC ALGORITHM
    // ============================================================================

    interface Gene {
      sectionId: number;
      date: string;
      timeSlot: string;
      roomId: string;
      proctorId: number;
    }

    type Chromosome = Gene[];

    const generateRandomChromosome = (): Chromosome => {
      const chromosome: Chromosome = [];
      
      // Group sections by course
      const sectionsByCourse = new Map<string, any[]>();
      allSections.forEach(section => {
        const courseId = section.course_id;
        if (!sectionsByCourse.has(courseId)) {
          sectionsByCourse.set(courseId, []);
        }
        sectionsByCourse.get(courseId)!.push(section);
      });

      // CRITICAL: Assign each course to ONE specific date
      const courseDateAssignment = new Map<string, string>();
      const coursesArray = Array.from(sectionsByCourse.keys());
      
      coursesArray.forEach(courseId => {
        const randomDate = sortedDates[Math.floor(Math.random() * sortedDates.length)];
        courseDateAssignment.set(courseId, randomDate);
      });

      const usedTimeSlotsPerDate = new Map<string, Map<string, string>>();
      const courseTimeSlotAssignments = new Map<string, Map<string, string>>();
      
      // Track time ranges to prevent overlaps
      const roomTimeRanges = new Map<string, Array<{start: number, end: number}>>();
      const proctorTimeRanges = new Map<string, Array<{start: number, end: number}>>();

      for (const section of allSections) {
        const yearLevel = extractYearLevel(section.section_name);
        const courseId = section.course_id;
        
        // CRITICAL: All sections of the same course MUST be on the same date
        const date = courseDateAssignment.get(courseId)!;
        
        if (!usedTimeSlotsPerDate.has(date)) {
          usedTimeSlotsPerDate.set(date, new Map());
        }
        const dateSlots = usedTimeSlotsPerDate.get(date)!;
        
        if (!courseTimeSlotAssignments.has(courseId)) {
          courseTimeSlotAssignments.set(courseId, new Map());
        }
        
        let timeSlot: string;
        
        // All sections of same course get same time slot
        if (courseTimeSlotAssignments.get(courseId)!.has(date)) {
          timeSlot = courseTimeSlotAssignments.get(courseId)!.get(date)!;
        } else {
          timeSlot = validTimes[Math.floor(Math.random() * validTimes.length)];
          let attempts = 0;
          const maxAttempts = 15;
          
          while (attempts < maxAttempts) {
            const timeIndex = validTimes.indexOf(timeSlot);
            const prevSlot = timeIndex > 0 ? validTimes[timeIndex - 1] : null;
            const nextSlot = timeIndex < validTimes.length - 1 ? validTimes[timeIndex + 1] : null;
            
            const hasConflict = 
              dateSlots.get(timeSlot) === yearLevel ||
              (prevSlot && dateSlots.get(prevSlot) === yearLevel) ||
              (nextSlot && dateSlots.get(nextSlot) === yearLevel);
            
            if (!hasConflict) {
              break;
            }
            
            timeSlot = validTimes[Math.floor(Math.random() * validTimes.length)];
            attempts++;
          }
          
          courseTimeSlotAssignments.get(courseId)!.set(date, timeSlot);
          dateSlots.set(timeSlot, yearLevel);
        }
        
        const startMinutes = timeToMinutes(timeSlot);
        const endMinutes = startMinutes + totalDurationMinutes;
        
        // Find suitable rooms that don't have time overlaps
        const suitableRooms = sectionRoomsMap.get(section.modality_id) || [];
        let roomId = "";
        
        for (const room of suitableRooms) {
          const roomDateKey = `${date}|${room}`;
          const existingRanges = roomTimeRanges.get(roomDateKey) || [];
          
          let hasOverlap = false;
          for (const range of existingRanges) {
            if (rangesOverlap(startMinutes, endMinutes, range.start, range.end)) {
              hasOverlap = true;
              break;
            }
          }
          
          if (!hasOverlap) {
            roomId = room;
            if (!roomTimeRanges.has(roomDateKey)) {
              roomTimeRanges.set(roomDateKey, []);
            }
            roomTimeRanges.get(roomDateKey)!.push({ start: startMinutes, end: endMinutes });
            break;
          }
        }
        
        // If no room found without overlap, pick random (will be fixed by evolution)
        if (!roomId && suitableRooms.length > 0) {
          roomId = suitableRooms[Math.floor(Math.random() * suitableRooms.length)];
        }
        
        // CRITICAL: Find proctors that don't have ANY time overlaps (can only be in one room at a time)
        const availableProctors = getAvailableProctors(date, timeSlot);
        let proctorId = -1;
        
        for (const proctor of availableProctors) {
          const proctorDateKey = `${date}|${proctor}`;
          const existingRanges = proctorTimeRanges.get(proctorDateKey) || [];
          
          let hasOverlap = false;
          for (const range of existingRanges) {
            if (rangesOverlap(startMinutes, endMinutes, range.start, range.end)) {
              hasOverlap = true;
              break;
            }
          }
          
          if (!hasOverlap) {
            proctorId = proctor;
            if (!proctorTimeRanges.has(proctorDateKey)) {
              proctorTimeRanges.set(proctorDateKey, []);
            }
            proctorTimeRanges.get(proctorDateKey)!.push({ start: startMinutes, end: endMinutes });
            break;
          }
        }
        
        // If no proctor found without overlap, pick random (will be fixed by evolution)
        if (proctorId === -1 && availableProctors.length > 0) {
          proctorId = availableProctors[Math.floor(Math.random() * availableProctors.length)];
        }

        chromosome.push({ sectionId: section.modality_id, date, timeSlot, roomId, proctorId });
      }

      return chromosome;
    };

    const calculateFitness = (chromosome: Chromosome): number => {
      let fitness = 0;

      const roomSchedule = new Map<string, Set<string>>();
      const proctorSchedule = new Map<string, Set<number>>();
      const studentSchedule = new Map<string, Set<string>>();
      const proctorLoadCount = new Map<number, number>();
      const sectionScheduledCount = new Map<number, number>();
      const yearLevelByTimeSlot = new Map<string, Set<string>>();
      const collegeSchedule = new Map<string, Set<string>>();
      const courseTimeSlots = new Map<string, Map<string, Set<string>>>();
      const courseDateAssignments = new Map<string, Set<string>>();
      
      // Track all time slots used by each entity to detect overlaps
      const roomTimeRanges = new Map<string, Array<{start: number, end: number, sectionId: number}>>();
      const proctorTimeRanges = new Map<string, Array<{start: number, end: number, sectionId: number}>>();

      for (const gene of chromosome) {
        const section = sectionMap.get(gene.sectionId);
        if (!section) continue;

        const { date, timeSlot, roomId, proctorId } = gene;
        const timeSlots = getTimeSlots(timeSlot);
        const enrolledCount = section.enrolled_students ?? 0;
        const yearLevel = extractYearLevel(section.section_name);
        const programId = section.program_id;
        const courseId = section.course_id;

        // Calculate time range for this exam
        const startMinutes = timeToMinutes(timeSlot);
        const endMinutes = startMinutes + totalDurationMinutes;

        // Section uniqueness
        sectionScheduledCount.set(gene.sectionId, (sectionScheduledCount.get(gene.sectionId) || 0) + 1);
        if (sectionScheduledCount.get(gene.sectionId)! > 1) {
          fitness -= 10000;
        }

        // CRITICAL RULE: All sections of same course MUST be on same date
        if (!courseDateAssignments.has(courseId)) {
          courseDateAssignments.set(courseId, new Set());
        }
        courseDateAssignments.get(courseId)!.add(date);
        
        if (courseDateAssignments.get(courseId)!.size > 1) {
          fitness -= 25000; // MASSIVE PENALTY: Course split across multiple dates
        }

        // RULE I: Same Course MUST be at Same Time
        if (!courseTimeSlots.has(courseId)) {
          courseTimeSlots.set(courseId, new Map());
        }
        if (!courseTimeSlots.get(courseId)!.has(date)) {
          courseTimeSlots.get(courseId)!.set(date, new Set());
        }
        
        const courseTimesForDate = courseTimeSlots.get(courseId)!.get(date)!;
        
        if (courseTimesForDate.size > 0) {
          const existingTimeSlot = Array.from(courseTimesForDate)[0];
          if (existingTimeSlot !== timeSlot) {
            fitness -= 15000; // CRITICAL: Same course at different times
          }
        }
        courseTimesForDate.add(timeSlot);

        // Student conflicts
        const studentKey = `${yearLevel}-${programId}`;

        for (const slot of timeSlots) {
          const studentKey2 = `${date}|${slot}`;
          if (!studentSchedule.has(studentKey2)) studentSchedule.set(studentKey2, new Set());
          if (studentSchedule.get(studentKey2)!.has(studentKey)) {
            fitness -= 5000;
          }
          studentSchedule.get(studentKey2)!.add(studentKey);
        }

        // RULE II: Year Level Consistency (Vertical Alignment)
        const timeSlotKey = `${date}|${timeSlot}`;
        if (!yearLevelByTimeSlot.has(timeSlotKey)) {
          yearLevelByTimeSlot.set(timeSlotKey, new Set());
        }
        yearLevelByTimeSlot.get(timeSlotKey)!.add(yearLevel);
        
        if (yearLevelByTimeSlot.get(timeSlotKey)!.size > 1) {
          fitness -= 8000; // CRITICAL: Mixed year levels at same time
        }

        // RULE III: College Overlap Prevention
        const program = programs.find(p => p.program_id === programId);
        const collegeId = program ? String(program.department_id) : "unknown";
        
        for (const slot of timeSlots) {
          const collegeKey = `${date}|${slot}|${collegeId}`;
          if (!collegeSchedule.has(collegeKey)) collegeSchedule.set(collegeKey, new Set());
          
          if (collegeSchedule.get(collegeKey)!.size > 0) {
            fitness -= 7000; // CRITICAL: College overlap
          }
          collegeSchedule.get(collegeKey)!.add(section.course_id);
        }

        // Room capacity and NO TIME OVERLAPS
        if (!roomId || roomId === "") {
          fitness -= 8000;
        } else {
          const roomCapacity = roomCapacityMap.get(roomId);
          
          if (!roomCapacity || roomCapacity < enrolledCount) {
            fitness -= 7000;
          } else {
            const wastedCapacity = roomCapacity - enrolledCount;
            fitness -= wastedCapacity * 1;
          }

          // Check for time range overlaps in the same room
          const roomDateKey = `${date}|${roomId}`;
          if (!roomTimeRanges.has(roomDateKey)) {
            roomTimeRanges.set(roomDateKey, []);
          }
          
          const existingRanges = roomTimeRanges.get(roomDateKey)!;
          for (const existing of existingRanges) {
            if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
              fitness -= 20000; // CRITICAL: Room time overlap
            }
          }
          
          existingRanges.push({ start: startMinutes, end: endMinutes, sectionId: gene.sectionId });

          // Keep old slot-by-slot check as backup
          for (const slot of timeSlots) {
            const roomKey = `${date}|${slot}`;
            if (!roomSchedule.has(roomKey)) roomSchedule.set(roomKey, new Set());
            if (roomSchedule.get(roomKey)!.has(roomId)) {
              fitness -= 9000;
            }
            roomSchedule.get(roomKey)!.add(roomId);
          }
        }

        // CRITICAL: Proctor can only be in ONE place at a time (NO SUPERHERO PROCTORS)
        if (proctorId === -1) {
          fitness -= 6000;
        } else {
          const availableProctors = getAvailableProctors(date, timeSlot);
          if (!availableProctors.includes(proctorId)) {
            fitness -= 4000;
          }

          proctorLoadCount.set(proctorId, (proctorLoadCount.get(proctorId) || 0) + 1);

          // Check for time range overlaps for the same proctor
          const proctorDateKey = `${date}|${proctorId}`;
          if (!proctorTimeRanges.has(proctorDateKey)) {
            proctorTimeRanges.set(proctorDateKey, []);
          }
          
          const existingProctorRanges = proctorTimeRanges.get(proctorDateKey)!;
          for (const existing of existingProctorRanges) {
            if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
              fitness -= 30000; // MASSIVE PENALTY: Proctor in multiple rooms at same time!
            }
          }
          
          existingProctorRanges.push({ start: startMinutes, end: endMinutes, sectionId: gene.sectionId });

          // Keep old slot-by-slot check as backup
          for (const slot of timeSlots) {
            const proctorKey = `${date}|${slot}`;
            if (!proctorSchedule.has(proctorKey)) proctorSchedule.set(proctorKey, new Set());
            if (proctorSchedule.get(proctorKey)!.has(proctorId)) {
              fitness -= 15000; // Very high penalty for proctor being in multiple places
            }
            proctorSchedule.get(proctorKey)!.add(proctorId);
          }
        }
      }

      // RULE II (Part B): Sequential Year-Level Breaks
      const timeSlotsByDate = new Map<string, string[]>();
      for (const gene of chromosome) {
        if (!timeSlotsByDate.has(gene.date)) {
          timeSlotsByDate.set(gene.date, []);
        }
        if (!timeSlotsByDate.get(gene.date)!.includes(gene.timeSlot)) {
          timeSlotsByDate.get(gene.date)!.push(gene.timeSlot);
        }
      }

      for (const [date, slots] of timeSlotsByDate) {
        const sortedSlots = slots.sort();
        
        for (let i = 0; i < sortedSlots.length - 1; i++) {
          const currentSlot = sortedSlots[i];
          const nextSlot = sortedSlots[i + 1];
          
          const currentKey = `${date}|${currentSlot}`;
          const nextKey = `${date}|${nextSlot}`;
          
          const currentYearLevels = yearLevelByTimeSlot.get(currentKey);
          const nextYearLevels = yearLevelByTimeSlot.get(nextKey);
          
          if (currentYearLevels && nextYearLevels) {
            for (const year of currentYearLevels) {
              if (nextYearLevels.has(year)) {
                fitness -= 6000; // CRITICAL: Same year level in consecutive slots
              }
            }
          }
        }
      }

      // Reward scheduled sections
      const scheduledCount = chromosome.filter(g => g.roomId && g.roomId !== "" && g.proctorId !== -1).length;
      fitness += scheduledCount * 1000;

      // Proctor load balancing
      const loads = Array.from(proctorLoadCount.values());
      if (loads.length > 1) {
        const avgLoad = loads.reduce((a, b) => a + b, 0) / loads.length;
        const variance = loads.reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / loads.length;
        fitness -= variance * 50;
      }

      return fitness;
    };

    const tournamentSelection = (population: Chromosome[], fitnesses: number[]): Chromosome => {
      let best = Math.floor(Math.random() * population.length);
      for (let i = 1; i < TOURNAMENT_SIZE; i++) {
        const contestant = Math.floor(Math.random() * population.length);
        if (fitnesses[contestant] > fitnesses[best]) best = contestant;
      }
      return population[best].map(gene => ({ ...gene }));
    };

    const crossover = (parent1: Chromosome, parent2: Chromosome): [Chromosome, Chromosome] => {
      const child1: Chromosome = [];
      const child2: Chromosome = [];
      
      for (let i = 0; i < parent1.length; i++) {
        if (Math.random() < 0.5) {
          child1.push({ ...parent1[i] });
          child2.push({ ...parent2[i] });
        } else {
          child1.push({ ...parent2[i] });
          child2.push({ ...parent1[i] });
        }
      }
      
      return [child1, child2];
    };

    const mutate = (chromosome: Chromosome): Chromosome => {
      // First, establish course-to-date mapping from current chromosome
      const courseDateMap = new Map<string, string>();
      chromosome.forEach(gene => {
        const section = sectionMap.get(gene.sectionId);
        if (section) {
          const courseId = section.course_id;
          if (!courseDateMap.has(courseId)) {
            courseDateMap.set(courseId, gene.date);
          }
        }
      });

      return chromosome.map(gene => {
        if (Math.random() < MUTATION_RATE) {
          const section = sectionMap.get(gene.sectionId);
          if (!section) return { ...gene };
          
          const courseId = section.course_id;
          const mutationType = Math.floor(Math.random() * 4);
          const suitableRooms = sectionRoomsMap.get(gene.sectionId) || [];
          
          if (mutationType === 0) {
            // Date mutation - but keep course on same date
            // Only mutate if we want to move the ENTIRE course to a new date
            const shouldMoveEntireCourse = Math.random() < 0.3; // 30% chance to move entire course
            
            if (shouldMoveEntireCourse) {
              const newDate = sortedDates[Math.floor(Math.random() * sortedDates.length)];
              courseDateMap.set(courseId, newDate); // Update the mapping
              const availableProctors = getAvailableProctors(newDate, gene.timeSlot);
              const newProctorId = availableProctors.length > 0
                ? availableProctors[Math.floor(Math.random() * availableProctors.length)]
                : -1;
              return { ...gene, date: newDate, proctorId: newProctorId };
            } else {
              // Don't change date - keep course together
              return { ...gene };
            }
          } else if (mutationType === 1) {
            // Time slot mutation
            const newTimeSlot = validTimes[Math.floor(Math.random() * validTimes.length)];
            const availableProctors = getAvailableProctors(gene.date, newTimeSlot);
            const newProctorId = availableProctors.length > 0
              ? availableProctors[Math.floor(Math.random() * availableProctors.length)]
              : -1;
            return { ...gene, timeSlot: newTimeSlot, proctorId: newProctorId };
          } else if (mutationType === 2) {
            // Room mutation
            const newRoomId = suitableRooms.length > 0
              ? suitableRooms[Math.floor(Math.random() * suitableRooms.length)]
              : "";
            return { ...gene, roomId: newRoomId };
          } else {
            // Proctor mutation
            const availableProctors = getAvailableProctors(gene.date, gene.timeSlot);
            const newProctorId = availableProctors.length > 0
              ? availableProctors[Math.floor(Math.random() * availableProctors.length)]
              : -1;
            return { ...gene, proctorId: newProctorId };
          }
        }
        return { ...gene };
      });
    };

    // ============================================================================
    // EVOLUTION WITH YIELDING
    // ============================================================================

    console.log("🧬 Starting genetic algorithm...");
    toast.info("Generating schedule... This may take a moment.", { autoClose: 2000 });
    
    let population: Chromosome[] = [];
    for (let i = 0; i < POPULATION_SIZE; i++) {
      population.push(generateRandomChromosome());
    }

    let bestChromosome: Chromosome | null = null;
    let bestFitness = -Infinity;

    for (let generation = 0; generation < GENERATIONS; generation++) {
      // Yield to browser every N generations to prevent freezing
      if (generation % YIELD_EVERY_N_GENERATIONS === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const fitnesses = population.map(calculateFitness);
      
      const currentBestIdx = fitnesses.indexOf(Math.max(...fitnesses));
      if (fitnesses[currentBestIdx] > bestFitness) {
        bestFitness = fitnesses[currentBestIdx];
        bestChromosome = population[currentBestIdx];
        
        // Only log every 20 generations to reduce overhead
        if (generation % 20 === 0) {
          console.log(`Generation ${generation}: Best fitness = ${bestFitness}`);
        }
      }

      const nextPopulation: Chromosome[] = [];

      const sortedIndices = fitnesses
        .map((fit, idx) => ({ fit, idx }))
        .sort((a, b) => b.fit - a.fit)
        .map(x => x.idx);
      
      for (let i = 0; i < ELITE_SIZE; i++) {
        nextPopulation.push(population[sortedIndices[i]].map(gene => ({ ...gene })));
      }

      while (nextPopulation.length < POPULATION_SIZE) {
        const parent1 = tournamentSelection(population, fitnesses);
        const parent2 = tournamentSelection(population, fitnesses);
        const [child1, child2] = crossover(parent1, parent2);
        
        nextPopulation.push(mutate(child1));
        if (nextPopulation.length < POPULATION_SIZE) {
          nextPopulation.push(mutate(child2));
        }
      }

      population = nextPopulation;
    }

    if (!bestChromosome) {
      alert("Could not find a valid schedule.");
      return;
    }

    console.log(`✅ Evolution complete! Final best fitness: ${bestFitness}`);

    // ============================================================================
    // CONVERT TO SCHEDULE WITH VALIDATION
    // ============================================================================

    const scheduledExams: any[] = [];
    const unscheduledSections: string[] = [];
    
    // Validation structures
    const finalRoomTimeRanges = new Map<string, Array<{start: number, end: number, course: string, section: string}>>();
    const finalProctorTimeRanges = new Map<string, Array<{start: number, end: number, course: string, section: string}>>();
    const finalCourseDates = new Map<string, Set<string>>();

    for (const gene of bestChromosome) {
      const section = sectionMap.get(gene.sectionId);
      if (!section) continue;

      const { date, timeSlot, roomId, proctorId } = gene;
      const courseId = section.course_id;

      if (!roomId || roomId === "" || proctorId === -1) {
        unscheduledSections.push(`${section.course_id} - ${section.section_name}`);
        continue;
      }

      // VALIDATION: Check course is on one date only
      if (!finalCourseDates.has(courseId)) {
        finalCourseDates.set(courseId, new Set());
      }
      finalCourseDates.get(courseId)!.add(date);
      
      if (finalCourseDates.get(courseId)!.size > 1) {
        console.warn(`⚠️ Course split across dates: ${courseId} is on ${Array.from(finalCourseDates.get(courseId)!).join(', ')}`);
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (course split across multiple dates)`);
        continue;
      }

      const matchedPeriod = examPeriods.find((p) => {
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        return new Date(date) >= start && new Date(date) <= end;
      });

      if (!matchedPeriod) {
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (no matching exam period)`);
        continue;
      }
      
      // Calculate time range
      const [startHour, startMinute] = timeSlot.split(":").map(Number);
      const startMinutes = timeToMinutes(timeSlot);
      const endMinutes = startMinutes + totalDurationMinutes;
      const endHour = startHour + Math.floor((startMinute + totalDurationMinutes) / 60);
      const endMinute = (startMinute + totalDurationMinutes) % 60;
      const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
      
      // FINAL VALIDATION: Check for overlaps
      let hasOverlap = false;
      
      // Check room overlaps
      const roomDateKey = `${date}|${roomId}`;
      const existingRoomRanges = finalRoomTimeRanges.get(roomDateKey) || [];
      for (const existing of existingRoomRanges) {
        if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
          console.warn(`⚠️ Room overlap detected: ${section.course_id} ${section.section_name} overlaps with ${existing.course} ${existing.section} in room ${roomId} on ${date}`);
          hasOverlap = true;
          break;
        }
      }
      
      // CRITICAL: Check proctor overlaps (proctor can only be in one room at a time)
      const proctorDateKey = `${date}|${proctorId}`;
      const existingProctorRanges = finalProctorTimeRanges.get(proctorDateKey) || [];
      for (const existing of existingProctorRanges) {
        if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
          console.warn(`⚠️ SUPERHERO PROCTOR ALERT: Proctor ${proctorId} would be in multiple rooms at same time!`);
          console.warn(`   ${section.course_id} ${section.section_name} (${timeSlot}-${endTime}) overlaps with ${existing.course} ${existing.section} on ${date}`);
          hasOverlap = true;
          break;
        }
      }
      
      if (hasOverlap) {
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (time overlap conflict)`);
        continue;
      }
      
      // Record the time range
      if (!finalRoomTimeRanges.has(roomDateKey)) {
        finalRoomTimeRanges.set(roomDateKey, []);
      }
      finalRoomTimeRanges.get(roomDateKey)!.push({
        start: startMinutes,
        end: endMinutes,
        course: section.course_id,
        section: section.section_name
      });
      
      if (!finalProctorTimeRanges.has(proctorDateKey)) {
        finalProctorTimeRanges.set(proctorDateKey, []);
      }
      finalProctorTimeRanges.get(proctorDateKey)!.push({
        start: startMinutes,
        end: endMinutes,
        course: section.course_id,
        section: section.section_name
      });

      const startTimestamp = `${date}T${timeSlot}:00Z`;
      const endTimestamp = `${date}T${endTime}:00Z`;

      const sectionObj = sectionCourses.find(
        (sc) =>
          sc.program_id === section.program_id &&
          sc.course_id === section.course_id &&
          sc.section_name === section.section_name
      );
      const instructorId = sectionObj?.user_id ?? null;

      const buildingId = roomToBuildingMap.get(roomId);
      const buildingName = buildingId ? buildingMap.get(buildingId) : "Unknown Building";

      scheduledExams.push({
        program_id: section.program_id,
        course_id: section.course_id,
        modality_id: section.modality_id,
        room_id: roomId,
        section_name: section.section_name,
        proctor_id: proctorId,
        examperiod_id: matchedPeriod.examperiod_id,
        exam_date: date,
        exam_start_time: startTimestamp,
        exam_end_time: endTimestamp,
        exam_duration: `${duration.hours ?? 0}h ${duration.minutes ?? 0}m`,
        proctor_timein: formData.proctor_timein ?? null,
        proctor_timeout: formData.proctor_timeout ?? null,
        academic_year: academicYear,
        semester: semester,
        exam_category: formData.exam_category ?? null,
        exam_period: examPeriod,
        college_name: collegeNameForCourse,
        building_name: `${buildingName} (${buildingId})`,
        instructor_id: instructorId,
      });
    }

    // ============================================================================
    // SAVE RESULTS
    // ============================================================================

    if (unscheduledSections.length > 0) {
      const message = `Could not schedule ${unscheduledSections.length} section(s):\n\n${unscheduledSections.slice(0, 10).join("\n")}${unscheduledSections.length > 10 ? `\n... and ${unscheduledSections.length - 10} more` : ""}\n\nScheduled: ${scheduledExams.length}/${allSections.length} sections`;
      
      if (scheduledExams.length === 0) {
        alert(message + "\n\nNo schedules to save. Please adjust constraints or add more resources.");
        return;
      }
      
      const proceed = window.confirm(message + "\n\nDo you want to save the partial schedule?");
      if (!proceed) {
        return;
      }
    }

    if (scheduledExams.length === 0) {
      alert("No valid schedules to save. Please adjust constraints.");
      return;
    }

    console.log(`💾 Saving ${scheduledExams.length} exam schedules...`);

    const { error } = await supabase.from("tbl_examdetails").insert(scheduledExams);
    if (error) {
      console.error("Database error:", error);
      alert("Error saving schedule: " + error.message);
    } else {
      toast.success(`Successfully scheduled ${scheduledExams.length}/${allSections.length} sections!`);
      console.log(`✅ Successfully saved ${scheduledExams.length} exam schedules`);
    }
  };

  const times = [
    "07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
    "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30",
    "17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30"
  ];

  const [duration, setDuration] = useState({ hours: 1, minutes: 0 });
  const [selectedStartTime, setSelectedStartTime] = useState<string>("");

  const filteredPrograms = useMemo(() => {
    if (
      userCollegeIds.length === 0 ||
      departments.length === 0 ||
      programs.length === 0
    ) {
      return programs;
    }

    const allowedDepartments = new Set(
      departments
        .filter((d) => userCollegeIds.includes(String(d.college_id)))
        .map((d) => String(d.department_id).trim())
    );

    return programs.filter((p) =>
      allowedDepartments.has(String(p.department_id).trim())
    );
  }, [programs, userCollegeIds, departments]);

  return (
    <div className="scheduler-container">
      <h2 className="scheduler-header">Generate Schedule</h2>
      <div className="main-content-layout">
        
        <div className="form-column">
          <div className="field">
            <label className="label">Academic Year & Semester</label>
            <select
              name="academic_year"
              value={formData.academic_year ?? ""}
              onChange={handleChange}
              className="select"
            >
              <option value="">Select Academic Year & Semester</option>
              {uniqueAcademicYearTermOptions.map((o) => (
                <option key={o.key} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label">Exam Term</label>
            <select
              name="exam_category"
              value={formData.exam_category ?? ""}
              onChange={handleChange}
              className="select"
            >
              <option value="">Select Exam Category</option>
              {uniqueExamCategoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label">Select Exam Dates</label>
            <Select
              options={examDateOptions.map(d => ({ value: d.iso, label: d.label }))}
              isMulti
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{ Option: CheckboxOption }}
              onChange={(selected) =>
                setFormData(prev => ({
                  ...prev,
                  selectedExamDates: (selected as any[]).map(s => s.value),
                }))
              }
              value={formData.selectedExamDates.map(d => {
                const opt = examDateOptions.find(o => o.iso === d);
                return { value: d, label: opt?.label ?? d };
              })}
            />
          </div>

          <div className="field">
            <label className="label">Program</label>
            <Select
              options={addSelectAllOption(
                filteredPrograms.map(p => ({
                  value: p.program_id,
                  label: `${p.program_id} | ${p.program_name}`,
                }))
              )}
              isMulti
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{ Option: CheckboxOption }}
              onChange={(selected) => {
                let selectedValues = (selected as any[]).map(s => s.value);

                if (selectedValues.includes("__all__")) {
                  const allValues = filteredPrograms.map(p => p.program_id);
                  selectedValues = Array.from(new Set([...selectedValues.filter(v => v !== "__all__"), ...allValues]));
                }

                setFormData(prev => ({
                  ...prev,
                  selectedPrograms: selectedValues.filter(v => v !== "__all__"),
                  selectedCourses: [],
                  selectedModalities: [],
                }));
              }}
              value={formData.selectedPrograms.map(p => {
                const prog = filteredPrograms.find(f => f.program_id === p);
                return { value: p, label: prog ? `${prog.program_id}` : p };
              })}
            />
          </div>

          <div className="field">
            <label className="label">Course</label>
            <Select
              options={addSelectAllOption(
                filteredCoursesByPrograms.map(c => ({
                  value: c.course_id,
                  label: `${c.course_id} | ${c.course_name}`,
                }))
              )}
              isMulti
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{ Option: CheckboxOption }}
              onChange={(selected) => {
                let selectedValues = (selected as any[]).map(s => s.value);

                if (selectedValues.includes("__all__")) {
                  const allValues = filteredCoursesByPrograms.map(c => c.course_id);
                  selectedValues = Array.from(
                    new Set([...selectedValues.filter(v => v !== "__all__"), ...allValues])
                  );
                }

                setFormData(prev => ({
                  ...prev,
                  selectedCourses: selectedValues.filter(v => v !== "__all__"),
                  selectedModalities: [],
                }));
              }}
              value={formData.selectedCourses.map(c => {
                const course = filteredCoursesByPrograms.find(f => f.course_id === c);
                return { value: c, label: course ? `${course.course_id}` : c };
              })}
              styles={{
                valueContainer: (provided) => ({
                  ...provided,
                  maxHeight: "120px",
                  overflowY: "auto",
                }),
              }}
            />
          </div>

          <div className="field">
            <label className="label">Modality</label>
            <Select
              options={addSelectAllOption(
                filteredModalitiesBySelection.map(m => ({
                  value: m.modality_id,
                  label: `${m.modality_type}${m.section_name ? ` – ${m.section_name}` : ""}`,
                }))
              )}
              isMulti
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{ Option: CheckboxOption }}
              onChange={(selected) => {
                let selectedValues = (selected as any[]).map(s => s.value);

                if (selectedValues.includes("__all__")) {
                  const allValues = filteredModalitiesBySelection.map(m => m.modality_id);
                  selectedValues = Array.from(
                    new Set([...selectedValues.filter(v => v !== "__all__"), ...allValues])
                  );
                }

                setFormData(prev => ({
                  ...prev,
                  selectedModalities: selectedValues.filter(v => v !== "__all__"),
                }));
              }}
              value={formData.selectedModalities.map(m => {
                const mod = filteredModalitiesBySelection.find(f => f.modality_id === m);
                return {
                  value: m,
                  label: mod
                    ? `${mod.modality_type}${mod.section_name ? ` – ${mod.section_name}` : ""}`
                    : String(m),
                };
              })}
              styles={{
                valueContainer: (provided) => ({
                  ...provided,
                  maxHeight: "120px",
                  overflowY: "auto",
                }),
              }}
            />
          </div>

          <div className="field">
            <label className="label">Exam Duration</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="number"
                min={0}
                value={duration.hours}
                onChange={(e) => setDuration(prev => ({ ...prev, hours: Number(e.target.value) }))}
                placeholder="Hours"
                className="input"
              />
              <input
                type="number"
                min={0}
                max={59}
                value={duration.minutes}
                onChange={(e) => setDuration(prev => ({ ...prev, minutes: Number(e.target.value) }))}
                placeholder="Minutes"
                className="input"
              />
            </div>
          </div>

          <div className="field">
            <label className="label">Exam Start Time</label>
            <select
              value={selectedStartTime}
              onChange={(e) => setSelectedStartTime(e.target.value)}
              className="select"
            >
              <option value="">Select Start Time</option>
              {times.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="preview-column">
          <h3 className="preview-header">Selected Modality Preview ({formData.selectedModalities.length})</h3>
          
          <input
            type="text"
            placeholder="Search within selected modalities (Course, Section, Type)"
            value={modalityPreviewSearchTerm}
            onChange={(e) => setModalityPreviewSearchTerm(e.target.value)}
            className="input preview-search-input"
          />
          
          {formData.selectedModalities.length > 0 ? (
            <div className="modality-list">
              {formData.selectedModalities
                .map(modalityId => {
                  const modality = filteredModalitiesBySelection.find(m => m.modality_id === modalityId);
                  const course = filteredCoursesByPrograms.find(c => c.course_id === modality?.course_id);

                  const searchString = [
                    course?.course_id,
                    modality?.section_name,
                    modality?.modality_type,
                  ].join(' ').toLowerCase();

                  return { modality, course, searchString, modalityId };
                })
                .filter(item => {
                  if (!modalityPreviewSearchTerm) return true;
                  return item.searchString.includes(modalityPreviewSearchTerm.toLowerCase());
                })
                .map(({ modality, course, modalityId }) => (
                  <div key={modalityId} className="modality-item">
                    <p className="modality-detail">
                      Course: {course ? course.course_id : 'N/A'}
                    </p>
                    <p className="modality-detail">
                      Section: {modality?.section_name ?? 'N/A'}
                    </p>
                    <p className="modality-detail">
                      Modality Type: {modality?.modality_type ?? 'N/A'}
                    </p>
                    <p className="modality-detail">
                      Remarks: {modality?.modality_remarks ?? 'N/A'}
                    </p>
                    <hr className="modality-divider" />
                  </div>
                ))
              }
              {formData.selectedModalities.length > 0 && 
               !formData.selectedModalities
                  .map(id => filteredModalitiesBySelection.find(m => m.modality_id === id))
                  .some(m => [m?.course_id, m?.section_name, m?.modality_type].join(' ').toLowerCase().includes(modalityPreviewSearchTerm.toLowerCase())) &&
                  modalityPreviewSearchTerm && (
                      <p className="helper" style={{marginTop: '10px'}}>No modalities match your search filter.</p>
                  )
              }
            </div>
          ) : (
            <p className="helper">Select one or more modalities to see a preview.</p>
          )}
        </div>
      </div>
      
      <div className="save-button-wrapper">
        <button
          type="button"
          onClick={handleSaveClick}
          className="btn-save"
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {loading ? (
            <FaSpinner className="spin" />
          ) : (
            <FaPlay />
          )}
          {loading ? "Generating" : "Generate Schedule"}
        </button>
      </div>
        <ToastContainer position="top-center" autoClose={3000} />
    </div>
  );
};

export default SchedulerPlottingSchedule;