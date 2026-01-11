

export function Dashboard() {
    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">Overview</h1>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Placeholder for Dashboard widgets */}
                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-sm font-medium text-slate-500">Total Servers</h3>
                    <p className="text-2xl font-bold text-slate-900 mt-2">0</p>
                </div>
                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-sm font-medium text-slate-500">Active Connections</h3>
                    <p className="text-2xl font-bold text-slate-900 mt-2">-</p>
                </div>
                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-sm font-medium text-slate-500">Total Bandwidth</h3>
                    <p className="text-2xl font-bold text-slate-900 mt-2">-</p>
                </div>
            </div>
        </div>
    );
}
