import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { redirectToPayment } from '../lib/stripe';

interface PricingProps {
  onClose: () => void;
}

function Pricing({ onClose }: PricingProps) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-7xl max-h-[90vh] overflow-y-auto bg-[#0a0505] rounded-lg shadow-lg border border-red-500/20">
        {/* Error Message */}
        {error && (
          <div className="fixed top-4 right-4 left-4 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg">
            {error}
            <button 
              onClick={() => setError(null)}
              className="absolute top-3 right-3 hover:text-red-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-red-500/10 transition-all duration-300"
          aria-label="Close"
        >
          <X className="w-6 h-6 text-gray-400 hover:text-white" />
        </button>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold mb-4 title-gradient">Kiara Intelligence Plans & Pricing</h1>
            <p className="text-xl text-red-400/80">Choose the plan that best fits your needs</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <div className="bg-[#0D0D12] rounded-2xl p-8 border border-red-900/20 hover:border-red-500/50 transition-all duration-300 flex flex-col">
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-4 text-white">Kiara Starter</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">$0</span>
                  <span className="text-red-400">/month</span>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-red-500 mt-0.5" />
                    <span className="text-red-200">Up to 40 tokens per day</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-red-500 mt-0.5" />
                    <span className="text-red-200">Standard response time</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-red-500 mt-0.5" />
                    <span className="text-red-200">Limited access to new features</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <button 
                  onClick={onClose}
                  className="w-full py-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 transition-colors text-white"
                >
                  Get Started for Free
                </button>
              </div>
            </div>

            {/* Plus Plan */}
            <div className="bg-[#0D0D12] rounded-2xl p-8 border-2 border-red-500 relative flex flex-col">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-1 rounded-full text-sm">
                Most Popular
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-4 text-white">Kiara Plus</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">$19.99</span>
                  <span className="text-red-400">/month</span>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-red-500 mt-0.5" />
                    <span className="text-red-200">Up to 1500 tokens per month</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-red-500 mt-0.5" />
                    <span className="text-red-200">Faster response time with priority</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-red-500 mt-0.5" />
                    <span className="text-red-200">Custom AI profiles & voice support</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-red-500 mt-0.5" />
                    <span className="text-red-200">Advanced chat tools & analytics</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <button 
                  onClick={() => redirectToPayment('plus')}
                  className="w-full py-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 transition-colors text-white"
                >
                  Subscribe Now
                </button>
              </div>
            </div>

            {/* Infinity Plan */}
            <div className="bg-[#0D0D12] rounded-2xl p-8 border border-red-900/20 hover:border-red-500/50 transition-all duration-300 flex flex-col">
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-4 text-white">Kiara Infinity</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">$49.99</span>
                  <span className="text-red-400">/month</span>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-red-500 mt-0.5" />
                    <span className="text-red-200">All features from Plus</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-red-500 mt-0.5" />
                    <span className="text-red-200">Up to 4300 tokens per month</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-red-500 mt-0.5" />
                    <span className="text-red-200">Real-time priority response access</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-red-500 mt-0.5" />
                    <span className="text-red-200">Advanced usage analytics and reports</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-red-500 mt-0.5" />
                    <span className="text-red-200">Business-level tools and integrations</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-red-500 mt-0.5" />
                    <span className="text-red-200">Priority 24/7 customer support</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-red-500 mt-0.5" />
                    <span className="text-red-200">Full access to all upcoming features</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <button 
                  onClick={() => redirectToPayment('infinity')}
                  className="w-full py-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 transition-colors text-white"
                >
                  Subscribe Now
                </button>
              </div>
            </div>
          </div>

          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold mb-8 text-white">Frequently Asked Questions</h2>
            <div className="max-w-3xl mx-auto grid gap-6">
              <div className="bg-[#0D0D12] rounded-lg p-6 border border-red-900/20">
                <h3 className="text-lg font-semibold mb-2 text-white">What's included in each plan?</h3>
                <p className="text-red-200/80">Each plan offers different levels of access to Kiara's capabilities. Choose based on your usage needs and desired features.</p>
              </div>
              <div className="bg-[#0D0D12] rounded-lg p-6 border border-red-900/20">
                <h3 className="text-lg font-semibold mb-2 text-white">Can I upgrade or downgrade my plan?</h3>
                <p className="text-red-200/80">Yes, you can change your plan at any time. Changes will be reflected in your next billing cycle.</p>
              </div>
              <div className="bg-[#0D0D12] rounded-lg p-6 border border-red-900/20">
                <h3 className="text-lg font-semibold mb-2 text-white">What payment methods do you accept?</h3>
                <p className="text-red-200/80">We accept all major credit cards and debit cards through our secure payment processor, Stripe.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Pricing;