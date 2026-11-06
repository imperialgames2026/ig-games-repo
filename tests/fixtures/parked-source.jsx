// Dev-test-only entry: not an application route or production build input.
// Exercise preserved, parked source components under intercepted synthetic APIs.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {AuthProvider} from '../../lib/AuthContext';
import ProtectedRoute from '../../lib/ProtectedRoute';
import Withdraw from '../../pages/Withdraw';
import PlayCoinFlip from '../../pages/PlayCoinFlip';
import PlayHashDice from '../../pages/PlayHashDice';
import PlayLimbo from '../../pages/PlayLimbo';
import PlayPlinko from '../../pages/PlayPlinko';
import PlayWheel from '../../pages/PlayWheel';
import PlayMines from '../../pages/PlayMines';
import PlayDarts from '../../pages/PlayDarts';
import PlayDiceZone from '../../pages/PlayDiceZone';
import PlayHiLo from '../../pages/PlayHiLo';
import PlayTowers from '../../pages/PlayTowers';
import PrizeClaims from '../../pages/PrizeClaims';
import '../../index.css';
const sources={PlayDarts,PlayDiceZone,PlayHiLo,PlayTowers,PrizeClaims,Withdraw,PlayCoinFlip,PlayHashDice,PlayLimbo,PlayPlinko,PlayWheel,PlayMines};
const Source=sources[new URLSearchParams(location.search).get('source')];
if(!Source)throw Error('Unknown parked source fixture');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ProtectedRoute><Source/></ProtectedRoute></AuthProvider></BrowserRouter>);
