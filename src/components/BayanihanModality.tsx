import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import '../styles/bayanihanModality.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Select, { components } from 'react-select';

interface UserProps {
  user: {
    user_id: number;
    email: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  } | null;
}

const modalityRoomTypeMap: { [key: string]: string } = {
  'Written (Lecture)': 'Lecture',
  'Written (Laboratory)': 'Laboratory',
  'PIT or Projects': 'No Room',
  'Pitching': 'No Room',
  'Hands-on': 'Laboratory',
};

const BayanihanModality: React.FC<UserProps> = ({ user }) => {
  const [form, setForm] = useState({
    modality: '',
    rooms: [] as string[],
    roomType: '',
    program: '',
    sections: [] as string[],
    course: '',
    remarks: '',
  });

  const [programOptions, setProgramOptions] = useState<{ program_id: string; program_name: string }[]>([]);
  const [courseOptions, setCourseOptions] = useState<{ course_id: string; course_name: string }[]>([]);
  const [sectionOptions, setSectionOptions] = useState<{ course_id: string; program_id: string; section_name: string }[]>([]);
  const [roomOptions, setRoomOptions] = useState<{ room_id: string; room_name: string; room_type: string; building_id?: string }[]>([]);
  const [availableRoomIds, setAvailableRoomIds] = useState<string[]>([]);
  const [_sectionDropdownOpen, _setSectionDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);

  const _dropdownRef = useRef<HTMLDivElement>(null);

  // Modal states
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [buildingOptions, setBuildingOptions] = useState<{ id: string; name: string }[]>([]);
  const [occupancyModal, setOccupancyModal] = useState<{ visible: boolean; roomId: string | null }>({
    visible: false,
    roomId: null,
  });

  // Room status with occupied times
  const [roomStatus, setRoomStatus] = useState<{
    [key: string]: { occupiedTimes: { start: string; end: string }[] }
  }>({});

  const CheckboxOption = (props: any) => (
    <components.Option {...props}>
      <input
        type="checkbox"
        checked={props.isSelected}
        readOnly
        style={{ marginRight: 8 }}
      />
      <label>{props.label}</label>
    </components.Option>
  );

  /** FETCH ROOM STATUS BASED ON EXAMDETAILS */
  useEffect(() => {
    const fetchRoomStatus = async () => {
      const { data: exams, error } = await supabase
        .from('tbl_examdetails')
        .select('room_id, exam_start_time, exam_end_time');

      if (error) {
        console.error("Error fetching exams:", error.message);
        return;
      }

      const statusMap: { [key: string]: { occupiedTimes: { start: string; end: string }[] } } = {};

      exams?.forEach(e => {
        if (!statusMap[e.room_id]) {
          statusMap[e.room_id] = { occupiedTimes: [] };
        }
        statusMap[e.room_id].occupiedTimes.push({ start: e.exam_start_time, end: e.exam_end_time });
      });

      setRoomStatus(statusMap);
    };

    fetchRoomStatus();
  }, []);

  /** FETCH PROGRAMS, COURSES, SECTIONS, ROOMS, BUILDINGS, AND AVAILABLE ROOMS */
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.user_id) return;

      setLoadingRooms(true);

      try {
        // USER ROLES
        const { data: roles } = await supabase
          .from('tbl_user_role')
          .select('college_id, department_id')
          .eq('user_id', user.user_id);

        if (!roles || roles.length === 0) {
          setLoadingRooms(false);
          return;
        }

        const leaderDepartments = roles.map(r => r.department_id).filter(Boolean);
        if (!leaderDepartments.length) {
          setLoadingRooms(false);
          return;
        }

        // PROGRAMS
        const { data: programs } = await supabase
          .from('tbl_program')
          .select('program_id, program_name, department_id')
          .in('department_id', leaderDepartments);

        setProgramOptions(programs ?? []);

        // USER COURSES
        const { data: userCourses } = await supabase
          .from('tbl_course_users')
          .select('course_id')
          .eq('user_id', user.user_id)
          .eq('is_bayanihan_leader', true);

        const courseIds = userCourses?.map(c => c.course_id) ?? [];

        const { data: coursesWithNames } = await supabase
          .from('tbl_course')
          .select('course_id, course_name')
          .in('course_id', courseIds);

        setCourseOptions(coursesWithNames ?? []);

        // SECTIONS
        const { data: sectionCourses } = await supabase
          .from('tbl_sectioncourse')
          .select('course_id, program_id, section_name');

        const filteredSections = sectionCourses?.filter(sc => courseIds.includes(sc.course_id)) ?? [];
        setSectionOptions(filteredSections);

        // FETCH AVAILABLE ROOMS (rooms marked as available in RoomManagement)
        /** Get user's college based on role_id = 4 (Bayanihan Leader) **/
        const { data: leaderRoles, error: roleErr } = await supabase
          .from('tbl_user_role')
          .select('department_id, role_id')
          .eq('user_id', user.user_id)
          .eq('role_id', 4); // Bayanihan Leader

        if (roleErr) {
          console.error('Error fetching user role:', roleErr.message);
          toast.error('Unable to fetch your department information.');
          setLoadingRooms(false);
          return;
        }

        if (!leaderRoles || leaderRoles.length === 0) {
          toast.warn('You are not assigned as a Bayanihan Leader.');
          setLoadingRooms(false);
          return;
        }

        const leaderDepartmentIds = leaderRoles.map(r => r.department_id).filter(Boolean);
        if (leaderDepartmentIds.length === 0) {
          toast.warn('No department assigned to your Bayanihan Leader role.');
          setLoadingRooms(false);
          return;
        }

        /** Get the college that these departments belong to **/
        const { data: departments, error: deptErr } = await supabase
          .from('tbl_department')
          .select('department_id, college_id')
          .in('department_id', leaderDepartmentIds);

        if (deptErr) {
          console.error('Error fetching departments:', deptErr.message);
          toast.error('Failed to fetch department-college mapping.');
          setLoadingRooms(false);
          return;
        }

        const collegeIds = departments.map(d => d.college_id).filter(Boolean);
        if (collegeIds.length === 0) {
          toast.warn('No associated college found for your department.');
          setLoadingRooms(false);
          return;
        }

        /** Fetch available rooms filtered by those college IDs **/
        const { data: availableRooms, error: availableError } = await supabase
          .from('tbl_available_rooms')
          .select('room_id, college_id')
          .in('college_id', collegeIds);

        if (availableError) {
          console.error('Error fetching available rooms:', availableError.message);
          toast.error(`Failed to load available rooms: ${availableError.message}`);
          setLoadingRooms(false);
          return;
        }

        const availableIds = availableRooms?.map(r => r.room_id) ?? [];
        setAvailableRoomIds(availableIds);

        /** Fetch room details based on available IDs **/
        if (availableIds.length > 0) {
          const { data: rooms } = await supabase
            .from('tbl_rooms')
            .select('room_id, room_name, room_type, building_id')
            .in('room_id', availableIds);
          setRoomOptions(rooms ?? []);
        } else {
          setRoomOptions([]);
        }

        // BUILDINGS
        const { data: buildings } = await supabase
          .from('tbl_buildings')
          .select('building_id, building_name');

        setBuildingOptions(buildings?.map(b => ({ id: b.building_id, name: b.building_name })) ?? []);

        console.log('Available Room IDs:', availableIds);
        console.log('Filtered Rooms:', roomOptions);
      } catch (error) {
        console.error('Unexpected error fetching data:', error);
        toast.error('An unexpected error occurred while loading data');
      } finally {
        setLoadingRooms(false);
      }
    };

    fetchData();
  }, [user]);

  /** AUTO-SELECT ROOM TYPE BASED ON MODALITY */
  useEffect(() => {
    const requiredRoomType = modalityRoomTypeMap[form.modality];
    if (!requiredRoomType) return;

    if (requiredRoomType === "No Room") {
      setForm(prev => ({ ...prev, rooms: [], roomType: "No Room" }));
      return;
    }

    setForm(prev => ({ ...prev, roomType: requiredRoomType }));
  }, [form.modality]);

  /** HANDLE FORM CHANGE */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'program') {
      setForm(prev => ({ ...prev, program: value, course: '', sections: [] }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  /** HANDLE FORM SUBMIT */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!user?.user_id) return;
    
    if (!form.sections.length) {
      toast.warn('Please select at least one section.');
      return;
    }

    if (form.sections.length !== form.rooms.length) {
      toast.error(`Number of sections must be equal to the number of rooms! (${form.sections.length} of ${form.rooms.length} selected)`);
      return;
    }

    setIsSubmitting(true);

    for (const sectionName of form.sections) {
      const section = sectionOptions.find(
        s => s.course_id === form.course && s.section_name === sectionName
      );
      if (!section) continue;

      const { data: existing, error: checkError } = await supabase
        .from('tbl_modality')
        .select('modality_id')
        .eq('course_id', section.course_id)
        .eq('program_id', section.program_id)
        .eq('section_name', section.section_name)
        .eq('modality_type', form.modality)
        .eq('room_type', form.roomType)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing record:', checkError.message);
        toast.error(`Error checking duplicates for ${section.section_name}`);
        continue;
      }

      if (existing) {
        toast.warn(`Already submitted for ${section.section_name}`);
        continue;
      }

      const { error: insertError } = await supabase.from('tbl_modality').insert([
        {
          modality_type: form.modality,
          room_type: form.roomType,
          modality_remarks: form.remarks,
          course_id: section.course_id,
          program_id: section.program_id,
          section_name: section.section_name,
          possible_rooms: form.rooms,
          user_id: user.user_id,
          created_at: new Date().toISOString(),
        },
      ]);

      if (insertError) toast.error(`Failed to save for ${section.section_name}`);
      else toast.success(`Saved for ${section.section_name}`);
    }

    setIsSubmitting(false);

    // Reset form after submit
    setForm({
      modality: '',
      rooms: [],
      roomType: '',
      program: '',
      sections: [],
      course: '',
      remarks: '',
    });
  };

  /** GET ROOM TIMESLOTS WITH 30-MINUTE VACANT INTERVALS */
  const getRoomTimeslots = (roomId: string) => {
    const dayStart = new Date();
    dayStart.setHours(7, 30, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(21, 0, 0, 0);

    const status = roomStatus[String(roomId)];
    const occupiedTimes =
      status?.occupiedTimes
        .map((t) => ({ start: new Date(t.start), end: new Date(t.end) }))
        .sort((a, b) => a.start.getTime() - b.start.getTime()) || [];

    const timeslots: { start: Date; end: Date; occupied: boolean }[] = [];
    let cursor = new Date(dayStart);

    for (const slot of occupiedTimes) {
      if (cursor.getTime() < slot.start.getTime()) {
        timeslots.push({
          start: new Date(cursor),
          end: new Date(slot.start),
          occupied: false,
        });
      }

      timeslots.push({
        start: new Date(slot.start),
        end: new Date(slot.end),
        occupied: true,
      });

      cursor = new Date(slot.end);
    }

    if (cursor.getTime() < dayEnd.getTime()) {
      timeslots.push({
        start: new Date(cursor),
        end: new Date(dayEnd),
        occupied: false,
      });
    }

    return timeslots;
  };

  /** RENDER TIMESLOT LIST */
  const RoomTimeslots: React.FC<{ roomId: string }> = ({ roomId }) => {
    const slots = getRoomTimeslots(roomId);

    return (
      <div className="occupancy-timeslots">
        {slots.map((slot, i) => (
          <div
            key={i}
            className={`timeslot-entry ${slot.occupied ? "occupied" : "vacant"}`}
          >
            <div className="timeslot-status">
              {slot.occupied ? "Occupied" : "Available"}
            </div>
            <div className="timeslot-time">
              {slot.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
              {slot.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Filter rooms to only show available ones
  const filteredRoomOptions = roomOptions.filter(r => availableRoomIds.includes(r.room_id));

  return (
    <div className="set-availability-container">
      <div className="availability-sections">
        <div className="availability-card">
          <div className="card-header-set">Modality Submission</div>
          <p className="subtitle">Please fill in all fields before submitting.</p>
          
          {loadingRooms ? (
            <div style={{ 
              backgroundColor: '#e3f2fd', 
              border: '1px solid #2196F3', 
              padding: '12px', 
              borderRadius: '4px', 
              marginBottom: '20px',
              color: '#1565C0',
              textAlign: 'center'
            }}>
              Loading available rooms...
            </div>
          ) : availableRoomIds.length === 0 ? (
            <div style={{ 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffc107', 
              padding: '12px', 
              borderRadius: '4px', 
              marginBottom: '20px',
              color: '#856404'
            }}>
              ⚠️ No rooms are currently available for selection. Please contact the administrator to set up available rooms in the Room Management page.
            </div>
          ) : null}

          <form className="availability-form" onSubmit={handleSubmit}>
            <div className="availability-grid">

              {/* MODALITY */}
              <div className="form-group">
                <label>Modality Type</label>
                <Select
                  options={[
                    { value: 'Hands-on', label: 'Hands-on' },
                    { value: 'Written (Lecture)', label: 'Written (Lecture)' },
                    { value: 'Written (Laboratory)', label: 'Written (Laboratory)' },
                    { value: 'PIT or Projects', label: 'PIT or Projects' },
                    { value: 'Pitching', label: 'Pitching' }
                  ]}
                  value={form.modality ? { value: form.modality, label: form.modality } : null}
                  onChange={selected => setForm(prev => ({ ...prev, modality: selected?.value || '' }))}
                  placeholder="Select modality..."
                  isClearable
                />
              </div>

              {/* BUILDING-ROOM */}
              <div className="form-group">
                <label>Building-Room</label>
                <button
                  type="button"
                  className="open-modal-btn"
                  disabled={!form.roomType || form.roomType === "No Room" || availableRoomIds.length === 0 || loadingRooms}
                  onClick={() => setShowRoomModal(true)}
                >
                  {loadingRooms ? 'Loading...' : 'Select Room'}
                </button>

                {form.rooms.length > 0 && (
                  <div className="selected-rooms">
                    {form.rooms.map((roomId) => {
                      const r = roomOptions.find(r => r.room_id === roomId);
                      return (
                        <div key={roomId} className="room-card">
                          {r?.room_id}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ROOM TYPE */}
              <div className="form-group">
                <label>Room Type</label>
                <input
                  type="text"
                  name="roomType"
                  value={form.roomType}
                  readOnly
                  className="custom-select"
                  placeholder="Auto-filled"
                />
              </div>

              {/* PROGRAM */}
              <div className="form-group">
                <label>Program</label>
                <Select
                  options={programOptions.map(p => ({ value: p.program_id, label: `${p.program_id} - ${p.program_name}` }))}
                  value={programOptions.filter(p => p.program_id === form.program).map(p => ({ value: p.program_id, label: `${p.program_id} - ${p.program_name}` }))}
                  onChange={selected => setForm(prev => ({ ...prev, program: selected?.value || '', course: '', sections: [] }))}
                  placeholder="Select program..."
                  isClearable
                />
              </div>

              {/* COURSE */}
              <div className="form-group">
                <label>Course</label>
                <Select
                  isDisabled={!form.program}
                  options={courseOptions
                    .filter(c => sectionOptions.some(s => s.program_id === form.program && s.course_id === c.course_id))
                    .map(c => ({ value: c.course_id, label: `${c.course_id} (${c.course_name})` }))}
                  value={form.course ? { value: form.course, label: `${courseOptions.find(c => c.course_id === form.course)?.course_id} (${courseOptions.find(c => c.course_id === form.course)?.course_name})` } : null}
                  onChange={selected => setForm(prev => ({ ...prev, course: selected?.value || '', sections: [] }))}
                  placeholder="Select course..."
                  isClearable
                />
              </div>

              {/* SECTIONS */}
              <div className="form-group full-width">
                <label>Sections</label>

                {form.course ? (
                  <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    components={{ Option: CheckboxOption }}
                    options={[
                      { value: 'select_all', label: 'Select All Sections' },
                      ...sectionOptions
                        .filter(s => s.course_id === form.course)
                        .map(s => ({ value: s.section_name, label: s.section_name }))
                    ]}
                    value={form.sections.map(sec => ({ value: sec, label: sec }))}
                    onChange={(selected) => {
                      if (!selected) {
                        setForm(prev => ({ ...prev, sections: [] }));
                        return;
                      }

                      const allSections = sectionOptions
                        .filter(s => s.course_id === form.course)
                        .map(s => s.section_name);

                      const isSelectAll = selected.some(s => s.value === 'select_all');

                      if (isSelectAll) {
                        if (form.rooms.length === 0) {
                          toast.warn('Please select rooms first before using "Select All".');
                          return;
                        }

                        const limitedSections = allSections.slice(0, form.rooms.length);
                        setForm(prev => ({ ...prev, sections: limitedSections }));
                        toast.info(`Only ${form.rooms.length} section(s) selected.`);
                        return;
                      }

                      const selectedValues = selected.map(s => s.value);
                      if (selectedValues.length > form.rooms.length) {
                        toast.error(`You can only select ${form.rooms.length} section(s) because ${form.rooms.length} room(s) are selected.`);
                        return;
                      }

                      setForm(prev => ({ ...prev, sections: selectedValues }));
                    }}
                    placeholder="Select sections..."
                  />
                ) : (
                  <p style={{ color: "#888" }}>Select a course first</p>
                )}

                {form.rooms.length > 0 && (
                  <small style={{ marginTop: "4px", display: "block", color: form.sections.length !== form.rooms.length ? "red" : "#666" }}>
                    ⚠️ Number of sections must be equal to the number of rooms! {form.sections.length} of {form.rooms.length} section(s) selected.
                  </small>
                )}
              </div>

              {/* REMARKS */}
              <div className="form-group">
                <label>Remarks</label>
                <textarea
                  name="remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  placeholder="Enter any notes or remarks here..."
                />
              </div>

            </div>

            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="spinner"></span>
              ) : (
                'Submit'
              )}
            </button>
          </form>
        </div>
      </div>

       {/* ROOM MODAL */}
      {showRoomModal && (
        <div className="modal-overlay">
          <div className="modal-contents-modality">
            <h3>Select Room</h3>

            <Select
              options={buildingOptions.map(b => ({
                value: b.id,
                label: `${b.name} (${b.id})`,
              }))}
              value={
                selectedBuilding
                  ? { value: selectedBuilding, label: `${buildingOptions.find(b => b.id === selectedBuilding)?.name} (${selectedBuilding})` }
                  : null
              }
              onChange={(selected) => setSelectedBuilding(selected?.value || null)}
              placeholder="-- Select Building --"
              isClearable
            />

            <div className="room-grid">
              {filteredRoomOptions
                .filter(r => !selectedBuilding || r.building_id === selectedBuilding)
                .sort((a, b) => {
                  if (a.room_type === form.roomType && b.room_type !== form.roomType) return -1;
                  if (a.room_type !== form.roomType && b.room_type === form.roomType) return 1;
                  return a.room_name.localeCompare(b.room_name);
                })
                .map(r => {
                  const isDisabled = r.room_type !== form.roomType;
                  const isSelected = form.rooms.includes(r.room_id);

                  return (
                    <div
                      key={r.room_id}
                      className={`room-box ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""}`}
                      onClick={() => {
                        if (isDisabled) return;
                        setForm(prev => ({
                          ...prev,
                          rooms: isSelected
                            ? prev.rooms.filter(id => id !== r.room_id)
                            : [...prev.rooms, r.room_id],
                        }));
                      }}
                    >
                      <div className="room-label">
                        {r.room_id} <small>({r.room_type})</small>
                      </div>

                      {!isDisabled && (
                        <button
                          type="button"
                          className="view-occupancy"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOccupancyModal({ visible: true, roomId: r.room_id });
                          }}
                        >
                          <small>View Vacancy</small>
                        </button>
                      )}
                    </div>
                  );
                })}

              {filteredRoomOptions.filter(r => !selectedBuilding || r.building_id === selectedBuilding).length === 0 && (
                <div className="no-rooms">No available rooms for this room type</div>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="close-modal" onClick={() => setShowRoomModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OCCUPANCY MODAL */}
      {occupancyModal.visible && occupancyModal.roomId && (
        <div className="modal-overlay">
          <div className="modal-contents-modality">
            <h3>Room Occupancy</h3>
            <RoomTimeslots roomId={occupancyModal.roomId} />
            <div className="modal-actions">
              <button
                type="button"
                className="close-modal"
                onClick={() => setOccupancyModal({ visible: false, roomId: null })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default BayanihanModality;