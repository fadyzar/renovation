import { useState } from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { WORK_CATEGORIES } from '../../lib/workTypes';

interface Props {
  selected: string[];
  onChange: (updated: string[]) => void;
  singleSelect?: boolean;
}

export function WorkTypePicker({ selected, onChange, singleSelect = false }: Props) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  function toggleSub(id: string) {
    if (singleSelect) {
      onChange([id]);
      return;
    }
    const next = selected.includes(id)
      ? selected.filter(s => s !== id)
      : [...selected, id];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {WORK_CATEGORIES.map(cat => {
        const selectedInCat = cat.subs.filter(s => selected.includes(s.id)).length;
        const isOpen = openCategory === cat.id;

        return (
          <div key={cat.id} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Category header */}
            <button
              type="button"
              onClick={() => setOpenCategory(isOpen ? null : cat.id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{cat.icon}</span>
                <span className="text-sm font-semibold text-gray-900">{cat.label}</span>
                {selectedInCat > 0 && (
                  <span className="text-xs bg-orange-500 text-white font-bold px-2 py-0.5 rounded-full">
                    {selectedInCat}
                  </span>
                )}
              </div>
              {isOpen
                ? <ChevronDown className="w-4 h-4 text-gray-400" />
                : <ChevronRight className="w-4 h-4 text-gray-400" />
              }
            </button>

            {/* Sub-specialties */}
            {isOpen && (
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-white">
                {cat.subs.map(sub => {
                  const active = selected.includes(sub.id);
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => toggleSub(sub.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                        active
                          ? 'bg-orange-50 border border-orange-300 text-orange-800 font-medium'
                          : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                        active ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
                      }`}>
                        {active && <Check className="w-3 h-3 text-white" />}
                      </div>
                      {sub.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
