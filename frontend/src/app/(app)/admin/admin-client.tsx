"use client";

import { useState, useEffect } from "react";
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";
import { Users, FolderGit2, Zap, MessageSquare, TrendingUp, Activity } from "lucide-react";

function StatCard({ title, value, icon: Icon, trend }: any) {
  return (
    <div className="bg-paper border border-cloud rounded-xl p-6 shadow-sm flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-ash">{title}</p>
          <h3 className="text-3xl font-bold text-obsidian mt-2">{value}</h3>
        </div>
        <div className="p-3 bg-paper-sunken rounded-lg text-obsidian">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-sm font-medium text-emerald-600">
          <TrendingUp className="w-4 h-4 mr-1" />
          {trend}
        </div>
      )}
    </div>
  );
}

export function AdminDashboardClient({ 
  overview, signupsTimeseries, featureAdoption, mostViewedReports, healthScoreDist, recentActivity 
}: any) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return (
    <div className="space-y-8">
      {/* 1. Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <StatCard 
          title="Total Users" 
          value={overview.total_users} 
          icon={Users} 
          trend={`+${overview.signups_last_7_days} this week`} 
        />
        <StatCard 
          title="Total Projects" 
          value={overview.total_projects} 
          icon={FolderGit2} 
          trend={`${overview.active_projects_last_7_days} active this week`}
        />
        <StatCard 
          title="Analyses Run" 
          value={overview.total_analyses} 
          icon={Zap} 
        />
        <StatCard 
          title="Chat Messages" 
          value={overview.total_chat_messages} 
          icon={MessageSquare} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 2. Signups Over Time */}
        <div className="bg-paper border border-cloud rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-obsidian mb-6 font-display">Signups (Last 30 Days)</h3>
          <div className="h-72 w-full">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={signupsTimeseries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(val) => val.split('-').slice(1).join('/')} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="signups" stroke="#111827" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full bg-paper-sunken animate-pulse rounded-lg" />
            )}
          </div>
        </div>

        {/* 3. Feature Adoption */}
        <div className="bg-paper border border-cloud rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-obsidian mb-6 font-display">Feature Adoption (%)</h3>
          <div className="space-y-6">
            {[
              { label: 'Webhooks Enabled', value: featureAdoption.webhook_adoption_pct },
              { label: 'Used Chat', value: featureAdoption.chat_adoption_pct },
              { label: 'Shared a Report', value: featureAdoption.share_adoption_pct },
              { label: 'Exported PDF', value: featureAdoption.export_adoption_pct },
            ].map((feature, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-obsidian">{feature.label}</span>
                  <span className="text-ash font-mono">{feature.value}%</span>
                </div>
                <div className="w-full bg-paper-sunken rounded-full h-2">
                  <div className="bg-obsidian h-2 rounded-full" style={{ width: `${feature.value}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Most Viewed Reports */}
        <div className="bg-paper border border-cloud rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-obsidian mb-6 font-display">Most Viewed Report Types</h3>
          <div className="h-72 w-full">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={mostViewedReports} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="report_type" type="category" tick={{ fill: '#374151', fontSize: 12 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="views" fill="#111827" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full bg-paper-sunken animate-pulse rounded-lg" />
            )}
          </div>
        </div>

        {/* 5. Health Score Distribution */}
        <div className="bg-paper border border-cloud rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-obsidian mb-6 font-display">Health Score Distribution</h3>
          <div className="h-72 w-full">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={healthScoreDist}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="bucket" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" fill="#4B5563" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full bg-paper-sunken animate-pulse rounded-lg" />
            )}
          </div>
        </div>
      </div>

      {/* 6. Recent Activity Feed */}
      <div className="bg-paper border border-cloud rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5 text-obsidian" />
          <h3 className="text-lg font-bold text-obsidian font-display">Recent Activity</h3>
        </div>
        
        {recentActivity.length === 0 ? (
          <p className="text-ash text-sm">No recent activity.</p>
        ) : (
          <div className="space-y-4">
            {recentActivity.map((event: any) => (
              <div key={event.id} className="flex items-start gap-4 p-3 hover:bg-paper-sunken rounded-lg transition-colors">
                <div className="w-2 h-2 mt-2 rounded-full bg-obsidian flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-obsidian">{event.summary}</p>
                  <p className="text-xs text-ash mt-1">
                    {mounted ? new Date(event.created_at).toLocaleString() : ""} • <span className="font-mono">{event.event_type}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
