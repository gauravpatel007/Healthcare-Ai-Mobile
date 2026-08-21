import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, FileText, Globe, CheckCircle, XCircle } from 'lucide-react';
import CustomSelect from '../../components/ui/CustomSelect';

const AdminArticles = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '', category: 'Blogs', content: '', featured_image_url: '', seo_title: '', seo_description: '', status: 'Draft'
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const data = await API.getAdminArticles();
      setArticles(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.content) return alert("Title and Content are required");
    try {
      if (editingId) {
        await API.updateAdminArticle(editingId, formData);
      } else {
        await API.createAdminArticle(formData);
      }
      setShowModal(false);
      fetchArticles();
    } catch (err) {
      console.error(err);
      alert("Failed to save: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this article?")) {
      await API.deleteAdminArticle(id);
      fetchArticles();
    }
  };

  const categories = ['Blogs', 'Health Tips', 'Mental Wellness', 'Nutrition', 'Fitness', 'Diseases', 'Medical News'];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Health Articles</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage medical news and health tips</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          setEditingId(null);
          setFormData({ title: '', category: 'Blogs', content: '', featured_image_url: '', seo_title: '', seo_description: '', status: 'Draft' });
          setShowModal(true);
        }}>
          <Plus className="w-4 h-4" style={{ marginRight: '8px' }} />
          New Article
        </button>
      </div>

      {loading ? <p>Loading articles...</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {articles.length === 0 ? <p>No articles found.</p> : articles.map(article => (
            <div key={article.id} className="glass-card" style={{ padding: '20px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem' }}>{article.category}</span>
                <span className="badge" style={{ background: article.status === 'Published' ? 'var(--success-light)' : 'var(--bg-secondary)', color: article.status === 'Published' ? 'var(--success)' : 'var(--text-secondary)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem' }}>
                  {article.status}
                </span>
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>{article.title}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {article.content}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button className="btn btn-icon" onClick={() => {
                  setEditingId(article.id);
                  setFormData(article);
                  setShowModal(true);
                }}><Edit2 className="w-4 h-4" /></button>
                <button className="btn btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(article.id)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && createPortal(
        <div className="modal-overlay active" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(false)}>
          <div className="modal-content glass-card" style={{ background: 'var(--bg-card)', padding: '32px', borderRadius: '20px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px' }}>{editingId ? 'Edit Article' : 'New Article'}</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input type="text" className="form-input" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <CustomSelect
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  options={categories.map(c => ({ value: c, label: c }))}
                  className="bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] font-normal py-[10px]"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <CustomSelect
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  options={[
                    { value: "Draft", label: "Draft" },
                    { value: "Published", label: "Published" },
                    { value: "Archived", label: "Archived" }
                  ]}
                  className="bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] font-normal py-[10px]"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Featured Image URL</label>
                <input type="text" className="form-input" value={formData.featured_image_url} onChange={e => setFormData({ ...formData, featured_image_url: e.target.value })} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Content (Markdown supported)</label>
              <textarea className="form-input" rows="8" value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })}></textarea>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
              <h4 style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Globe className="w-4 h-4" /> SEO Fields
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">SEO Title</label>
                  <input type="text" className="form-input" value={formData.seo_title} onChange={e => setFormData({ ...formData, seo_title: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">SEO Description</label>
                  <input type="text" className="form-input" value={formData.seo_description} onChange={e => setFormData({ ...formData, seo_description: e.target.value })} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn" style={{ background: 'var(--bg-secondary)' }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save Article</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminArticles;
