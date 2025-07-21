import { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import BackButton from '@/components/ui/BackButton';

export const metadata: Metadata = {
  title: 'Terms of Service | Eris Debate',
  description: 'Read the terms and conditions for using Eris Debate platform.',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      
      <main className="breathing-room max-w-4xl mx-auto">
        <BackButton className="mb-12" />
        
        <article className="space-y-12">
          <header className="space-y-4">
            <h1 className="text-gray-900 dark:text-gray-100">
              terms of service
            </h1>
            <p className="text-sm text-gray-500">
              effective date: {new Date().toLocaleDateString()}
            </p>
          </header>

          <div className="divider"></div>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">acceptance of terms</h2>
            <p>
              by accessing or using eris debate, you agree to be bound by these terms of service. 
              if you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">description of service</h2>
            <p>
              eris debate provides ai-powered debate training tools including simulated debates, 
              speech analysis, and research assistance for educational purposes.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">user accounts</h2>
            <div className="space-y-4">
              <p>to use certain features, you must create an account. you agree to:</p>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400 pl-8">
                <li>provide accurate information</li>
                <li>maintain the security of your password</li>
                <li>notify us of any unauthorized access</li>
                <li>be responsible for all account activity</li>
              </ul>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">acceptable use</h2>
            <p>you agree not to:</p>
            <ul className="space-y-2 text-gray-600 dark:text-gray-400 pl-8">
              <li>violate any laws or regulations</li>
              <li>infringe on intellectual property rights</li>
              <li>upload harmful or malicious content</li>
              <li>attempt to gain unauthorized access</li>
              <li>interfere with service operation</li>
              <li>use the service for commercial purposes without permission</li>
            </ul>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">content ownership</h2>
            <div className="space-y-4">
              <h3 className="text-primary-500">your content</h3>
              <p>
                you retain ownership of content you create. by using our service, you grant us 
                a license to use, store, and process your content to provide our services.
              </p>
              
              <h3 className="text-primary-500 mt-4">our content</h3>
              <p>
                eris debate and its licensors own all rights to the service, including ai models, 
                software, and educational materials.
              </p>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">privacy</h2>
            <p>
              your use of our service is governed by our privacy policy. please review it to 
              understand our data practices.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">disclaimers</h2>
            <p>
              the service is provided "as is" without warranties of any kind. we do not guarantee 
              uninterrupted service or specific outcomes from using our platform.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">limitation of liability</h2>
            <p>
              to the fullest extent permitted by law, eris debate shall not be liable for any 
              indirect, incidental, or consequential damages arising from your use of the service.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">indemnification</h2>
            <p>
              you agree to indemnify and hold harmless eris debate from any claims arising from 
              your use of the service or violation of these terms.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">termination</h2>
            <p>
              we may terminate or suspend your account at any time for violations of these terms. 
              you may also delete your account at any time through your account settings.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">changes to terms</h2>
            <p>
              we may modify these terms at any time. continued use after changes constitutes 
              acceptance of the new terms.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">governing law</h2>
            <p>
              these terms are governed by the laws of the united states, without regard to 
              conflict of law principles.
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