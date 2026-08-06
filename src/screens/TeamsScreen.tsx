import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit2, AlertTriangle, CheckCircle, Search, Layers, UserPlus, X, HelpCircle } from 'lucide-react';
import { dataService } from '../lib/dataService';
import { ProductionTeam, GarmentStyle, Worker, UserRole } from '../types';

interface TeamsScreenProps {
  role: UserRole;
  embeddedInSettings?: boolean;
}

export const TeamsScreen: React.FC<TeamsScreenProps> = ({ role, embeddedInSettings = false }) => {
  const [teams, setTeams] = useState<ProductionTeam[]>([]);
  const [styles, setStyles] = useState<GarmentStyle[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStyleFilter, setSelectedStyleFilter] = useState<string>('all');

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');
  
  // Selected Members for Form
  const [selectedMembers, setSelectedMembers] = useState<{ worker_id: string; share_percent: string }[]>([]);
  const [workerSearch, setWorkerSearch] = useState('');
  
  // Toast / Messages
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [teamsData, stylesData, workersData] = await Promise.all([
        dataService.getTeams(),
        dataService.getStyles(),
        dataService.getWorkers(),
      ]);
      setTeams(teamsData);
      setStyles(stylesData);
      setWorkers(workersData.filter(w => w.status === 'active'));
    } catch (err) {
      console.error('Failed to load teams data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingTeamId(null);
    setTeamName('');
    setSelectedStyleId('');
    setSelectedMembers([]);
    setWorkerSearch('');
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (team: ProductionTeam) => {
    setEditingTeamId(team.id);
    setTeamName(team.name);
    setSelectedStyleId(team.style_id || '');
    
    if (team.members && team.members.length > 0) {
      setSelectedMembers(
        team.members.map(m => ({
          worker_id: m.worker_id,
          share_percent: m.share_percent != null ? String(m.share_percent) : '',
        }))
      );
    } else {
      setSelectedMembers([]);
    }
    setWorkerSearch('');
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleAddWorkerToTeam = (workerId: string) => {
    if (selectedMembers.some(m => m.worker_id === workerId)) return;
    setSelectedMembers([...selectedMembers, { worker_id: workerId, share_percent: '' }]);
  };

  const handleRemoveWorkerFromTeam = (workerId: string) => {
    setSelectedMembers(selectedMembers.filter(m => m.worker_id !== workerId));
  };

  const handleShareChange = (workerId: string, value: string) => {
    setSelectedMembers(
      selectedMembers.map(m => (m.worker_id === workerId ? { ...m, share_percent: value } : m))
    );
  };

  // Calculate sum of shares if any member has a share specified
  const hasAnyShare = selectedMembers.some(m => m.share_percent.trim() !== '');
  const totalSharePercent = selectedMembers.reduce((sum, m) => {
    const val = parseFloat(m.share_percent);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const isShareValid = !hasAnyShare || Math.abs(totalSharePercent - 100) < 0.01;

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!teamName.trim()) {
      setErrorMsg('Team name is required.');
      return;
    }

    if (selectedMembers.length === 0) {
      setErrorMsg('Please select at least one worker for this team.');
      return;
    }

    if (hasAnyShare && !isShareValid) {
      setErrorMsg(`Total share percentages must equal exactly 100% (Currently ${totalSharePercent}%).`);
      return;
    }

    try {
      const membersPayload = selectedMembers.map(m => ({
        worker_id: m.worker_id,
        share_percent: m.share_percent.trim() !== '' ? parseFloat(m.share_percent) : null,
      }));

      await dataService.saveTeam(
        {
          id: editingTeamId || undefined,
          name: teamName.trim(),
          style_id: selectedStyleId || null,
        },
        membersPayload
      );

      setShowModal(false);
      setSuccessMsg(editingTeamId ? 'Team updated successfully!' : 'Team created successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadData();
    } catch (err: any) {
      console.error('Error saving team:', err);
      setErrorMsg(err.message || 'Failed to save team.');
    }
  };

  const handleDeleteTeam = async (team: ProductionTeam) => {
    if (!window.confirm(`Are you sure you want to delete team "${team.name}"?`)) return;
    try {
      await dataService.deleteTeam(team.id);
      setSuccessMsg(`Team "${team.name}" deleted.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadData();
    } catch (err: any) {
      console.error('Error deleting team:', err);
    }
  };

  const filteredTeams = teams.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.members?.some(m => m.worker_name?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStyle = selectedStyleFilter === 'all' 
      ? true 
      : selectedStyleFilter === 'general'
      ? !t.style_id
      : t.style_id === selectedStyleFilter;

    return matchesSearch && matchesStyle;
  });

  const availableWorkersToAdd = workers.filter(w => !selectedMembers.some(m => m.worker_id === w.id))
    .filter(w => 
      w.full_name.toLowerCase().includes(workerSearch.toLowerCase()) ||
      w.worker_code.toLowerCase().includes(workerSearch.toLowerCase())
    );

  return (
    <div className={`space-y-6 ${embeddedInSettings ? '' : 'max-w-6xl mx-auto pb-24'}`}>
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-stone-200 p-5 rounded-3xl shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-2xl text-indigo-700">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-stone-900 tracking-tight">Production Teams Management</h1>
              <p className="text-xs text-stone-600">Configure teams for group piece-rate allocation and shared style outputs</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center space-x-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-4 py-2.5 rounded-2xl shadow-xs transition cursor-pointer text-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Team</span>
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl text-xs font-bold flex items-center space-x-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Controls: Search & Style Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search team or worker name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-stone-900 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <label className="text-xs font-bold text-stone-600 shrink-0">Filter Style:</label>
          <select
            value={selectedStyleFilter}
            onChange={e => setSelectedStyleFilter(e.target.value)}
            className="w-full sm:w-auto bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-900 outline-none font-medium cursor-pointer"
          >
            <option value="all">All Teams</option>
            <option value="general">General (Any Style)</option>
            {styles.map(s => (
              <option key={s.id} value={s.id}>
                {s.style_code} - {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="p-12 text-center text-stone-500 font-medium text-sm">
          Loading production teams...
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-3xl p-12 text-center space-y-3">
          <Users className="w-12 h-12 text-stone-300 mx-auto" />
          <h3 className="font-bold text-stone-800 text-base">No Production Teams Found</h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            Create a team to group workers together for team-based piece rate wage distribution.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-2 inline-flex items-center space-x-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold px-4 py-2 rounded-xl text-xs transition border border-indigo-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Team</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map(t => {
            const styleObj = styles.find(s => s.id === t.style_id);
            const hasCustomShares = t.members?.some(m => m.share_percent != null);

            return (
              <div
                key={t.id}
                className="bg-white border border-stone-200 rounded-3xl p-5 shadow-xs hover:border-indigo-200 transition flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                    <div>
                      <h3 className="font-extrabold text-stone-900 text-base tracking-tight">{t.name}</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        {styleObj ? (
                          <span className="text-[10px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg flex items-center space-x-1">
                            <Layers className="w-3 h-3 text-indigo-600" />
                            <span>{styleObj.style_code}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-lg">
                            Any Style (General)
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                          {t.member_count || 0} Members
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEditModal(t)}
                        className="p-1.5 text-stone-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                        title="Edit Team"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(t)}
                        className="p-1.5 text-stone-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        title="Delete Team"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Members List */}
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-stone-400 uppercase tracking-wider px-1">
                      <span>Team Member</span>
                      <span>{hasCustomShares ? 'Share %' : 'Split'}</span>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {t.members && t.members.length > 0 ? (
                        t.members.map(m => (
                          <div
                            key={m.id || m.worker_id}
                            className="flex items-center justify-between bg-stone-50 p-2.5 rounded-xl border border-stone-150 text-xs"
                          >
                            <div className="flex items-center space-x-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 font-black text-[10px] flex items-center justify-center shrink-0">
                                {m.worker_name?.charAt(0) || 'W'}
                              </div>
                              <div className="truncate">
                                <span className="font-bold text-stone-900 block truncate">{m.worker_name}</span>
                                <span className="text-[10px] font-mono text-stone-500 block">{m.worker_code}</span>
                              </div>
                            </div>

                            <div className="shrink-0 font-mono font-bold text-stone-700 bg-white px-2 py-1 rounded-lg border border-stone-200 text-[11px]">
                              {m.share_percent != null ? `${m.share_percent}%` : 'Equal'}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-stone-400 italic py-2">No members assigned.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
                  <span>Split Method:</span>
                  <span className="font-bold text-stone-800">
                    {hasCustomShares ? 'By Share Percentage' : 'Equal Share (Piece by Piece)'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT TEAM MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-stone-200 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 animate-scale-up my-8">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-700" />
                <h3 className="font-black text-stone-900 text-base">
                  {editingTeamId ? 'Edit Production Team' : 'Create New Production Team'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:text-stone-800 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-300 text-rose-900 p-3 rounded-2xl text-xs font-bold flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveTeam} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Team Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Line 1 Collar Team"
                    value={teamName}
                    onChange={e => setTeamName(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Assigned Style (Optional)</label>
                  <select
                    value={selectedStyleId}
                    onChange={e => setSelectedStyleId(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 outline-none font-medium cursor-pointer"
                  >
                    <option value="">Any Style (General Team)</option>
                    {styles.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.style_code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Members Selection Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Team Members ({selectedMembers.length})
                  </label>
                  {hasAnyShare && (
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${
                      isShareValid 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                        : 'bg-amber-50 text-amber-900 border-amber-300'
                    }`}>
                      Total Share: {totalSharePercent}% {isShareValid ? '✓' : '⚠️ Must = 100%'}
                    </span>
                  )}
                </div>

                {hasAnyShare && !isShareValid && (
                  <div className="bg-amber-50 border border-amber-300 text-amber-900 p-2.5 rounded-xl text-xs font-medium flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Warning: Total share percentage is {totalSharePercent}%. Please adjust shares so they reach exactly 100%, or leave blank for equal split.</span>
                  </div>
                )}

                {/* Selected Members List */}
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 space-y-2 max-h-56 overflow-y-auto">
                  {selectedMembers.length === 0 ? (
                    <p className="text-xs text-stone-400 italic text-center py-4">
                      No workers added to team yet. Select workers below to add them.
                    </p>
                  ) : (
                    selectedMembers.map(m => {
                      const worker = workers.find(w => w.id === m.worker_id);
                      return (
                        <div
                          key={m.worker_id}
                          className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-stone-200 shadow-2xs gap-2"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-800 font-extrabold text-xs flex items-center justify-center shrink-0">
                              {worker?.full_name.charAt(0) || 'W'}
                            </div>
                            <div className="truncate">
                              <span className="font-bold text-stone-900 text-xs block truncate">{worker?.full_name}</span>
                              <span className="text-[10px] font-mono text-stone-500 block">{worker?.worker_code} • {worker?.line_no || 'Sewing'}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <div className="flex items-center space-x-1">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max="100"
                                placeholder="Equal"
                                value={m.share_percent}
                                onChange={e => handleShareChange(m.worker_id, e.target.value)}
                                className="w-16 bg-stone-50 border border-stone-200 text-stone-900 font-mono font-bold rounded-lg px-2 py-1 text-xs text-right outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              <span className="text-xs text-stone-400 font-bold">%</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveWorkerFromTeam(m.worker_id)}
                              className="p-1 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                              title="Remove Member"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add Worker Picker */}
                <div className="space-y-2 pt-2 border-t border-stone-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-700 flex items-center space-x-1">
                      <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Add Worker to Team</span>
                    </label>
                  </div>

                  <input
                    type="text"
                    placeholder="Search worker to add..."
                    value={workerSearch}
                    onChange={e => setWorkerSearch(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-900 outline-none font-medium"
                  />

                  <div className="max-h-36 overflow-y-auto border border-stone-200 rounded-xl divide-y divide-stone-100 bg-white">
                    {availableWorkersToAdd.length === 0 ? (
                      <p className="text-xs text-stone-400 p-3 text-center">No more workers found.</p>
                    ) : (
                      availableWorkersToAdd.slice(0, 15).map(w => (
                        <div
                          key={w.id}
                          onClick={() => handleAddWorkerToTeam(w.id)}
                          className="p-2 px-3 flex items-center justify-between hover:bg-indigo-50/60 cursor-pointer transition text-xs"
                        >
                          <div>
                            <span className="font-bold text-stone-900">{w.full_name}</span>
                            <span className="text-[10px] font-mono text-stone-500 ml-2">({w.worker_code})</span>
                          </div>
                          <button
                            type="button"
                            className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg"
                          >
                            + Add
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-xs font-bold hover:bg-stone-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer"
                >
                  {editingTeamId ? 'Update Team' : 'Save Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
