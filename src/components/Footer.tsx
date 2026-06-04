import { useState } from 'react';
import { Facebook, Twitter, Linkedin, Instagram, ChevronUp } from 'lucide-react';
import logo from '../assets/logo.svg';

export function Footer() {
  const [email, setEmail] = useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Subscribe:', email);
    setEmail('');
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer>

      {/* ── 1. Contact Info ── */}
      <div className="bg-white py-10 sm:py-16 px-4">
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row items-start gap-8 lg:gap-16">

          {/* Left: heading */}
          <div className="flex-1 min-w-0">
            <p className="text-[24px] text-brand-navy mb-4">Contact Info</p>
            <h2 className="text-[32px] sm:text-[50px] font-bold text-brand-navy leading-tight">
              We are always happy<br />to assist you
            </h2>
          </div>

          {/* Right: two cards */}
          <div className="flex flex-col sm:flex-row gap-6 shrink-0 w-full lg:w-auto">

            {/* Email card */}
            <div className="w-full sm:w-[280px] px-6 sm:px-8 py-8 sm:py-10">
              <h4 className="text-[18px] sm:text-[20px] font-semibold text-brand-navy">Email Address</h4>
              <div className="w-7 h-[3px] bg-brand-navy mt-2 mb-5" />
              <a
                href="mailto:office@mgbit.com"
                className="text-[18px] font-semibold text-brand-navy hover:underline"
              >
                office@mgbit.com
              </a>
              <p className="text-[18px] text-brand-navy mt-5 leading-relaxed">
                Assistance hours:<br />
                Monday – Friday 6 am to 8 pm EST
              </p>
            </div>

            {/* Number card */}
            <div className="w-full sm:w-[280px] px-6 sm:px-8 py-8 sm:py-10">
              <h4 className="text-[18px] sm:text-[20px] font-semibold text-brand-navy">Number</h4>
              <div className="w-7 h-[3px] bg-brand-navy mt-2 mb-5" />
              <a
                href="tel:+18558264248"
                className="text-[18px] font-semibold text-brand-navy hover:underline"
              >
                855-826-4248
              </a>
              <p className="text-[18px] text-brand-navy mt-5 leading-relaxed">
                Assistance hours:<br />
                Monday – Friday 6 am to 8 pm EST
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* ── 2. Newsletter ── */}
      <div className="bg-brand-navy py-10 sm:py-14 px-4 relative">
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row items-start lg:items-center gap-8 lg:gap-12">

          {/* Text */}
          <div className="flex-1 min-w-0">
            <h2 className="text-[28px] sm:text-[40px] font-bold text-white leading-tight">
              Subscribe to our Newsletter
            </h2>
            <p className="text-[16px] sm:text-[20px] text-[#ECECEC] mt-4 leading-relaxed">
              Subscribe to our newsletter to get the latest renovation tips,
              industry updates, and exclusive offers.
            </p>
          </div>

          {/* Input + button */}
          <div className="shrink-0 w-full lg:max-w-[560px]">
            <form
              onSubmit={handleSubscribe}
              className="flex flex-col sm:flex-row bg-white rounded-[20px] overflow-hidden sm:h-[84px] w-full"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="flex-1 px-6 sm:px-8 py-4 sm:py-0 text-base sm:text-[18px] text-brand-navy placeholder-[#909090] focus:outline-none bg-transparent"
              />
              <div className="p-2">
                <button
                  type="submit"
                  className="w-full sm:w-auto h-12 sm:h-full px-8 bg-brand-navy text-white text-[15px] sm:text-[16px] font-bold rounded-[14px] hover:opacity-90 transition-opacity"
                >
                  Subscribe
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Back to top */}
        <div className="flex justify-center mt-10">
          <button
            onClick={scrollToTop}
            aria-label="Back to top"
            className="w-[70px] h-[70px] rounded-full bg-white border border-[#F4F4F4] flex items-center justify-center hover:shadow-md transition-shadow"
          >
            <ChevronUp className="w-6 h-6 text-brand-navy" />
          </button>
        </div>
      </div>

      {/* ── 3. Footer columns ── */}
      <div className="bg-white py-12 px-4">
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-12 lg:gap-16">

          {/* Logo + address + social */}
          <div className="w-full lg:w-[310px] shrink-0">
            <img src={logo} alt="M.G.BIT" className="h-9 w-auto mb-6" />
            <p className="text-[14px] text-black leading-relaxed mb-3">
              MGBiT<br />
              21550 Oxnard St, Suite 300<br />
              Woodland Hills, CA 91367
            </p>
            <p className="text-[14px] text-black mb-1">Phone: 855-826-4248</p>
            <p className="text-[14px] text-black mb-6">Email: office@mgbit.com</p>

            {/* Social icons */}
            <div className="flex items-center gap-4">
              {[
                { Icon: Facebook, href: '#' },
                { Icon: Twitter, href: '#' },
                { Icon: Instagram, href: '#' },
                { Icon: Linkedin, href: '#' },
              ].map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  className="w-6 h-6 flex items-center justify-center text-black hover:opacity-60 transition-opacity"
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-8">

            <div>
              <h4 className="text-[18px] font-semibold text-black mb-5">Main Pages</h4>
              <ul className="space-y-3">
                {['Home', 'How It Works', 'Find Contractors', 'My Projects', 'Contact & Support'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-[14px] text-black hover:opacity-60 transition-opacity">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[18px] font-semibold text-black mb-5">Company</h4>
              <ul className="space-y-3">
                {['About Us', 'Careers', 'Blog'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-[14px] text-black hover:opacity-60 transition-opacity">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[18px] font-semibold text-black mb-5">Support & Resources</h4>
              <ul className="space-y-3">
                {['Help Center', 'FAQs', 'Guides & Tutorials', 'Customer Reviews'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-[14px] text-black hover:opacity-60 transition-opacity">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[18px] font-semibold text-black mb-5">Legal</h4>
              <ul className="space-y-3">
                {['Terms & Conditions', 'Privacy Policy', 'Refund Policy'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-[14px] text-black hover:opacity-60 transition-opacity">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </div>

      {/* ── 4. Copyright bar ── */}
      <div className="bg-[#F7F7F7] py-8 px-4">
        <p className="text-center text-[14px] text-black">
          © Developed by <span className="font-semibold">NFD - Next Flow Digital</span>. All Rights Reserved to M.G.BiT
        </p>
      </div>

    </footer>
  );
}
