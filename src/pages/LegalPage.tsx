import React from 'react';
import { ArrowLeft, ShieldCheck, FileText, Sparkles, ExternalLink, Calendar, Lock } from 'lucide-react';

interface LegalPageProps {
  type: 'privacy' | 'terms';
  onBack?: () => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({ type, onBack }) => {
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#080b12] text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-[#080b12]/90 backdrop-blur-xl border-b border-white/5 px-4 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-emerald-400" />
            <span>Back to Homebase</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-emerald-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-sm font-black tracking-tight text-white">Homebase</span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <a
              href="/privacy"
              className={`px-3 py-1.5 rounded-xl transition-all ${
                type === 'privacy'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Privacy
            </a>
            <a
              href="/terms"
              className={`px-3 py-1.5 rounded-xl transition-all ${
                type === 'terms'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Terms
            </a>
          </div>
        </div>
      </header>

      {/* Main Document Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {type === 'privacy' ? (
          <article className="space-y-8">
            <div className="space-y-3 border-b border-white/10 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Privacy & Data Protection</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Privacy Policy</h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Last updated: <span className="text-slate-300 font-medium">September 16, 2026</span>
              </p>
            </div>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400">1.</span> Overview
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Homebase (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;the app&rdquo;) is a private household coordination and family organizing application operated at{' '}
                <a href="https://homebase.skyy.studio" className="text-emerald-400 underline">https://homebase.skyy.studio</a>. We believe family data belongs strictly to the family. We do not sell, rent, monetize, or broker your personal information or household data under any circumstances.
              </p>
            </section>

            <section className="space-y-4 p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-base">
                <Calendar className="w-5 h-5" />
                <h2>2. Google User Data & Google Calendar Sync</h2>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                When you connect your Google account to Homebase, our application requests access to the Google Calendar API strictly to synchronize your personal schedule with your private household timeline.
              </p>
              <div className="space-y-2 text-xs sm:text-sm text-slate-300">
                <div className="font-semibold text-white">Specific access and usage includes:</div>
                <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
                  <li>
                    <strong className="text-slate-200">Calendar Discovery:</strong> Requesting metadata of your calendars (titles and IDs) so you can granularly choose which specific calendars to include and which family member to assign each calendar to.
                  </li>
                  <li>
                    <strong className="text-slate-200">Event Synchronization:</strong> Reading event titles, dates, start/end times, and descriptions solely to display them on your unified household schedule.
                  </li>
                  <li>
                    <strong className="text-slate-200">Selective Granularity:</strong> We only synchronize the specific calendars you explicitly select.
                  </li>
                </ul>
              </div>

              {/* Limited Use Disclosure */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/30 space-y-2">
                <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Google API Services User Data Policy & Limited Use
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Homebase&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
                  <a
                    href="https://developers.google.com/terms/api-services-user-data-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 underline font-medium inline-flex items-center gap-1"
                  >
                    Google API Services User Data Policy <ExternalLink className="w-3 h-3" />
                  </a>
                  , including the Limited Use requirements.
                </p>
              </div>

              <div className="space-y-2 text-xs sm:text-sm text-slate-300">
                <div className="font-semibold text-white">What we NEVER do with your Google data:</div>
                <ul className="list-disc list-inside space-y-1 pl-2 text-slate-300">
                  <li>We do NOT sell, lease, or transfer your Google data to any third party or data broker.</li>
                  <li>We do NOT use your Google Calendar data for advertising, marketing, or retargeting.</li>
                  <li>We do NOT train generalized artificial intelligence or machine learning models on your Google data.</li>
                  <li>We do NOT access your Gmail, Google Drive, Contacts, or any other unauthorized Google services.</li>
                </ul>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400">3.</span> Information We Collect
              </h2>
              <div className="space-y-2 text-sm text-slate-300 leading-relaxed">
                <p>Besides optional Google Calendar sync, Homebase stores information you provide directly to operate your household:</p>
                <ul className="list-disc list-inside space-y-1.5 pl-2">
                  <li><strong className="text-slate-200">Account Credentials:</strong> Name, email address, and encrypted password.</li>
                  <li><strong className="text-slate-200">Household Data:</strong> Grocery items, custom aisles, recipes, and meal plans created by household members.</li>
                  <li><strong className="text-slate-200">Device Push Tokens:</strong> Cryptographic Web Push subscriptions to notify household members of updates (if you grant browser permission).</li>
                </ul>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400">4.</span> Data Storage, Retention & Security
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                All data is encrypted in transit using Transport Layer Security (TLS/HTTPS). Authentication passwords are protected using industry-standard hashing algorithms. Data is retained solely as long as your household account remains active.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400">5.</span> Disconnecting & Deleting Your Data
              </h2>
              <div className="space-y-2 text-sm text-slate-300 leading-relaxed">
                <p>
                  You have complete control over your data at all times:
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-2">
                  <li>
                    <strong className="text-slate-200">Disconnect Google Sync:</strong> You can disconnect your Google Calendar at any time in Homebase under <em>Settings &rarr; Google Calendar Sync &rarr; Disconnect</em>. This immediately deletes stored OAuth refresh tokens and purges all synced Google events from the schedule timeline.
                  </li>
                  <li>
                    <strong className="text-slate-200">Revoke via Google:</strong> You can also revoke access anytime through your{' '}
                    <a
                      href="https://myaccount.google.com/permissions"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 underline font-medium"
                    >
                      Google Account Security Permissions
                    </a>.
                  </li>
                  <li>
                    <strong className="text-slate-200">Account Deletion:</strong> You can request full deletion of your household and account data by contacting us below.
                  </li>
                </ul>
              </div>
            </section>

            <section className="space-y-3 border-t border-white/10 pt-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400">6.</span> Contact Us
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                If you have questions, privacy concerns, or data deletion requests, please reach out to:
              </p>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 text-xs sm:text-sm text-slate-300 space-y-1">
                <div className="text-white font-bold">Homebase Support</div>
                <div>Email:{' '}
                  <a href="mailto:support@famkit.app" className="text-emerald-400 underline font-medium">
                    support@famkit.app
                  </a>
                </div>
                <div>Website:{' '}
                  <a href="https://homebase.skyy.studio" className="text-emerald-400 underline font-medium">
                    https://homebase.skyy.studio
                  </a>
                </div>
              </div>
            </section>
          </article>
        ) : (
          <article className="space-y-8">
            <div className="space-y-3 border-b border-white/10 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold">
                <FileText className="w-3.5 h-3.5" />
                <span>Terms of Service</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Terms of Service</h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Last updated: <span className="text-slate-300 font-medium">September 16, 2026</span>
              </p>
            </div>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400">1.</span> Acceptance of Terms
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                By accessing or using Homebase at <a href="https://homebase.skyy.studio" className="text-emerald-400 underline">https://homebase.skyy.studio</a>, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400">2.</span> Purpose & Household Use
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Homebase provides collaborative tools for family organizing, including shared grocery lists, meal scheduling, recipe management, and calendar aggregation. It is intended solely for personal, non-commercial household management.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400">3.</span> Account Responsibilities & Security
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials and household invite codes. You agree to notify us immediately of any unauthorized access to your household account.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400">4.</span> Third-Party Integrations (Google Calendar)
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Homebase allows optional connection with third-party services such as Google Calendar. When you choose to connect a third-party account, you authorize Homebase to access the selected data according to our Privacy Policy and third-party terms. We are not responsible for outages or modifications made by third-party service providers.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400">5.</span> Service Availability & Disclaimers
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Homebase is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. While we strive for 100% uptime and data integrity, we do not warrant that the service will be uninterrupted or error-free.
              </p>
            </section>

            <section className="space-y-3 border-t border-white/10 pt-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400">6.</span> Contact Information
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                For legal inquiries or questions regarding these terms, please contact:
              </p>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 text-xs sm:text-sm text-slate-300 space-y-1">
                <div className="text-white font-bold">Homebase Support</div>
                <div>Email:{' '}
                  <a href="mailto:support@famkit.app" className="text-emerald-400 underline font-medium">
                    support@famkit.app
                  </a>
                </div>
              </div>
            </section>
          </article>
        )}

        {/* Bottom Back Button */}
        <div className="mt-12 pt-8 border-t border-white/10 flex justify-center">
          <button
            onClick={handleBack}
            className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-xl shadow-emerald-500/20 flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Homebase</span>
          </button>
        </div>
      </main>
    </div>
  );
};
