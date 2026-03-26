import { useState, useEffect, useCallback } from 'react';
import {
  FolderTree,
  FileText,
  MessageSquare,
  Edit2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Bot,
  AlertTriangle
} from 'lucide-react';
import {
  getNodes,
  saveNode,
  deleteNode,
  getChatbotConfig,
  saveChatbotConfig,
  uploadFile
} from '../services/chatbotApi';

// ─── Constantes ───────────────────────────────────────────────────────────────
const NODE_TYPES = [
  { value: 'menu',     label: 'Menú (solo opciones)' },
  { value: 'content',  label: 'Contenido (texto + opciones)' },
  { value: 'response', label: 'Respuesta (hoja del árbol)' }
];
const RESPONSE_TYPES = [
  { value: 'text',  label: 'Texto' },
  { value: 'pdf',   label: 'PDF' },
  { value: 'image', label: 'Imagen' },
  { value: 'link',  label: 'Enlace' }
];

const emptyNode = () => ({
  id: null,
  type: 'menu',
  message: '',
  isRoot: false,
  parentNodeId: null,
  responseType: 'text',
  responseContent: '',
  options: []
});

// ─── Helper: construir árbol desde array plano ────────────────────────────────
const buildTree = (nodes) => {
  const map = {};
  nodes.forEach(n => { map[n.id] = { ...n, children: [] }; });
  const roots = [];
  nodes.forEach(n => {
    if (n.parentNodeId && map[n.parentNodeId]) {
      map[n.parentNodeId].children.push(map[n.id]);
    } else {
      if (n.isRoot) roots.unshift(map[n.id]);
      else roots.push(map[n.id]);
    }
  });
  return roots;
};

// ─── Componente de un nodo en la vista árbol ──────────────────────────────────
function TreeNode({ node, allNodes, onEdit, onAddChild, onDelete, depth = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  const typeIcon = node.type === 'menu' ? <FolderTree size={18} /> : node.type === 'content' ? <FileText size={18} /> : <MessageSquare size={18} />;
  const typeColor = node.type === 'menu' ? '#6366f1' : node.type === 'content' ? '#f59e0b' : '#10b981';

  return (
    <div style={{ marginLeft: depth * 24, borderLeft: depth > 0 ? '2px solid rgba(255,255,255,0.08)' : 'none', paddingLeft: depth > 0 ? 16 : 0 }}>
      <div className="tree-node-card" style={{ borderLeft: `3px solid ${typeColor}` }}>
        <div className="tree-node-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {hasChildren && (
              <button className="tree-expand-btn" onClick={() => setExpanded(e => !e)}>
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            <span style={{ color: typeColor }}>{typeIcon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tree-node-message">{node.message || '(sin mensaje)'}</div>
              <div className="tree-node-meta">
                {node.isRoot && <span className="badge badge-root">ROOT</span>}
                <span className="badge" style={{ background: typeColor + '22', color: typeColor }}>{node.type}</span>
                {node.options?.length > 0 && (
                  <span className="badge badge-dim">{node.options.length} opciones</span>
                )}
              </div>
            </div>
          </div>
          <div className="tree-node-actions">
            <button className="btn-icon" title="Editar" onClick={() => onEdit(node)}><Edit2 size={16} /></button>
            <button className="btn-icon" title="Agregar hijo" onClick={() => onAddChild(node.id)}><Plus size={16} /></button>
            <button className="btn-icon btn-danger" title="Eliminar" onClick={() => onDelete(node)}><Trash2 size={16} /></button>
          </div>
        </div>

        {node.options?.length > 0 && (
          <div className="tree-node-options">
            {node.options.sort((a, b) => a.order - b.order).map((opt, i) => (
              <div key={opt.id || i} className="tree-option-item">
                <span className="opt-number">{i + 1}</span>
                <span className="opt-label">{opt.label}</span>
                {opt.nextNodeId && (
                  <span className="opt-arrow">→ {allNodes.find(n => n.id === opt.nextNodeId)?.message?.slice(0, 30) || opt.nextNodeId}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {expanded && hasChildren && node.children.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          allNodes={allNodes}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDelete={onDelete}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

// ─── Modal de edición de nodo ──────────────────────────────────────────────────
function NodeModal({ node, allNodes, onSave, onClose }) {
  const [form, setForm]         = useState({ ...node });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleOptionChange = (idx, key, val) => {
    const opts = [...(form.options || [])];
    opts[idx] = { ...opts[idx], [key]: val };
    setField('options', opts);
  };

  const addOption = () => {
    const opts = [...(form.options || [])];
    opts.push({ label: '', nextNodeId: null, order: opts.length });
    setField('options', opts);
  };

  const removeOption = (idx) => {
    const opts = [...(form.options || [])];
    opts.splice(idx, 1);
    opts.forEach((o, i) => { o.order = i; });
    setField('options', opts);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { url } = await uploadFile(file);
      setField('responseContent', url);
    } catch (err) {
      setError('Error al subir el archivo: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.message.trim()) { setError('El mensaje del nodo no puede estar vacío.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectableNodes = allNodes.filter(n => n.id !== form.id);
  const showResponse = form.type === 'response';
  const showOptions  = form.type !== 'response';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{form.id ? 'Editar Nodo' : 'Nuevo Nodo'}</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="alert-error">{error}</div>}

          <div className="form-row">
            <label>Tipo de nodo</label>
            <select value={form.type} onChange={e => setField('type', e.target.value)}>
              {NODE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="form-row">
            <label>Mensaje del nodo</label>
            <textarea
              rows={4}
              value={form.message}
              placeholder="Ej: ¿En qué podemos ayudarte hoy?"
              onChange={e => setField('message', e.target.value)}
            />
          </div>

          <div className="form-row form-row-inline">
            <label>
              <input type="checkbox" checked={form.isRoot} onChange={e => setField('isRoot', e.target.checked)} />
              {' '}Nodo raíz (inicio del bot)
            </label>
          </div>

          {/* Nodo padre */}
          {!form.isRoot && (
            <div className="form-row">
              <label>Nodo padre (opcional)</label>
              <select value={form.parentNodeId || ''} onChange={e => setField('parentNodeId', e.target.value || null)}>
                <option value="">— Ninguno —</option>
                {selectableNodes.map(n => (
                  <option key={n.id} value={n.id}>{n.message?.slice(0, 50) || n.id}</option>
                ))}
              </select>
            </div>
          )}

          {/* Respuesta directa */}
          {showResponse && (
            <div className="form-section">
              <div className="form-section-title">Contenido de la respuesta</div>
              <div className="form-row">
                <label>Tipo de contenido</label>
                <select value={form.responseType || 'text'} onChange={e => setField('responseType', e.target.value)}>
                  {RESPONSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {(form.responseType === 'text' || form.responseType === 'link') && (
                <div className="form-row">
                  <label>{form.responseType === 'link' ? 'URL del enlace' : 'Texto adicional'}</label>
                  <input
                    type="text"
                    value={form.responseContent || ''}
                    placeholder={form.responseType === 'link' ? 'https://...' : 'Texto de respuesta...'}
                    onChange={e => setField('responseContent', e.target.value)}
                  />
                </div>
              )}

              {(form.responseType === 'pdf' || form.responseType === 'image') && (
                <div className="form-row">
                  <label>Subir archivo</label>
                  <input type="file" accept={form.responseType === 'pdf' ? '.pdf' : 'image/*'} onChange={handleUpload} disabled={uploading} />
                  {uploading && <span className="upload-hint"><Loader2 size={14} className="spin" /> Subiendo...</span>}
                  {form.responseContent && !uploading && (
                    <div className="upload-preview">
                      <CheckCircle2 size={14} /> Archivo subido: <a href={form.responseContent} target="_blank" rel="noreferrer">Ver archivo</a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Opciones del menú */}
          {showOptions && (
            <div className="form-section">
              <div className="form-section-title">Opciones del menú</div>
              {(form.options || []).map((opt, idx) => (
                <div key={idx} className="option-row">
                  <span className="opt-number">{idx + 1}</span>
                  <input
                    type="text"
                    placeholder="Texto de la opción (ej: Ver catálogo)"
                    value={opt.label}
                    onChange={e => handleOptionChange(idx, 'label', e.target.value)}
                  />
                  <select
                    value={opt.nextNodeId || ''}
                    onChange={e => handleOptionChange(idx, 'nextNodeId', e.target.value || null)}
                  >
                    <option value="">— Sin destino (hoja) —</option>
                    {selectableNodes.map(n => (
                      <option key={n.id} value={n.id}>{n.message?.slice(0, 40) || n.id}</option>
                    ))}
                  </select>
                  <button type="button" className="btn-icon btn-danger" onClick={() => removeOption(idx)}><Trash2 size={16} /></button>
                </div>
              ))}
              <button type="button" className="btn btn-outline btn-sm" onClick={addOption}>
                <Plus size={14} /> Agregar opción
              </button>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
              {saving ? ' Guardando...' : ' Guardar nodo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Panel de Config General ──────────────────────────────────────────────────
function GeneralConfigPanel({ onClose }) {
  const [config, setConfig]   = useState({ 
    greeting: '', 
    fallbackMessage: '', 
    timeoutMinutes: 5,
    timeoutExtensionMinutes: 5,
    timeoutWarningMsg: '',
    timeoutExtensionMsg: '',
    timeoutCloseMsg: '',
    keywords: [] 
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState('');

  useEffect(() => {
    getChatbotConfig()
      .then(c => setConfig(c))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const addKeyword = () => setConfig(c => ({
    ...c,
    keywords: [...(c.keywords || []), { key: '', response: '' }]
  }));

  const updateKeyword = (i, field, val) => {
    const kws = [...(config.keywords || [])];
    kws[i] = { ...kws[i], [field]: val };
    setConfig(c => ({ ...c, keywords: kws }));
  };

  const removeKeyword = (i) => {
    const kws = [...(config.keywords || [])];
    kws.splice(i, 1);
    setConfig(c => ({ ...c, keywords: kws }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveChatbotConfig(config);
      setToast(<><CheckCircle2 size={16} /> Configuración guardada</>);
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setToast(<><AlertCircle size={16} /> Error: {err.message}</>);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="panel-loading">Cargando configuración...</div>;

  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <h3><Settings size={18} /> Configuración General del Bot</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
      </div>

      {toast && <div className="alert-toast">{toast}</div>}

      <div className="form-row">
        <label>Mensaje de bienvenida</label>
        <textarea rows={3} value={config.greeting || ''} onChange={e => setConfig(c => ({ ...c, greeting: e.target.value }))} placeholder="¡Hola! ¿En qué podemos ayudarte?" />
      </div>

      <div className="form-row">
        <label>Mensaje de fallback (cuando no entiende al usuario)</label>
        <textarea rows={2} value={config.fallbackMessage || ''} onChange={e => setConfig(c => ({ ...c, fallbackMessage: e.target.value }))} placeholder="No entiendo tu consulta. Escribe *0* para volver al menú." />
      </div>

      <div className="form-section">
        <div className="form-section-title">Tiempo de Espera e Inactividad</div>
        <div className="form-row">
          <label>Cerrar chat por inactividad después de:</label>
          <select 
            value={config.timeoutMinutes || 5} 
            onChange={e => setConfig(c => ({ ...c, timeoutMinutes: parseInt(e.target.value) }))}
          >
            <option value={5}>5 minutos</option>
            <option value={10}>10 minutos</option>
            <option value={15}>15 minutos</option>
          </select>
        </div>
        <div className="form-row">
          <label>Tiempo adicional al extender (cuando responde *1*):</label>
          <select 
            value={config.timeoutExtensionMinutes || 5} 
            onChange={e => setConfig(c => ({ ...c, timeoutExtensionMinutes: parseInt(e.target.value) }))}
          >
            <option value={5}>5 minutos</option>
            <option value={10}>10 minutos</option>
            <option value={15}>15 minutos</option>
          </select>
        </div>
        <div className="form-row">
          <label>Mensaje de Aviso (Falta 1 minuto para cerrar el chat)</label>
          <textarea 
            rows={2} 
            value={config.timeoutWarningMsg || ''} 
            onChange={e => setConfig(c => ({ ...c, timeoutWarningMsg: e.target.value }))} 
            placeholder="⏳ Tu sesión está por cerrarse por inactividad. Si necesitas más tiempo, responde con *1*." 
          />
        </div>
        <div className="form-row">
          <label>Mensaje de Extensión (Cuando el usuario responde *1*)</label>
          <input 
            type="text" 
            value={config.timeoutExtensionMsg || ''} 
            onChange={e => setConfig(c => ({ ...c, timeoutExtensionMsg: e.target.value }))} 
            placeholder="✅ Entendido, tienes más tiempo." 
          />
        </div>
        <div className="form-row">
          <label>Mensaje de Cierre Definitivo</label>
          <textarea 
            rows={2} 
            value={config.timeoutCloseMsg || ''} 
            onChange={e => setConfig(c => ({ ...c, timeoutCloseMsg: e.target.value }))} 
            placeholder="❌ Chat cerrado por inactividad. Escribe cualquier mensaje para volver a iniciar." 
          />
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Palabras clave</div>
        {(config.keywords || []).map((kw, i) => (
          <div key={i} className="keyword-row">
            <input type="text" placeholder="Palabra clave" value={kw.key} onChange={e => updateKeyword(i, 'key', e.target.value)} />
            <input type="text" placeholder="Respuesta automática" value={kw.response} onChange={e => updateKeyword(i, 'response', e.target.value)} />
            <button className="btn-icon btn-danger" onClick={() => removeKeyword(i)}><Trash2 size={16} /></button>
          </div>
        ))}
        <button className="btn btn-outline btn-sm" onClick={addKeyword}><Plus size={14} /> Agregar palabra clave</button>
      </div>

      <div className="config-panel-footer">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
          {saving ? ' Guardando...' : ' Guardar configuración'}
        </button>
      </div>
    </div>
  );
}

// ─── Componente Principal ──────────────────────────────────────────────────────
export default function ChatbotEditor() {
  const [nodes, setNodes]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [editingNode, setEditingNode] = useState(null);
  const [showConfig, setShowConfig]   = useState(false);
  const [toast, setToast]             = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadNodes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNodes();
      setNodes(data);
    } catch (err) {
      showToast(<><AlertCircle size={16} /> Error al cargar nodos: {err.message}</>);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNodes(); }, [loadNodes]);

  const handleSaveNode = async (nodeData) => {
    await saveNode(nodeData);
    showToast(<><CheckCircle2 size={16} /> Nodo guardado correctamente</>);
    await loadNodes();
  };

  const handleDeleteNode = async (node) => {
    try {
      await deleteNode(node.id);
      showToast(<><Trash2 size={16} /> Nodo eliminado</>);
      setDeleteTarget(null);
      await loadNodes();
    } catch (err) {
      showToast(<><AlertCircle size={16} /> Error al eliminar: {err.message}</>);
    }
  };

  const handleAddChild = (parentNodeId) => {
    setEditingNode({ ...emptyNode(), parentNodeId });
  };

  const tree = buildTree(nodes);
  const hasNodes = nodes.length > 0;

  return (
    <div className="chatbot-editor">
      {/* Header */}
      <div className="editor-header">
        <div>
          <h2 className="editor-title"><Bot size={24} /> Editor de Chatbot</h2>
          <p className="editor-subtitle">Construye el flujo de conversación de tu bot</p>
        </div>
        <div className="editor-header-actions">
          <button className="btn btn-ghost" onClick={() => setShowConfig(v => !v)}>
            <Settings size={18} /> Configuración
          </button>
          <button className="btn btn-primary" onClick={() => setEditingNode(emptyNode())}>
            <Plus size={18} /> Nuevo nodo
          </button>
        </div>
      </div>

      {toast && <div className="alert-toast">{toast}</div>}

      {/* Panel de config */}
      {showConfig && <GeneralConfigPanel onClose={() => setShowConfig(false)} />}

      {/* Árbol de nodos */}
      <div className="editor-tree">
        {loading ? (
          <div className="panel-loading"><Loader2 size={18} className="spin" /> Cargando árbol de nodos...</div>
        ) : !hasNodes ? (
          <div className="empty-state">
            <div className="empty-icon"><Bot size={48} /></div>
            <h3>Aún no tienes nodos configurados</h3>
            <p>Crea tu primer nodo y empieza a construir el flujo de tu chatbot.</p>
            <button className="btn btn-primary" onClick={() => setEditingNode({ ...emptyNode(), isRoot: true })}>
              <Plus size={18} /> Crear nodo raíz
            </button>
          </div>
        ) : (
          <div className="tree-container">
            {tree.map(node => (
              <TreeNode
                key={node.id}
                node={node}
                allNodes={nodes}
                onEdit={setEditingNode}
                onAddChild={handleAddChild}
                onDelete={setDeleteTarget}
                depth={0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de edición */}
      {editingNode && (
        <NodeModal
          node={editingNode}
          allNodes={nodes}
          onSave={handleSaveNode}
          onClose={() => setEditingNode(null)}
        />
      )}

      {/* Confirm eliminación */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3><AlertTriangle size={20} color="#ef4444" /> ¿Eliminar este nodo?</h3>
            <p>Se eliminará <strong>"{deleteTarget.message?.slice(0, 60)}"</strong> y todas sus opciones. Las referencias desde otros nodos quedarán vacías.</p>
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleDeleteNode(deleteTarget)}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
