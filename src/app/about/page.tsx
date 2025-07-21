import Navbar from '@/components/layout/Navbar';
import BackButton from '@/components/ui/BackButton';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      
      <main className="breathing-room max-w-4xl mx-auto">
        <BackButton className="mb-12" />
        
        <article className="space-y-12">
          <header className="space-y-4 animate-fade-in">
            <h1 className="text-gray-900 dark:text-gray-100">
              about eris debate
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              empowering the next generation of debaters through ai-powered practice
            </p>
          </header>

          <div className="divider"></div>

          <section className="space-y-6 animate-fade-in stagger-1">
            <h2 className="text-gray-900 dark:text-gray-100">our mission</h2>
            <p>
              eris debate was created to democratize access to high-quality debate practice. 
              we believe every student should have the opportunity to develop critical thinking 
              and communication skills, regardless of their school's resources or geographic location.
            </p>
            <p>
              by combining advanced ai technology with proven debate pedagogy, we provide 
              students with realistic practice partners, detailed feedback, and comprehensive 
              research tools—all in one distraction-free platform.
            </p>
          </section>

          <section className="space-y-6 animate-fade-in stagger-2">
            <h2 className="text-gray-900 dark:text-gray-100">built for public forum debate</h2>
            <p>
              our platform is specifically designed for high school public forum debaters. 
              every feature—from the timed debate rounds to the ai personalities—has been 
              crafted to mirror real tournament conditions and help students prepare effectively.
            </p>
            <p>
              with 10 distinct ai debate partners, each with unique arguing styles and strengths, 
              students can practice against diverse opponents and improve their adaptability.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">our approach</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-primary-500 mb-2">intelligent practice</h3>
                <p>
                  our ai opponents generate substantive arguments, respond to your 
                  points, and engage in realistic crossfire exchanges.
                </p>
              </div>
              <div>
                <h3 className="text-primary-500 mb-2">comprehensive feedback</h3>
                <p>
                  receive detailed analysis on your speeches, including scores for delivery, 
                  argument quality, evidence usage, and rebuttal effectiveness.
                </p>
              </div>
              <div>
                <h3 className="text-primary-500 mb-2">evidence at your fingertips</h3>
                <p>
                  our vector-based search engine helps you find relevant evidence quickly, 
                  drawing from a curated database of credible sources.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-gray-900 dark:text-gray-100">privacy & security</h2>
            <p>
              we take your privacy seriously. all debate sessions are private, your data is 
              encrypted, and we use row-level security to ensure only you can access your 
              practice history and feedback.
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