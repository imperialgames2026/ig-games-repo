import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicy() {
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
              <Shield className="w-6 h-6 text-pink-400" />
            </div>
            <h1 className="text-3xl font-black text-white">Privacy Policy</h1>
          </div>

          <div className="text-gray-300 space-y-6 text-sm">
            <p className="text-xs text-gray-400">Last Updated: February 7, 2026</p>

            <p>
              This Privacy Policy governs the manner in which Imperial House Gaming LLC (hereinafter "Imperial Gaming", "We", "us", or "our"), 
              collects, use, maintain and disclose information collected from customers of its website imperialhouse.online. This Privacy Policy 
              applies to imperialhouse.online and all products and services offered through imperialhouse.online.
            </p>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">1. Imperial Gaming Statement</h2>
              <p>
                Imperial Gaming is committed to protecting and respecting your privacy and maintaining the confidence and trust its customers. 
                This Privacy Policy explains how your personal information is collected, why it is collected and how it is kept secure.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">2. Data Controller</h2>
              <p>
                Imperial House Gaming LLC is a company incorporated under the laws of Virginia, with the register number VA262385288 and 
                registered office at 391 Brook Dr. Hot Springs, Virginia 24445 U.S.A. Imperial House Gaming LLC is responsible for processing 
                the data collected from you using the website imperialhouse.online.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">3. Type of Information We Collect</h2>
              <p className="mb-2">We collect the following information from you:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Full name</li>
                <li>Date of Birth</li>
                <li>Permanent address</li>
                <li>E-mail</li>
                <li>Phone number</li>
                <li>Device information about your use of our website, such as the content you view, the time and duration of your visit on our website, how often you use our services, how you first heard about our website, your preferences and information about your interaction with the content offered through our website, your hardware model, device type, other unique device identifiers, operating system version, browser type and IP address</li>
                <li>Identification documents (may include ID, utility bills, bank statements, etc.)</li>
                <li>Transaction information (linked to the purchases and redeems you make)</li>
                <li>Communications exchange with our teams (support, live chat, complaints, etc.)</li>
                <li>Information we obtain from a third-party, such as a site or platform provider (including Facebook), about your use of or interest in our services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">4. How We Collect Your Information</h2>
              <p className="mb-3">
                We collect your information in a variety of ways, including when you visit, register, make purchases or redemptions on 
                imperialhouse.online, or communicate with us through filling out a form, using our chats or other means of communications.
              </p>
              <p className="mb-3">
                We also collect information about your use of our products and services through a variety of technologies that are present when 
                you visit imperialhouse.online or use our applications on third-party sites or platforms (whether or not you are logged in or 
                registered) including cookies, flash cookies, pixels, tags and application program interfaces ("API").
              </p>
              <p>
                Analytics tools are also used by us to collect information, including when you visit imperialhouse.online or use our applications 
                or services on third-party sites or platforms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">5. How We Use Collected Information</h2>
              <p className="mb-3">
                Imperial Gaming is responsible for and may use your information for the purposes described in this Privacy Policy. Third-Parties 
                may access your information where they act on behalf of Imperial Gaming as a data processor for the purposes described in this 
                Privacy Policy.
              </p>
              <p className="mb-2">
                In accordance with applicable law and any elections made available to you, Imperial Gaming may collect and use your information 
                for the following purposes:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Provide and manage the services you request</li>
                <li>Improve customer service and our services</li>
                <li>Process payments</li>
                <li>Contact you about our services</li>
                <li>Comply legal and regulatory obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">6. Personal Data Collected via Technology</h2>
              <p className="mb-3">
                When you interact with our website, we try to make that experience simple and useful. We and our partners use industry standard 
                identifiers, such as cookies or other similar technologies.
              </p>
              <p>
                Our website may use technologies to enhance your experience. These technologies are small files that are placed on your computer, 
                tablet, mobile phone or other devices when you visit a website. They allow us to record certain pieces of information whenever 
                you visit or interact with the website.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">7. Your Rights Over Your Information</h2>
              <p className="mb-2">You have the following general rights:</p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>Right to access the personal information we hold about you</li>
                <li>Right to object to the processing of your data</li>
                <li>The right to withdraw any consent provided</li>
                <li>The right to request we delete the personal information we hold about you</li>
              </ul>
              <p>
                To exercise the rights described above, please contact{' '}
                <a href="mailto:imperial.games2026@gmail.com" className="text-pink-400 hover:text-pink-300">
                  imperial.games2026@gmail.com
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">8. How We Protect Your Information</h2>
              <p className="mb-3">
                Imperial Gaming has in place, physical, electronic and operational procedures to protect the information that we collect from you. 
                Imperial Gaming adopts appropriate data collection, storage and processing practices and security measures to protect against 
                unauthorized access, alteration, disclosure or destruction of your personal information, username, password, transaction information 
                and data stored on our database.
              </p>
              <p>
                Our security measures are reviewed regularly and updated in keeping with technological advances.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">9. How Long We Will Retain Your Information</h2>
              <p>
                We will retain your information for the period of time required to fulfill the purposes outlined in this Privacy Policy, unless a 
                longer retention period is required or permitted by law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">10. Sharing Your Information</h2>
              <p className="mb-3">
                Imperial Gaming does not sell, trade, or rent the personal identification information of its customers. However, there are 
                circumstances when Imperial Gaming will share your personal data with other companies in Imperial Gaming Group or with third-parties 
                that provide services to you on our behalf.
              </p>
              <p className="mb-2">
                Imperial Gaming will only share your personal information with companies of its Group and Third-Parties on the following circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>You allow us to share your information with third-parties</li>
                <li>When providing you with products and services and notifying you about either important changes or developments to the features and operation of those products and services</li>
                <li>When such information is required by our service providers to enable us to provide our services, such as companies that help us with technology services, storing and combining data, processing payments and redemptions or providing relevant marketing and advertising for our products and services</li>
                <li>In response to lawful requests by public authorities, including to meet national security or law enforcement requirements</li>
                <li>To enforce our terms and conditions, to protect our rights and property and the rights and property of our customers and third-parties</li>
                <li>To perform customer due diligence including ID verification</li>
              </ul>
              <p className="mb-3">
                We may ask you to provide your image to assist us in verifying your identity. We do this by using facial recognition technology 
                provided by third-parties that determines whether the photo you take matches the photo in your identification document. Biometric 
                data is stored by the third-party service provider in accordance with its Privacy Policy and is stored by us, until such time as 
                the initial purpose for collecting or obtaining such information has been satisfied or within 3 years of your last interaction 
                with us, whichever occurs first.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">11. Data Transfers</h2>
              <p className="mb-3">
                Imperial Gaming operates in several international jurisdictions and personal information we collect may be transferred to, and 
                stored and processed by, individual companies in the Imperial Gaming Group or third-parties in the United States or any other 
                country in which we or our third-party processors maintain facilities.
              </p>
              <p>
                We will ensure that transfers of personal information to any country or organization are subject to appropriate safeguards.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">12. Changes to This Privacy Policy</h2>
              <p className="mb-3">
                This Privacy Policy may be updated from time to time to reflect changes in the way we work or the way our work is regulated. 
                We will notify you of material changes and, where required by law, will obtain your consent.
              </p>
              <p className="mb-3">
                Any changes to the Privacy Policy will become effective when the updated policy is posted on imperialhouse.online.
              </p>
              <p>
                We encourage you to frequently check this page for any changes to stay informed about how we are helping to protect the personal 
                information we collect.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">13. Contacting Us</h2>
              <p>
                If you have specific questions regarding your personal information or how we use it, please contact{' '}
                <a href="mailto:imperial.games2026@gmail.com" className="text-pink-400 hover:text-pink-300">
                  imperial.games2026@gmail.com
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">14. Notice About Collection</h2>
              <p className="mb-3">
                We collect information that identifies, relates to, describes, references, is capable of being associated with, or could reasonably 
                be linked, directly or indirectly, with a particular consumer or device ("personal information").
              </p>

              <h3 className="text-lg font-semibold text-white mb-2">Information Collected</h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-white/10 text-xs">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="border border-white/10 p-2 text-left">Personal Information Category</th>
                      <th className="border border-white/10 p-2 text-left">Examples</th>
                      <th className="border border-white/10 p-2 text-center">Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-white/10 p-2">Identifiers</td>
                      <td className="border border-white/10 p-2">Name, email, address, IP address, account name</td>
                      <td className="border border-white/10 p-2 text-center">YES</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-2">Personal information</td>
                      <td className="border border-white/10 p-2">Name, address, telephone, financial information</td>
                      <td className="border border-white/10 p-2 text-center">YES</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-2">Protected classification characteristics</td>
                      <td className="border border-white/10 p-2">Age, race, sex, etc.</td>
                      <td className="border border-white/10 p-2 text-center">YES</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-2">Commercial information</td>
                      <td className="border border-white/10 p-2">Purchase history, consuming histories</td>
                      <td className="border border-white/10 p-2 text-center">YES</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-2">Biometric information</td>
                      <td className="border border-white/10 p-2">Facial recognition data for ID verification</td>
                      <td className="border border-white/10 p-2 text-center">YES</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-2">Internet activity</td>
                      <td className="border border-white/10 p-2">Browsing history, interaction with website</td>
                      <td className="border border-white/10 p-2 text-center">YES</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 p-2">Geolocation data</td>
                      <td className="border border-white/10 p-2">Physical or IP address location</td>
                      <td className="border border-white/10 p-2 text-center">YES</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">Sources of Information</h3>
              <p className="mb-2">We obtain the categories of personal information listed above from the following sources:</p>
              <ul className="list-decimal pl-6 space-y-1">
                <li>Directly from our customers (e.g., registration, verification requests)</li>
                <li>Directly and indirectly from activity on our websites and applications (usage data, device information)</li>
                <li>From third-parties that interact with us in connection with the services we perform</li>
              </ul>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">Use of Personal Information</h3>
              <p className="mb-2">We may use or disclose the personal information we collect for one or more of the following business purposes:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>To provide and manage the services you request</li>
                <li>To maintain, develop, and improve customer service and our services</li>
                <li>To create, maintain, customize, and secure your customer account</li>
                <li>To fulfill purchases or redemptions and prevent transactional fraud</li>
                <li>To personalize user experience</li>
                <li>To contact you about our services</li>
                <li>To comply with our legal and regulatory obligations</li>
              </ul>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">Sharing Personal Information</h3>
              <p className="mb-2">We may disclose your personal information to third-parties for the business purposes described above:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Our affiliates</li>
                <li>Service providers</li>
                <li>Third-parties that interact with us in connection with the services we perform</li>
              </ul>
              <p className="mt-3 font-bold text-pink-400">
                We do not sell your personal information or share it with third-parties for cross-context behavioral advertising.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">15. Your Rights (California Residents)</h2>
              <p className="mb-3">
                California residents may have specific rights regarding their personal information, including accessing the personal information 
                we've collected about you during the past 12 months and information about our data practice. You may also have the right to request 
                that we delete the personal information we have collected from you.
              </p>

              <h3 className="text-lg font-semibold text-white mb-2">Exercising Access and Deletion Rights</h3>
              <p className="mb-3">
                To request access to or deletion of your personal information, please submit a verifiable consumer request to us at{' '}
                <a href="mailto:imperial.games2026@gmail.com" className="text-pink-400 hover:text-pink-300">
                  imperial.games2026@gmail.com
                </a>
              </p>
              <p className="mb-2">For your consumer request to be verifiable, you must provide:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Full name</li>
                <li>Date of birth</li>
                <li>Address</li>
                <li>E-mail address</li>
                <li>Whether you are a California consumer pursuant to CCPA</li>
                <li>Photo identification (for deletion requests)</li>
              </ul>

              <h3 className="text-lg font-semibold text-white mt-4 mb-2">Non-Discrimination</h3>
              <p>We will not discriminate against you for exercising any of your rights described above.</p>
            </section>

            <div className="mt-8 p-4 bg-pink-500/10 border border-pink-500/30 rounded-xl">
              <p className="text-sm font-bold text-pink-300 mb-2">Contact Information</p>
              <p className="text-xs text-pink-200">
                If you have any questions or comments about this Privacy Policy, please contact us at{' '}
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