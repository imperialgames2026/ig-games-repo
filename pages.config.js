/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Admin from './pages/Admin';
import AdminAnnouncements from './pages/AdminAnnouncements';
import AdminKYC from './pages/AdminKYC';
import AdminSupport from './pages/AdminSupport';
import AdminUsers from './pages/AdminUsers';
import AdminWallets from './pages/AdminWallets';
import Bonuses from './pages/Bonuses';
import CookiesPolicy from './pages/CookiesPolicy';
import Games from './pages/Games';
import Home from './pages/Home';
import KYCVerification from './pages/KYCVerification';
import PlayBlackjack from './pages/PlayBlackjack';
import PlayCactusCassidy from './pages/PlayCactusCassidy';
import PlayCoinFlip from './pages/PlayCoinFlip';
import PlayCosmicCrown from './pages/PlayCosmicCrown';
import PlayCraps from './pages/PlayCraps';
import PlayDiamondDynasty from './pages/PlayDiamondDynasty';
import PlayDice from './pages/PlayDice';
import PlayDiceZone from './pages/PlayDiceZone';
import PlayEmeraldEmpire from './pages/PlayEmeraldEmpire';
import PlayExternal from './pages/PlayExternal';
import PlayHiLo from './pages/PlayHiLo';
import PlayHotPot from './pages/PlayHotPot';
import PlayImperialGold from './pages/PlayImperialGold';
import PlayLuckyFortune from './pages/PlayLuckyFortune';
import PlayMines from './pages/PlayMines';
import PlayNeonNights from './pages/PlayNeonNights';
import PlayOceanTreasure from './pages/PlayOceanTreasure';
import PlayPhoenixFire from './pages/PlayPhoenixFire';
import PlayPlinko from './pages/PlayPlinko';
import PlayPoker from './pages/PlayPoker';
import PlayRocket from './pages/PlayRocket';
import PlayRoulette from './pages/PlayRoulette';
import PlayRoyalRuby from './pages/PlayRoyalRuby';
import PlaySapphireStorm from './pages/PlaySapphireStorm';
import PlaySlots from './pages/PlaySlots';
import PlayTowers from './pages/PlayTowers';
import PlayTrenball from './pages/PlayTrenball';
import PlayTwist from './pages/PlayTwist';
import PlayWheel from './pages/PlayWheel';
import PokerLobby from './pages/PokerLobby';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Profile from './pages/Profile';
import Progression from './pages/Progression';
import ProvablyFair from './pages/ProvablyFair';
import Referrals from './pages/Referrals';
import ResponsiblePlay from './pages/ResponsiblePlay';
import Store from './pages/Store';
import Support from './pages/Support';
import TermsOfService from './pages/TermsOfService';
import ThankYou from './pages/ThankYou';
import TransactionHistory from './pages/TransactionHistory';
import VIP from './pages/VIP';
import Withdraw from './pages/Withdraw';
import PlayHashDice from './pages/PlayHashDice';
import PlayLimbo from './pages/PlayLimbo';
import PlayStellarRush from './pages/PlayStellarRush';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Admin": Admin,
    "AdminAnnouncements": AdminAnnouncements,
    "AdminKYC": AdminKYC,
    "AdminSupport": AdminSupport,
    "AdminUsers": AdminUsers,
    "AdminWallets": AdminWallets,
    "Bonuses": Bonuses,
    "CookiesPolicy": CookiesPolicy,
    "Games": Games,
    "Home": Home,
    "KYCVerification": KYCVerification,
    "PlayBlackjack": PlayBlackjack,
    "PlayCactusCassidy": PlayCactusCassidy,
    "PlayCoinFlip": PlayCoinFlip,
    "PlayCosmicCrown": PlayCosmicCrown,
    "PlayCraps": PlayCraps,
    "PlayDiamondDynasty": PlayDiamondDynasty,
    "PlayDice": PlayDice,
    "PlayDiceZone": PlayDiceZone,
    "PlayEmeraldEmpire": PlayEmeraldEmpire,
    "PlayExternal": PlayExternal,
    "PlayHiLo": PlayHiLo,
    "PlayHotPot": PlayHotPot,
    "PlayImperialGold": PlayImperialGold,
    "PlayLuckyFortune": PlayLuckyFortune,
    "PlayMines": PlayMines,
    "PlayNeonNights": PlayNeonNights,
    "PlayOceanTreasure": PlayOceanTreasure,
    "PlayPhoenixFire": PlayPhoenixFire,
    "PlayPlinko": PlayPlinko,
    "PlayPoker": PlayPoker,
    "PlayRocket": PlayRocket,
    "PlayRoulette": PlayRoulette,
    "PlayRoyalRuby": PlayRoyalRuby,
    "PlaySapphireStorm": PlaySapphireStorm,
    "PlaySlots": PlaySlots,
    "PlayTowers": PlayTowers,
    "PlayTrenball": PlayTrenball,
    "PlayTwist": PlayTwist,
    "PlayWheel": PlayWheel,
    "PokerLobby": PokerLobby,
    "PrivacyPolicy": PrivacyPolicy,
    "Profile": Profile,
    "Progression": Progression,
    "ProvablyFair": ProvablyFair,
    "Referrals": Referrals,
    "ResponsiblePlay": ResponsiblePlay,
    "Store": Store,
    "Support": Support,
    "TermsOfService": TermsOfService,
    "ThankYou": ThankYou,
    "TransactionHistory": TransactionHistory,
    "VIP": VIP,
    "Withdraw": Withdraw,
    "PlayHashDice": PlayHashDice,
    "PlayLimbo": PlayLimbo,
    "PlayStellarRush": PlayStellarRush,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};