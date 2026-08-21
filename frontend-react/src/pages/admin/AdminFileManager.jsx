import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Folder, Image as ImageIcon, Video, FileText, File, 
  FileBox, Search, Plus, MoreVertical, LayoutGrid, List,
  Trash2, Download, ArrowLeft, Loader2, Edit, X
} from 'lucide-react';
import api from '../../utils/api';
import CustomSelect from '../../components/ui/CustomSelect';

export default function AdminFileManager() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [displayCount, setDisplayCount] = useState(15);

  const folderCategories = [
    { name: 'Images', icon: ImageIcon, color: 'text-purple-500', bg: 'bg-purple-50' },
    { name: 'Reports', icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-50' }
  ];

  useEffect(() => {
    fetchFiles();
  }, [activeFolder]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminFiles(activeFolder || '');
      setFiles(res.data || res || []);
    } catch (err) {
      console.error("Failed to fetch files:", err);
    } finally {
      setLoading(false);
    }
  };

  const [editFile, setEditFile] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditModal = (file) => {
    setEditFile(file);
    setEditName(file.name);
    setEditCategory(file.category);
  };

  const closeEditModal = () => {
    setEditFile(null);
  };

  const handleSaveEdit = async () => {
    if (!editFile) return;
    try {
      setSavingEdit(true);
      await api.updateAdminFile(editFile.id, {
        name: editName,
        category: editCategory
      });
      fetchFiles();
      closeEditModal();
    } catch (err) {
      console.error("Failed to update file", err);
      alert("Error updating file");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Determine category based on type or let user choose (simplified for now)
    let category = 'Documents';
    if (file.type.startsWith('image/')) category = 'Images';
    if (file.type.startsWith('video/')) category = 'Videos';
    if (file.type === 'application/pdf') category = 'PDF';
    
    // Override if we are inside a specific folder
    if (activeFolder) {
      category = activeFolder;
    }

    let formData = new FormData();
    formData.append("file", file);
    formData.append("name", file.name);
    formData.append("category", category);

    try {
      setUploading(true);
      await api.uploadAdminFile(formData);
      fetchFiles();
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this file permanently?")) return;
    try {
      await api.deleteAdminFile(id);
      fetchFiles();
    } catch (err) {
      console.error("Failed to delete", err);
      alert("Error deleting file: " + err.message);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFolderCount = (folderName) => {
    if (activeFolder) return files.length;
    return files.filter(f => f.category === folderName).length;
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 flex flex-col h-full min-h-[80vh] pb-10">
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-visible w-full shrink-0">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Folder className="w-8 h-8" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-3">
              {activeFolder && (
                <button onClick={() => setActiveFolder(null)} className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                  <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
              )}
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
                {activeFolder ? activeFolder : 'File Manager'}
              </h1>
            </div>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              Manage system assets and user uploaded files.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-xl font-bold transition-colors shadow-sm"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search files..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      ) : (!activeFolder && !searchQuery) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {folderCategories.map(f => (
            <div 
              key={f.name} 
              onClick={() => setActiveFolder(f.name)}
              className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center`}>
                  <f.icon className={`w-6 h-6 ${f.color}`} />
                </div>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">{f.name}</h3>
              <p className="text-gray-500 dark:text-gray-400 font-medium text-sm mt-1">{getFolderCount(f.name)} items</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 flex flex-col">
          {filteredFiles.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-bold mb-1">No files found</h3>
              <p className="text-gray-400 font-medium text-sm">Upload a file to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Size</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.slice(0, displayCount).map(file => (
                    <tr key={file.id} className="border-b border-gray-50 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 transition-colors">
                      <td className="py-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{file.name}</span>
                      </td>
                      <td className="py-4 text-sm text-gray-500 dark:text-gray-400">{formatSize(file.size_bytes)}</td>
                      <td className="py-4 text-sm text-gray-500 dark:text-gray-400">{file.type}</td>
                      <td className="py-4 flex justify-end gap-2">
                        <button 
                          onClick={() => openEditModal(file)}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            if (file.file_path) {
                              let url = file.file_path;
                              if (!url.startsWith('/uploads') && !url.startsWith('http')) {
                                url = `/uploads/${url.replace(/^\//, '')}`;
                              }
                              window.open(api.getMediaUrl(url), '_blank');
                              window.open(url, '_blank');
                            } else {
                              alert("No file path available for download.");
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 dark:bg-blue-900/30 dark:hover:bg-blue-900/30 dark:bg-blue-900/30 dark:hover:bg-blue-900/30 dark:bg-blue-900/30 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(file.id)}
                          className="p-2 text-gray-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400 dark:text-red-400 dark:hover:text-red-400 dark:text-red-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 dark:hover:bg-red-900/30 dark:bg-red-900/30 dark:hover:bg-red-900/30 dark:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredFiles.length > displayCount && (
            <div className="p-4 mt-2 flex justify-center">
              <button
                onClick={() => setDisplayCount(prev => prev + 20)}
                className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
              >
                See More ({filteredFiles.length - displayCount} more)
              </button>
            </div>
          )}
        </div>
      )}

      {editFile && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[100000] flex items-center justify-center p-4" onClick={closeEditModal}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Edit File Details</h3>
              <button onClick={closeEditModal} className="p-2 hover:bg-gray-100 dark:bg-gray-700 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">File Name</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
                <CustomSelect
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  options={folderCategories.map(cat => ({ value: cat.name, label: cat.name }))}
                  className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 font-medium py-[10px]"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={closeEditModal}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-70"
                >
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
