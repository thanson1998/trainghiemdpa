import {OwnerGate} from './owner-login';
import {createRoot} from 'react-dom/client';
import {BankSettingsProvider} from './bank-settings';
import Dashboard from './dashboard';
import './styles.css';
import './menu-print.css';
import './menu-editor.css';
import './catalog.css';
createRoot(document.getElementById('root')!).render(<OwnerGate><BankSettingsProvider><Dashboard/></BankSettingsProvider></OwnerGate>);
import './orders-dashboard.css';

import './table-transfer.css';

import './workflow.css';

import './payments.css';

import './pos.css';


import './pos-fast.css';
import './action-colors.css';
import './pos-readability.css';
import './page-layout.css';

import './performance.css';

import './form-controls.css';
