import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/nunito-sans/latin-700.css';
import '@fontsource/nunito-sans/latin-800.css';
import '@fontsource/nunito-sans/latin-900.css';
import './styles.css';
createRoot(document.getElementById('root')!).render(<App/>);
if('serviceWorker' in navigator && import.meta.env.PROD){window.addEventListener('load',()=>{void navigator.serviceWorker.register('./sw.js').catch(()=>{});});}
