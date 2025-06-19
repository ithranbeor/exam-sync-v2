import React, { useState, useEffect } from 'react';
import { FaTrash, FaEdit, FaSearch } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/colleges.css';

interface College {
  college_id: number;
  name: string;
  dean_name?: string;
}

interface User {
  user_id: string;
}

interface Dean {
  user_id: number;
  full_name: string;
}

interface CollegesProps {
   user?: User;
}

const Colleges: React.FC<CollegesProps> = ({ user }) => {
  const [colleges, setColleges] = useState<College[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newCollegeName, setNewCollegeName] = useState('');
  const [selectedDeanId, setSelectedDeanId] = useState<number | null>(null);
  const [deans, setDeans] = useState<Dean[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editingCollegeId, setEditingCollegeId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchColleges();
    fetchDeans();
  }, []);

  const fetchColleges = async () => {
    const { data, error } = await supabase
      .from('tbl_college')
      .select(`college_id, college_name, dean:tbl_users(first_name, last_name)`);

    if (error || !data) {
      console.error('Error fetching colleges:', error?.message);
      return;
    }

    const formatted = data.map((item: any) => ({
      college_id: item.college_id,
      name: item.college_name,
      dean_name: item.dean ? `${item.dean.first_name} ${item.dean.last_name}` : 'N/A',
    }));
    setColleges(formatted);
  };

  const fetchDeans = async () => {
    const { data, error } = await supabase
      .from('tbl_user_roles')
      .select(`user_id, tbl_users(first_name, last_name)`)
      .eq('role_id', 1); // Role ID for Dean

    if (error || !data) {
      console.error('Error fetching deans:', error?.message);
      return;
    }

    const formatted = data.map((item: any) => ({
      user_id: item.user_id,
      full_name: `${item.tbl_users.first_name} ${item.tbl_users.last_name}`,
    }));
    setDeans(formatted);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleAddCollege = () => {
    setNewCollegeName('');
    setSelectedDeanId(null);
    setEditMode(false);
    setEditingCollegeId(null);
    setShowModal(true);
  };

  const handleModalSubmit = async () => {
    if (!newCollegeName.trim() || selectedDeanId === null) {
      toast.error('Please provide a college name and select a dean.');
      return;
    }

    if (isSubmitting) return; // Prevent double submission

    setIsSubmitting(true);

    try {
      if (editMode && editingCollegeId !== null) {
        const { error } = await supabase
          .from('tbl_college')
          .update({ college_name: newCollegeName, user_id: selectedDeanId })
          .eq('college_id', editingCollegeId);

        if (error) {
          toast.error('Failed to update college.');
        } else {
          toast.success('College updated successfully!');
          fetchColleges();
        }
      } else {
        const { error } = await supabase
          .from('tbl_college')
          .insert([{ college_name: newCollegeName, user_id: selectedDeanId }]);

        if (error) {
          toast.error('Failed to add college.');
        } else {
          toast.success('College added successfully!');
          fetchColleges();
        }
      }

      setShowModal(false);
      setNewCollegeName('');
      setSelectedDeanId(null);
      setEditMode(false);
      setEditingCollegeId(null);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleDelete = async (id: number) => {
    const { error } = await supabase.from('tbl_college').delete().eq('college_id', id);

    if (error) {
      toast.error('Failed to delete college.');
    } else {
      setColleges(colleges.filter((c) => c.college_id !== id));
      toast.success('College deleted successfully!');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event: any) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet);

      for (const row of json) {
        const collegeName = row['College Name']?.trim();
        const deanName = row['Dean Name']?.trim();

        if (!collegeName || !deanName) continue;

        const dean = deans.find(d => d.full_name.toLowerCase() === deanName.toLowerCase());
        if (!dean) {
          toast.error(`Dean not found: ${deanName}`);
          continue;
        }

        const { error } = await supabase
          .from('tbl_college')
          .insert([{ college_name: collegeName, user_id: dean.user_id }]);

        if (error) {
          console.error('Error importing college:', error.message);
          toast.error(`Failed to import ${collegeName}`);
        }
      }

      toast.success('Import completed!');
      fetchColleges();
      setShowImport(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const filteredColleges = colleges.filter((college) =>
    college.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (college.dean_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="colleges-container">
      <div className="colleges-header">
        <h2 className="colleges-title">Manage Colleges</h2>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search for Colleges"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <button className="search-button">
            <FaSearch />
          </button>
        </div>
      </div>

      <div className="colleges-actions">
        <button className="action-button add-new" onClick={handleAddCollege}>
          Add New College
        </button>
        <button className="action-button import" onClick={() => setShowImport(true)}>
          Import Colleges
        </button>
      </div>

      <div className="colleges-table-container">
        <table className="colleges-table">
          <thead>
            <tr>
              <th>#</th>
              <th>College Name</th>
              <th>Dean</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredColleges.length === 0 ? (
              <tr><td colSpan={4}>No colleges found.</td></tr>
            ) : (
              filteredColleges.map((college, index) => (
                <tr key={college.college_id}>
                  <td>{index + 1}</td>
                  <td>{college.name}</td>
                  <td>{college.dean_name}</td>
                  <td className="action-buttons">
                    <button className="icon-button edit-button" onClick={() => {
                      setNewCollegeName(college.name);
                      const dean = deans.find(d => d.full_name === college.dean_name);
                      setSelectedDeanId(dean?.user_id ?? null);
                      setEditingCollegeId(college.college_id);
                      setEditMode(true);
                      setShowModal(true);
                    }}>
                      <FaEdit />
                    </button>
                    <button className="icon-button delete-button" onClick={() => handleDelete(college.college_id)}>
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editMode ? 'Edit College' : 'Add New College'}</h3>
            <input
              type="text"
              placeholder="College Name"
              value={newCollegeName}
              onChange={(e) => setNewCollegeName(e.target.value)}
            />
            <select
              value={selectedDeanId ?? ''}
              onChange={(e) => setSelectedDeanId(Number(e.target.value))}
            >
              <option value="">Select Dean</option>
              {deans.map((dean) => (
                <option key={dean.user_id} value={dean.user_id}>
                  {dean.full_name}
                </option>
              ))}
            </select>
            <div className="modal-actions">
              <button onClick={handleModalSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Import Colleges</h3>
            <input type="file" accept=".xlsx, .xls" onChange={handleImportFile} />
            <div className="modal-actions">
              <button onClick={() => setShowImport(false)}>Done</button>
              <button onClick={() => setShowImport(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Colleges;
