import React, { useState, useMemo } from 'react';

interface CredentialEntry {
  id: string;
  username: string;
  source: string;
  strength: 'weak' | 'medium' | 'strong' | 'cracked';
  status: string;
  foundAt: string;
}

interface CredentialAuditorProps {
  credentials: CredentialEntry[];
  onRetest?: (ids: string[]) => void;
  onExport?: () => void;
}

const STRENGTH_COLORS: Record<string, string> = {
  weak: 'bg-red-500/10 text-red-400 border-red-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  strong: 'bg-green-500/10 text-green-400 border-green-500/20',
  cracked: 'bg-red-600/10 text-red-500 border-red-600/20',
};

const CredentialAuditor: React.FC<CredentialAuditorProps> = ({ credentials, onRetest, onExport }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return credentials;
    const q = search.toLowerCase();
    return credentials.filter(c =>
      c.username.toLowerCase().includes(q) ||
      c.source.toLowerCase().includes(q) ||
      c.status.toLowerCase().includes(q)
    );
  }, [credentials, search]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.id)));
    }
  };

  const strengthDistribution = useMemo(() => {
    const dist: Record<string, number> = { weak: 0, medium: 0, strong: 0, cracked: 0 };
    for (const cred of credentials) {
      if (dist[cred.strength] !== undefined) dist[cred.strength]++;
    }
    return dist;
  }, [credentials]);

  const total = credentials.length || 1;

  return (
    <div className="flex flex-col h-full bg-[#0d0d15] border border-[#1a1a2e] rounded font-mono text-white">
      {/* Header */}
      <div className="p-3 border-b border-[#1a1a2e] flex items-center justify-between">
        <h3 className="text-xs font-bold text-[#f0c040]">CREDENTIAL AUDIT</h3>
        <div className="flex items-center gap-2">
          {selected.size > 0 && onRetest && (
            <button
              onClick={() => onRetest(Array.from(selected))}
              className="text-[10px] px-2 py-0.5 rounded bg-[#f0c040]/10 text-[#f0c040] border border-[#f0c040]/20 hover:bg-[#f0c040]/20"
            >
              Re-test ({selected.size})
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className="text-[10px] px-2 py-0.5 rounded bg-[#1a1a2e] text-gray-400 border border-[#1a1a2e] hover:text-white"
            >
              Export
            </button>
          )}
        </div>
      </div>

      {/* Strength Distribution Bar */}
      <div className="px-3 py-2 border-b border-[#1a1a2e]">
        <div className="flex h-2 rounded overflow-hidden">
          {strengthDistribution.cracked > 0 && (
            <div className="bg-red-600" style={{ width: `${(strengthDistribution.cracked / total) * 100}%` }} />
          )}
          {strengthDistribution.weak > 0 && (
            <div className="bg-red-400" style={{ width: `${(strengthDistribution.weak / total) * 100}%` }} />
          )}
          {strengthDistribution.medium > 0 && (
            <div className="bg-yellow-400" style={{ width: `${(strengthDistribution.medium / total) * 100}%` }} />
          )}
          {strengthDistribution.strong > 0 && (
            <div className="bg-green-400" style={{ width: `${(strengthDistribution.strong / total) * 100}%` }} />
          )}
        </div>
        <div className="flex justify-between mt-1 text-[9px] text-gray-500">
          <span>Cracked: {strengthDistribution.cracked}</span>
          <span>Weak: {strengthDistribution.weak}</span>
          <span>Medium: {strengthDistribution.medium}</span>
          <span>Strong: {strengthDistribution.strong}</span>
        </div>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-[#1a1a2e]">
        <input
          type="text"
          placeholder="Search credentials..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#0a0a0f] border border-[#1a1a2e] rounded px-2 py-1 text-[10px] focus:outline-none focus:border-[#f0c040]/50"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-[#0d0d15]">
            <tr className="border-b border-[#1a1a2e]">
              <th className="py-1.5 px-2 text-left">
                <input
                  type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  className="accent-[#f0c040]"
                />
              </th>
              <th className="py-1.5 px-2 text-left text-gray-500 font-medium">USER</th>
              <th className="py-1.5 px-2 text-left text-gray-500 font-medium">SOURCE</th>
              <th className="py-1.5 px-2 text-left text-gray-500 font-medium">STRENGTH</th>
              <th className="py-1.5 px-2 text-left text-gray-500 font-medium">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(cred => (
              <tr
                key={cred.id}
                className="border-b border-[#1a1a2e]/50 hover:bg-[#1a1a2e]/30 transition-colors"
              >
                <td className="py-1.5 px-2">
                  <input
                    type="checkbox"
                    checked={selected.has(cred.id)}
                    onChange={() => toggleSelect(cred.id)}
                    className="accent-[#f0c040]"
                  />
                </td>
                <td className="py-1.5 px-2 text-white">{cred.username}</td>
                <td className="py-1.5 px-2 text-gray-400">{cred.source}</td>
                <td className="py-1.5 px-2">
                  <span className={`px-1.5 py-0.5 rounded border ${STRENGTH_COLORS[cred.strength] || STRENGTH_COLORS.medium}`}>
                    {cred.strength}
                  </span>
                </td>
                <td className="py-1.5 px-2 text-gray-400">{cred.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-4 text-center text-gray-600 text-[10px]">
            {credentials.length === 0 ? 'No credentials discovered yet' : 'No results match your search'}
          </div>
        )}
      </div>
    </div>
  );
};

export default CredentialAuditor;
