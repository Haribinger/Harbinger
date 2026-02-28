import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw,
  Search,
  Filter,
  Plus,
  Target,
  Globe,
  DollarSign,
  AlertCircle,
} from 'lucide-react'
import { useBountyHubStore } from '../../store/bountyHubStore'

interface BountyProgram {
  id: string
  name: string
  platform: 'HackerOne' | 'Bugcrowd' | 'Intigriti' | 'YesWeHack' | 'Federacy'
  scopeDomains: string[]
  outOfScope: string[]
  payoutMin: number
  payoutMax: number
  type: 'VDP' | 'Paid'
  status: 'active' | 'paused'
  createdAt: string
}

function BountyHub() {
  const { programs, syncStatus, filters, searchTerm, setSearchTerm, setFilters, syncTargets } = useBountyHubStore()
  const [displayedPrograms, setDisplayedPrograms] = useState<BountyProgram[]>([])
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    let filtered = programs;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    const platform = filters.platform ?? [];
    const typeFilter = filters.type ?? [];
    const minPayout = filters.minPayout ?? 0;
    const maxPayout = filters.maxPayout ?? Number.MAX_SAFE_INTEGER;

    // Apply platform filter
    if (platform.length > 0) {
      filtered = filtered.filter(p => platform.includes(p.platform));
    }

    // Apply payout filter
    filtered = filtered.filter(p => p.payoutMax >= minPayout && p.payoutMin <= maxPayout);

    // Apply type filter
    if (typeFilter.length > 0) {
      filtered = filtered.filter(p => typeFilter.includes(p.type));
    }

    setDisplayedPrograms(filtered);
  }, [programs, filters, searchTerm]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncTargets();
    } finally {
      setIsSyncing(false);
    }
  };

  const platformColors = {
    HackerOne: 'bg-red-500',
    Bugcrowd: 'bg-blue-500',
    Intigriti: 'bg-[#6d3fcf]',
    YesWeHack: 'bg-green-500',
    Federacy: 'bg-orange-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bounty Hub</h1>
          <p className="text-text-secondary">Discover and manage bug bounty targets</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Targets'}</span>
          </button>
        </div>
      </div>

      {/* Sync Status */}
      {syncStatus && (
        <div className="mb-6 p-4 bg-surface rounded-lg border border-border">
          <p className="text-sm text-text-secondary">
            Last synced: {new Date(syncStatus.lastSyncTime).toLocaleString()}
          </p>
          <p className="text-sm text-text-secondary">
            Total programs: {syncStatus.totalPrograms}
          </p>
        </div>
      )}

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder="Search programs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-light transition-colors">
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>

        {/* Platform Filter */}
        <div className="flex gap-2 flex-wrap">
          {['HackerOne', 'Bugcrowd', 'Intigriti', 'YesWeHack', 'Federacy'].map((platform) => (
            <button
              key={platform}
              onClick={() => {
                const newPlatforms = filters.platform?.includes(platform as string)
                  ? filters.platform.filter(p => p !== platform)
                  : [...(filters.platform || []), platform as string];
                setFilters({ ...filters, platform: newPlatforms });
              }}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                filters.platform?.includes(platform as string)
                  ? 'bg-[#f0c040] text-[#0a0a0f]'
                  : 'bg-surface border border-border text-text-secondary hover:bg-surface-light'
              }`}
            >
              {platform}
            </button>
          ))}
        </div>
      </div>

      {/* Programs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedPrograms.map((program, index) => (
          <motion.div
            key={program.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-surface rounded-xl border border-border p-5 hover:border-primary/50 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3 flex-1">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold ${platformColors[program.platform]}`}>
                  {program.platform.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold line-clamp-2">{program.name}</h3>
                  <span className="inline-block mt-1 px-2 py-1 text-xs bg-surface-light rounded-full text-text-secondary">
                    {program.platform}
                  </span>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${
                program.type === 'VDP' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
              }`}>
                {program.type}
              </span>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-text-secondary" />
                <span className="text-text-secondary">
                  ${program.payoutMin.toLocaleString()} - ${program.payoutMax.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-text-secondary" />
                <span className="text-text-secondary">
                  {program.scopeDomains.length} domains in scope
                </span>
              </div>

              {program.outOfScope.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 text-text-secondary" />
                  <span className="text-text-secondary">
                    {program.outOfScope.length} out of scope
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t border-border">
              <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-transparent border border-[#f0c040] text-[#f0c040] hover:bg-[#f0c040]/10 rounded-lg transition-colors text-sm">
                <Target className="w-4 h-4" />
                <span>View Scope</span>
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-surface-light hover:bg-surface border border-border rounded-lg transition-colors text-sm">
                <Plus className="w-4 h-4" />
                <span>Add to Hunt</span>
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {displayedPrograms.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <Target className="w-12 h-12 text-text-secondary mb-4" />
          <p className="text-text-secondary">No programs found matching your filters</p>
        </div>
      )}
    </motion.div>
  )
}

export default BountyHub
