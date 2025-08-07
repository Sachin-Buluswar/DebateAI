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
              disrupting debate education through ai-powered practice
            </p>
          </header>

          <div className="divider"></div>

          <section className="space-y-8 animate-fade-in stagger-1">
            <h2 className="text-gray-900 dark:text-gray-100">meet the founders</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
              <div className="space-y-4">
                <div>
                  <h3 className="text-primary-500 mb-1">sachin buluswar</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    co-founder • horace mann school, class of 2026
                  </p>
                </div>
                <p className="leading-relaxed">
                  sachin combines his programming expertise with debate knowledge, having 
                  competed in parliamentary debate. he specializes in building ai-powered 
                  software products.
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  in his free time, sachin loves driving cars and practicing brazilian 
                  jiu-jitsu.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-primary-500 mb-1">kevin cheng</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    co-founder • horace mann school, class of 2026
                  </p>
                </div>
                <p className="leading-relaxed">
                  kevin brings 5 years of competitive debate experience as president of 
                  horace mann's public forum debate team. he's qualified twice to the tournament of 
                  champions and once to nationals.
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  outside of debate, kevin enjoys playing piano and exploring new york city 
                  with friends.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-6 animate-fade-in stagger-2">
            <h2 className="text-gray-900 dark:text-gray-100">our story</h2>
            <p>
              eris is the name of the greek goddess for chaos and disruption. 
              and that's our goal: to disrupt debate education.
            </p>
            <p>
              currently, debate is dominated by schools that spend thousands of dollars on 
              expensive coaches. but we believe that's not how it should be. instead, debate 
              should be an equal playing field where the more strategic and articulate debater 
              wins rounds, rather than teams with hours of coaching under their belts.
            </p>
            <p>
              eris debate is our way of making that happen. with eris, you don't need a coach 
              to give you speech feedback, help you find evidence, or practice live rounds.
            </p>
            <p className="text-primary-500 font-medium">
              join us in democratizing debate education.
            </p>
          </section>

          <section className="space-y-6 animate-fade-in stagger-3">
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

          <section className="space-y-6 animate-fade-in stagger-4">
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