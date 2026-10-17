import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, FileText, Building2, DollarSign, CheckCircle } from 'lucide-react';

const docs = [
  {
    id: 'llc-certificate',
    tab: 'LLC Certificate',
    icon: Building2,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10 border-purple-400/20',
    title: 'Certificate of Organization',
    issuer: 'Commonwealth of Virginia — State Corporation Commission',
    date: 'March 27, 2026',
    url: 'https://media.base44.com/files/public/697dc67abbb768c5bbbab5d5/c2c5428c2_state_corp_comm_cert_llc.pdf',
    details: [
      { label: 'Company', value: 'Imperial Gaming LLC' },
      { label: 'Entity ID', value: '11991908' },
      { label: 'Effective Date', value: 'March 27, 2026' },
      { label: 'Issued By', value: 'Bernard J. Logan, Clerk of the Commission' },
    ],
    description: 'Official certificate confirming Imperial Gaming LLC is authorized to transact business in the Commonwealth of Virginia.',
  },

  {
    id: 'sales-tax-cert',
    tab: 'Sales Tax Certificate',
    icon: DollarSign,
    color: 'text-green-400',
    bg: 'bg-green-400/10 border-green-400/20',
    title: 'Certificate of Registration — Sales & Use Tax',
    issuer: 'Commonwealth of Virginia — Department of Taxation',
    date: 'March 27, 2026',
    url: 'https://media.base44.com/files/public/697dc67abbb768c5bbbab5d5/f6b5aaa12_cert-of-regist-sales-tax-llc.pdf',
    details: [
      { label: 'Registration No.', value: '10-228399686F-001' },
      { label: 'Account Type', value: 'Non-Fixed Account' },
      { label: 'Liability Start', value: 'April 2026' },
      { label: 'Issued', value: 'March 27, 2026' },
    ],
    description: 'Imperial Gaming LLC is officially authorized and empowered to collect Sales and Use Tax for the Commonwealth of Virginia.',
  },
  {
    id: 'sales-tax-reg',
    tab: 'Tax Registration',
    icon: CheckCircle,
    color: 'text-pink-400',
    bg: 'bg-pink-400/10 border-pink-400/20',
    title: 'Retail Sales & Use Tax Registration',
    issuer: 'Commonwealth of Virginia — Department of Taxation',
    date: 'March 27, 2026',
    url: 'https://media.base44.com/files/public/697dc67abbb768c5bbbab5d5/b517b8bf3_Sales_Tax_IMPERIAL_GAMING.pdf',
    details: [
      { label: 'Account No.', value: '10-228399686F-001' },
      { label: 'Tax Type', value: 'Retail Sales & Use Tax' },
      { label: 'Filing Frequency', value: 'Occasional (Monthly)' },
      { label: 'Liability Start', value: 'April 2026' },
    ],
    description: 'Confirmation of completed iReg registration for Retail Sales and Use Tax, filed with the Virginia Department of Taxation.',
  },
  {
    id: 'pass-through',
    tab: 'Pass-Through Entity',
    icon: Shield,
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10 border-yellow-400/20',
    title: 'Pass-Through Entity Tax Registration',
    issuer: 'Commonwealth of Virginia — Department of Taxation',
    date: 'March 27, 2026',
    url: 'https://media.base44.com/files/public/697dc67abbb768c5bbbab5d5/66ca67a4d_PASS-THROUGH-ENTITY-GAMING-IND.pdf',
    details: [
      { label: 'Account No.', value: '38-228399686F-001' },
      { label: 'Tax Type', value: 'Pass-Through Entity' },
      { label: 'Filing Frequency', value: 'Fiscal' },
      { label: 'Liability Start', value: 'April 2026' },
    ],
    description: 'Confirmation of completed iReg registration for Pass-Through Entity tax obligations with the Virginia Department of Taxation.',
  },
];

export default function Licensing() {
  const [activeTab, setActiveTab] = useState(docs[0].id);

  const active = docs.find(d => d.id === activeTab);
  const Icon = active.icon;

  return (
    <div className="min-h-screen bg-[#0A0612] py-10 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Shield className="w-8 h-8 text-pink-400" />
            <h1 className="text-4xl font-black text-white">Licensing &amp; Registration</h1>
          </div>
          <p className="text-gray-400 text-base max-w-2xl mx-auto">
            Imperial Gaming LLC is a fully registered and compliant limited liability company in the Commonwealth of Virginia. All official documentation is available below for public transparency.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {docs.map(doc => {
            const TabIcon = doc.icon;
            const isActive = activeTab === doc.id;
            return (
              <button
                key={doc.id}
                onClick={() => setActiveTab(doc.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  isActive
                    ? `${doc.bg} ${doc.color} border-current`
                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                {doc.tab}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="grid md:grid-cols-2 gap-6"
        >
          {/* Info Card */}
          <div className={`rounded-2xl border p-6 ${active.bg}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-black/20`}>
                <Icon className={`w-5 h-5 ${active.color}`} />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">{active.title}</h2>
                <p className="text-gray-400 text-xs">{active.issuer}</p>
              </div>
            </div>

            <p className="text-gray-300 text-sm leading-relaxed mb-5">{active.description}</p>

            <div className="space-y-2 mb-6">
              {active.details.map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4 text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-white font-mono text-right">{value}</span>
                </div>
              ))}
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-gray-500">Issued</span>
                <span className="text-white font-mono">{active.date}</span>
              </div>
            </div>

            <a
              href={active.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-black/30 hover:bg-black/50 transition-colors ${active.color}`}
            >
              <FileText className="w-4 h-4" />
              View Official Document (PDF)
            </a>
          </div>

          {/* PDF Embed */}
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 min-h-[420px]">
            <iframe
              src={active.url}
              title={active.title}
              className="w-full h-full min-h-[420px]"
              style={{ border: 'none' }}
            />
          </div>
        </motion.div>

        {/* Footer note */}
        <p className="text-center text-gray-600 text-xs mt-8">
          All documents are official filings with the Commonwealth of Virginia. Imperial Gaming LLC — Registration No. 11991908 — Effective March 27, 2026.
        </p>
      </div>
    </div>
  );
}