import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search,
  Shield,
  Target,
  FileText,
  Code,
  Clock,
  Globe,
  Bell,
  X,
} from 'lucide-react';
import {
  WORKFLOW_TEMPLATES,
  type WorkflowTemplateIconKey,
  type WorkflowTemplateData,
  type WorkflowTemplateDifficulty,
} from '../../core/workflows/templates';

// -- Icon map mirrors the one in Workflows.tsx to stay consistent across the codebase --
const TEMPLATE_ICONS: Record<WorkflowTemplateIconKey, typeof Search> = {
  search: Search,
  shield: Shield,
  target: Target,
  filetext: FileText,
  code: Code,
  clock: Clock,
  globe: Globe,
  bell: Bell,
};

// -- Filter categories derived from actual template data, with "All" prepended --
const FILTER_CATEGORIES = ['All', 'Recon', 'Security', 'Monitoring', 'Automation'] as const;
type FilterCategory = (typeof FILTER_CATEGORIES)[number];

// Maps template.category values to the marketplace filter chips.
// Templates whose category doesn't match any specific chip fall under "Automation" as a catch-all.
function matchesCategory(template: WorkflowTemplateData, filter: FilterCategory): boolean {
  if (filter === 'All') return true;

  const cat = (template.category ?? '').toLowerCase();

  switch (filter) {
    case 'Recon':
      return cat === 'recon';
    case 'Security':
      return cat === 'offensive' || cat === 'defensive' || cat === 'bounty';
    case 'Monitoring':
      return cat === 'monitoring' || (template.tags ?? []).some(t =>
        ['cron', 'webhook', 'scheduled', 'notification'].includes(t)
      );
    case 'Automation':
      return cat === 'reporting' || cat === 'automation';
    default:
      return false;
  }
}

const DIFFICULTY_STYLES: Record<WorkflowTemplateDifficulty, { bg: string; text: string; border: string }> = {
  beginner: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  intermediate: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  advanced: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
};

interface TemplateMarketplaceProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: (typeof WORKFLOW_TEMPLATES)[number]) => void;
}

const TemplateMarketplace: React.FC<TemplateMarketplaceProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('All');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setActiveCategory('All');
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return WORKFLOW_TEMPLATES.filter((tpl) => {
      // Category filter
      if (!matchesCategory(tpl, activeCategory)) return false;

      // Text search across name, description, and tags
      if (query) {
        const haystack = [
          tpl.name,
          tpl.description,
          ...(tpl.tags ?? []),
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(query);
      }

      return true;
    });
  }, [searchQuery, activeCategory]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only close when clicking the backdrop itself, not its children
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
      style={{ backdropFilter: 'blur(6px)', backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
    >
      <div className="w-full max-w-4xl max-h-[85vh] bg-[#0d0d15] border border-[#1a1a2e] rounded-lg shadow-2xl flex flex-col font-mono overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a2e]">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#f0c040]" />
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
              Template Marketplace
            </h2>
            <span className="text-[10px] text-gray-500">
              {WORKFLOW_TEMPLATES.length} templates
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[#1a1a2e] transition-colors text-gray-500 hover:text-white"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search + Filters */}
        <div className="px-6 py-3 border-b border-[#1a1a2e] space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search templates by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-[#0a0a0f] border border-[#1a1a2e] rounded px-3 py-2 pl-9 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#f0c040]/50 transition-colors"
            />
          </div>

          {/* Category chips */}
          <div className="flex items-center gap-2">
            {FILTER_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded text-[11px] border transition-colors ${
                  activeCategory === cat
                    ? 'bg-[#f0c040]/10 text-[#f0c040] border-[#f0c040]/30'
                    : 'bg-[#0a0a0f] text-gray-500 border-[#1a1a2e] hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600">
              <Search className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-xs">No templates match your search.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('All');
                }}
                className="mt-2 text-[11px] text-[#f0c040]/70 hover:text-[#f0c040] transition-colors"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((tpl) => {
                const IconComponent = TEMPLATE_ICONS[tpl.iconKey];
                const difficulty = tpl.difficulty ?? 'intermediate';
                const diffStyle = DIFFICULTY_STYLES[difficulty];
                const isBeginner = difficulty === 'beginner';

                return (
                  <div
                    key={tpl.id}
                    className={`group relative flex flex-col bg-[#0a0a0f] rounded-lg border transition-all hover:border-[#f0c040]/40 hover:shadow-lg hover:shadow-[#f0c040]/5 ${
                      isBeginner
                        ? 'border-green-500/20'
                        : 'border-[#1a1a2e]'
                    }`}
                  >
                    <div className="p-4 flex-1 flex flex-col">
                      {/* Icon + Title row */}
                      <div className="flex items-start gap-3 mb-2">
                        <div className="flex-shrink-0 w-8 h-8 rounded-md bg-[#1a1a2e] flex items-center justify-center group-hover:bg-[#f0c040]/10 transition-colors">
                          <IconComponent className="w-4 h-4 text-[#f0c040]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs font-bold text-white truncate">
                            {tpl.name}
                          </h3>
                          {tpl.author && (
                            <span className="text-[10px] text-gray-600">
                              by {tpl.author}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-gray-500 leading-relaxed mb-3 line-clamp-2 flex-1">
                        {tpl.description}
                      </p>

                      {/* Metadata row: node/edge count + difficulty badge */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 text-[10px] text-gray-600">
                          <span>{tpl.nodes.length} nodes</span>
                          <span className="text-gray-700">&middot;</span>
                          <span>{tpl.edges.length} edges</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border ${diffStyle.bg} ${diffStyle.text} ${diffStyle.border}`}
                        >
                          {difficulty}
                        </span>
                      </div>

                      {/* Tags */}
                      {tpl.tags && tpl.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {tpl.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 rounded text-[9px] bg-[#1a1a2e] text-gray-500 border border-[#1a1a2e]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Use Template button */}
                      <button
                        onClick={() => onSelectTemplate(tpl)}
                        className="w-full py-1.5 rounded text-[11px] font-medium bg-[#f0c040]/10 text-[#f0c040] border border-[#f0c040]/20 hover:bg-[#f0c040]/20 hover:border-[#f0c040]/40 transition-colors"
                      >
                        Use Template
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#1a1a2e] flex items-center justify-between">
          <span className="text-[10px] text-gray-600">
            {filteredTemplates.length} of {WORKFLOW_TEMPLATES.length} templates shown
          </span>
          <span className="text-[10px] text-gray-700">
            ESC to close
          </span>
        </div>
      </div>
    </div>
  );
};

export default TemplateMarketplace;
