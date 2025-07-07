/**
 * Terms of Service Page for DebateAI
 * Comprehensive terms and conditions for platform usage
 */

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | DebateAI',
  description: 'Read the terms and conditions for using DebateAI platform.',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            Terms of Service
          </h1>
          
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                1. Acceptance of Terms
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                By accessing and using DebateAI ("the Service"), you accept and agree to be bound by 
                the terms and provision of this agreement. If you do not agree to abide by the above, 
                please do not use this service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                2. Description of Service
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                DebateAI is an AI-powered platform designed to help users improve their debate and 
                public speaking skills through:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Interactive AI debate simulations</li>
                <li>Speech analysis and feedback</li>
                <li>Evidence research and wiki search capabilities</li>
                <li>Performance tracking and improvement recommendations</li>
                <li>Educational content and debate training materials</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                3. User Accounts and Registration
              </h2>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>You must provide accurate and complete information when creating an account</li>
                <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                <li>You must be at least 13 years old to use the Service</li>
                <li>Users under 18 must have parental consent</li>
                <li>One account per person; multiple accounts are not permitted</li>
                <li>You are responsible for all activities that occur under your account</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                4. Acceptable Use Policy
              </h2>
              
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-3">
                Permitted Uses
              </h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Educational and personal skill development</li>
                <li>Legitimate debate practice and training</li>
                <li>Research for educational purposes</li>
                <li>Content creation for academic or professional use</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-3 mt-6">
                Prohibited Uses
              </h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Uploading offensive, harmful, or inappropriate content</li>
                <li>Using the service for commercial purposes without authorization</li>
                <li>Attempting to reverse engineer or modify the AI systems</li>
                <li>Sharing account credentials with others</li>
                <li>Violating any applicable laws or regulations</li>
                <li>Harassment, abuse, or threatening behavior</li>
                <li>Spamming or automated abuse of the platform</li>
                <li>Uploading copyrighted material without permission</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                5. Content and Intellectual Property
              </h2>
              
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-3">
                User Content
              </h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>You retain ownership of content you upload (speeches, recordings, etc.)</li>
                <li>You grant us a license to process your content for service delivery</li>
                <li>You are responsible for ensuring you have rights to uploaded content</li>
                <li>We may remove content that violates these terms</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-3 mt-6">
                Platform Content
              </h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>DebateAI owns all platform software, AI models, and generated content</li>
                <li>You may not copy, modify, or distribute our proprietary technology</li>
                <li>Educational materials and feedback remain our intellectual property</li>
                <li>You receive a limited license to use the platform for personal use only</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                6. Privacy and Data Usage
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Your privacy is important to us. Please review our{' '}
                <a href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Privacy Policy
                </a>{' '}
                to understand how we collect, use, and protect your information.
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>We use your data to provide and improve our services</li>
                <li>Audio recordings are processed for analysis and feedback</li>
                <li>We implement strong security measures to protect your data</li>
                <li>You can request data deletion in accordance with our Privacy Policy</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                7. Service Availability and Modifications
              </h2>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>We strive for high availability but cannot guarantee 100% uptime</li>
                <li>We may modify, suspend, or discontinue services with notice</li>
                <li>We may update features and functionality over time</li>
                <li>Emergency maintenance may occur without advance notice</li>
                <li>We are not liable for service interruptions or data loss</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                8. Limitation of Liability
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                To the fullest extent permitted by law:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>The service is provided "as is" without warranties of any kind</li>
                <li>We are not liable for indirect, incidental, or consequential damages</li>
                <li>Our total liability shall not exceed the amount paid for the service</li>
                <li>We are not responsible for third-party content or services</li>
                <li>Users assume all risks associated with platform usage</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                9. Termination
              </h2>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>You may terminate your account at any time</li>
                <li>We may terminate accounts for violations of these terms</li>
                <li>We may suspend access during investigations of misconduct</li>
                <li>Upon termination, your access to the service will cease</li>
                <li>Some provisions of these terms survive termination</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                10. AI and Machine Learning Disclaimer
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Our platform uses artificial intelligence and machine learning technologies:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>AI feedback is educational and should not replace human instruction</li>
                <li>AI-generated content may contain errors or biases</li>
                <li>Users should verify information and use critical thinking</li>
                <li>We continuously improve our AI systems but cannot guarantee perfection</li>
                <li>AI responses are generated based on training data and algorithms</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                11. Dispute Resolution
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                In the event of disputes:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>We encourage resolution through direct communication</li>
                <li>Binding arbitration may be required for certain disputes</li>
                <li>Class action lawsuits are waived where legally permissible</li>
                <li>Governing law shall be determined by our jurisdiction</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                12. Changes to Terms
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We reserve the right to modify these terms at any time. Material changes will be 
                communicated through the platform or email. Continued use of the service after 
                changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                13. Contact Information
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                For questions about these Terms of Service, please contact us:
              </p>
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Email:</strong>{' '}
                  <a href="mailto:legal@debateai.com" className="text-blue-600 dark:text-blue-400 hover:underline">
                    legal@debateai.com
                  </a>
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Subject Line:</strong> Terms of Service Inquiry
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Response Time:</strong> We aim to respond within 72 hours
                </p>
              </div>
            </section>

            <div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Agreement Acknowledgment
              </h3>
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                By using DebateAI, you acknowledge that you have read, understood, and agree to be 
                bound by these Terms of Service and our Privacy Policy. If you do not agree to 
                these terms, please discontinue use of the platform immediately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}