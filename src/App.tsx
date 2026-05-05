import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import Login from "./features/auth/pages/Login"
import Signup from "./features/auth/pages/Signup"
import Pending from "./features/auth/pages/Pending"
import Dashboard from "./features/shared/pages/Dashboard"
import { Toaster } from "react-hot-toast"

import RequireActive from "./features/auth/guards/RequireActive"
import RequirePending from "./features/auth/guards/RequirePending"
import EmployeeLayout from "./layouts/EmployeeLayout"
import RequireAdmin from "./features/auth/guards/RequireAdmin"
import AdminLayout from "./layouts/AdminLayout"
import Clients from "./features/clients/components/Clients"
import ClientDetail from "./features/clients/components/ClientDetail"
import Inventory from "./features/shared/pages/Inventory"
import Settings from "./features/admin/pages/Settings"
import Schedule from "./features/shared/pages/Schedule"
import People from "./features/shared/pages/People"
import Reports from "./features/shared/pages/Reports"
import ClockIn from "./features/shared/pages/ClockIn"
import Timesheet from "./features/admin/pages/Timesheet"
import Invoices from "./features/invoices/pages/Invoices"
import Receipts from "./features/receipts/pages/Receipts"
import PurchaseRequests from "./features/purchases/pages/PurchaseRequests"
import Payroll from "./features/payroll/pages/Payroll"
import Availability from "./features/shared/pages/Availability"

// Note: Clients, ClientDetail, People, Settings remain imported because
// they are still used in the admin routes below.


function App() {

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace/>} />
          <Route path="/login" element={<Login/>}/>
          <Route path="/signup" element={<Signup/>}/>

          {/* Require Pending for protection */}
          <Route element={<RequirePending/>}>
            <Route path="/pending" element={<Pending/>}/>
          </Route>

          {/* Employee protected area */}
          <Route element={<RequireActive/>}>
            <Route element={<EmployeeLayout/>}>
              <Route path="/dashboard" element={<Dashboard/>}/>
              <Route path="/schedule" element={<Schedule/>}/>
              <Route path="/calendar" element={<Navigate to="/schedule" replace/>}/>
              <Route path="/inventory" element={<Inventory/>}/>
              <Route path="/reports" element={<Reports/>}/>
              <Route path="/clock" element={<ClockIn/>}/>
              <Route path="/receipts" element={<Receipts/>}/>
              <Route path="/purchase-requests" element={<PurchaseRequests/>}/>
              <Route path="/payroll" element={<Payroll/>}/>
              <Route path="/availability" element={<Availability/>}/>
              <Route path="/settings" element={<Settings/>}/>
              {/* Admin-only paths — redirect employees to dashboard */}
              <Route path="/clients" element={<Navigate to="/dashboard" replace/>}/>
              <Route path="/clients/:id" element={<Navigate to="/dashboard" replace/>}/>
              <Route path="/people" element={<Navigate to="/dashboard" replace/>}/>
            </Route>
          </Route>

          {/* Admin protected area */}
          <Route element={<RequireAdmin/>}>
            <Route element={<AdminLayout/>}>
              <Route path="/admin/dashboard" element={<Dashboard/>}/>
              <Route path="/admin/schedule" element={<Schedule/>}/>
              <Route path="/admin/calendar" element={<Navigate to="/admin/schedule" replace/>}/>
              <Route path="/admin/people" element={<People/>}/>
              <Route path="/admin/clients" element={<Clients/>}/>
              <Route path="/admin/clients/:id" element={<ClientDetail/>}/>
              <Route path="/admin/inventory" element={<Inventory/>}/>
              <Route path="/admin/reports" element={<Reports/>}/>
              <Route path="/admin/timesheet" element={<Timesheet/>}/>
              <Route path="/admin/invoices" element={<Invoices/>}/>
              <Route path="/admin/receipts" element={<Receipts/>}/>
              <Route path="/admin/purchase-requests" element={<PurchaseRequests/>}/>
              <Route path="/admin/payroll" element={<Payroll/>}/>
              <Route path="/admin/availability" element={<Availability/>}/>
              <Route path="/admin/settings" element={<Settings/>}/>
            </Route>
          </Route>

          <Route path="*" element={<div className="p-6">404</div>}/>
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
        }}
      />
    </>
  )
}

export default App
