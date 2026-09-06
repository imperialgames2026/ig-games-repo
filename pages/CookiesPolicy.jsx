import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CookiesPolicy() {
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
              <Cookie className="w-6 h-6 text-pink-400" />
            </div>
            <h1 className="text-3xl font-black text-white">Cookies Policy</h1>
          </div>

          <div className="text-gray-300 space-y-6 text-sm">
            <p className="text-xs text-gray-400">Last Updated: February 7, 2026</p>

            <p>
              This website uses cookies to better the users experience while visiting the website. Where applicable this website uses a 
              cookie control system allowing the user on their first visit to the website to allow or disallow the use of cookies on their 
              computer/device. This complies with recent legislation requirements for websites to obtain explicit consent from users before 
              leaving behind or reading files such as cookies on a user's computer/device.
            </p>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">Cookies In Use</h2>
              <p className="mb-4">The cookies in use are described in the table below:</p>
              
              <div className="overflow-x-auto">
                <table className="w-full border border-white/10 text-xs">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="border border-white/10 p-3 text-left">Cookies</th>
                      <th className="border border-white/10 p-3 text-left">Owner</th>
                      <th className="border border-white/10 p-3 text-left">Duration</th>
                      <th className="border border-white/10 p-3 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-white/10 p-3">SAPISID, APISID, SSID, HSID, SID</td>
                      <td className="border border-white/10 p-3">Google</td>
                      <td className="border border-white/10 p-3">2 years</td>
                      <td className="border border-white/10 p-3">Stores user preferences including preferred language, number of search results, and SafeSearch filter settings</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-3">SIDCC</td>
                      <td className="border border-white/10 p-3">Google</td>
                      <td className="border border-white/10 p-3">1 day</td>
                      <td className="border border-white/10 p-3">Security cookie that protects user data from unauthorized access</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-3">__Secure-3PSID, __Secure-3PAPISID, __Secure-1PAPISID, __Secure-1PSID</td>
                      <td className="border border-white/10 p-3">Google</td>
                      <td className="border border-white/10 p-3">2 years</td>
                      <td className="border border-white/10 p-3">Builds a profile of website visitor interests to show relevant and personalized ads through retargeting</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-3">__Secure-3PSIDCC, __Secure-1PSIDCC</td>
                      <td className="border border-white/10 p-3">Google</td>
                      <td className="border border-white/10 p-3">1 year</td>
                      <td className="border border-white/10 p-3">Builds a profile of website visitor interests to show relevant and personalized ads through retargeting</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-3">NID</td>
                      <td className="border border-white/10 p-3">Google</td>
                      <td className="border border-white/10 p-3">6 months</td>
                      <td className="border border-white/10 p-3">Stores visitors' preferences and personalizes ads on Google websites based on recent searches and interactions</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-3">_ga</td>
                      <td className="border border-white/10 p-3">Google</td>
                      <td className="border border-white/10 p-3">-</td>
                      <td className="border border-white/10 p-3">Google Analytics persistent cookie used to distinguish unique users</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-3">1P_JAR</td>
                      <td className="border border-white/10 p-3">Google</td>
                      <td className="border border-white/10 p-3">1 week</td>
                      <td className="border border-white/10 p-3">Based on recent searches and previous interactions, custom ads are shown on Google sites</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-3">MUID</td>
                      <td className="border border-white/10 p-3">Bing.com</td>
                      <td className="border border-white/10 p-3">1 month</td>
                      <td className="border border-white/10 p-3">Microsoft User Identifier tracking cookie used by Bing Ads</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-3">_EDGE_S</td>
                      <td className="border border-white/10 p-3">Bing.com</td>
                      <td className="border border-white/10 p-3">-</td>
                      <td className="border border-white/10 p-3">Used to retarget website visitors via Bing</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-3">OTZ</td>
                      <td className="border border-white/10 p-3">Google</td>
                      <td className="border border-white/10 p-3">1 month</td>
                      <td className="border border-white/10 p-3">Links activities of website visitors to other devices previously logged in via the Google account</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-3">_gid</td>
                      <td className="border border-white/10 p-3">Google</td>
                      <td className="border border-white/10 p-3">1 day</td>
                      <td className="border border-white/10 p-3">Google Analytics cookie used to store information about how visitors use the website</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-3">_uetvid</td>
                      <td className="border border-white/10 p-3">Bing.com</td>
                      <td className="border border-white/10 p-3">1 year</td>
                      <td className="border border-white/10 p-3">Used to track visitors on multiple websites to present relevant advertisements</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-3">_uetsid</td>
                      <td className="border border-white/10 p-3">Bing.com</td>
                      <td className="border border-white/10 p-3">1 day</td>
                      <td className="border border-white/10 p-3">Collects data on visitor behaviour from multiple websites for relevant advertisements</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-3">fp_token_*, io_token_*</td>
                      <td className="border border-white/10 p-3">Iovation</td>
                      <td className="border border-white/10 p-3">-</td>
                      <td className="border border-white/10 p-3">Analytics and customer support</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-3">incap_ses_*, visid_incap_*</td>
                      <td className="border border-white/10 p-3">Optimove</td>
                      <td className="border border-white/10 p-3">-</td>
                      <td className="border border-white/10 p-3">Marketing purposes</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-3">intercom-id-*, intercom-session-*</td>
                      <td className="border border-white/10 p-3">Intercom</td>
                      <td className="border border-white/10 p-3">-</td>
                      <td className="border border-white/10 p-3">Customer support</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-3">mp_*_mixpanel</td>
                      <td className="border border-white/10 p-3">Mixpanel</td>
                      <td className="border border-white/10 p-3">-</td>
                      <td className="border border-white/10 p-3">Marketing purposes</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">Opt-out</h2>
              <p className="mb-3">
                In order to provide website visitors with more choice on how data is collected by Google Analytics, Google has developed 
                the Google Analytics Opt-out Browser Add-on. The add-on communicates with the Google Analytics JavaScript (ga.js) to stop 
                data being sent to Google Analytics. The Google Analytics Opt-out Browser Add-on does not affect usage of the website in 
                any other way.
              </p>
              <p className="mb-3">
                For more information: <a href="http://tools.google.com/dlpage/gaoptout?hl=None" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300">Google Analytics Opt-out Browser Add-on</a>
              </p>
              <p>
                For more information on the usage of cookies by Google Analytics: <a href="http://www.google.com/analytics/learn/privacy.html" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300">Google Analytics Privacy</a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">Disabling Cookies</h2>
              <p className="mb-3">
                If you would like to restrict the use of cookies you can control this in your Internet browser. Links to advice on how to 
                do this for the most popular Internet browsers are provided below:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <a href="http://windows.microsoft.com/en-GB/windows7/Block-enable-or-allow-cookies" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300">
                    Internet Explorer
                  </a>
                </li>
                <li>
                  <a href="https://support.google.com/chrome/bin/answer.py?hl=en-GB&answer=95647&p=cpn_cookies" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300">
                    Google Chrome
                  </a>
                </li>
                <li>
                  <a href="http://support.mozilla.org/en-US/kb/Blocking%20cookies" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300">
                    Mozilla Firefox
                  </a>
                </li>
                <li>
                  <a href="http://docs.info.apple.com/article.html?artnum=32467" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300">
                    Apple Safari
                  </a>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">Contact & Communication</h2>
              <p className="mb-3">
                Users contacting this website and/or its owners do so at their own discretion and provide any such personal details requested 
                at their own risk. Your personal information is kept private and stored securely until a time it is no longer required or has 
                no use, as detailed in the Data Protection Regulation.
              </p>
              <p className="mb-3">
                This website and its owners use any information submitted to provide you with further information about the products/services 
                they offer or to assist you in answering any questions or queries you may have submitted. This includes using your details to 
                subscribe you to any email newsletter program the website operates but only if this was made clear to you and your express 
                permission was granted.
              </p>
              <p>Your details are not passed on to any third parties.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">External Links</h2>
              <p className="mb-3">
                Although this website only looks to include quality, safe and relevant external links, users are advised adopt a policy of 
                caution before clicking any external web links mentioned throughout this website.
              </p>
              <p>
                The owners of this website cannot guarantee or verify the contents of any externally linked website despite their best efforts. 
                Users should therefore note they click on external links at their own risk and this website and its owners cannot be held liable 
                for any damages or implications caused by visiting any external links mentioned.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">Social Media Platforms</h2>
              <p className="mb-3">
                Communication, engagement and actions taken through external social media platforms that this website and its owners participate 
                on are custom to the terms and conditions as well as the privacy policies held with each social media platform respectively.
              </p>
              <p className="mb-3">
                Users are advised to use social media platforms wisely and communicate/engage upon them with due care and caution in regard to 
                their own privacy and personal details. This website nor its owners will ever ask for personal or sensitive information through 
                social media platforms and encourage users wishing to discuss sensitive details to contact them through primary communication 
                channels such as by telephone or email.
              </p>
              <p>
                This website may use social sharing buttons which help share web content directly from web pages to the social media platform 
                in question. Users are advised before using such social sharing buttons that they do so at their own discretion and note that 
                the social media platform may track and save your request to share a web page respectively through your social media platform account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">Shortened Links in Social Media</h2>
              <p className="mb-3">
                This website and its owners through their social media platform accounts may share web links to relevant web pages.
              </p>
              <p>
                Users are advised to take caution and good judgement before clicking any shortened URLs published on social media platforms by 
                this website and its owners. Despite the best efforts to ensure only genuine URLs are published many social media platforms are 
                prone to spam and hacking and therefore this website and its owners cannot be held liable for any damages or implications caused 
                by visiting any shortened links.
              </p>
            </section>

            <div className="mt-8 p-4 bg-pink-500/10 border border-pink-500/30 rounded-xl">
              <p className="text-sm font-bold text-pink-300 mb-2">Contact Information</p>
              <p className="text-xs text-pink-200">
                If you have any questions about this Cookies Policy, please contact us at{' '}
                <a href="mailto:imperial.games2026@gmail.com" className="text-pink-400 hover:text-pink-300">
                  imperial.games2026@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}