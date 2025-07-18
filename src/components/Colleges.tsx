// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect } from 'react';
import { FaTrash, FaEdit, FaSearch, FaDownload } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/colleges.css';

interface College {
  college_id: string;
  college_name: string;
}

interface User {
  user_id: string;
}

interface CollegesProps {
  user: User;
}

const Colleges: React.FC<CollegesProps> = ({ user }) => {
  const [colleges, setColleges] = useState<College[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newCollegeId, setNewCollegeId] = useState<string>('');
  const [newCollegeName, setNewCollegeName] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editingCollegeId, setEditingCollegeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchColleges();
  }, []);

  const fetchColleges = async () => {
    const { data, error } = await supabase
      .from('tbl_college')
      .select('college_id, college_name');

    if (error) {
      console.error('Error fetching colleges:', error.message);
      toast.error('Failed to fetch colleges.');
    } else {
      setColleges(data);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const filteredColleges = colleges.filter((college) =>
    college.college_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    college.college_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddCollege = () => {
    setNewCollegeId('');
    setNewCollegeName('');
    setEditMode(false);
    setEditingCollegeId(null);
    setShowModal(true);
  };

  const handleModalSubmit = async () => {
    if (!newCollegeId.trim() || !newCollegeName.trim()) {
      toast.error('Please enter both College ID and Name.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editMode && editingCollegeId !== null) {
        const { error } = await supabase
          .from('tbl_college')
          .update({
            college_id: newCollegeId,
            college_name: newCollegeName,
          })
          .eq('college_id', editingCollegeId);

        if (error) {
          toast.error('Failed to update college.');
        } else {
          toast.success('College updated.');
          fetchColleges();
        }
      } else {
        const { error } = await supabase
          .from('tbl_college')
          .insert([{ college_id: newCollegeId, college_name: newCollegeName }]);

        if (error) {
          toast.error('Failed to add college.');
        } else {
          toast.success('College added.');
          fetchColleges();
        }
      }

      setShowModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('tbl_college').delete().eq('college_id', id);

    if (error) {
      toast.error('Failed to delete college.');
    } else {
      setColleges(colleges.filter((c) => c.college_id !== id));
      toast.success('College deleted.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const collegeId = String(row['College ID']).trim();
        const collegeName = row['College Name']?.trim();
        if (!collegeId || !collegeName) continue;

        const { error } = await supabase
          .from('tbl_college')
          .insert([{ college_id: collegeId, college_name: collegeName }]);

        if (error) {
          console.error('Import error:', error.message);
          toast.error(`Failed to import: ${collegeName}`);
        }
      }

      toast.success('Import completed!');
      fetchColleges();
      setShowImport(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['College ID', 'College Name'],
      ['CITC', 'College of Information Technology and Computing'],
      ['CSM', 'College of Science and Mathematics'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Colleges Template');
    XLSX.writeFile(workbook, 'colleges_template.xlsx');
  };

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
          <button type="button" className="search-button"><FaSearch /></button>
        </div>
      </div>

      <div className="colleges-actions">
        <button type="button" className="action-button add-new" onClick={handleAddCollege}>
          Add New College
        </button>
        <button type="button" className="action-button import" onClick={() => setShowImport(true)}>
          Import Colleges
        </button>
        <button type="button" className="action-button download" onClick={downloadTemplate}>
          <FaDownload style={{ marginRight: 5 }} /> Download Template
        </button>
      </div>

      <div className="colleges-table-container">
        <table className="colleges-table">
          <thead>
            <tr>
              <th>#</th>
              <th>College Code</th>
              <th>College Name</th>
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
                  <td>{college.college_id}</td>
                  <td>{college.college_name}</td>
                  <td className="action-buttons">
                    <button type="button"
                      className="icon-button edit-button"
                      onClick={() => {
                        setNewCollegeId(college.college_id);
                        setNewCollegeName(college.college_name);
                        setEditMode(true);
                        setEditingCollegeId(college.college_id);
                        setShowModal(true);
                      }}
                    >
                      <FaEdit />
                    </button>
                    <button type="button"
                      className="icon-button delete-button"
                      onClick={() => handleDelete(college.college_id)}
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for Add/Edit */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>
              {editMode ? 'Edit College' : 'Add New College'}
            </h3>

            <div className="input-group">
              <label htmlFor="college-id">College ID</label>
              <input
                id="college-id"
                type="text"
                placeholder="College ID"
                value={newCollegeId}
                onChange={(e) => setNewCollegeId(e.target.value)}
                disabled={editMode}
              />
            </div>

            <div className="input-group">
              <label htmlFor="college-name">College Name</label>
              <input
                id="college-name"
                type="text"
                placeholder="College Name"
                value={newCollegeName}
                onChange={(e) => setNewCollegeName(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button type="button" onClick={handleModalSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>Import Colleges</h3>
            <input type="file" accept=".xlsx, .xls" onChange={handleImportFile} />
            <div className="modal-actions">
              <button type="button" onClick={() => setShowImport(false)}>Done</button>
              <button type="button" onClick={() => setShowImport(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Colleges;
