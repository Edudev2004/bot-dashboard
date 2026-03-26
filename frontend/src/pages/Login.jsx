import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { login } from '../services/api';
import arboraBlack from '../assets/ARBORA-BLACK.png';
import arboraWhite from '../assets/ARBORA-WHITE.png';

export default function Login({ onLogin, onSwitchToRegister, theme }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data = await login(username, password);
      // Guardamos el token real y los datos del usuario
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', data.username);
      localStorage.setItem('userId', data.userId);
      localStorage.setItem('role', data.role);
      onLogin();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al conectar con el servidor';
      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-side-image"></div>
      
      <div className="login-form-container">
        <div className="card login-card">
          <div className="login-header">
            <img 
              src={theme === 'dark' ? arboraWhite : arboraBlack} 
              alt="Arbora Logo" 
              className="logo-image" 
              style={{ marginBottom: 24, maxHeight: 40 }}
            />
            <h1>¡Bienvenido!</h1>
            <p>Por favor, ingresa tus datos para continuar.</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className={error.toLowerCase().includes('desactivada') ? 'login-warning' : 'login-error'}>
                {error}
              </div>
            )}

            <div className="input-group">
              <label>Usuario</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  placeholder="Ingresa tu usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label>Contraseña</label>
              <div className="input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <div className="login-options">
              <label className="remember-me">
                <input type="checkbox" />
                <span>Recordarme</span>
              </label>
              <a href="#" className="forgot-password">¿Olvidaste tu contraseña?</a>
            </div>

            <button type="submit" className="login-btn" disabled={isLoading}>
              {isLoading ? <div className="spinner-small"></div> : 'Iniciar sesión'}
            </button>
          </form>

          <footer className="register-footer">
            <p>¿No tienes una cuenta? <button onClick={onSwitchToRegister} className="register-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Regístrate aquí</button></p>
          </footer>
        </div>
      </div>
    </div>
  );
}
