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
import AdminUsers from "./features/admin/pages/AdminUsers"
import Clients from "./features/clients/components/Clients"
import Inventory from "./features/shared/pages/Inventory"
import Settings from "./features/admin/pages/Settings"
import Schedule from "./features/shared/pages/Schedule"
import Calendar from "./features/shared/pages/Calendar"
import Employees from "./features/admin/pages/Employees"
import Reports from "./features/shared/pages/Reports"


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
              <Route path="/calendar" element={<Calendar/>}/>
              <Route path="/clients" element={<Clients/>}/>
              <Route path="/inventory" element={<Inventory/>}/>
              <Route path="/reports" element={<Reports/>}/>
              <Route path="/employees" element={<Employees/>}/>
              <Route path="/settings" element={<Settings/>}/>
            </Route>     
          </Route>

          {/* Admin protected area */}
          <Route element={<RequireAdmin/>}>
            <Route element={<AdminLayout/>}>
              <Route path="/admin/dashboard" element={<Dashboard/>}/>
              <Route path="/admin/schedule" element={<Schedule/>}/>
              <Route path="/admin/calendar" element={<Calendar/>}/>
              <Route path="/admin/users" element={<AdminUsers/>} />
              <Route path="/admin/clients" element={<Clients/>}/>
              <Route path="/admin/inventory" element={<Inventory/>}/>
              <Route path="/admin/reports" element={<Reports/>}/>
              <Route path="/admin/employees" element={<Employees/>}/>
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
