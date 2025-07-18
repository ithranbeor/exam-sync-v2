import React, { useState, useEffect } from 'react';
import '../styles/proctorSetAvailability.css';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient.ts';

type ProctorSetAvailabilityProps = {
  user: {
    user_id: number;
    [key: string]: unknown;
  };
};

const ProctorSetAvailability: React.FC<ProctorSetAvailabilityProps> = ({ user }) => {

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('7 AM - 12 NN (Morning)');
  const [availabilityStatus, setAvailabilityStatus] = useState('available');
  const [remarks, setRemarks] = useState('');
  const [changeStatus, setChangeStatus] = useState('unavailable');
  const [reason, setReason] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allowedDates, setAllowedDates] = useState<string[]>([]);

  const today = new Date();

  useEffect(() => {
    const localToday = new Date();
    localToday.setHours(12, 0, 0, 0);
    setSelectedDate(localToday.toISOString().split('T')[0]);
    setCurrentMonth(new Date(localToday.getFullYear(), localToday.getMonth(), 1));
  }, []);

  useEffect(() => {
    const fetchExamPeriods = async () => {
      const { data: roleData, error: roleError } = await supabase
        .from('tbl_user_role')
        .select('college_id, department_id')
        .eq('user_id', user.user_id)
        .limit(1)
        .single();

      if (roleError || !roleData) {
        console.error('Error fetching user role:', roleError?.message);
        return;
      }

      const { college_id, department_id } = roleData;

      const { data: periods, error: examError } = await supabase
        .from('tbl_examperiod')
        .select('start_date, end_date')
        .or(`college_id.eq.${college_id},department_id.eq.${department_id}`);

      if (examError || !periods) {
        console.error('Error fetching exam periods:', examError?.message);
        return;
      }

      const generatedDates: string[] = [];

      for (const period of periods) {
        if (!period.start_date || !period.end_date) continue;

        const start = new Date(period.start_date);
        const end = new Date(period.end_date);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

        for (const i = new Date(start); i <= end; i.setDate(i.getDate() + 1)) {
          const dateCopy = new Date(i);
          generatedDates.push(dateCopy.toISOString().split('T')[0]);
        }
      }

      generatedDates.sort();
      setAllowedDates(generatedDates);

      const todayStr = new Date().toISOString().split('T')[0];
      setSelectedDate(generatedDates.includes(todayStr) ? todayStr : generatedDates[0] || '');

      const today = new Date();
      setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    };

    fetchExamPeriods();
  }, []);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const numDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    const daysArray: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) daysArray.push(null);
    for (let i = 1; i <= numDays; i++) daysArray.push(i);
    return daysArray;
  };

  const handleDateSelect = (day: number | null) => {
    if (!day) return;

    const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 12);
    const iso = selected.toISOString().split('T')[0];

    if (allowedDates.includes(iso)) {
      setSelectedDate(iso);
      setShowDatePicker(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today.toISOString().split('T')[0]);
  };

  const timeSlots = [
    '7 AM - 12 NN (Morning)',
    '1 PM - 5 PM (Afternoon)',
    '5 PM - 9 PM (Evening)',
  ];

  const availabilityOptions = ['available', 'unavailable'];

  const handleSubmitAvailability = async (e: React.FormEvent) => {
    e.preventDefault();

    const userId = user?.user_id;
    if (!userId) {
      alert('User is not logged in.');
      return;
    }

    const data = {
      day: selectedDate,
      time_slot: selectedTimeSlot,
      status: availabilityStatus,
      remarks,
      user_id: userId,
    };

    const { error } = await supabase.from('tbl_availability').insert(data);

    if (error) {
      console.error('Error submitting availability:', error.message);
      alert('Failed to submit availability.');
    } else {
      alert('Availability set successfully!');
      setRemarks('');
    }
  };

  const handleSubmitChangeRequest = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Change request:', { changeStatus, reason });
    alert('Change request submitted!');
  };

  return (
    <div className="set-availability-container">
      <div className="availability-sections">
        <div className="availability-card">
          <div className="card-header-set">Set Availability</div>
          <div className="subtitle">(This will allow the proctor to choose his/her availability for the exam schedule. Scroll down to Request Change of Availability)</div>
          <form onSubmit={handleSubmitAvailability} className="availability-form">
            <div className="form-group">
              <label htmlFor="day">Day</label>
              <div className="custom-select-wrapper">
                <input
                  type="text"
                  id="day"
                  value={new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  readOnly
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="date-input-field"
                />
                <span className="dropdown-arrow" onClick={() => setShowDatePicker(!showDatePicker)}>&#9660;</span>
                {showDatePicker && (
                  <div className="date-picker">
                    <div className="date-picker-header">
                      <button type="button" onClick={goToPreviousMonth}><FaChevronLeft /></button>
                      <span>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                      <button type="button" onClick={goToNextMonth}><FaChevronRight /></button>
                    </div>
                    <div className="date-picker-grid">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <div key={i} className="day-name">{d}</div>
                      ))}
                      {getCalendarDays().map((day, index) => {
                      const dayDate = day
                        ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 12)
                        : null;

                      const isoDate = dayDate ? dayDate.toISOString().split('T')[0] : '';
                      const isAllowed = allowedDates.includes(isoDate);
                      const isSelected = isoDate === selectedDate;
                      const isToday = dayDate && dayDate.toDateString() === today.toDateString();

                      return (
                        <div
                          key={index}
                          className={`calendar-day ${day ? 'selectable' : ''} ${isSelected ? 'selected' : ''} ${isToday && !isSelected ? 'today' : ''} ${isAllowed ? '' : 'disabled'}`}
                          onClick={() => isAllowed && handleDateSelect(day)}
                          style={{ pointerEvents: isAllowed ? 'auto' : 'none', opacity: isAllowed ? 1 : 0.3 }}
                        >
                          {day}
                        </div>
                      );
                    })}
                    </div>
                    <div className="date-picker-footer">
                      <button type="button" onClick={goToToday}>Now</button>
                      <button type="button" onClick={() => setShowDatePicker(false)}>Close</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="timeSlot">Time Slot</label>
              <div className="custom-select-wrapper">
                <select
                  id="timeSlot"
                  value={selectedTimeSlot}
                  onChange={(e) => setSelectedTimeSlot(e.target.value)}
                  className="custom-select"
                >
                  {timeSlots.map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
                <span className="dropdown-arrow">&#9660;</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <div className="custom-select-wrapper">
                <select
                  id="status"
                  value={availabilityStatus}
                  onChange={(e) => setAvailabilityStatus(e.target.value)}
                  className="custom-select"
                >
                  {availabilityOptions.map(option => (
                    <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
                  ))}
                </select>
                <span className="dropdown-arrow">&#9660;</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="remarks">Remarks</label>
              <textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Type here..."
              ></textarea>
            </div>

            <button type="submit" className="submit-button">Submit</button>
          </form>
        </div>

        <div className="availability-card">
          <div className="card-header-request">Request Change of Availability</div>
          <div className="subtitle">(only available after the release of exam schedule)</div>
          <form onSubmit={handleSubmitChangeRequest} className="availability-form">
            <div className="form-group">
              <label htmlFor="changeStatus">Status</label>
              <div className="custom-select-wrapper">
                <select
                  id="changeStatus"
                  value={changeStatus}
                  onChange={(e) => setChangeStatus(e.target.value)}
                  className="custom-select"
                >
                  {availabilityOptions.map(option => (
                    <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
                  ))}
                </select>
                <span className="dropdown-arrow">&#9660;</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reason">Reason/s</label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Type here..."
              ></textarea>
            </div>

            <button type="submit" className="submit-button">Submit</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProctorSetAvailability;
