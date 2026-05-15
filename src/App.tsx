import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { ServerProvider } from "./context/ServerContext";
import { DataProvider } from "./context/DataContext";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeProvider } from "./context/ThemeContext";

// Lazy load pages
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Servers = lazy(() => import("./pages/Servers").then(m => ({ default: m.Servers })));
const Customers = lazy(() => import("./pages/Customers").then(m => ({ default: m.Customers })));
const Profiles = lazy(() => import("./pages/Profiles").then(m => ({ default: m.Profiles })));
const IpPools = lazy(() => import("./pages/IpPools").then(m => ({ default: m.IpPools })));
const DamageTypes = lazy(() => import("./pages/DamageTypes").then(m => ({ default: m.DamageTypes })));
const SubAreas = lazy(() => import("./pages/SubAreas").then(m => ({ default: m.SubAreas })));
const SupportTickets = lazy(() => import("./pages/SupportTickets").then(m => ({ default: m.SupportTickets })));
const Registration = lazy(() => import("./pages/Registration").then(m => ({ default: m.Registration })));
const WorkingOrder = lazy(() => import("./pages/WorkingOrder").then(m => ({ default: m.WorkingOrder })));
const Employees = lazy(() => import("./pages/Employees").then(m => ({ default: m.Employees })));
const JobTitles = lazy(() => import("./pages/JobTitles").then(m => ({ default: m.JobTitles })));
const PaymentMethods = lazy(() => import("./pages/PaymentMethods").then(m => ({ default: m.PaymentMethods })));
const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const Settings = lazy(() => import("./pages/Settings").then(m => ({ default: m.Settings })));
const ActivityLogs = lazy(() => import("./pages/ActivityLogs").then(m => ({ default: m.ActivityLogs })));
const Monitoring = lazy(() => import("./pages/Monitoring").then(m => ({ default: m.Monitoring })));
const Finance = lazy(() => import("./pages/Finance").then(m => ({ default: m.Finance })));
const RemoteDevices = lazy(() => import("./pages/RemoteDevices").then(m => ({ default: m.RemoteDevices })));
const ChangeOnu = lazy(() => import("./pages/ChangeOnu").then(m => ({ default: m.ChangeOnu })));
const MikrotikBackup = lazy(() => import("./pages/MikrotikBackup").then(m => ({ default: m.MikrotikBackup })));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy").then(m => ({ default: m.PrivacyPolicy })));


const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-500 font-medium animate-pulse">Loading component...</p>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <ServerProvider>
          <DataProvider>
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />


                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/servers" element={<Servers />} />
                      <Route path="/monitoring" element={<Monitoring />} />
                      <Route path="/customers" element={<Customers />} />
                      <Route path="/registration/active" element={<Registration view="active" />} />
                      <Route path="/registration/completed" element={<Registration view="completed" />} />
                      <Route path="/working-order/progress" element={<WorkingOrder view="progress" />} />
                      <Route path="/working-order/completed" element={<WorkingOrder view="completed" />} />
                      <Route path="/employees" element={<Employees />} />
                      <Route path="/master/profiles" element={<Profiles />} />
                      <Route path="/master/ip-pools" element={<IpPools />} />
                      <Route path="/master/damage-types" element={<DamageTypes />} />
                      <Route path="/tickets" element={<SupportTickets />} />
                      <Route path="/master/job-titles" element={<JobTitles />} />
                      <Route path="/master/payment-methods" element={<PaymentMethods />} />
                      <Route path="/master/sub-areas" element={<SubAreas />} />
                      <Route path="/logs" element={<ActivityLogs />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/finance" element={<Finance />} />
                      <Route path="/remote-devices" element={<RemoteDevices />} />
                      <Route path="/maintenance/change-onu" element={<ChangeOnu />} />
                      <Route path="/device/backup" element={<MikrotikBackup />} />
                    </Route>
                  </Route>

                </Routes>
              </Suspense>
            </BrowserRouter>

          </DataProvider>
        </ServerProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
