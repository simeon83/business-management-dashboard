import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useBusiness } from '@/hooks/useBusiness';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Menu, X, LogOut, Plus, Edit2, Trash2, Building2, ChevronDown } from 'lucide-react';
import { GoogleSheetsSync } from '@/components/GoogleSheetsSync';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const { businesses, currentBusiness, currentRole, loading, switchBusiness, canAccess } = useBusiness();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState({ customers: [], products: [], sales: [], expenses: [], logs: [] });
  const [stats, setStats] = useState({ revenue: 0, expenses: 0, customers: 0, products: 0 });

  useEffect(() => {
    if (currentBusiness) loadData();
  }, [currentBusiness]);

  const loadData = async () => {
    if (!currentBusiness) return;
    try {
      const [c, p, s, e, l] = await Promise.all([
        supabase.from('customers').select('*').eq('business_id', currentBusiness.id),
        supabase.from('products').select('*').eq('business_id', currentBusiness.id),
        supabase.from('sales').select('*').eq('business_id', currentBusiness.id),
        supabase.from('expenses').select('*').eq('business_id', currentBusiness.id),
        supabase.from('audit_logs').select('*').eq('business_id', currentBusiness.id).order('created_at', { ascending: false }).limit(10),
      ]);

      setData({ customers: c.data || [], products: p.data || [], sales: s.data || [], expenses: e.data || [], logs: l.data || [] });
      setStats({
        revenue: (s.data || []).reduce((sum, x) => sum + x.total_amount, 0),
        expenses: (e.data || []).reduce((sum, x) => sum + x.amount, 0),
        customers: c.data?.length || 0,
        products: p.data?.length || 0,
      });
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen text-foreground">Loading...</div>;
  if (!user) return <div className="flex items-center justify-center h-screen text-foreground">Sign in required</div>;
  if (!currentBusiness) return <div className="flex items-center justify-center h-screen text-foreground">No business assigned</div>;

  const chartData = data.sales.reduce((acc: any[], s) => {
    const date = format(new Date(s.sale_date), 'MMM dd');
    const existing = acc.find((d) => d.date === date);
    if (existing) existing.revenue += s.total_amount;
    else acc.push({ date, revenue: s.total_amount });
    return acc;
  }, []);

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="flex h-screen bg-background">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-card border-r border-border transition-all flex flex-col`}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          {sidebarOpen && <Building2 className="w-6 h-6 text-primary" />}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-muted rounded">
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {sidebarOpen && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Business</p>
              <div className="relative group">
                <button className="w-full px-3 py-2 bg-muted rounded text-sm font-medium text-foreground hover:bg-muted/80 flex items-center justify-between">
                  <span className="truncate">{currentBusiness.name}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {businesses.length > 1 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded shadow-lg hidden group-hover:block z-50">
                    {businesses.map((b) => (
                      <button key={b.id} onClick={() => switchBusiness(b.id)} className="w-full px-3 py-2 text-left text-sm hover:bg-muted">
                        {b.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2 capitalize">Role: {currentRole}</p>
            </div>

            <nav className="space-y-2">
              {['overview', 'customers', 'products', 'sales', 'expenses', 'audit', 'sync'].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full px-3 py-2 rounded text-left text-sm font-medium ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>
        )}

        <div className="p-4 border-t border-border">
          <button onClick={signOut} className="w-full px-3 py-2 bg-destructive text-destructive-foreground rounded text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2">
            <LogOut className="w-4 h-4" />
            {sidebarOpen && 'Sign Out'}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">{currentBusiness.name}</h1>

          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card p-6 rounded border border-border"><p className="text-muted-foreground text-sm">Revenue</p><p className="text-2xl font-bold text-foreground">${stats.revenue.toFixed(2)}</p></div>
                <div className="bg-card p-6 rounded border border-border"><p className="text-muted-foreground text-sm">Expenses</p><p className="text-2xl font-bold text-foreground">${stats.expenses.toFixed(2)}</p></div>
                <div className="bg-card p-6 rounded border border-border"><p className="text-muted-foreground text-sm">Customers</p><p className="text-2xl font-bold text-foreground">{stats.customers}</p></div>
                <div className="bg-card p-6 rounded border border-border"><p className="text-muted-foreground text-sm">Products</p><p className="text-2xl font-bold text-foreground">{stats.products}</p></div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card p-6 rounded border border-border">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Sales Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-card p-6 rounded border border-border">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Expense Categories</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={data.expenses.reduce((acc: any[], e) => { const ex = acc.find((d) => d.name === e.category); if (ex) ex.value += e.amount; else acc.push({ name: e.category, value: e.amount }); return acc; }, [])} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                        {data.expenses.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="bg-card rounded border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted"><tr><th className="px-4 py-3 text-left font-semibold">Name</th><th className="px-4 py-3 text-left font-semibold">Email</th><th className="px-4 py-3 text-left font-semibold">Phone</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {data.customers.map((c) => <tr key={c.id} className="hover:bg-muted"><td className="px-4 py-3">{c.name}</td><td className="px-4 py-3 text-muted-foreground">{c.email || '-'}</td><td className="px-4 py-3 text-muted-foreground">{c.phone || '-'}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="bg-card rounded border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted"><tr><th className="px-4 py-3 text-left font-semibold">Name</th><th className="px-4 py-3 text-left font-semibold">SKU</th><th className="px-4 py-3 text-left font-semibold">Category</th><th className="px-4 py-3 text-left font-semibold">Price</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {data.products.map((p) => <tr key={p.id} className="hover:bg-muted"><td className="px-4 py-3">{p.name}</td><td className="px-4 py-3 text-muted-foreground">{p.sku || '-'}</td><td className="px-4 py-3 text-muted-foreground">{p.category}</td><td className="px-4 py-3">${p.unit_price.toFixed(2)}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="bg-card rounded border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted"><tr><th className="px-4 py-3 text-left font-semibold">Date</th><th className="px-4 py-3 text-left font-semibold">Amount</th><th className="px-4 py-3 text-left font-semibold">Status</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {data.sales.map((s) => <tr key={s.id} className="hover:bg-muted"><td className="px-4 py-3">{format(new Date(s.sale_date), 'MMM dd, yyyy')}</td><td className="px-4 py-3">${s.total_amount.toFixed(2)}</td><td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${s.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{s.payment_status}</span></td></tr>)}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="bg-card rounded border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted"><tr><th className="px-4 py-3 text-left font-semibold">Category</th><th className="px-4 py-3 text-left font-semibold">Amount</th><th className="px-4 py-3 text-left font-semibold">Date</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {data.expenses.map((e) => <tr key={e.id} className="hover:bg-muted"><td className="px-4 py-3">{e.category}</td><td className="px-4 py-3">${e.amount.toFixed(2)}</td><td className="px-4 py-3">{format(new Date(e.expense_date), 'MMM dd, yyyy')}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="bg-card rounded border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted"><tr><th className="px-4 py-3 text-left font-semibold">Action</th><th className="px-4 py-3 text-left font-semibold">Entity</th><th className="px-4 py-3 text-left font-semibold">Date</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {data.logs.map((l) => <tr key={l.id} className="hover:bg-muted"><td className="px-4 py-3 uppercase text-xs font-semibold">{l.action}</td><td className="px-4 py-3 text-muted-foreground">{l.entity_type}</td><td className="px-4 py-3 text-muted-foreground">{format(new Date(l.created_at), 'MMM dd, yyyy HH:mm')}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'sync' && (
            <GoogleSheetsSync
              businessId={currentBusiness.id}
              canWrite={canAccess('write')}
              onDataSynced={loadData}
            />
          )}
        </div>
      </main>
    </div>
  );
}
