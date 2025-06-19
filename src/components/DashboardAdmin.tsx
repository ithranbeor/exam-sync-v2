import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.ts'; // Make sure this is correctly set
import {
  FaHome, FaBuilding, FaClipboardList, FaBook, FaUserGraduate,
  FaChalkboardTeacher, FaCalendarAlt, FaDoorOpen, FaUser,
  FaUsers, FaSignOutAlt, FaBookOpen, FaCalendarDay
} from 'react-icons/fa';
import '../styles/dashboardFaculty.css';
import Colleges from '../components/Colleges.tsx';
import Departments from '../components/Departments.tsx';
import Programs from '../components/Programs.tsx';
import Courses from '../components/Courses.tsx';
import SectionCourses from '../components/SectionCourses.tsx';
import Terms from '../components/Terms.tsx'; 
import Buildings from '../components/Buildings.tsx'; 
import Rooms from '../components/Rooms.tsx'; 
import ExamPeriod from '../components/ExamPeriod.tsx'; 
import Accounts from '../components/Accounts.tsx'; 
import Profile from '../components/Profile.tsx';
import Scheduler_Dashboard from './Scheduler_Dashboard.tsx';
import Scheduler_PlotSchedule from './Scheduler_PlotSchedule.tsx';
import Scheduler_Notification from './Scheduler_Notification.tsx';
import Scheduler_Availability from './Scheduler_Availability.tsx';

const iconStyle = { className: 'icon', size: 20 };

const DashboardAdmin = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser =
      JSON.parse(localStorage.getItem('user') || 'null') ||
      JSON.parse(sessionStorage.getItem('user') || 'null');
    if (!storedUser) {
      navigate('/');
    } else {
      setUser(storedUser);
    }
  }, [navigate]);

  useEffect(() => {
    const fetchUserRoles = async () => {
      if (!user?.username) return;

      const { data, error } = await supabase.rpc('get_user_roles_by_username', {
        input_username: user.username
      });

      if (error) {
        console.error('Error fetching roles:', error.message);
      } else {
        type RoleRow = { role_name: string };
        const roleNames = data.map((row: RoleRow) => row.role_name);
        setRoles(roleNames);
      }
    };

    fetchUserRoles();
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    navigate('/');
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getMonthName = (date: Date) =>
    date.toLocaleString('en-US', { month: 'long' });

  const getDayOfWeekName = (date: Date) =>
    date.toLocaleString('en-US', { weekday: 'long' });

  const formattedTime = currentDateTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const [hour, minute, ampm] = formattedTime.split(/:| /);
  const currentMonthName = getMonthName(currentDateTime);
  const currentDay = currentDateTime.getDate();
  const currentDayOfWeek = getDayOfWeekName(currentDateTime);

  if (!user) return <div>Loading...</div>;

  return (
    <div className="app-container">
      <div className="main-content-wrapper">
        <aside
          className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}
          onMouseEnter={() => setIsSidebarOpen(true)}
          onMouseLeave={() => setIsSidebarOpen(false)}
        >
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <img src="./src/assets/Exam.png" alt="Logo" className="logo-img" />
              {isSidebarOpen && <span className="logo-text">ExamSync</span>}
            </div>
          </div>

          <nav className="sidebar-nav">
            <ul>
              <li className={activeMenu === 'dashboard' ? 'active' : ''}>
                <button type="button" onClick={() => setActiveMenu('dashboard')}>
                  <FaHome {...iconStyle} />
                  {isSidebarOpen && <span>Dashboard</span>}
                </button>
              </li>
              <div className="sidebar-divider"></div>
              <li className={activeMenu === 'colleges' ? 'active' : ''}>
                <button type="button" onClick={() => setActiveMenu('colleges')}>
                  <FaUserGraduate {...iconStyle} />
                  {isSidebarOpen && <span>Colleges</span>}
                </button>
              </li>

              <li className={activeMenu === 'departments' ? 'active' : ''}>
                <button type="button" onClick={() => setActiveMenu('departments')}>
                  <FaChalkboardTeacher {...iconStyle} />
                  {isSidebarOpen && <span>Departments</span>}
                </button>
              </li>
              <li className={activeMenu === 'programs' ? 'active' : ''}>
                <button type="button" onClick={() => setActiveMenu('programs')}>
                  <FaBookOpen {...iconStyle} />
                  {isSidebarOpen && <span>Programs</span>}
                </button>
              </li>
              <li className={activeMenu === 'courses' ? 'active' : ''}>
                <button type="button" onClick={() => setActiveMenu('courses')}>
                  <FaBook {...iconStyle} />
                  {isSidebarOpen && <span>Courses</span>}
                </button>
              </li>
              <li className={activeMenu === 'section-courses' ? 'active' : ''}>
                <button type="button" onClick={() => setActiveMenu('section-courses')}>
                  <FaClipboardList {...iconStyle} />
                  {isSidebarOpen && <span>Section Courses</span>}
                </button>
              </li>
              <li className={activeMenu === 'terms' ? 'active' : ''}>
                <button type="button" onClick={() => setActiveMenu('terms')}>
                  <FaCalendarDay {...iconStyle} />
                  {isSidebarOpen && <span>Terms</span>}
                </button>
              </li>
              <div className="sidebar-divider"></div>
              <li className={activeMenu === 'buildings' ? 'active' : ''}>
                <button type="button" onClick={() => setActiveMenu('buildings')}>
                  <FaBuilding {...iconStyle} />
                  {isSidebarOpen && <span>Buildings</span>}
                </button>
              </li>
              <li className={activeMenu === 'rooms' ? 'active' : ''}>
                <button type="button" onClick={() => setActiveMenu('rooms')}>
                  <FaDoorOpen {...iconStyle} />
                  {isSidebarOpen && <span>Rooms</span>}
                </button>
              </li>
              <li className={activeMenu === 'exam-period' ? 'active' : ''}>
                <button type="button" onClick={() => setActiveMenu('exam-period')}>
                  <FaCalendarAlt {...iconStyle} />
                  {isSidebarOpen && <span>Exam Period</span>}
                </button>
              </li>
              <div className="sidebar-divider"></div>
              <li className={activeMenu === 'accounts' ? 'active' : ''}>
                <button type="button" onClick={() => setActiveMenu('accounts')}>
                  <FaUsers {...iconStyle} />
                  {isSidebarOpen && <span>Accounts</span>}
                </button>
              </li>
              <div className="sidebar-divider"></div>
              <li className={activeMenu === 'scheduler' ? 'active' : ''}>
                <button type="button" onClick={() => setActiveMenu('scheduler')}>
                  <FaDoorOpen {...iconStyle} />
                  {isSidebarOpen && <span>Scheduler/Staff</span>}
                </button>
              </li>
              <li className={activeMenu === 'plotsched' ? 'active' : ''}>
                <button type="button" onClick={() => setActiveMenu('plotsched')}>
                  <FaBuilding {...iconStyle} />
                  {isSidebarOpen && <span>Plot Schedule</span>}
                </button>
              </li>
              <li className={activeMenu === 'availability' ? 'active' : ''}>
                <button type="button" onClick={() => setActiveMenu('availability')}>
                  <FaBuilding {...iconStyle} />
                  {isSidebarOpen && <span>Availability</span>}
                </button>
              </li>
              <li className={activeMenu === 'notification' ? 'active' : ''}>
                <button type="button" onClick={() => setActiveMenu('notification')}>
                  <FaBuilding {...iconStyle} />
                  {isSidebarOpen && <span>Notification</span>}
                </button>
              </li>
              <div className="sidebar-divider"></div>
              <li className={activeMenu === 'profile' ? 'active' : ''}>
                <button type="button" onClick={() => setActiveMenu('profile')}>
                  <FaUser {...iconStyle} />
                  {isSidebarOpen && <span>Profile</span>}
                </button>
              </li>
              <li>
                <button type="button" onClick={handleLogout}>
                  <FaSignOutAlt {...iconStyle} />
                  {isSidebarOpen && <span>Logout</span>}
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        <main className={`main-content ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="content-header">
          <h1>{activeMenu.charAt(0).toUpperCase() + activeMenu.slice(1)}</h1>
        </div>

        {activeMenu === 'dashboard' && (
          <div className="dashboard-grid">
            <div className="card welcome-card">
              <h3>
                Welcome, <span className="robert-name">{user.first_name || 'User'}!</span>
              </h3>
              <p>Organize your work and improve your performance here</p>
            </div>

            <div className="card datetime-card">
              <div className="date-display-simple">
                <span>{currentMonthName} {currentDay}, {currentDayOfWeek}</span>
              </div>
              <div className="time-display">
                <span>{hour}:</span>
                <span>{minute}</span>
                <span className="ampm">{ampm}</span>
              </div>
            </div>

            <div className="card faculty-info-card">
              <img
                src="./src/assets/ba.png"
                alt={`${user.first_name} ${user.middle_name} ${user.last_name}`}
                className="faculty-avatar"
              />
              <h4>{user.first_name} {user.middle_name} {user.last_name}</h4>
              <p>{roles.length ? roles.join(', ') : 'Loading role(s)...'}</p>
            </div>

            <div className="full-width-section">
              <h2>Try these things out</h2>
              <div className="try-things-grid">
                <div className="card try-thing-card">
                  <img src="./src/assets/ba.png" alt="Set Availability" className="try-thing-img" />
                  <p>Try Setting Your Availability</p>
                  <button type="button" className="set-button">Set</button>
                </div>

                <div className="card try-thing-card">
                  <img src="./src/assets/ba.png" alt="View Exam Schedule" className="try-thing-img" />
                  <p>View Exam Schedule</p>
                  <button type="button" className="view-button">View</button>
                </div>
              </div>
            </div>
          </div>
          )}
          {activeMenu === 'colleges' && <Colleges user={user}/>}
          {activeMenu === 'departments' && <Departments />}
          {activeMenu === 'programs' && <Programs />}
          {activeMenu === 'courses' && <Courses />}
          {activeMenu === 'section-courses' && <SectionCourses />}
          {activeMenu === 'terms' && <Terms />}
          {activeMenu === 'buildings' && <Buildings />}
          {activeMenu === 'rooms' && <Rooms />}
          {activeMenu === 'exam-period' && <ExamPeriod />}
          {activeMenu === 'accounts' && <Accounts user={user}/>}
          {activeMenu === 'profile' && <Profile />}
          {activeMenu === 'scheduler' && <Scheduler_Dashboard />}
          {activeMenu === 'plotsched' && <Scheduler_PlotSchedule />}
          {activeMenu === 'availability' && <Scheduler_Availability />}
          {activeMenu === 'notification' && <Scheduler_Notification />}
        </main>
      </div>
    </div>
  );
};

export default DashboardAdmin;
