import { createRoot } from 'react-dom/client';
import p5 from 'p5';
import App from './App.tsx';
import './index.css';

// Bundle p5 with the application so ticket and projection rendering work offline.
(window as unknown as { p5: typeof p5 }).p5 = p5;

createRoot(document.getElementById('root')!).render(<App />);
