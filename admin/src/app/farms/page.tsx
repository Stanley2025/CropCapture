'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Search,
  Filter,
  Eye,
  Layers,
  Sprout,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Droplets,
  Download,
  Plus,
  X,
  PawPrint,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getFarms, getFarmers, createFarm } from '@/lib/api';
import { Farm, Farmer } from '@/types/database';
import {
  getCounties,
  getDistrictsByCounty,
  County,
  District,
} from '@/lib/liberiaGeographicData';

export default function FarmsPage() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [search, setSearch] = useState('');
  const [countyFilter, setCountyFilter] = useState('All');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [irrigationFilter, setIrrigationFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  // Register Farm Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formFarmerId, setFormFarmerId] = useState('');
  const [formFarmingType, setFormFarmingType] = useState<'crops' | 'livestock' | 'both'>('crops');
  const [formCounty, setFormCounty] = useState('');
  const [formDistrict, setFormDistrict] = useState('');
  const [formCommunity, setFormCommunity] = useState('');
  const [formSize, setFormSize] = useState('');
  const [formSizeUnit, setFormSizeUnit] = useState<'acres' | 'hectares'>('acres');
  const [formOwnershipType, setFormOwnershipType] = useState('Family Customary Land');
  const [formIrrigation, setFormIrrigation] = useState(false);
  const [formSoilType, setFormSoilType] = useState('Clay Loam (Swamp Basin)');
  const [formDescription, setFormDescription] = useState('');

  // Form Inline Errors
  const [countyError, setCountyError] = useState<string | null>(null);
  const [districtError, setDistrictError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const countiesList = getCounties();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [farmsData, farmersData] = await Promise.all([getFarms(), getFarmers()]);
        setFarms(farmsData);
        setFarmers(farmersData);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Handle County Filter Change -> Clear District Filter
  const handleCountyFilterChange = (val: string) => {
    setCountyFilter(val);
    setDistrictFilter('All');
  };

  // Handle Form County Change -> Clear District Selection
  const handleFormCountyChange = (val: string) => {
    setFormCounty(val);
    setFormDistrict(''); // Clear district as required
    setCountyError(null);
    setDistrictError(null);
  };

  const handleFormDistrictChange = (val: string) => {
    setFormDistrict(val);
    setDistrictError(null);
  };

  const availableDistrictsForFilter =
    countyFilter !== 'All' ? getDistrictsByCounty(countyFilter) : [];

  const availableDistrictsForForm =
    formCounty ? getDistrictsByCounty(formCounty) : [];

  const filteredFarms = farms.filter((farm) => {
    const matchesSearch =
      farm.name.toLowerCase().includes(search.toLowerCase()) ||
      farm.community.toLowerCase().includes(search.toLowerCase()) ||
      (farm.farmer && farm.farmer.full_name.toLowerCase().includes(search.toLowerCase()));
    const matchesCounty =
      countyFilter === 'All' || farm.county.toLowerCase() === countyFilter.toLowerCase();
    const matchesDistrict =
      districtFilter === 'All' || farm.district.toLowerCase() === districtFilter.toLowerCase();
    const matchesIrrigation =
      irrigationFilter === 'All' ||
      (irrigationFilter === 'Yes' && farm.irrigation) ||
      (irrigationFilter === 'No' && !farm.irrigation);
    return matchesSearch && matchesCounty && matchesDistrict && matchesIrrigation;
  });

  const handleRegisterFarmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCountyError(null);
    setDistrictError(null);
    setGeneralError(null);

    if (!formName.trim()) {
      setGeneralError('Please enter a farm parcel name.');
      return;
    }
    if (!formFarmerId) {
      setGeneralError('Please select an associated farmer.');
      return;
    }
    if (!formCounty) {
      setCountyError('Select a county');
      return;
    }
    if (!formDistrict) {
      setDistrictError('Select a district');
      return;
    }
    if (!formCommunity.trim()) {
      setGeneralError('Please enter the community or town name.');
      return;
    }
    if (!formSize || isNaN(Number(formSize)) || Number(formSize) <= 0) {
      setGeneralError('Please enter a valid numeric farm size.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedCountyObj = countiesList.find(
        (c) => c.name.toLowerCase() === formCounty.toLowerCase()
      );
      const selectedDistrictObj = availableDistrictsForForm.find(
        (d) => d.name.toLowerCase() === formDistrict.toLowerCase()
      );

      const newFarmPayload: Partial<Farm> = {
        name: formName.trim(),
        farmer_id: formFarmerId,
        farming_type: formFarmingType,
        county: selectedCountyObj?.name || formCounty,
        district: selectedDistrictObj?.name || formDistrict,
        county_id: selectedCountyObj?.id || null,
        district_id: selectedDistrictObj?.id || null,
        community: formCommunity.trim(),
        size: parseFloat(formSize),
        size_unit: formSizeUnit,
        ownership_type: formOwnershipType,
        irrigation: formIrrigation,
        soil_type: formSoilType,
        description: formDescription.trim() || undefined,
        is_active: true,
      };

      const created = await createFarm(newFarmPayload);
      if (created) {
        // Find associated farmer object to attach for table rendering
        const assocFarmer = farmers.find((f) => f.id === formFarmerId);
        const fullFarm: Farm = {
          ...created,
          farmer: assocFarmer,
        };
        setFarms((prev) => [fullFarm, ...prev]);
        setFeedback({
          type: 'success',
          message: `Farm parcel "${created.name}" successfully registered in ${created.county} County.`,
        });
        setShowRegisterModal(false);
        // Reset form
        setFormName('');
        setFormFarmerId('');
        setFormCounty('');
        setFormDistrict('');
        setFormCommunity('');
        setFormSize('');
        setFormDescription('');
      } else {
        setGeneralError('Failed to create farm in cloud database. Please verify inputs and try again.');
      }
    } catch (err: any) {
      setGeneralError(err?.message || 'Error occurred while saving farm.');
    } finally {
      setSubmitting(false);
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Farm Parcel Management & Cartography
            </h1>
            <p className="text-sm text-slate-500">
              Verified agricultural parcels, customary land tenure, and GPS geographic coordinates.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/maps"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Navigation className="h-3.5 w-3.5 text-[#15803D]" />
              Open Geographic Map View
            </Link>

            <button
              onClick={() => {
                setShowRegisterModal(true);
                setGeneralError(null);
                setCountyError(null);
                setDistrictError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#15803D] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#14532D] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Register Farm
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`flex items-center justify-between rounded-xl border p-4 text-xs font-semibold ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search farm name, farmer owner, community..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-slate-50 py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#15803D] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* County Filter (15 Counties, A-Z) */}
            <select
              value={countyFilter}
              onChange={(e) => handleCountyFilterChange(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#15803D] focus:outline-none"
            >
              <option value="All">All Counties (15)</option>
              {countiesList.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Dependent District Filter */}
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              disabled={countyFilter === 'All'}
              className={`rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium focus:border-[#15803D] focus:outline-none ${
                countyFilter === 'All'
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-50 text-slate-700'
              }`}
            >
              <option value="All">
                {countyFilter === 'All' ? 'Select county first' : 'All Districts'}
              </option>
              {availableDistrictsForFilter.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={irrigationFilter}
              onChange={(e) => setIrrigationFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#15803D] focus:outline-none"
            >
              <option value="All">Irrigation: All</option>
              <option value="Yes">Irrigated</option>
              <option value="No">Rainfed</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E2E8F0] bg-slate-50 font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3.5 px-4">Farm Parcel</th>
                  <th className="py-3.5 px-4">Associated Farmer</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Size</th>
                  <th className="py-3.5 px-4">GPS Coordinates</th>
                  <th className="py-3.5 px-4">System</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Loading parcels...
                    </td>
                  </tr>
                ) : filteredFarms.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No farm parcels match filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredFarms.map((farm) => (
                    <tr key={farm.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{farm.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-slate-400">{farm.soil_type || 'Loam'}</span>
                          {farm.farming_type && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                              {farm.farming_type === 'both'
                                ? 'Crops & Livestock'
                                : farm.farming_type === 'livestock'
                                ? 'Livestock'
                                : 'Crops'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{farm.farmer?.full_name || 'Unassigned'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{farm.farmer?.farmer_id_code}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800">{farm.community}, {farm.district}</div>
                        <div className="text-[11px] text-slate-400">{farm.county} County</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[#14532D] bg-[#DCFCE7] px-2 py-0.5 rounded text-[11px]">
                          {farm.size} {farm.size_unit || 'acres'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {farm.latitude && farm.longitude ? (
                          <div className="font-mono text-[11px] text-slate-600">
                            {farm.latitude.toFixed(4)}°N, {Math.abs(farm.longitude).toFixed(4)}°W
                          </div>
                        ) : (
                          <span className="text-slate-400">No GPS lock</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {farm.irrigation ? (
                          <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium text-[11px]">
                            <Droplets className="h-3 w-3" />
                            Irrigated
                          </span>
                        ) : (
                          <span className="text-slate-500">Rainfed</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/farms/${farm.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-semibold text-[#15803D] hover:bg-[#DCFCE7] transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Register Farm Modal with Dependent County to District Selector */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Register Farm Parcel</h2>
                <p className="text-xs text-slate-500">
                  Record new verified parcel boundary, farmer owner, county, and district.
                </p>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {generalError && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{generalError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterFarmSubmit} className="mt-4 space-y-4">
              {/* Parcel Name & Farmer */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Farm Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gbehley Swamp Plot 1"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#15803D] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Associated Farmer *
                  </label>
                  <select
                    required
                    value={formFarmerId}
                    onChange={(e) => setFormFarmerId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#15803D] focus:outline-none"
                  >
                    <option value="">Select Farmer</option>
                    {farmers.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.full_name} ({f.farmer_id_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Farm Category */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Farm Enterprise / Category *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormFarmingType('crops')}
                    className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-bold transition ${
                      formFarmingType === 'crops'
                        ? 'border-[#15803D] bg-emerald-50 text-[#15803D]'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Sprout className="h-4 w-4" />
                    Crops
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormFarmingType('livestock')}
                    className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-bold transition ${
                      formFarmingType === 'livestock'
                        ? 'border-amber-600 bg-amber-50 text-amber-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <PawPrint className="h-4 w-4" />
                    Livestock
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormFarmingType('both')}
                    className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-bold transition ${
                      formFarmingType === 'both'
                        ? 'border-teal-700 bg-teal-50 text-teal-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Layers className="h-4 w-4" />
                    Both
                  </button>
                </div>
              </div>

              {/* Dependent County and District Selectors */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    County *
                  </label>
                  <select
                    value={formCounty}
                    onChange={(e) => handleFormCountyChange(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#15803D] focus:outline-none ${
                      countyError ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
                    }`}
                  >
                    <option value="">Select a county</option>
                    {countiesList.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {countyError && (
                    <p className="mt-1 text-[11px] font-semibold text-rose-600">{countyError}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    District *
                  </label>
                  <select
                    value={formDistrict}
                    onChange={(e) => handleFormDistrictChange(e.target.value)}
                    disabled={!formCounty}
                    className={`w-full rounded-lg border px-3 py-2 text-xs font-medium focus:border-[#15803D] focus:outline-none ${
                      !formCounty
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : districtError
                        ? 'border-rose-400 bg-rose-50/50 text-slate-800'
                        : 'border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="">
                      {!formCounty ? 'Select a county first' : 'Select a district'}
                    </option>
                    {availableDistrictsForForm.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  {districtError && (
                    <p className="mt-1 text-[11px] font-semibold text-rose-600">{districtError}</p>
                  )}
                </div>
              </div>

              {/* Community and Farm Size */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Community / Town *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gbehley"
                    value={formCommunity}
                    onChange={(e) => setFormCommunity(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#15803D] focus:outline-none"
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Farm Size *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      placeholder="e.g. 5.5"
                      value={formSize}
                      onChange={(e) => setFormSize(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#15803D] focus:outline-none"
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Unit
                    </label>
                    <select
                      value={formSizeUnit}
                      onChange={(e) => setFormSizeUnit(e.target.value as any)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-800 focus:border-[#15803D] focus:outline-none"
                    >
                      <option value="acres">Acres</option>
                      <option value="hectares">Ha</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tenure and Soil */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Land Tenure
                  </label>
                  <select
                    value={formOwnershipType}
                    onChange={(e) => setFormOwnershipType(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#15803D] focus:outline-none"
                  >
                    <option value="Family Customary Land">Family Customary Land</option>
                    <option value="Freehold / Titled Deed">Freehold / Titled Deed</option>
                    <option value="Leasehold Agreement">Leasehold Agreement</option>
                    <option value="Community Communal Land">Community Communal Land</option>
                    <option value="Sharecropping / Tenant">Sharecropping / Tenant</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Predominant Soil Type
                  </label>
                  <select
                    value={formSoilType}
                    onChange={(e) => setFormSoilType(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#15803D] focus:outline-none"
                  >
                    <option value="Clay Loam (Swamp Basin)">Clay Loam (Swamp Basin)</option>
                    <option value="Sandy Clay Loam">Sandy Clay Loam</option>
                    <option value="Alluvial Deposit">Alluvial Deposit</option>
                    <option value="Red Lateritic Soil">Red Lateritic Soil</option>
                    <option value="Sandy Loam">Sandy Loam</option>
                    <option value="Gravelly Loam">Gravelly Loam</option>
                    <option value="Peat / Organic Muck">Peat / Organic Muck</option>
                  </select>
                </div>
              </div>

              {/* Irrigation Toggle */}
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  type="checkbox"
                  id="admin_farm_irrigation"
                  checked={formIrrigation}
                  onChange={(e) => setFormIrrigation(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#15803D] focus:ring-[#15803D]"
                />
                <label htmlFor="admin_farm_irrigation" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Irrigation system available (bunds, canals or pump channel)
                </label>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Description / Topography (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes on access road, topography, slope, or water sources..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#15803D] focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#15803D] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#14532D] disabled:opacity-50"
                >
                  {submitting ? 'Registering Parcel...' : 'Register Farm Parcel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
