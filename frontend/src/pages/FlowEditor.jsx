import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { saveNode, updateNodePosition } from '../services/chatbotApi';
import { FolderTree, FileText, MessageSquare, Shuffle, Plus, Trash2 } from 'lucide-react';

// ─── Colores por tipo ─────────────────────────────────────────────────────────
const TYPE_COLORS = {
  menu:     { border: '#6366f1', bg: 'rgba(99,102,241,0.12)', icon: <FolderTree size={14} /> },
  content:  { border: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <FileText size={14} /> },
  response: { border: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <MessageSquare size={14} /> }
};
// Nodo raíz siempre naranja, independiente del tipo
const ROOT_COLORS = { border: '#f97316', bg: 'rgba(249,115,22,0.15)' };

// ─── Nodo visual personalizado ────────────────────────────────────────────────
function ChatbotNodeComp({ data }) {
  const { type = 'menu', label, isRoot, onClick } = data;
  const base   = TYPE_COLORS[type] || TYPE_COLORS.menu;
  const colors = isRoot ? { ...base, border: ROOT_COLORS.border, bg: ROOT_COLORS.bg } : base;

  return (
    <div
      className="flow-node-card"
      style={{ borderColor: colors.border, background: colors.bg }}
      onClick={onClick}
    >
      {/* Handle de entrada (izquierda) */}
      <Handle
        type="target"
        position={Position.Left}
        className="flow-handle flow-handle-in"
        style={{ borderColor: colors.border }}
      />

      <div className="flow-node-header">
        <span style={{ color: colors.border }}>{base.icon}</span>
        <span className="flow-node-type" style={{ color: colors.border }}>{type}</span>
        {isRoot && <span className="flow-node-root-badge" style={{ background: 'rgba(249,115,22,0.25)', color: '#fb923c' }}>ROOT</span>}
      </div>
      <div className="flow-node-label">
        {label || <em style={{ opacity: 0.5 }}>(sin mensaje)</em>}
      </div>

      {/* Handle de salida (derecha) */}
      <Handle
        type="source"
        position={Position.Right}
        className="flow-handle flow-handle-out"
        style={{ borderColor: colors.border }}
      />
    </div>
  );
}

const nodeTypes = { chatbotNode: ChatbotNodeComp };

// ─── Auto-layout tipo árbol (BFS por niveles) ─────────────────────────────────
// Respeta la jerarquía padre→hijo con ramificación correcta.
// Si un nodo no tiene padre conocido, va al nivel 0 (columna izq).
const treeAutoLayout = (rawNodes) => {
  const NODE_W  = 260;
  const NODE_H  = 90;
  const GAP_X   = 80;   // espacio horizontal entre columnas
  const GAP_Y   = 40;   // espacio vertical entre nodos del mismo nivel

  const nodeMap = {};
  rawNodes.forEach(n => { nodeMap[n.id] = { ...n, children: [] }; });

  // Construir árbol de hijos real (basado en parentNodeId Y en options.nextNodeId juntos)
  const childrenOf = {};
  rawNodes.forEach(n => { childrenOf[n.id] = []; });

  rawNodes.forEach(n => {
    // Relación por parentNodeId
    if (n.parentNodeId && nodeMap[n.parentNodeId]) {
      if (!childrenOf[n.parentNodeId].includes(n.id)) {
        childrenOf[n.parentNodeId].push(n.id);
      }
    }
    // Relación por options.nextNodeId (flujo gráfico)
    (n.options || []).forEach(o => {
      if (o.nextNodeId && nodeMap[o.nextNodeId]) {
        if (!childrenOf[n.id].includes(o.nextNodeId)) {
          childrenOf[n.id].push(o.nextNodeId);
        }
      }
    });
  });

  // Identificar raíces (nodos sin padre conocido o marcados isRoot)
  const roots = rawNodes
    .filter(n => n.isRoot || !rawNodes.some(p => childrenOf[p.id]?.includes(n.id)))
    .map(n => n.id);

  // Deduplicar raíces
  const uniqueRoots = [...new Set(roots)];

  // BFS para asignar columna (depth) y fila (index dentro de ese nivel)
  const depthMap  = {};  // id → depth
  const visited   = new Set();
  const queue     = uniqueRoots.map((id, i) => ({ id, depth: i > 0 ? 0 : 0 }));

  // Todos los nodos raíz van en depth 0
  uniqueRoots.forEach(id => { depthMap[id] = 0; visited.add(id); });

  while (queue.length > 0) {
    const { id } = queue.shift();
    const d = depthMap[id];
    (childrenOf[id] || []).forEach(childId => {
      if (!visited.has(childId)) {
        visited.add(childId);
        depthMap[childId] = d + 1;
        queue.push({ id: childId, depth: d + 1 });
      }
    });
  }

  // Nodos no alcanzados por BFS → depth 0
  rawNodes.forEach(n => { if (depthMap[n.id] === undefined) depthMap[n.id] = 0; });

  // Agrupar por columna (depth) y calcular posición Y centrada
  const byDepth = {};
  rawNodes.forEach(n => {
    const d = depthMap[n.id];
    if (!byDepth[d]) byDepth[d] = [];
    byDepth[d].push(n.id);
  });

  const positions = {};
  Object.entries(byDepth).forEach(([depthStr, ids]) => {
    const depth    = parseInt(depthStr, 10);
    const total    = ids.length;
    const totalH   = total * NODE_H + (total - 1) * GAP_Y;
    const startY   = -Math.floor(totalH / 2);
    ids.forEach((id, i) => {
      positions[id] = {
        x: depth * (NODE_W + GAP_X) + 40,
        y: startY + i * (NODE_H + GAP_Y)
      };
    });
  });

  return rawNodes.map(n => ({
    ...n,
    posX: positions[n.id]?.x ?? 40,
    posY: positions[n.id]?.y ?? 0
  }));
};

// ─── Conversiones ─────────────────────────────────────────────────────────────
const toFlowNodes = (rawNodes, onClickNode) =>
  rawNodes.map(n => ({
    id: n.id,
    type: 'chatbotNode',
    position: {
      x: n.posX != null ? n.posX : 0,
      y: n.posY != null ? n.posY : 0
    },
    data: {
      label: n.message,
      type: n.type,
      isRoot: n.isRoot,
      raw: n,
      onClick: () => onClickNode(n)
    }
  }));

const toFlowEdges = (rawNodes) => {
  const edgesMap = {}; // key: "source-target"

  rawNodes.forEach(n => {
    // 1. Opciones (flecha continua)
    (n.options || []).forEach(o => {
      if (o.nextNodeId) {
        const key = `${n.id}-${o.nextNodeId}`;
        edgesMap[key] = {
          id: `e-opt-${n.id}-${o.id || o.nextNodeId}`,
          source: n.id,
          target: o.nextNodeId,
          label: o.label || '',
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#6366f1', strokeWidth: 2 },
          labelStyle: { fill: '#a5b4fc', fontSize: 11 },
          labelBgStyle: { fill: 'rgba(30,30,50,0.85)', borderRadius: 4 }
        };
      }
    });

    // 2. Nodo Padre (flecha punteada, si no hay opción expresa)
    if (n.parentNodeId) {
      const key = `${n.parentNodeId}-${n.id}`;
      if (!edgesMap[key]) {
        edgesMap[key] = {
          id: `e-parent-${n.parentNodeId}-${n.id}`,
          source: n.parentNodeId,
          target: n.id,
          label: 'Hijo',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '5,5' },
          labelStyle: { fill: '#94a3b8', fontSize: 10 },
          labelBgStyle: { fill: 'rgba(30,30,50,0.85)', borderRadius: 4 }
        };
      }
    }
  });

  return Object.values(edgesMap);
};

// ─── emptyNode para crear uno nuevo desde el lienzo ──────────────────────────
const makeEmptyNode = () => ({
  id: null, type: 'menu', message: '', isRoot: false,
  parentNodeId: null, responseType: 'text', responseContent: '', options: []
});

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FlowEditor({ nodes: rawNodes, onEditNode, onReloadNodes, onDeleteNode }) {
  const [draggingNode, setDraggingNode] = useState(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const trashRef = useRef(null);

  const hasPositions = rawNodes.some(n => n.posX != null);
  const normalizedRaw = useMemo(
    () => hasPositions ? rawNodes : treeAutoLayout(rawNodes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawNodes]
  );

  const [flowNodes, setFlowNodes, onFlowNodesChange] = useNodesState(
    toFlowNodes(normalizedRaw, onEditNode)
  );
  const [flowEdges, setFlowEdges, onFlowEdgesChange] = useEdgesState(
    toFlowEdges(rawNodes)
  );

  // Sincronizar cuando rawNodes cambia externamente (ej.: guardado desde árbol)
  useEffect(() => {
    setFlowNodes(toFlowNodes(normalizedRaw, onEditNode));
    setFlowEdges(toFlowEdges(rawNodes));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawNodes]);

  // ─── Dragging & Tacho de basura ─────────────────────────────────────────────
  const onNodeDragStart = useCallback((_event, node) => {
    setDraggingNode(node);
    setIsOverTrash(false);
  }, []);

  const onNodeDrag = useCallback((event) => {
    if (!trashRef.current) return;
    const rect = trashRef.current.getBoundingClientRect();
    if (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      setIsOverTrash(true);
    } else {
      setIsOverTrash(false);
    }
  }, []);

  const onNodeDragStop = useCallback(async (event, node) => {
    setDraggingNode(null);
    setIsOverTrash(false);

    if (trashRef.current) {
      const rect = trashRef.current.getBoundingClientRect();
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        // Soltado sobre el tacho
        if (onDeleteNode && node.data?.raw) {
          onDeleteNode(node.data.raw);
        }
        return; // no guardar nueva posición
      }
    }

    try {
      await updateNodePosition(node.id, Math.round(node.position.x), Math.round(node.position.y));
    } catch (e) {
      console.error('[FlowEditor] Error guardando posición:', e.message);
    }
  }, [onDeleteNode]);

  // ─── Conectar dos nodos (arrastrar handle) ───────────────────────────────────
  const onConnect = useCallback(async (params) => {
    const sourceNode = rawNodes.find(n => n.id === params.source);
    const targetNode = rawNodes.find(n => n.id === params.target);
    if (!sourceNode || !targetNode) return;

    // 1. Asignar opción
    const opts = [...(sourceNode.options || [])];
    const emptyIdx = opts.findIndex(o => !o.nextNodeId);
    if (emptyIdx >= 0) {
      opts[emptyIdx] = { ...opts[emptyIdx], nextNodeId: params.target };
    } else {
      opts.push({ label: '', nextNodeId: params.target, order: opts.length });
    }

    try {
      const promises = [saveNode({ ...sourceNode, options: opts })];
      
      // 2. Asignar Nodo Padre si está huérfano (para sincronizar el árbol)
      if (!targetNode.parentNodeId || targetNode.parentNodeId !== sourceNode.id) {
        promises.push(saveNode({ ...targetNode, parentNodeId: sourceNode.id }));
      }
      
      await Promise.allSettled(promises);
      await onReloadNodes();
    } catch (e) {
      console.error('[FlowEditor] Error conectando nodos:', e.message);
    }
  }, [rawNodes, onReloadNodes]);

  // ─── Eliminar arista (Delete key) ────────────────────────────────────────────
  const onEdgesDelete = useCallback(async (deletedEdges) => {
    const promises = [];

    for (const edge of deletedEdges) {
      if (edge.id.startsWith('e-opt-')) {
        const sourceNode = rawNodes.find(n => n.id === edge.source);
        if (sourceNode) {
          const opts = (sourceNode.options || []).map(o =>
            o.nextNodeId === edge.target ? { ...o, nextNodeId: null } : o
          );
          promises.push(saveNode({ ...sourceNode, options: opts }));
        }
      } else if (edge.id.startsWith('e-parent-')) {
        const targetNode = rawNodes.find(n => n.id === edge.target);
        if (targetNode) {
          promises.push(saveNode({ ...targetNode, parentNodeId: null }));
        }
      }
    }

    try {
      await Promise.allSettled(promises);
      await onReloadNodes();
    } catch (e) {
      console.error('[FlowEditor] Error desconectando:', e.message);
    }
  }, [rawNodes, onReloadNodes]);

  // ─── Auto-layout árbol (BFS) — guarda todas las posiciones de una vez ────────
  const handleAutoLayout = useCallback(async () => {
    const laid = treeAutoLayout(rawNodes);
    // Guardar en paralelo para velocidad
    await Promise.allSettled(laid.map(n => updateNodePosition(n.id, n.posX, n.posY)));
    await onReloadNodes();
  }, [rawNodes, onReloadNodes]);

  // ─── Añadir nodo nuevo desde el lienzo ───────────────────────────────────────
  const handleAddNode = useCallback(() => {
    onEditNode(makeEmptyNode());
  }, [onEditNode]);

  return (
    <div className="flow-editor-wrap">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onFlowNodesChange}
        onEdgesChange={onFlowEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        deleteKeyCode="Delete"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#2a2a3a" gap={20} size={1} />
        <Controls className="flow-controls" showInteractive={false} />
        <MiniMap
          nodeColor={n => n.data?.isRoot ? ROOT_COLORS.border : (TYPE_COLORS[n.data?.type]?.border || '#6366f1')}
          maskColor="rgba(15,15,35,0.7)"
          className="flow-minimap"
        />

        {/* Panel superior izquierdo: botón Añadir Nodo */}
        <Panel position="top-left" className="flow-panel-top-left">
          <button
            className="btn btn-primary flow-add-btn"
            onClick={handleAddNode}
            title="Añadir nuevo nodo al flujo"
          >
            <Plus size={15} /> Añadir Nodo
          </button>
        </Panel>

        {/* Panel superior derecho: Auto-distribuir + hint */}
        <Panel position="top-right" className="flow-panel-top">
          <button className="btn btn-ghost btn-sm flow-auto-btn" onClick={handleAutoLayout} title="Distribuir nodos en árbol automáticamente">
            <Shuffle size={14} /> Auto-distribuir
          </button>
          <span className="flow-hint">Arrastra · Conecta handles · Delete arista · Clic para editar</span>
        </Panel>

        {/* Panel inferior centro: Tacho de basura temporal al arrastrar */}
        {draggingNode && (
          <Panel position="bottom-center" className="flow-trash-panel">
            <div
              ref={trashRef}
              className={`flow-trash-zone ${isOverTrash ? 'over' : ''}`}
            >
              <Trash2 size={24} className={isOverTrash ? 'shake' : ''} />
              <span>Soltar aquí para eliminar</span>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
