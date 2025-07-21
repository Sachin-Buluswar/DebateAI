import { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import BackButton from '@/components/ui/BackButton';

export const metadata: Metadata = {
  title: 'Privacy Policy | Eris Debate',
  description: 'Learn how Eris Debate collects, uses, and protects your personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      
      <main className="breathing-room max-w-4xl mx-auto">
        <BackButton className="mb-12" />
        
        <article className="space-y-12">
          <header className="space-y-4">
            <h1 className="text-gray-900 dark:text-gray-100">
              privacy policy
            </h1>
            <p className="text-sm text-gray-500">
              last updated: {new Date().toLocaleDateString()}
            </p>
          </header>

          <div className="divider"></div>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">introduction</h2>
            <p>
              this privacy policy explains how eris debate collects, uses, and protects your information. 
              by using our platform, you agree to the collection and use of information in accordance 
              with this policy.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">information we collect</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-primary-500 mb-2">personal information</h3>
                <p>email address, name, profile preferences, and communication settings.</p>
              </div>
              
              <div>
                <h3 className="text-primary-500 mb-2">usage information</h3>
                <p>
                  audio recordings of speeches, debate topics, participation history, 
                  analysis results, search queries, and platform usage patterns.
                </p>
              </div>
              
              <div>
                <h3 className="text-primary-500 mb-2">technical information</h3>
                <p>
                  ip address, device information, browser type, operating system, 
                  and usage analytics.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">how we use your information</h2>
            <ul className="space-y-2 text-gray-600 dark:text-gray-400">
              <li>— provide and maintain debate training services</li>
              <li>— analyze speech recordings for feedback</li>
              <li>— personalize your learning experience</li>
              <li>— communicate about your account</li>
              <li>— improve our ai models</li>
              <li>— ensure platform security</li>
              <li>— comply with legal obligations</li>
            </ul>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">third-party services</h2>
            <div className="space-y-4">
              <p>we use trusted partners to provide our services:</p>
              <div className="pl-8 space-y-2">
                <p><span className="text-primary-500">openai</span> — speech analysis and feedback</p>
                <p><span className="text-primary-500">elevenlabs</span> — voice synthesis and transcription</p>
                <p><span className="text-primary-500">supabase</span> — secure data storage</p>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">data security</h2>
            <p>
              we implement appropriate security measures including encryption, access controls, 
              regular audits, and secure cloud storage to protect your information.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">your rights</h2>
            <p>you have the right to:</p>
            <ul className="space-y-2 text-gray-600 dark:text-gray-400 pl-8">
              <li>access your personal data</li>
              <li>correct inaccurate information</li>
              <li>request deletion of your data</li>
              <li>receive your data in a portable format</li>
              <li>object to certain processing</li>
              <li>withdraw consent</li>
            </ul>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">data retention</h2>
            <p>
              speech recordings and analysis data are retained for 2 years unless you request 
              earlier deletion. account information is kept for the duration of your account 
              plus 30 days.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">children's privacy</h2>
            <p>
              our service is not intended for children under 13. we do not knowingly collect 
              information from children under 13.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">updates to this policy</h2>
            <p>
              we may update this policy periodically. material changes will be posted on this 
              page with an updated date.
            </p>
          </section>


          <div className="divider"></div>

          <footer className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-500">
              eris debate. focused practice for better debates.
            </p>
          </footer>
        </article>
      </main>
    </div>
  );
}