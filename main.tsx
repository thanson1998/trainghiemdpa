import {createRoot} from 'react-dom/client';
import Dashboard from './dashboard';
import './styles.css';
import './menu-print.css';
import './menu-editor.css';
createRoot(document.getElementById('root')!).render(<Dashboard/>);
