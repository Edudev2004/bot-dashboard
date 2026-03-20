import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import './index.css';

function App() {
  // Estado del tema: 'light' o 'dark'
  const [theme, setTheme] = useState('dark');

  const toggleTheme = () =>
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <div data-theme={theme} className="app-root">
      <Dashboard theme={theme} toggleTheme={toggleTheme} />
    </div>
  );
}

export default App;
