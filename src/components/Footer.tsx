import { useState } from 'react';
import { ChevronUp } from 'lucide-react';

export function Footer() {
  const [email, setEmail] = useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Subscribe:', email);
    setEmail('');
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-white border-t border-gray-200 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Contact Info</h3>
            <p className="text-3xl font-bold text-gray-900 mb-8">
              We are always happy<br />to assist you
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Email Address</h4>
                <div className="h-px bg-gray-300 mb-3"></div>
                <a href="mailto:office@mgbit.com" className="text-gray-700 hover:text-gray-900">
                  office@mgbit.com
                </a>
                <p className="text-sm text-gray-600 mt-2">
                  Assistance hours:<br />
                  Monday - Friday 6 am to 8 pm EST
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Number</h4>
                <div className="h-px bg-gray-300 mb-3"></div>
                <a href="tel:+11234567890" className="text-gray-700 hover:text-gray-900">
                  +1 123456789
                </a>
                <p className="text-sm text-gray-600 mt-2">
                  Assistance hours:<br />
                  Monday - Friday 6 am to 8 pm EST
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 text-white rounded-2xl p-8">
            <h3 className="text-2xl font-bold mb-2">Subscribe to our Newsletter</h3>
            <p className="text-gray-400 mb-6">
              Subscribe to our newsletter to get the latest renovation tips, industry updates, and exclusive offers.
            </p>
            <form onSubmit={handleSubscribe} className="flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
                required
              />
              <button
                type="submit"
                className="px-8 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                Subscribe
              </button>
            </form>

            <button
              onClick={scrollToTop}
              className="mt-6 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors mx-auto"
            >
              <ChevronUp className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
                <span className="text-xl font-bold text-gray-900">M.G.BiT</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">4516 Court Street, New York, NY 10012</p>
              <p className="text-sm text-gray-600 mb-1">(+123) 456 789 111</p>
              <p className="text-sm text-gray-600 mb-1">Phone: +1 123 4567 891</p>
              <p className="text-sm text-gray-600">Email: office123@gmail.com</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Main Pages</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="/" className="hover:text-gray-900">Home</a></li>
                <li><a href="/projects" className="hover:text-gray-900">New Projects</a></li>
                <li><a href="/projects" className="hover:text-gray-900">My Projects</a></li>
                <li><a href="/support" className="hover:text-gray-900">Contact & Support</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-gray-900">About Us</a></li>
                <li><a href="#" className="hover:text-gray-900">Careers</a></li>
                <li><a href="#" className="hover:text-gray-900">Blog</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Support & Resources</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="/support" className="hover:text-gray-900">Help Center</a></li>
                <li><a href="#" className="hover:text-gray-900">FAQs</a></li>
                <li><a href="#" className="hover:text-gray-900">Guides & Tutorials</a></li>
                <li><a href="#" className="hover:text-gray-900">Community Forum</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-gray-900">Terms & Conditions</a></li>
                <li><a href="#" className="hover:text-gray-900">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-gray-900">Refund Policy</a></li>
              </ul>
            </div>
          </div>

          <div className="text-center pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              © Copyright 2024 powered by{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700 font-semibold">
                United Themes
              </a>
              . All Rights Reserved and secured in{' '}
              <span className="font-semibold">M.G.BiT</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
