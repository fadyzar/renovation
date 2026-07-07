import { ChevronUp } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/logo.svg';
import { useAuth } from '../contexts/AuthContext';

export function Footer() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, user } = useAuth();

  const landingPath = user ? '/landing' : '/';

  function scrollToSection(id: string) {
    if (location.pathname === '/' || location.pathname === '/landing') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(`${landingPath}#${id}`);
    }
  }

  function handleFindContractors() {
    if (!user) { navigate('/login'); return; }
    navigate('/dashboard');
  }

  function handleMyProjects() {
    if (!user) { navigate('/login'); return; }
    if (profile?.role === 'contractor') {
      navigate('/projects');
    } else {
      navigate('/project-history');
    }
  }

  return (
    <footer>
      <div className="border-t border-gray-200" />

      {/* ── 1. Footer columns ── */}
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
            <p className="text-[14px] text-black mb-6">Email: mgbit@mgbit.io</p>

          </div>

          {/* Link columns */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-8">

            <div>
              <h4 className="text-[18px] font-semibold text-black mb-5">Main Pages</h4>
              <ul className="space-y-3">
                <li>
                  <button onClick={() => { if (location.pathname === '/' || location.pathname === '/landing') { window.scrollTo({ top: 0, behavior: 'smooth' }); } else { navigate(landingPath); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50); } }} className="text-[14px] text-black hover:opacity-60 transition-opacity">
                    Home
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('how-it-works')} className="text-[14px] text-black hover:opacity-60 transition-opacity">
                    How It Works
                  </button>
                </li>
                <li>
                  <button onClick={handleFindContractors} className="text-[14px] text-black hover:opacity-60 transition-opacity">
                    Find Contractors
                  </button>
                </li>
                <li>
                  <button onClick={handleMyProjects} className="text-[14px] text-black hover:opacity-60 transition-opacity">
                    My Projects
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-[18px] font-semibold text-black mb-5">Company</h4>
              <ul className="space-y-3">
                <li>
                  <button onClick={() => navigate('/about')} className="text-[14px] text-black hover:opacity-60 transition-opacity">
                    About Us
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-[18px] font-semibold text-black mb-5">Support & Resources</h4>
              <ul className="space-y-3">
                <li>
                  <button onClick={() => scrollToSection('support')} className="text-[14px] text-black hover:opacity-60 transition-opacity">
                    FAQs
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('contractors')} className="text-[14px] text-black hover:opacity-60 transition-opacity">
                    Customer Reviews
                  </button>
                </li>
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
