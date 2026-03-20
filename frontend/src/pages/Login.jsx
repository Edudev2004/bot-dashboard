import { useState } from 'react';
import { Lock, User, Eye, EyeOff, Bot } from 'lucide-react';
import { login } from '../services/api';

export default function Login({ onLogin }) {
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
      onLogin();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al conectar con el servidor';
      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
      </div>

      <div className="card login-card">
        <div className="login-header">
          <div className="logo-icon large">
            <Bot size={32} color="#fff" />
          </div>
          <h1>BotDash</h1>
          <p>Bienvenido de nuevo. Inicia sesión para continuar.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="input-group">
            <label>Usuario</label>
            <div className="input-wrapper">
              <User size={18} className="input-icon" />
              <input
                type="text"
                placeholder="Nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Contraseña</label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? <div className="spinner-small"></div> : 'Entrar al Dashboard'}
          </button>
        </form>

        <div className="login-footer">
          <p>&copy; 2026 Bot-Dashboard. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
}
