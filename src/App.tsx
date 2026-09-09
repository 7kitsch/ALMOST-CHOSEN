import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Participant from './pages/Participant';
import Projection from './pages/Projection';
import Print from './pages/Print';
import BackPreprint from './pages/BackPreprint';
import Admin from './pages/Admin';

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Participant />} />
    <Route path="/participant" element={<Participant />} />
    <Route path="/projection" element={<Projection />} />
    <Route path="/print" element={<Print />} />
    <Route path="/back-preprint" element={<BackPreprint />} />
    <Route path="/admin" element={<Admin />} />
  </Routes>
);

const App = () => (
  <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
);

export default App;
export { AppRoutes };
