import { Routes, Route, Navigate } from 'react-router-dom';
import { useGameStore } from './store/gameStore';
import { initTheme } from './theme.js';
import ThemeSwitcher from './components/ThemeSwitcher.jsx';

initTheme(); // apply the saved theme before first paint
import Login from './screens/Login';
import Signup from './screens/Signup';
import Dashboard from './screens/Dashboard';
import ChooseAvatar from './screens/ChooseAvatar';
import Hub from './screens/Hub';
import Learn from './screens/Learn';
import Race from './screens/Race';
import Result from './screens/Result';
import Champion from './screens/Champion';
import Shop from './screens/Shop';

function Protected({ children }) {
  const token = useGameStore((s) => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

// If already signed in, keep the player out of the auth screens.
function PublicOnly({ children }) {
  const token = useGameStore((s) => s.token);
  return token ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <>
      <ThemeSwitcher />
      <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/avatar" element={<Protected><ChooseAvatar /></Protected>} />
      <Route path="/hub" element={<Protected><Hub /></Protected>} />
      <Route path="/learn/:missionId" element={<Protected><Learn /></Protected>} />
      <Route path="/race/:missionId" element={<Protected><Race /></Protected>} />
      <Route path="/result" element={<Protected><Result /></Protected>} />
      <Route path="/champion" element={<Protected><Champion /></Protected>} />
      <Route path="/shop" element={<Protected><Shop /></Protected>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
