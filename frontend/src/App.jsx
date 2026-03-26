import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import './index.css';

function App() {
  // Estado del tema: 'light' o 'dark'
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('isLoggedIn') === 'true');
  const [isRegistering, setIsRegistering] = useState(false);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
    localStorage.setItem('isLoggedIn', 'true');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <div data-theme={theme} className="app-root">
      {isLoggedIn ? (
        <Dashboard theme={theme} toggleTheme={toggleTheme} onLogout={handleLogout} />
      ) : isRegistering ? (
        <Register onSwitchToLogin={() => setIsRegistering(false)} theme={theme} />
      ) : (
        <Login onLogin={handleLogin} onSwitchToRegister={() => setIsRegistering(true)} theme={theme} />
      )}
    </div>
  );
}

export default App;
