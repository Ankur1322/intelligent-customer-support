import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  FileText, Upload, Trash2, ShieldAlert, CheckCircle2, RefreshCw, Layers, Database, FileUp, Server, HardDrive
} from 'lucide-react';
import { Document, DocumentStats, User } from '../types';

interface DocumentManagementProps {
  user: User;
}

export const DocumentManagement: React.FC<DocumentManagementProps> = ({ user }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<DocumentStats | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    fetchDocumentsAndStats();
  }, []);

  const fetchDocumentsAndStats = async () => {
    setLoadingDocs(true);
    setError(null);
    try {
      const docsData = await api.documents.list();
      setDocuments(docsData);
      
      if (isAdmin) {
        const statsData = await api.documents.getStats();
        setStats(statsData);
      }
    } catch (err: any) {
      setError("Failed to fetch documents from database.");
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);
    setSuccess(null);

    if (!isAdmin) {
      setError("Only workspace administrators can upload files.");
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await handleUploadFile(file);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    if (!isAdmin) {
      setError("Only workspace administrators can upload files.");
      return;
    }

    if (e.target.value && e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await handleUploadFile(file);
    }
  };

  const handleUploadFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'docx', 'txt'].includes(ext)) {
      setError("Unsupported file format. Only PDF, DOCX, and TXT are supported.");
      return;
    }

    setUploading(true);
    try {
      await api.documents.upload(file);
      setSuccess(`Document '${file.name}' was successfully uploaded, cleaned, chunked, and indexed into FAISS vector space.`);
      fetchDocumentsAndStats();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Document extraction and indexing failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete '${name}'? This will purge all associated text chunks and rebuild the vector database.`)) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await api.documents.delete(id);
      setSuccess(`Document '${name}' deleted successfully and FAISS index rebuilt.`);
      fetchDocumentsAndStats();
    } catch (err: any) {
      setError("Failed to delete document from database.");
    }
  };

  const handleManualReindex = async () => {
    setReindexing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.documents.reindex();
      setSuccess(`${res.message} Total active vectorized chunks: ${res.total_indexed_chunks}`);
      fetchDocumentsAndStats();
    } catch (err: any) {
      setError("Failed to rebuild FAISS vector database.");
    } finally {
      setReindexing(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {error && (
        <div className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl text-red-700 dark:text-red-400 shadow-2xs">
          <ShieldAlert className="shrink-0 mt-0.5" size={18} />
          <div className="text-xs font-semibold leading-relaxed">{error}</div>
        </div>
      )}

      {success && (
        <div className="flex items-start space-x-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-2xl text-emerald-700 dark:text-emerald-400 shadow-2xs">
          <CheckCircle2 className="shrink-0 mt-0.5" size={18} />
          <div className="text-xs font-semibold leading-relaxed">{success}</div>
        </div>
      )}

      {isAdmin && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex items-center space-x-4 shadow-3xs">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Database size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Documents</p>
              <h4 className="text-xl font-black text-slate-900 dark:text-white mt-1">{stats.total_documents}</h4>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex items-center space-x-4 shadow-3xs">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Layers size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Indexed Chunks</p>
              <h4 className="text-xl font-black text-slate-900 dark:text-white mt-1">{stats.total_chunks}</h4>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex items-center space-x-4 shadow-3xs">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400">
              <HardDrive size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Footprint</p>
              <h4 className="text-xl font-black text-slate-900 dark:text-white mt-1">{formatBytes(stats.total_size_bytes)}</h4>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex items-center space-x-4 shadow-3xs">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-rose-600 dark:text-rose-400">
              <Server size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Re-indexing State</p>
              <h4 className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-2 flex items-center space-x-1">
                <CheckCircle2 size={14} /> <span>FAISS Vector Space Hot</span>
              </h4>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center space-x-2">
              <Upload size={16} className="text-indigo-500" />
              <span>Import Documents to Knowledge Base</span>
            </h3>
            <button
              onClick={handleManualReindex}
              disabled={reindexing}
              className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-2 transition disabled:opacity-50"
              title="Manually trigger FAISS vector rebuilding"
            >
              <RefreshCw size={12} className={reindexing ? 'animate-spin' : ''} />
              <span>{reindexing ? "Rebuilding Index..." : "Re-index FAISS"}</span>
            </button>
          </div>

          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center transition-all cursor-pointer
              ${dragActive 
                ? 'border-indigo-600 bg-indigo-50/20 dark:border-indigo-500 dark:bg-indigo-950/10' 
                : 'border-slate-200 hover:border-indigo-500/70 dark:border-slate-800 dark:hover:border-slate-700'}
            `}
          >
            <input
              type="file"
              id="file-input"
              accept=".pdf,.docx,.txt"
              onChange={handleFileInput}
              className="hidden"
            />
            <label htmlFor="file-input" className="cursor-pointer flex flex-col items-center">
              <div className="p-4 bg-indigo-50 dark:bg-slate-800/80 rounded-2xl text-indigo-600 dark:text-indigo-400 mb-4 shadow-2xs">
                <FileUp size={28} />
              </div>
              <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                {uploading ? 'Processing File...' : 'Drag and Drop file here, or click to browse'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
                Supports PDF, DOCX, and TXT (Maximum upload: 25MB)
              </p>
            </label>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center space-x-2">
            <FileText size={16} className="text-indigo-500" />
            <span>Active Knowledge Base Documents</span>
          </h3>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-full">
            {documents.length} Files Total
          </span>
        </div>

        {loadingDocs ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Querying Knowledge Base file catalogs...
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl mb-3">
              <FileText size={24} />
            </div>
            <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">Knowledge Base Empty</h5>
            <p className="text-[10px] text-slate-400 mt-1 max-w-xs text-center">
              {isAdmin 
                ? "Upload some text documents (PDF, DOCX, or TXT) to establish the support knowledge base."
                : "No company knowledge documents have been indexed yet. Contact your system administrator."
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3.5">File Name</th>
                  <th className="px-6 py-3.5">Format</th>
                  <th className="px-6 py-3.5">Size</th>
                  <th className="px-6 py-3.5 text-center">Pages</th>
                  <th className="px-6 py-3.5 text-center">Chunks</th>
                  <th className="px-6 py-3.5">Indexing Status</th>
                  {isAdmin && <th className="px-6 py-3.5 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
                {documents.map((doc) => {
                  let statusBadge = '';
                  if (doc.status === 'indexed') {
                    statusBadge = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400';
                  } else if (doc.status === 'indexing') {
                    statusBadge = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 animate-pulse';
                  } else {
                    statusBadge = 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400';
                  }

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                      <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[240px]" title={doc.name}>
                        {doc.name}
                      </td>
                      <td className="px-6 py-4 uppercase font-bold text-[10px] text-slate-400">{doc.file_type}</td>
                      <td className="px-6 py-4 font-medium text-slate-500">{formatBytes(doc.size_bytes)}</td>
                      <td className="px-6 py-4 text-center font-bold">{doc.page_count}</td>
                      <td className="px-6 py-4 text-center font-bold text-indigo-600 dark:text-indigo-400">{doc.chunk_count}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide capitalize ${statusBadge}`}>
                          {doc.status}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteDoc(doc.id, doc.name)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                            title="Delete and Rebuild Index"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
export default DocumentManagement;
