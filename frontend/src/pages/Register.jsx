import { useState } from 'react';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { register } from '../services/api';
import arboraBlack from '../assets/ARBORA-BLACK.png';
import arboraWhite from '../assets/ARBORA-WHITE.png';

export default function Register({ onSwitchToLogin, theme }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phonePrefix: '+34',
    phoneNumber: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (formData.password !== formData.confirmPassword) {
      return setError('Las contraseñas no coinciden');
    }

    setIsLoading(true);

    try {
      await register({
        username: formData.username,
        email: formData.email,
        phonePrefix: formData.phonePrefix,
        phoneNumber: formData.phoneNumber,
        password: formData.password
      });
      setSuccess(true);
      setTimeout(() => {
        onSwitchToLogin();
      }, 2000);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al registrar usuario';
      setError(msg);
      setIsLoading(false);
    }
  };

  const prefixes = [
    { code: '+34', label: 'ESP' },
    { code: '+52', label: 'MEX' },
    { code: '+1',  label: 'USA' },
    { code: '+57', label: 'COL' },
    { code: '+54', label: 'ARG' },
    { code: '+56', label: 'CHI' },
    { code: '+51', label: 'PER' },
    { code: '+506', label: 'CRI' },
    { code: '+507', label: 'PAN' }
  ];

  return (
    <div className="login-page">
      <div className="login-side-image"></div>
      
      <div className="login-form-container">
        <div className="card login-card" style={{ maxWidth: '450px' }}>
          <div className="login-header">
            <img 
              src={theme === 'dark' ? arboraWhite : arboraBlack} 
              alt="Arbora Logo" 
              className="logo-image" 
              style={{ marginBottom: 24, maxHeight: 40 }}
            />
            <h1>Crea tu cuenta</h1>
            <p>Únete a Arbora y gestiona tus bots de forma inteligente.</p>
          </div>

          {success ? (
            <div className="login-success" style={{ color: '#10b981', marginBottom: 20, textAlign: 'center', fontWeight: 'bold' }}>
              ¡Registro exitoso! Redirigiendo al login...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              {error && <div className="login-error">{error}</div>}

              <div className="input-row" style={{ display: 'flex', gap: '20px' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Usuario</label>
                  <div className="input-wrapper">
                    <input
                      name="username"
                      type="text"
                      placeholder="Nombre de usuario"
                      value={formData.username}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Email</label>
                  <div className="input-wrapper">
                    <input
                      name="email"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="input-group">
                <label>Teléfono</label>
                <div className="input-wrapper" style={{ display: 'flex', gap: '10px' }}>
                  <select 
                    name="phonePrefix" 
                    value={formData.phonePrefix} 
                    onChange={handleChange}
                    className="prefix-select"
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      borderBottom: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      padding: '8px 0',
                      fontSize: '14px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {prefixes.map(p => (
                      <option key={p.code} value={p.code} style={{ background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}>
                        {p.label} ({p.code})
                      </option>
                    ))}
                  </select>
                  <input
                    name="phoneNumber"
                    type="tel"
                    placeholder="Número de teléfono"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    required
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              <div className="input-row" style={{ display: 'flex', gap: '20px' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Contraseña</label>
                  <div className="input-wrapper">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Repetir Contraseña</label>
                  <div className="input-wrapper">
                    <input
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-minimal"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} color="#fff" /> : <Eye size={18} color="#fff" />}
                    </button>
                  </div>
                </div>
              </div>

              <button type="submit" className="login-btn" disabled={isLoading} style={{ marginTop: '10px' }}>
                {isLoading ? <div className="spinner-small"></div> : 'Registrarse'}
              </button>
            </form>
          )}

          <footer className="register-footer" style={{ marginTop: '20px' }}>
            <button 
              onClick={onSwitchToLogin} 
              className="register-link" 
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', margin: '0 auto' }}
            >
              <ArrowLeft size={16} /> Volver al inicio de sesión
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
