import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Heart, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ResponsiblePlay() {
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
              <Heart className="w-6 h-6 text-pink-400" />
            </div>
            <h1 className="text-3xl font-black text-white">Responsible Play</h1>
          </div>

          <div className="text-gray-300 space-y-6 text-sm">
            <div className="p-4 bg-pink-500/10 border border-pink-500/30 rounded-xl">
              <p className="text-sm font-bold text-pink-300 mb-2">Our Commitment</p>
              <p className="text-xs text-pink-200">
                Imperial Gaming is committed to endorsing responsible gameplay as a policy of customer care and social responsibility. 
                We believe it is our responsibility to you, our customers, to ensure that you enjoy your experience on our platforms, 
                while remaining fully aware of the potential risks that can be associated with computer gameplay if you don't remain in control.
              </p>
            </div>

            <p>
              To ensure that you continue to enjoy safe and manageable play, we fully support responsible gameplay and have put measures 
              in place to assist customers who wish to control their play. We reserve the right to activate these measures unilaterally 
              if, in our sole discretion, we consider them necessary.
            </p>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">1. Overview</h2>
              <p>
                For most people, playing computer games is an enjoyable leisure and entertainment activity. But for some, playing computer 
                games can have negative impacts. As a result, we have developed this policy to communicate our approach to responsible game 
                play and minimizing harm to customers who may be vulnerable to playing computer games.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">2. Customer Care Principles</h2>
              <p>
                At Imperial Gaming, we want to be an industry leader in providing a safe environment for our customers. We actively 
                encourage and promote responsible gameplay practices and provide tools to assist our customers in maintaining control 
                of their gameplay.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">3. Minors</h2>
              <p className="mb-3">
                At Imperial Gaming, we are committed to protecting minors by actively taking steps to exclude minors from using our 
                Sweepstake platform. Our services are designed to appeal to and be used by persons who are at least 21 years old.
              </p>
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-sm font-bold text-red-300 mb-2">IMPORTANT WARNING</p>
                <p className="text-xs text-red-200">
                  OUR SITE IS INTENDED TO BE USED ONLY BY PERSONS OVER 21 YEARS OF AGE AND IS COMPLETELY OFF LIMITS TO PERSONS UNDER 21. 
                  IF YOU ARE UNDER 21, DO NOT TRY TO ACCESS OR USE OUR SITE.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">4. Filtering Options and Account Security</h2>
              <p className="mb-3">
                Filtering and account security options, such as multi-factor authentication, can be enabled to help prevent unauthorized 
                persons from entering imperialhouse.online or gaining access to your account. If minors or any other persons have access 
                to the device that you use to access imperialhouse.online, we strongly encourage you to use multi-factor authentication 
                and filtering software to help secure your account and prevent access to our platform by minors.
              </p>
              <p className="font-bold text-pink-400">
                PLEASE CONTACT US IF YOU HAVE ANY QUESTIONS ABOUT USING THE FILTERING AND ACCOUNT SECURITY OPTIONS AVAILABLE.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">5. Additional Help</h2>
              <p>
                In the case of needed help please contact our support team at{' '}
                <a href="mailto:support@imperialhouse.online" className="text-pink-400 hover:text-pink-300">
                  support@imperialhouse.online
                </a>{' '}
                or on our live chat system and one of our agents will be able to give you the details of associations and help phone 
                numbers available in your country.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">6. Break-in-Play</h2>
              <p className="mb-3">
                Should you need a short break from imperialhouse.online, you can do so by taking a break for the following periods:
              </p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>24 hours</li>
                <li>48 hours</li>
                <li>7 days</li>
                <li>30 days</li>
                <li>2 months</li>
                <li>3 months</li>
              </ul>
              <p className="mb-3">
                You can set a break on your account under "Responsible Gaming" tab. Once you begin your break, you will still be able 
                to log in and make redemptions, but you will not be able to use your account for gaming, to claim daily bonuses or claim 
                reload bonus via the imperialhouse.online site. It will not be possible to reactivate your account until your chosen 
                period has ended.
              </p>
              <p className="italic text-gray-400">
                Imperial Gaming reserves the right to activate any of the above measures including, but not limited to Break-in-Play 
                and self-exclude a user's account should we, at our sole discretion, determine that online gaming may not be safe for 
                you to continue.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">7. Self-Exclusion</h2>
              <p className="mb-3">
                If you are concerned about your gaming activity and believe it has now affected your personal wellbeing negatively 
                (emotional, financial, physical, mental etc.), please consider entering a self-exclusion.
              </p>
              <p className="mb-3">
                Imperial Gaming is committed to giving to its customers an enjoyable and safe free & social gaming experience. If you 
                choose to enter a self-exclusion, your account with Imperial Gaming will be self-excluded immediately for the chosen 
                period (e.g. 6 months, 1 year or Indefinite).
              </p>
              <p className="mb-3">
                When you self-exclude your account, this means that you will not be able to login, play or redeem prizes. Please note 
                that you will not be eligible to re-open your account until the chosen self-exclusion period has expired. "Indefinite" 
                self-exclusion imposes a minimum exclusion period of at least 6 months, from the date of application. Once the 6 month 
                period has lapsed, your account can be considered for reactivation subject to a formal return to play review.
              </p>
              <p className="mb-3">
                We will also take all reasonable steps to ensure you do not receive any promotional material during this time. 
                Nevertheless, if you use Social Media channels, we strongly recommend you take steps to ensure you don't receive our 
                news or updates. You may also wish to consider installing software that blocks access to social casinos. Imperial Gaming 
                also recommends you to seek professional support.
              </p>
              <p className="mb-3">
                You can set your self-exclusion on your account by clicking the "Request Self Exclusion" button in your account settings 
                or by requesting it through the Customer Support Live Chat.
              </p>
              <p className="italic text-gray-400">
                Imperial Gaming reserves the right to activate any of the above measures including, but not limited to Break-in-Play 
                and self-exclude a user's account should we, at our sole discretion, determine that online gaming may not be safe for 
                you to continue.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">8. During the Self-Exclusion Period</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Purchases will not be permitted</li>
                <li>You will be unsubscribed from all marketing material</li>
                <li>During this period, no access will be permitted to social games related to Imperial Gaming, including the public chat forum</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">9. Account Closure</h2>
              <p className="mb-3">
                Imperial Gaming provides the option to close your account should you wish. Upon request via our support chat or email 
                service, we will ensure that your account remains closed indefinitely.
              </p>

              <h3 className="text-lg font-semibold text-white mb-2">Reactivation</h3>
              <p className="mb-3">
                In the event you wish to reactivate your account, a formal written request needs to be made via chat or email for the 
                account to be reactivated. A minimum timeframe of 24 hours needs to expire from the time it was closed, before your 
                account may be reopened and remains subject to internal checks.
              </p>
              <p className="italic text-gray-400">
                Note: Imperial Gaming reserves the right to close a customers account at any point in time.
              </p>
            </section>

            <div className="mt-8 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-green-400" />
                <p className="text-sm font-bold text-green-300">Need Help?</p>
              </div>
              <p className="text-xs text-green-200 mb-3">
                If you or someone you know is struggling with gaming-related issues, help is available.
              </p>
              <div className="space-y-1 text-xs text-green-200">
                 <p>Contact our support team: <a href="mailto:support@imperialhouse.online" className="text-pink-400 hover:text-pink-300">support@imperialhouse.online</a></p>
                 <p>National Problem Gaming Helpline: 1-800-522-4700</p>
                 <p>Visit: <a href="https://www.ncpgambling.org" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300">www.ncpgambling.org</a></p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}