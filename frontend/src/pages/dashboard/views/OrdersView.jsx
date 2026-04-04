import React, { useState } from "react";
import { 
  ShoppingCart, 
  Plus, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Trash2,
  Search,
  Filter,
  X
} from "lucide-react";

const OrdersView = ({ orders, loading, addOrder, updateOrderStatus, deleteOrder }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newOrder, setNewOrder] = useState({
    clientName: "",
    product: "",
    deliveryDate: "",
    delayDays: 0,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await addOrder(newOrder);
    if (success) {
      setIsAdding(false);
      setNewOrder({ clientName: "", product: "", deliveryDate: "", delayDays: 0 });
    }
  };

  const calculateUrgency = (deliveryDate, delayDays, status) => {
    if (status === "Completado") return "completed";
    const today = new Date();
    const target = new Date(deliveryDate);
    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "expired";
    if (diffDays <= delayDays) return "critical"; // Ya debería estar en fabricación
    if (diffDays <= delayDays + 3) return "warning"; // Pronto a iniciar fabricación
    return "normal";
  };

  const filteredOrders = orders.filter(o => 
    o.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.product?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dashboard-content pedidos-view">
      {/* ... cabecera y toolbar ... */}
      <div className="view-header">
        <div className="header-text">
          <h2 className="view-title">Gestión de Pedidos</h2>
          <p className="view-subtitle">Administra y programa la fabricación de tus productos</p>
        </div>
        <button className="add-btn primary-btn" onClick={() => setIsAdding(true)}>
          <Plus size={18} /> Nuevo Pedido
        </button>
      </div>

      <div className="view-toolbar">
        <div className="search-box glass-morphism">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Buscar por cliente o producto..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <button className="filter-btn glass-morphism">
            <Filter size={16} /> Filtros
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="modal-overlay">
          <div className="modal-content glass-morphism animate-fade-in">
            <div className="modal-header">
              <h3><ShoppingCart size={20} /> Registrar Nuevo Pedido</h3>
              <button className="close-btn" onClick={() => setIsAdding(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="premium-form">
              <div className="form-grid">
                <div className="input-group">
                  <label>Cliente</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Nombre del cliente"
                    value={newOrder.clientName}
                    onChange={e => setNewOrder({...newOrder, clientName: e.target.value})}
                  />
                </div>
                <div className="input-group">
                  <label>Producto / Detalles</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ej: 500 Tarjetas Personales"
                    value={newOrder.product}
                    onChange={e => setNewOrder({...newOrder, product: e.target.value})}
                  />
                </div>
                <div className="input-group">
                  <label>Fecha de Entrega</label>
                  <input 
                    type="date" 
                    required 
                    value={newOrder.deliveryDate}
                    onChange={e => setNewOrder({...newOrder, deliveryDate: e.target.value})}
                  />
                </div>
                <div className="input-group">
                  <label>Días de Fabricación (Demora)</label>
                  <input 
                    type="number" 
                    min="0"
                    placeholder="Días estimados"
                    value={newOrder.delayDays}
                    onChange={e => setNewOrder({...newOrder, delayDays: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>
              <footer className="form-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsAdding(false)}>Descartar</button>
                <button type="submit" className="submit-btn primary-btn">Guardar Pedido</button>
              </footer>
            </form>
          </div>
        </div>
      )}

      <div className="orders-grid">
        {loading ? (
          <div className="loading-state">Cargando pedidos...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="empty-state card glass-morphism">
            <ShoppingCart size={48} opacity={0.2} />
            <p>No hay pedidos registrados</p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const urgency = calculateUrgency(order.deliveryDate, order.delayDays, order.status);
            return (
              <div key={order.id} className={`order-card glass-morphism status-${urgency}`}>
                <div className="order-header">
                  <div className="client-info">
                    <h4>{order.clientName}</h4>
                    <p>{order.product}</p>
                  </div>
                  <div className={`urgency-badge ${urgency}`}>
                    {urgency === 'critical' && <><AlertCircle size={12} /> CRÍTICO</>}
                    {urgency === 'warning' && <><Clock size={12} /> PRÓXIMO</>}
                    {urgency === 'expired' && <><AlertCircle size={12} /> VENCIDO</>}
                    {urgency === 'normal' && <><CheckCircle2 size={12} /> A TIEMPO</>}
                    {urgency === 'completed' && <><CheckCircle2 size={12} /> COMPLETADO</>}
                  </div>
                </div>
                
                <div className="order-details">
                  <div className="detail-item">
                    <Calendar size={14} />
                    <span>Entrega: {new Date(order.deliveryDate).toLocaleDateString()}</span>
                  </div>
                  <div className="detail-item">
                    <Clock size={14} />
                    <span>Fabricación: {order.delayDays} días</span>
                  </div>
                </div>

                <div className="order-footer">
                  <span className="entry-date">Registrado: {new Date(order.entryDate).toLocaleDateString()}</span>
                  <div className="order-actions">
                    {order.status !== "Completado" && (
                      <button 
                        className="complete-order-btn" 
                        title="Marcar como completado"
                        onClick={() => updateOrderStatus(order.id, "Completado")}
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                    <button className="trash-btn" title="Eliminar pedido" onClick={() => deleteOrder(order.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OrdersView;
