import React from 'react';
import { X, Menu } from 'lucide-react';
import { useState } from 'react';

interface DocsProps {
  onClose: () => void;
}

export function Docs({ onClose }: DocsProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-[#0a0505]">
      {/* Mobile menu button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-[51] p-2 rounded-lg bg-black/20 backdrop-blur-sm text-white hover:bg-black/30 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile-friendly Sidebar */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50 w-64 bg-[#050202] border-r border-red-900/20
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        <div className="p-4 flex-1">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-lg font-semibold text-white">Documentation</h2>
          </div>
          <nav className="space-y-2">
            <a href="#1-introduction" className="block px-3 py-1.5 text-sm text-red-300 hover:text-red-200 rounded-lg hover:bg-red-900/20">
               Introduction
            </a>
            <div className="space-y-2">
              <a href="#2-kiara-ai-models" className="block px-3 py-1.5 text-sm text-red-300 hover:text-red-200 rounded-lg hover:bg-red-900/20">
                 Kiara AI Models
              </a>
              <div className="ml-4 space-y-1">
                <a href="#kiara-dominator-x" className="block px-3 py-1 text-sm text-red-400/70 hover:text-red-300">
                  Kiara Dominator X+
                </a>
                <a href="#kiara-vision-x" className="block px-3 py-1 text-sm text-red-400/70 hover:text-red-300">
                  Kiara Vision X
                </a>
              </div>
            </div>
            <a href="#3-future-vision" className="block px-3 py-1.5 text-sm text-red-300 hover:text-red-200 rounded-lg hover:bg-red-900/20">
               Future Vision & Roadmap
            </a>
            <a href="#4-api-integration" className="block px-3 py-1.5 text-sm text-red-300 hover:text-red-200 rounded-lg hover:bg-red-900/20">
               API & Integration (Coming Soon)
            </a>
            <a href="#5-usage-guidelines" className="block px-3 py-1.5 text-sm text-red-300 hover:text-red-200 rounded-lg hover:bg-red-900/20">
               Usage Guidelines & Best Practices
            </a>
            <a href="#6-security" className="block px-3 py-1.5 text-sm text-red-300 hover:text-red-200 rounded-lg hover:bg-red-900/20">
               Security & Compliance
            </a>
            <a href="#7-community" className="block px-3 py-1.5 text-sm text-red-300 hover:text-red-200 rounded-lg hover:bg-red-900/20">
               Community & Support
            </a>
            <a href="#8-privacy" className="block px-3 py-1.5 text-sm text-red-300 hover:text-red-200 rounded-lg hover:bg-red-900/20">
               Privacy Policy & Legal Notice
            </a>
          </nav>
        </div>
        {/* Logo at the bottom - adjusted margin and padding */}
        <div className="p-4 border-t border-red-900/20">
          <div className="flex justify-center -ml-1">
            <div className="infinity-logo w-16 h-16"></div>
          </div>
        </div>
      </div>

      {/* Content - Hidden on mobile */}
      <div className="flex-1 overflow-y-auto md:ml-0">
        {/* Title at the top */}
        <div className="fixed md:sticky top-0 left-0 right-0 md:left-auto md:right-auto bg-[#0a0505]/90 backdrop-blur-sm border-b border-red-900/20 px-8 py-4 z-[51]">
          <h1 className="text-2xl font-bold text-center title-gradient">
            Kiara Intelligence: Official Documentation
          </h1>
        </div>

        <div className="max-w-4xl mx-auto px-8 pt-24 pb-12 md:pt-12">
          <div className="prose prose-invert prose-red max-w-none">
            <h1 id="1-introduction" className="text-3xl font-bold mb-6 text-white scroll-mt-12">1. Introduction</h1>
            <p className="text-red-200/90 mb-8">
              At Kiara Intelligence, we are not just building AI tools—we are pioneering the future of artificial intelligence. Our mission is to create next-level AI solutions that redefine the boundaries of technology, enhancing human interaction, automation, and predictive capabilities across industries.
            </p>
            <p className="text-red-200/90 mb-8">
              We focus on delivering highly scalable, deeply intelligent AI models that cater to developers, businesses, and researchers, ensuring they have the most powerful AI at their disposal. With a firm commitment to innovation, we continuously expand our AI ecosystem, pushing AI towards true cognitive evolution.
            </p>

            <h2 id="2-kiara-ai-models" className="text-2xl font-bold mt-12 mb-6 text-white scroll-mt-12">2. Kiara AI Models</h2>
            <div className="space-y-8">
              <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-6">
                <h3 id="kiara-dominator-x" className="text-xl font-semibold mb-4 text-red-300 scroll-mt-12">Kiara Dominator X+</h3>
                <p className="text-red-200/90 mb-4">
                  The Kiara Dominator X+ is the pinnacle of high-performance AI reasoning, built for deep problem-solving, complex analytical tasks, and next-generation coding assistance. It excels in:
                </p>
                <ul className="space-y-2 text-red-200/90">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span><span className="text-red-400">Extended Context Understanding</span> – Processes massive amounts of information with unparalleled comprehension.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span><span className="text-red-400">Advanced Code Generation & Debugging</span> – Develops, optimizes, and troubleshoots code with AI-powered efficiency.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span><span className="text-red-400">In-Depth Analytical Thinking</span> – Breaks down intricate problems into structured, logical steps with actionable insights.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span><span className="text-red-400">Strategic Decision-Making</span> – Helps professionals make high-impact choices with data-driven intelligence.</span>
                  </li>
                </ul>
              </div>

              <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-6">
                <h3 id="kiara-vision-x" className="text-xl font-semibold mb-4 text-red-300 scroll-mt-12">Kiara Vision X</h3>
                <p className="text-red-200/90 mb-4">
                  The Kiara Vision X is a real-time AI optimized for seamless interaction, fast responses, and cutting-edge image & video processing. It specializes in:
                </p>
                <ul className="space-y-2 text-red-200/90">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span><span className="text-red-400">Instantaneous Image Recognition</span> – Deciphers complex visual inputs, identifying objects, patterns, and scene context.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span><span className="text-red-400">Lightning-Fast Conversational AI</span> – Engages in fluid, intelligent dialogue across multiple domains.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span><span className="text-red-400">Multi-Modal Capabilities</span> – Processes and interprets text, images, and structured data simultaneously.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span><span className="text-red-400">Scalability & Adaptability</span> – Handles high-volume requests with low-latency performance, ideal for global applications.</span>
                  </li>
                </ul>
              </div>
            </div>

            <h2 id="3-future-vision" className="text-2xl font-bold mt-12 mb-6 text-white scroll-mt-12">3. Future Vision & Next-Gen AI Development</h2>
            <p className="text-red-200/90 mb-6">
              Kiara Intelligence is not stopping here. Our roadmap includes groundbreaking advancements in human-like AI interaction, blockchain-integrated intelligence, and the next evolution of AI models.
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 text-red-300">Upcoming Developments:</h3>
                <ul className="space-y-4 text-red-200/90">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <div>
                      <span className="text-red-400">Hyper-Realistic AI Entities</span> – We are developing next-gen AI companions that interact more like real humans, featuring deep emotional intelligence, advanced real-time speech generation, and contextual adaptation.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <div>
                      <span className="text-red-400">Blockchain-Powered AI Solutions</span> – We are integrating on-chain AI analytics, predictive trading insights, and decentralized intelligence, leveraging blockchain for transparent and secure AI-powered financial solutions.
                    </div>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3 text-red-300">AI-Generated Media at Scale:</h3>
                <ul className="space-y-2 text-red-200/90">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span><span className="text-red-400">Ultra-Realistic Image Generation</span> – From high-resolution, lifelike renders to AI-powered concept art.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span><span className="text-red-400">Text-to-Voice & Voice-to-Voice</span> – Cutting-edge speech synthesis and AI-driven voice cloning.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span><span className="text-red-400">Music Composition & Video Generation</span> – AI-powered music production and video creation tools for creators.</span>
                  </li>
                </ul>
              </div>
            </div>

            <h2 id="4-api-integration" className="text-2xl font-bold mt-12 mb-6 text-white scroll-mt-12">4. API & Integration (Coming Soon)</h2>
            <p className="text-red-200/90 mb-6">
              While our APIs are in active development, we are building a robust AI infrastructure designed to seamlessly integrate into business applications, trading platforms, automation tools, and interactive services.
            </p>

            <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold mb-4 text-red-300">Example API Request (JavaScript)</h3>
              <pre className="bg-[#0D0D12] p-4 rounded-lg overflow-x-auto">
                <code className="text-red-200/90">{`const response = await fetch('/api/kiara/sendMessage', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chatId: 'unique-chat-id',
    content: 'Generate a trading analysis for Solana based on market trends.'
  })
});
const data = await response.json();
console.log(data);`}</code>
              </pre>
            </div>

            <h2 id="5-usage-guidelines" className="text-2xl font-bold mt-12 mb-6 text-white scroll-mt-12">5. Usage Guidelines & Best Practices</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 text-red-300">Optimizing AI Queries</h3>
                <ul className="space-y-2 text-red-200/90">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Be Specific – Detailed queries yield the most accurate AI responses.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Leverage Context – AI delivers better insights with more background information.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Iterate for Precision – Break down complex problems into smaller queries.</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3 text-red-300">Developer Best Practices</h3>
                <ul className="space-y-2 text-red-200/90">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Optimize API Calls – Efficient API usage for reduced latency.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Secure Data Management – Handle sensitive data with best-in-class security measures.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Enhance AI Performance – Experiment with prompt engineering to achieve optimal results.</span>
                  </li>
                </ul>
              </div>
            </div>

            <h2 id="6-security" className="text-2xl font-bold mt-12 mb-6 text-white scroll-mt-12">6. Security & Compliance</h2>
            <p className="text-red-200/90 mb-6">
              We implement industry-leading encryption & data protection strategies to ensure maximum security across all AI interactions.
            </p>

            <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold mb-4 text-red-300">Key Security Measures</h3>
              <ul className="space-y-2 text-red-200/90">
                <li className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  <span><span className="text-red-400">AES-256 Encryption</span> – Full data encryption in transit and at rest.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  <span><span className="text-red-400">Multi-Layered Authentication</span> – Secure access with MFA & biometric verification.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  <span><span className="text-red-400">Regular Security Audits</span> – Continuous system monitoring for threat mitigation.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  <span><span className="text-red-400">Strict Compliance Policies</span> – Adhering to global privacy and AI ethics standards.</span>
                </li>
              </ul>
            </div>

            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-8">
              <p className="text-red-300 text-sm italic">
                Disclaimer: Kiara Intelligence is an AI-powered service provider. We make no guarantees regarding investment predictions, business decisions, or outcomes resulting from AI-generated insights. Users should always conduct independent verification.
              </p>
            </div>

            <h2 id="7-community" className="text-2xl font-bold mt-12 mb-6 text-white scroll-mt-12">7. Community & Support</h2>
            <p className="text-red-200/90 mb-6">
              Join the Kiara Intelligence ecosystem and be part of the next AI revolution!
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 text-red-300">Ways to Engage</h3>
                <ul className="space-y-2 text-red-200/90">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Developer Forums – Collaborate, troubleshoot, and innovate.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Exclusive Webinars – Learn best practices from AI experts.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Beta Access Programs – Get early access to new AI models and features.</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3 text-red-300">Contact Us</h3>
                <ul className="space-y-2 text-red-200/90">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Website: <a href="https://www.kiaraintelligence.com" className="text-red-400 hover:text-red-300">www.kiaraintelligence.com</a></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Support Email: <a href="mailto:support@kiaraintelligence.com" className="text-red-400 hover:text-red-300">support@kiaraintelligence.com</a></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Community Channels: Engage with our AI & blockchain development teams.</span>
                  </li>
                </ul>
              </div>
            </div>

            <h2 id="8-privacy" className="text-2xl font-bold mt-12 mb-6 text-white scroll-mt-12">8. Privacy Policy & Legal Notice</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 text-red-300">1. Introduction</h3>
                <p className="text-red-200/90">
                  At Kiara Intelligence, user privacy is a top priority. Our AI models are designed to protect user data and operate with strict privacy controls.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3 text-red-300">2. Data Collection & Usage</h3>
                <p className="text-red-200/90 mb-4">
                  We minimize data collection, ensuring user control over stored information.
                </p>
                <ul className="space-y-2 text-red-200/90">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Limited Data Retention: No unnecessary storage of user conversations.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>No Personal Data Exploitation: We do not sell or share user data with third parties.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Encrypted Processing: All AI interactions are encrypted for maximum security.</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3 text-red-300">3. Legal Disclaimer & Liability Protection</h3>
                <p className="text-red-200/90 mb-4">
                  Kiara Intelligence is not responsible for:
                </p>
                <ul className="space-y-2 text-red-200/90">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Financial losses due to AI-generated trading insights.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Misinformation from AI-generated responses.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Any misuse of AI-generated content.</span>
                  </li>
                </ul>
              </div>

              <p className="text-red-300 italic mt-4">
                By using our services, you agree to take full responsibility for your own decisions and interpretations of AI-generated insights.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Close button - repositioned and styled */}
      <div className="fixed top-4 right-4 z-[51] flex items-center gap-2">
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-red-900/20 text-red-400 hover:text-red-300 transition-colors"
          aria-label="Close documentation"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}