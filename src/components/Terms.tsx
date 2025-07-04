// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect } from 'react';
import { FaTrash, FaSearch, FaDownload } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/colleges.css';

interface Term {
  term_id: number;
  term_name: string;
}

const Terms: React.FC = () => {
  const [terms, setTerms] = useState<Term[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newTermName, setNewTermName] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editingTermId, setEditingTermId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    const { data, error } = await supabase.from('tbl_term').select('*');
    if (error) toast.error('Failed to fetch terms');
    else setTerms(data);
  };

  const filteredTerms = terms.filter(term =>
    term.term_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleModalSubmit = async () => {
    if (!newTermName.trim()) {
      toast.error('Term name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editMode && editingTermId !== null) {
        const { data, error } = await supabase
          .from('tbl_term')
          .update({ term_name: newTermName.trim() })
          .eq('term_id', editingTermId)
          .select();

        if (error) {
          toast.error('Failed to update term');
          console.error('Update error:', error);
        } else if (!data || data.length === 0) {
          toast.error('No term was updated');
        } else {
          toast.success('Term updated');
        }
      } else {
        const exists = terms.find(
          t => t.term_name.trim().toLowerCase() === newTermName.trim().toLowerCase()
        );
        if (exists) {
          toast.warning('This term already exists.');
          return;
        }

        const { error } = await supabase
          .from('tbl_term')
          .insert([{ term_name: newTermName.trim() }]);

        if (error) toast.error('Failed to add term');
        else toast.success('Term added');
      }

      fetchTerms();
      setShowModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from('tbl_term').delete().eq('term_id', id);
    if (error) toast.error('Failed to delete term');
    else {
      setTerms(terms.filter(t => t.term_id !== id));
      toast.success('Term deleted');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event: any) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      let failCount = 0;
      let duplicateCount = 0;

      const existingTerms = terms.map(t => t.term_name.trim().toLowerCase());

      for (const row of json) {
        const termName = row['Term Name']?.trim();
        if (!termName) {
          failCount++;
          continue;
        }

        if (existingTerms.includes(termName.toLowerCase())) {
          duplicateCount++;
          continue;
        }

        const { error } = await supabase.from('tbl_term').insert([{ term_name: termName }]);
        if (error) {
          toast.error(`Failed to import: ${termName}`);
          failCount++;
        } else {
          successCount++;
        }
      }

      toast.success(
        `Import completed: ${successCount} added, ${duplicateCount} skipped (duplicates), ${failCount} failed.`
      );
      fetchTerms();
      setShowImport(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Term Name'],
      ['1st Semester'],
      ['2nd Semester'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Terms Template');
    XLSX.writeFile(workbook, 'terms_template.xlsx');
  };

  return (
    <div className="colleges-container">
      <div className="colleges-header">
        <h2 className="colleges-title">Manage Terms</h2>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search for Term"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="button" className="search-button"><FaSearch /></button>
        </div>
      </div>

      <div className="colleges-actions">
        <button
          type="button"
          className="action-button add-new"
          onClick={() => {
            setNewTermName('');
            setEditMode(false);
            setEditingTermId(null);
            setShowModal(true);
          }}
        >
          Add New Term
        </button>
        <button type="button" className="action-button import" onClick={() => setShowImport(true)}>
          Import Terms
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
              <th>Term Name</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTerms.length === 0 ? (
              <tr><td colSpan={3}>No terms found.</td></tr>
            ) : (
              filteredTerms.map((term, index) => (
                <tr key={term.term_id}>
                  <td>{index + 1}</td>
                  <td>{term.term_name}</td>
                  <td className="action-buttons">
                    <button
                      type="button"
                      className="icon-button delete-button"
                      onClick={() => handleDelete(term.term_id)}
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

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>{editMode ? 'Edit Term' : 'Add New Term'}</h3>
            <div className="input-group">
              <label htmlFor="term-name">Term Name</label>
              <input
                id="term-name"
                type="text"
                placeholder="Term Name"
                value={newTermName}
                onChange={(e) => setNewTermName(e.target.value)}
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

      {showImport && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>Import Terms</h3>
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

export default Terms;
