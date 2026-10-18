import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#0A0612] py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Link to={createPageUrl('Home')}>
          <Button variant="ghost" className="text-white mb-6">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center">
              <Scale className="w-6 h-6 text-pink-400" />
            </div>
            <h1 className="text-3xl font-black text-white">Terms of Service</h1>
          </div>

          <div className="text-gray-300 space-y-6 text-sm">
            <p className="text-xs text-gray-400">Last Updated: February 7, 2026</p>

            <div className="p-4 bg-pink-500/10 border border-pink-500/30 rounded-xl">
              <p className="text-sm font-bold text-pink-300 mb-2">IMPORTANT NOTICE</p>
              <p className="text-xs text-pink-200">
                The Platform is provided by Imperial House Gaming LLC, a company duly incorporated under Virginia law, 
                with the register number VA262385288 and registered office at 391 Brook Dr. Hot Springs, Virginia 24445 U.S.A. 
                (hereinafter "Imperial Gaming", "we", "us" or "our").
              </p>
            </div>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">Registering on the Platform</h2>
              <p className="mb-3">
                By registering on the Platform (through any electronic device, such as the web, mobile, tablet or any other device), 
                you accept these Terms and Conditions ("Terms") and enter into a binding agreement with us which applies to your 
                access to, and use of, our Platform and our Games.
              </p>
              <p className="mb-3 font-bold text-pink-400">
                PLEASE TAKE THE TIME TO READ THESE TERMS CAREFULLY AND IN THEIR ENTIRETY. BY ACCEPTING THESE TERMS, YOU REPRESENT 
                – AND WE ARE RELYING ON YOUR REPRESENTATION – THAT YOU HAVE DONE SO. IF YOU LIVE IN ANY OF THE EXCLUDED TERRITORIES 
                IDENTIFIED BELOW, DO NOT PROCEED ANY FURTHER AS YOU ARE NOT ELIGIBLE TO ACCESS OR USE THE PLATFORM, CREATE A CUSTOMER 
                ACCOUNT, PLAY THE GAMES OR INTERACT WITH IMPERIAL GAMING IN ANY OTHER WAY.
              </p>
              <p>
                By checking the box for acceptance during the registration process, accessing or using our Platform, creating a 
                Customer Account, and/or accessing the Games, you confirm that you have read and agree to be bound by these Terms, 
                which includes our Privacy Policy and other game-specific or promotion-specific terms relevant to your Participation.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">1. IMPERIAL GAMING STATEMENT</h2>
              
              <h3 className="text-lg font-semibold text-white mb-2">1.1 Excluded Territories</h3>
              <p className="mb-2">The following are "Excluded Territories":</p>
              <p className="mb-2">a) Any country other than the continental United States of America and Hawaii ("US");</p>
              <p className="mb-2">b) Within the US the following States are excluded:</p>
              <ul className="list-none pl-6 space-y-1 mb-3">
                <li>i. WASHINGTON</li>
                <li>ii. NEW YORK</li>
                <li>iii. NEVADA</li>
                <li>iv. IDAHO</li>
                <li>v. KENTUCKY</li>
                <li>vi. MICHIGAN</li>
                <li>vii. VERMONT</li>
                <li>viii. NEW JERSEY</li>
                <li>ix. DELAWARE</li>
                <li>x. WEST VIRGINIA</li>
                <li>xi. PENNSYLVANIA</li>
                <li>xii. RHODE ISLAND</li>
                <li>xiii. CONNECTICUT</li>
                <li>xiv. MARYLAND</li>
                <li>xv. LOUISIANA</li>
                <li>xvi. MONTANA</li>
                <li>xvii. ARIZONA</li>
                <li>xviii. TENNESSEE</li>
                <li>xix. CALIFORNIA</li>
                <li>xx. Any other states or jurisdictions which, under the laws applicable to you, are legally precluded from playing the Games offered on the Platform</li>
              </ul>

              <h3 className="text-lg font-semibold text-white mb-2">1.2 Important Representations</h3>
              <p className="mb-3 font-bold text-pink-400">
                BY ACCEPTING THESE TERMS, ACCESSING OR USING THE PLATFORM, CREATING A CUSTOMER ACCOUNT, AND/OR PLAYING THE GAMES, 
                YOU SPECIFICALLY REPRESENT TO US THAT YOU DO NOT LIVE IN ANY OF THE EXCLUDED TERRITORIES.
              </p>

              <h3 className="text-lg font-semibold text-white mb-2">1.3 No Purchase Necessary</h3>
              <p className="mb-3 font-bold">
                NO PURCHASE OR PAYMENT IS NECESSARY TO PARTICIPATE OR PLAY THE GAMES. A PURCHASE OR PAYMENT OF ANY KIND WILL NOT 
                INCREASE YOUR CHANCES OF WINNING.
              </p>

              <h3 className="text-lg font-semibold text-white mb-2">1.4 Entertainment Only</h3>
              <p className="mb-3 font-bold">
                THE PLATFORM AND GAMES DO NOT OFFER REAL MONEY GAMBLING, AND NO ACTUAL MONEY IS REQUIRED TO PLAY.
              </p>

              <h3 className="text-lg font-semibold text-white mb-2">1.5 Eligibility</h3>
              <p className="mb-3">
                ONLY CUSTOMERS IN THE CONTINENTAL UNITED STATES AND HAWAII (EXCEPT FOR THE EXCLUDED TERRITORIES) ARE ELIGIBLE TO 
                ACCESS AND USE THE PLATFORM, CREATE A CUSTOMER ACCOUNT, AND PLAY THE GAMES.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">2. DEFINITIONS</h2>
              <ul className="list-none space-y-2">
                <li><strong>"Customer Account"</strong> – means an account held by a Registered Customer.</li>
                <li><strong>"Game"</strong> – means any one or more Game(s) available on the Platform in either Standard Play or Promotional Play.</li>
                <li><strong>"Imperial Coins" (IC)</strong> – means the virtual social gameplay currency which enables you to play the Standard Play Games. Imperial Coins have no monetary value and cannot under any circumstance be redeemed for Prizes.</li>
                <li><strong>"Imperial Dollars" (ID)</strong> – means sweepstakes entries that can be used for Promotional Play.</li>
                <li><strong>"Platform"</strong> – means the services provided through imperialhouse.online and all subdomains, subpages and successor sites thereof.</li>
                <li><strong>"Customer" or "you"</strong> – means any person who Participates, whether or not a Registered Customer.</li>
                <li><strong>"Prizes"</strong> – means valuable prizes that can be redeemed using Imperial Dollars won through Promotional Play in accordance with these Terms.</li>
                <li><strong>"Promotional Play" or "Sweepstakes"</strong> – means Participation in our sweepstakes promotions by playing the Platform's game with Imperial Dollars.</li>
                <li><strong>"Standard Play"</strong> – means Participating in any game played with Imperial Coins.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">3. REGISTRATION & CUSTOMER WARRANTIES</h2>
              
              <h3 className="text-lg font-semibold text-white mb-2">3.1 Registration</h3>
              <p className="mb-2">When you register a Customer Account you will be requested to provide:</p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>Full legal name</li>
                <li>Date of birth</li>
                <li>Permanent Address</li>
                <li>Email</li>
              </ul>

              <h3 className="text-lg font-semibold text-white mb-2">3.2 Warranties</h3>
              <p className="mb-2">You declare and warrant that:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>You are over 21 years of age or such higher minimum legal age as required in your jurisdiction</li>
                <li>WHEN PARTICIPATING, YOU DO NOT RESIDE IN, OR ACCESS THE PLATFORM FROM, THE EXCLUDED TERRITORIES</li>
                <li>You use our Platform strictly in your personal capacity for recreational and entertainment purposes only</li>
                <li>All information you provide is true, complete and correct</li>
                <li>You will not be involved in any fraudulent, collusive, fixing or other unlawful activity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">4. YOUR CUSTOMER ACCOUNT</h2>
              
              <h3 className="text-lg font-semibold text-white mb-2">4.1 Single Account</h3>
              <p className="mb-3">
                You are allowed to have only one Customer Account on the Platform. If you attempt to open more than one Customer 
                Account, all accounts may be cancelled or suspended.
              </p>

              <h3 className="text-lg font-semibold text-white mb-2">4.2 Account Security</h3>
              <p className="mb-2">
                WE STRONGLY RECOMMEND THAT YOU ENABLE MULTI-FACTOR AUTHENTICATION FOR YOUR CUSTOMER ACCOUNT.
              </p>
              <p>
                You are solely responsible for maintaining the confidentiality of your password and account details. You will be 
                held responsible for all uses of your Customer Account, including any purchases made under the Account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">5. IMPERIAL COINS (IC)</h2>
              
              <p className="mb-3">
                Imperial Coins do not have a monetary value and can only be used to play Standard Games. Imperial Coins can be 
                used for entertainment only and cannot be redeemed for any value whatsoever.
              </p>

              <h3 className="text-lg font-semibold text-white mb-2">5.1 Obtaining Imperial Coins</h3>
              <p className="mb-2">Imperial Gaming will give Imperial Coins free of charge on:</p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>Daily Bonus – You can claim Imperial Coins once per day through your Customer Account</li>
                <li>Promotional Giveaways – Giveaways organized by Imperial Gaming on social media</li>
                <li>You may also win more Imperial Coins when you play in Standard Play</li>
                <li>You may purchase Imperial Coins on the Platform</li>
              </ul>

              <h3 className="text-lg font-semibold text-white mb-2">5.2 Purchases</h3>
              <p className="mb-2">
                The purchase of Imperial Coins is the purchase of a license that allows you to Participate in Standard Play Games 
                and is not a deposit of funds which can be withdrawn. Funds used to purchase Imperial Coins will not, and cannot, 
                be refunded to you. Imperial Coins do not have any real money value.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">6. IMPERIAL DOLLARS (ID)</h2>
              
              <p className="mb-3 font-bold text-pink-400">
                YOU CANNOT PURCHASE IMPERIAL DOLLARS. IMPERIAL DOLLARS CAN BE OBTAINED ONLY THROUGH FREE, PROMOTIONAL OFFERS.
              </p>

              <h3 className="text-lg font-semibold text-white mb-2">6.1 How to Receive Imperial Dollars</h3>
              <p className="mb-2">You can obtain Free Imperial Dollars through:</p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>Daily Login Bonus – Claim Imperial Dollars once per day through your Customer Account</li>
                <li>Promotional Giveaways – Organized by Imperial Gaming on social media</li>
                <li>Promotional bonuses when purchasing Imperial Coins</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">7. GAMES</h2>
              
              <h3 className="text-lg font-semibold text-white mb-2">7.1 Standard Play</h3>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>Standard Play can only be played with Imperial Coins</li>
                <li>On Standard Play you can only win Imperial Coins</li>
                <li>You cannot win money or Prizes of any kind when playing on Standard Play</li>
              </ul>

              <h3 className="text-lg font-semibold text-white mb-2">7.2 Promotional Play / Sweepstakes</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Promotional Play can only be played with Imperial Dollars</li>
                <li>Only Games played with Imperial Dollars provide the opportunity to redeem for Prizes</li>
                <li>Imperial Gaming's decisions regarding Prizes are final and binding</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">8. REDEMPTION OF PRIZES & WITHDRAWALS</h2>

              <p className="mb-3">
                Only Promotional Play / Sweepstakes give access to Prizes. No Prizes can be won through Standard Play.
              </p>
              <p className="mb-3">
                Only Imperial Dollars can be redeemed for Prizes. No Prize can be redeemed without completing the identification 
                process as required by Imperial Gaming.
              </p>
              <p className="mb-3">
                Imperial Dollars will be redeemable at an implied rate of 1 Imperial Dollar per 1 USD.
              </p>

              <h3 className="text-lg font-semibold text-white mb-2">8.1 Withdrawal Requirements</h3>
              <p className="mb-2">To withdraw Imperial Dollars from your account, you must:</p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li><strong>Meet the minimum withdrawal amount:</strong> You must request a withdrawal of at least $100.00 ID</li>
                <li><strong>Complete the 3x Wager Requirement:</strong> You must have wagered a total of 3 times your total deposited amount before withdrawing. For example, if you deposit $100.00 ID, you must wager $300.00 total across any games before you are eligible to withdraw your balance</li>
                <li>Complete all required verification and KYC (Know Your Customer) procedures</li>
              </ul>
              <p className="mb-3 font-bold text-pink-400">
                FAILURE TO MEET THE 3X WAGER REQUIREMENT WILL RESULT IN YOUR WITHDRAWAL REQUEST BEING DENIED.
              </p>
              <p>
                The wager requirement applies to all deposited Imperial Dollars. Withdrawals cannot be processed until this requirement is fulfilled.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">9. VERIFICATION</h2>
              
              <p className="mb-3">
                You agree that we are entitled to conduct any identification, credit and other verification checks that we may 
                reasonably require under applicable laws and regulations.
              </p>
              <p>
                Until all required verification checks are completed, any request for redemption of Prizes will remain pending and 
                we are entitled to restrict your Customer Account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">10. RESPONSIBLE SOCIAL GAMEPLAY</h2>
              
              <p className="mb-3">
                Imperial Gaming actively supports responsible social gameplay and encourages customers to make use of responsible 
                gameplay features.
              </p>

              <h3 className="text-lg font-semibold text-white mb-2">10.1 Self-Exclusion</h3>
              <p className="mb-2">You may request a time-out or self-exclusion from our Games at any time. Available periods:</p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>24 hours</li>
                <li>48 hours</li>
                <li>7 days</li>
                <li>30 days</li>
                <li>2 months</li>
                <li>3 months</li>
                <li>6 months</li>
                <li>1 year</li>
                <li>Indefinite</li>
              </ul>

              <h3 className="text-lg font-semibold text-white mb-2">10.2 During Self-Exclusion</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Purchases will not be permitted</li>
                <li>You will be unsubscribed from all marketing material</li>
                <li>No access will be permitted to games</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">11. PROHIBITED CONDUCT</h2>
              
              <p className="mb-2">You may not:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Use the Platform for any unlawful purpose</li>
                <li>Create multiple accounts</li>
                <li>Use bots, scripts, or automated tools</li>
                <li>Attempt to exploit bugs or vulnerabilities</li>
                <li>Engage in fraudulent activity</li>
                <li>Use VPN or proxy services to mask your location</li>
                <li>Share your account or identification documents with others</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">12. ACCOUNT SUSPENSION/DEACTIVATION</h2>
              
              <p className="mb-2">
                We reserve the right to suspend or deactivate your Customer Account if you:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Breach any provision of these Terms</li>
                <li>Have more than one Customer Account</li>
                <li>Provide incorrect or misleading information</li>
                <li>Are located in an Excluded Territory</li>
                <li>Are not over 21 years of age</li>
                <li>Have failed our due diligence procedures</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">13. INTELLECTUAL PROPERTY</h2>
              
              <p>
                All content on Imperial Gaming, including games, graphics, logos, and text, is owned by us or our licensors. 
                You may not copy, reproduce, or distribute any content without our written permission.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">14. LIMITATION OF LIABILITY</h2>
              
              <p className="mb-3 font-bold text-pink-400">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IMPERIAL GAMING SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, 
                SPECIAL, EXEMPLARY, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE PLATFORM.
              </p>
              <p>
                Imperial Gaming is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free 
                service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">15. DISPUTE RESOLUTION</h2>
              
              <p className="mb-3">
                Any disputes arising from these Terms will be resolved through individual arbitration. You waive your right to 
                pursue any class, group or representative claim.
              </p>
              <p className="mb-3">
                Before filing any claim, you agree to contact us at <a href="mailto:support@imperialhouse.online" className="text-pink-400 hover:text-pink-300">support@imperialhouse.online</a> to try to resolve the issue.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">16. GOVERNING LAW</h2>
              
              <p>
                These Terms will be governed by and construed in accordance with the laws of the State of Virginia in the United 
                States, without regard for its choice of conflict of law principles.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">17. CHANGES TO TERMS</h2>
              
              <p>
                We reserve the right to modify these Terms at any time. Continued use of the Platform after changes constitutes 
                acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">18. CONTACT INFORMATION</h2>
              
              <p className="mb-2">For questions about these Terms of Service, please contact us:</p>
              <ul className="list-none space-y-1">
                <li><strong>Email:</strong> <a href="mailto:support@imperialhouse.online" className="text-pink-400 hover:text-pink-300">support@imperialhouse.online</a></li>
                <li><strong>Address:</strong> 391 Brook Dr. Hot Springs, Virginia 24445 U.S.A.</li>
                <li><strong>Company:</strong> Imperial House Gaming LLC</li>
                <li><strong>Registration:</strong> VA262385288</li>
              </ul>
            </section>

            <div className="mt-8 p-4 bg-pink-500/10 border border-pink-500/30 rounded-xl">
              <p className="text-sm font-bold text-pink-300 mb-2">IMPORTANT REMINDER</p>
              <p className="text-xs text-pink-200">
                Imperial Gaming is for entertainment only. No real money gambling takes place on this platform. 
                Virtual currency cannot be exchanged for real money except through sweepstakes redemption as outlined in these terms.
                No purchase necessary to play or win.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}